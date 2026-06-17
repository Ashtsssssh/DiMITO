import os
import time
from datetime import datetime
from ..db.models import Edge, RoutingEntry


ALPHA         = 0.2   # EMA weight for cost updates (0 = never update, 1 = no smoothing)
MAX_INFLATION = 1.5   # Reject route updates that inflate cost beyond this ratio

MAX_QUEUE_M = 80.0
MAX_DENSITY = 1.0


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


def run_routing_dv_iteration() -> int:
    """
    Single iteration of distance-vector update.
    Call repeatedly until return value is 0 (converged).
    """
    print("\n" + "=" * 80)
    print("  DV UPDATE RUNNING (traffic-only routing)...")
    print("=" * 80)

    edges = Edge.objects(is_active=True)
    print(f"Total active edges: {edges.count()}")

    # Collect all nodes
    all_nodes = set()
    for edge in edges:
        all_nodes.add(edge.in_node_id)
        all_nodes.add(edge.out_node_id)

    print(f"Total nodes: {len(all_nodes)} - {sorted(all_nodes)}")

    # ----------------------------
    # PHASE 0: Self-routes (zero-cost, added once)
    # ----------------------------
    print("\n[PHASE 0] Adding self-routes...")
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

    print(f"  + Self-routes added: {self_routes_added}")

    # ----------------------------
    # PHASE 1: Bootstrap direct-edge routes
    # ----------------------------
    print("\n[PHASE 1] Bootstrapping routes from edges...")
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
            entry.cost         = (1 - ALPHA) * entry.cost + ALPHA * cost_AB
            entry.last_updated = datetime.now()
            entry.save()
            bootstrap_updated += 1
        else:
            RoutingEntry(
                from_node_id=A,
                destination_node_id=B,
                next_hop_node_id=B,
                cost=cost_AB
            ).save()
            bootstrap_created += 1

    print(f"  + Routes created: {bootstrap_created}, updated: {bootstrap_updated}")

    # ----------------------------
    # PHASE 2: DV propagation (single iteration)
    # ----------------------------
    print("\n[PHASE 2] DV propagation...")

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
                # Reject runaway cost inflation
                if new_cost > entry.cost * MAX_INFLATION:
                    continue

                entry.cost         = (1 - ALPHA) * entry.cost + ALPHA * new_cost
                entry.last_updated = datetime.now()
                entry.save()
                changes += 1

            else:
                # Only create if competitive against the current best path
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
    print(f"  + Routes changed this iteration: {changes}")
    print(f"  + Total routing entries in DB:   {total}")

    print("\n[SUMMARY] Routing tables by node:")
    for node in sorted(all_nodes):
        routes = RoutingEntry.objects(from_node_id=node)
        dests  = set(r.destination_node_id for r in routes)
        print(f"  {node}: {len(dests)} destinations")
        for dest in sorted(dests):
            dest_routes = RoutingEntry.objects(from_node_id=node, destination_node_id=dest)
            best_cost   = min(r.cost for r in dest_routes)
            print(f"    -> {dest}: {dest_routes.count()} paths, best cost: {best_cost:.4f}s")

    print("=" * 80 + "\n")
    return changes  # 0 = converged