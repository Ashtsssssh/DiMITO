import time

from backend.db.models import Edge, Node
from backend.services.green_time_service import compute_green_times


def get_signal_phase(node_id: str) -> dict | None:
    """
    Compute the current signal phase for *node_id*.

    Returns a dict:
        {
            "node_id":        str,
            "current_green":  str   (edge_id that currently has green),
            "remaining_time": int   (seconds left in that phase),
            "phases":         list  [{"edge": eid, "green": seconds}, ...],
            "server_time":    int   (unix ts)
        }

    Returns None if the node has no active outgoing edges.
    """
    now = int(time.time())

    edges = list(Edge.objects(out_node_id=node_id, is_active=True))
    if not edges:
        return None

    # Build traffic states for green-time computation
    states = []
    for e in edges:
        st = e.outgoing_traffic.copy()
        st["edge_id"] = e.edge_id
        states.append(st)

    # Use node's stored cycle_time if set, else auto-calculate
    node_obj = Node.objects(node_id=node_id).first()
    node_cycle_time = node_obj.cycle_time if node_obj else None
    green_times = compute_green_times(states, cycle_time=node_cycle_time)

    # Stable queue order (sorted by edge_id)
    queue = sorted(green_times.keys())
    durations = [green_times[eid] for eid in queue]
    cycle_total = sum(durations)

    # Anchor: the most recent phase-transition timestamp
    anchor_edge = max(
        edges,
        key=lambda e: e.outgoing_traffic.get("last_green_ts", 0),
    )
    anchor_ts = anchor_edge.outgoing_traffic.get("last_green_ts", 0)
    anchor_idx = (
        queue.index(anchor_edge.edge_id)
        if anchor_edge.edge_id in queue
        else 0
    )

    # Elapsed time since that anchor phase started
    elapsed = now - anchor_ts
    elapsed = elapsed % cycle_total if cycle_total > 0 else 0

    # Walk the queue starting from the anchor
    n = len(queue)
    idx = anchor_idx
    for _ in range(n):
        d = durations[idx]
        if elapsed < d:
            break
        elapsed -= d
        idx = (idx + 1) % n

    current_green_edge = queue[idx]
    remaining = max(0, int(durations[idx] - elapsed))

    return {
        "node_id": node_id,
        "current_green": current_green_edge,
        "remaining_time": remaining,
        "phases": [
            {"edge": eid, "green": green_times[eid]}
            for eid in queue
        ],
        "server_time": now,
    }
