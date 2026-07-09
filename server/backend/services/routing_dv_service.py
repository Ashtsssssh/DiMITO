import os
import time
from datetime import datetime
from ..db.models import Edge, RoutingEntry
from backend.algo_config import cfg


ALPHA         = cfg.DV_EMA_ALPHA
MAX_INFLATION = cfg.DV_MAX_INFLATION

MAX_QUEUE_M = cfg.TRAFFIC_MAX_QUEUE_M
MAX_DENSITY = cfg.TRAFFIC_MAX_DENSITY


def compute_traffic_cost(edge: Edge) -> float:
    """
    Cost in seconds to traverse this edge under current traffic.

    Formula:
        free_flow_time  = road_length_m / effective_speed
        effective_speed = speed_limit_ms / (1 + grade_pct * 0.02)
        lane_adj_Qn     = Qn / num_lanes          # more lanes = less per-lane pressure
        congestion_mult = 1 + 2.5 * lane_adj_Qn^2 + 0.8 * Dn
        cost            = free_flow_time * congestion_mult + turn_penalty_s
    """
    t = edge.outgoing_traffic or {}

    Qm = t.get("queue_length_m", 0.0)
    D  = t.get("density", 0.0)

    Qn = min(Qm / MAX_QUEUE_M, 1.0)
    Dn = min(D  / MAX_DENSITY, 1.0)

    # Grade penalty: each 1% uphill grade costs ~2% of free-flow speed
    grade_factor    = 1.0 + max(edge.grade_pct, 0.0) * 0.02
    effective_speed = edge.speed_limit_ms / grade_factor

    free_flow_time = edge.road_length_m / effective_speed

    # Multi-lane edges: queue normalised per lane.
    # A 3-lane road with the same raw queue as a 1-lane road is far less congested.
    lane_adjusted_Qn = Qn / max(edge.num_lanes, 1)

    congestion_mult = 1.0 + 2.5 * (lane_adjusted_Qn ** 2) + 0.8 * Dn

    return free_flow_time * congestion_mult + edge.turn_penalty_s


def _update_cost(entry, new_cost: float) -> bool:
    """
    Update entry.cost using an asymmetric rule and return True if the cost
    changed meaningfully (beyond CONVERGE_EPSILON).

    Asymmetric update rule — standard Bellman-Ford for improvements + EMA for
    increases:

    - If new_cost < stored cost (IMPROVEMENT): always accept immediately.
    - If new_cost > stored cost (INCREASE): apply EMA + inflation guard.
    """
    # Read live from cfg so .env changes take effect on server restart
    alpha         = cfg.DV_EMA_ALPHA
    max_inflation = cfg.DV_MAX_INFLATION
    epsilon       = cfg.DV_CONVERGE_EPSILON

    old = entry.cost

    if new_cost < old:
        # Improvement: always blend toward the lower value (fast recovery from stale data)
        entry.cost = (1 - alpha) * old + alpha * new_cost
    else:
        # Increase: reject if it would inflate cost beyond the guard ratio
        if new_cost > old * max_inflation:
            return False
        entry.cost = (1 - alpha) * old + alpha * new_cost

    # Only report as a "real" change if cost shifted by more than EPSILON
    relative_shift = abs(entry.cost - old) / max(old, 1e-9)
    return relative_shift > epsilon


def run_routing_dv_iteration(verbose: bool = True) -> int:
    """
    Single iteration of distance-vector update.
    Call repeatedly until return value is 0 (converged).

    `verbose=False` is used by the automatic background loop (apps.py) so it
    doesn't flood the console every cycle; the manual /api/routing/dv-update-test/
    endpoint still calls this with the default verbose=True for debugging.
    """
    def log(*args, **kwargs):
        if verbose:
            print(*args, **kwargs)

    log("\n" + "=" * 80)
    log("  DV UPDATE RUNNING (traffic-only routing)...")
    log("=" * 80)

    edges = Edge.objects(is_active=True)
    log(f"Total active edges: {edges.count()}")

    # Collect all nodes
    all_nodes = set()
    for edge in edges:
        all_nodes.add(edge.in_node_id)
        all_nodes.add(edge.out_node_id)

    log(f"Total nodes: {len(all_nodes)} - {sorted(all_nodes)}")

    # ----------------------------
    # PHASE 0: Self-routes (zero-cost, added once)
    # ----------------------------
    log("\n[PHASE 0] Adding self-routes...")
    self_routes_added = 0
    for node in all_nodes:
        exists = RoutingEntry.objects(
            from_node_id=node,
            destination_node_id=node,
            next_hop_node_id=node
        ).first()

        if not exists:
            RoutingEntry(
                from_node_id=node,
                destination_node_id=node,
                next_hop_node_id=node,
                cost=0.0
            ).save()
            self_routes_added += 1

    log(f"  + Self-routes added: {self_routes_added}")

    # ----------------------------
    # PHASE 1: Bootstrap direct-edge routes
    # ----------------------------
    log("\n[PHASE 1] Bootstrapping routes from edges...")
    bootstrap_created = 0
    bootstrap_updated = 0

    for edge in edges:
        A       = edge.in_node_id
        B       = edge.out_node_id
        cost_AB = compute_traffic_cost(edge)

        entry = RoutingEntry.objects(
            from_node_id=A,
            destination_node_id=B,
            next_hop_node_id=B
        ).first()

        if entry:
            changed = _update_cost(entry, cost_AB)
            entry.last_updated = datetime.now()
            entry.save()
            if changed:
                bootstrap_updated += 1
        else:
            RoutingEntry(
                from_node_id=A,
                destination_node_id=B,
                next_hop_node_id=B,
                cost=cost_AB
            ).save()
            bootstrap_created += 1

    log(f"  + Routes created: {bootstrap_created}, updated: {bootstrap_updated}")

    # ----------------------------
    # PHASE 2: DV propagation (single iteration)
    # ----------------------------
    log("\n[PHASE 2] DV propagation...")

    changes   = 0
    processed = set()  # guard against processing the same (A, D, B) triple twice

    for edge in edges:
        A       = edge.in_node_id
        B       = edge.out_node_id
        cost_AB = compute_traffic_cost(edge)

        routes_from_B = RoutingEntry.objects(from_node_id=B)

        for r in routes_from_B:
            D = r.destination_node_id

            if D == A:          # never route back to source
                continue

            new_cost  = cost_AB + r.cost
            route_key = (A, D, B)

            if route_key in processed:
                continue
            processed.add(route_key)

            entry = RoutingEntry.objects(
                from_node_id=A,
                destination_node_id=D,
                next_hop_node_id=B
            ).first()

            if entry:
                changed = _update_cost(entry, new_cost)
                if changed:
                    entry.last_updated = datetime.now()
                    entry.save()
                    changes += 1

            else:
                # Only create if competitive against the current best path.
                # Compare against the best-known path's cost (not MAX_INFLATION
                # relative to itself, since that best may also be stale/inflated).
                best_existing = RoutingEntry.objects(
                    from_node_id=A,
                    destination_node_id=D
                ).order_by('cost').first()

                if best_existing and new_cost > best_existing.cost * MAX_INFLATION:
                    continue

                RoutingEntry(
                    from_node_id=A,
                    destination_node_id=D,
                    next_hop_node_id=B,
                    cost=new_cost
                ).save()
                changes += 1

    # Summary
    total = RoutingEntry.objects().count()
    log(f"  + Routes changed this iteration: {changes}")
    log(f"  + Total routing entries in DB:   {total}")

    log("\n[SUMMARY] Routing tables by node:")
    for node in sorted(all_nodes):
        routes = RoutingEntry.objects(from_node_id=node)
        dests  = set(r.destination_node_id for r in routes)
        log(f"  {node}: {len(dests)} destinations")
        for dest in sorted(dests):
            dest_routes = RoutingEntry.objects(from_node_id=node, destination_node_id=dest)
            best_cost   = min(r.cost for r in dest_routes)
            log(f"    -> {dest}: {dest_routes.count()} paths, best cost: {best_cost:.4f}s")

    log("=" * 80 + "\n")
    return changes  # 0 = converged