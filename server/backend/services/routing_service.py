from collections import defaultdict
import math
import time

from ..db.models import RoutingEntry


BETA = 0.02          # randomness control (lower = more uniform distribution)
MAX_COST_RATIO = 3.3


def build_routing_table_for_node(node_id: str):
    """
    Build probabilistic routing table using Tiered Fair Distribution.
    
    Three tiers:
    - Tier 1 (Excellent): rel_cost 0-1.0    → Linear gentle penalty (2% per 0.1 units)
    - Tier 2 (Good): rel_cost 1.0-3.0       → Exponential moderate penalty
    - Tier 3 (Acceptable): rel_cost > 3.0   → Exponential harsh penalty
    
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

        # filter near-optimal paths
        filtered = [
            (nh, cost)
            for nh, cost in options
            if cost <= MAX_COST_RATIO * best_cost
        ]

        # Tiered Fair Distribution: compute weights based on cost tiers
        # ENFORCED CONTINUITY at tier boundaries for mathematical correctness
        weighted_list = []
        
        for nh, cost in filtered:
            rel_cost = cost - best_cost
            
            # Tier 1: Excellent paths (0 ≤ rel_cost ≤ 1.0)
            # Linear decay from 1.0 to 0.8 (2% penalty per 0.1 cost units)
            if rel_cost <= 1.0:
                weight = 1.0 - (rel_cost / 1.0) * 0.2
                tier = "excellent"
            
            # Tier 2: Good paths (1.0 < rel_cost ≤ 3.0)
            # Continuous exponential from 0.8 at rel_cost=1.0
            # w = 0.8 * exp(-0.05 * (rel_cost - 1.0))
            # At rel_cost=1.0: w = 0.8 * exp(0) = 0.8 ✓
            # At rel_cost=3.0: w = 0.8 * exp(-0.1) ≈ 0.724 ✓
            elif rel_cost <= 3.0:
                weight = 0.8 * math.exp(-0.05 * (rel_cost - 1.0))
                tier = "good"
            
            # Tier 3: Acceptable paths (rel_cost > 3.0)
            # Continuous exponential from ~0.724 at rel_cost=3.0
            # w = 0.724 * exp(-0.15 * (rel_cost - 3.0))
            # Using 0.8 * exp(-0.1) = 0.72255... for mathematical precision
            else:
                weight = 0.8 * math.exp(-0.1) * math.exp(-0.15 * (rel_cost - 3.0))
                tier = "acceptable"
            
            weighted_list.append((nh, weight, tier))
        
        # Normalize to probabilities
        Z = sum(w for _, w, _ in weighted_list)
        
        routing_table[dest] = [
            {
                "next_hop": nh,
                "prob": round(w / Z, 4)
            }
            for nh, w, _ in weighted_list
        ]

    return routing_table
