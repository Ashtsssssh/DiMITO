from collections import defaultdict
import math
import time

from ..db.models import RoutingEntry


BETA = 0.08          # randomness control
MAX_COST_RATIO = 3.3


def build_routing_table_for_node(node_id: str):
    """
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

        # cost -> probability
        weights = [
            (nh, math.exp(-BETA * cost))
            for nh, cost in filtered
        ]

        Z = sum(w for _, w in weights)

        routing_table[dest] = [
            {
                "next_hop": nh,
                "prob": round(w / Z, 4)
            }
            for nh, w in weights
        ]

    return routing_table
