from collections import defaultdict
import math
import time

from ..db.models import RoutingEntry
from backend.algo_config import cfg


# MAX_COST_RATIO: paths with cost > best_cost * MAX_COST_RATIO are not considered
MAX_COST_RATIO = cfg.ROUTING_MAX_COST_RATIO

# MIN_BEST_COST: floor for best_cost when normalising rel_cost to a ratio.
MIN_BEST_COST = cfg.ROUTING_MIN_BEST_COST


def build_routing_table_for_node(node_id: str):
    """
    Build probabilistic routing table using Tiered Fair Distribution.

    rel_cost_ratio = (cost - best_cost) / max(best_cost, MIN_BEST_COST)

    Tiers (based on rel_cost_ratio, i.e. fractional cost overhead):
    - Tier 1 (Excellent): ratio  0 – TIER1_THRESHOLD  → linear decay  1.0 → 0.8
    - Tier 2 (Good):      ratio  TIER1–TIER2           → exponential moderate penalty
    - Tier 3 (Acceptable):ratio  > TIER2               → exponential harsh penalty

    Only paths within MAX_COST_RATIO × best_cost are considered at all.

    Returns:
    {
      destination: [
        {"next_hop": X, "prob": P},
        ...
      ]
    }
    """

    routes = RoutingEntry.objects(from_node_id=node_id)

    temp = defaultdict(list)

    # Collect costs
    for r in routes:
        temp[r.destination_node_id].append(
            (r.next_hop_node_id, r.cost)
        )

    routing_table = {}

    for dest, options in temp.items():
        best_cost = min(cost for _, cost in options)

        # Read tier params fresh from cfg (reflects any .env edits after restart)
        max_cost_ratio     = cfg.ROUTING_MAX_COST_RATIO
        min_best_cost      = cfg.ROUTING_MIN_BEST_COST
        tier1_threshold    = cfg.ROUTING_TIER1_THRESHOLD
        tier2_threshold    = cfg.ROUTING_TIER2_THRESHOLD
        tier1_decay        = cfg.ROUTING_TIER1_DECAY
        tier2_exp_rate     = cfg.ROUTING_TIER2_EXP_RATE
        tier3_exp_rate     = cfg.ROUTING_TIER3_EXP_RATE

        # Filter paths that are too much worse than the best known path.
        filtered = [
            (nh, cost)
            for nh, cost in options
            if cost <= max_cost_ratio * best_cost
        ]

        norm_base = max(best_cost, min_best_cost)

        weighted_list = []

        for nh, cost in filtered:
            rel = (cost - best_cost) / norm_base

            if rel <= tier1_threshold:
                weight = 1.0 - (rel / tier1_threshold) * tier1_decay
                tier = "excellent"

            elif rel <= tier2_threshold:
                weight = (1.0 - tier1_decay) * math.exp(
                    -tier2_exp_rate * (rel - tier1_threshold)
                )
                tier = "good"

            else:
                boundary_weight = (1.0 - tier1_decay) * math.exp(
                    -tier2_exp_rate * (tier2_threshold - tier1_threshold)
                )
                weight = boundary_weight * math.exp(-tier3_exp_rate * (rel - tier2_threshold))
                tier = "acceptable"

            weighted_list.append((nh, weight, tier))

        Z = sum(w for _, w, _ in weighted_list)

        routing_table[dest] = [
            {
                "next_hop": nh,
                "prob": round(w / Z, 4)
            }
            for nh, w, _ in weighted_list
        ]

    return routing_table
