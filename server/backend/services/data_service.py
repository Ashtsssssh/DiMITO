from datetime import datetime
import time
import random
import math

from server.mongo import connect_mongo
from backend.db.models import Node, Edge
from backend.db.models import RoutingEntry




# Ensure MongoDB connection is established when this module is imported
connect_mongo()


def create_node(node_id: str, name: str, location: dict = None,
                cycle_time: int = None, is_active: bool = True):
	"""Create and save a Node.

	Args:
		node_id: unique node identifier
		name: human-friendly name
		location: dict with lat/lng
		cycle_time: total green cycle in seconds; None → auto-calculated
		is_active: whether node is active

	Returns:
		The saved `Node` document.
	"""
	location = location or {}
	node = Node(
		node_id=node_id,
		name=name,
		location=location,
		cycle_time=cycle_time,
		is_active=is_active,
		created_at=datetime.now(),
		updated_at=datetime.now(),
	)
	node.save()
	return node

def delete_node(node_id: str) -> bool:
    """Delete a Node and cascade-delete all related Edges and RoutingEntries.

    Because Edge/RoutingEntry use plain string IDs (not MongoEngine
    ReferenceFields), there is no DB-level cascade. We do it explicitly here.

    Deleted:
      - The Node itself
      - All Edge docs where in_node_id OR out_node_id == node_id
      - All RoutingEntry docs where from_node_id, destination_node_id,
        OR next_hop_node_id == node_id
    """
    node = Node.objects(node_id=node_id).first()
    if not node:
        return False

    # --- Cascade: edges ---
    edges_deleted = Edge.objects(in_node_id=node_id).delete()
    edges_deleted += Edge.objects(out_node_id=node_id).delete()

    # --- Cascade: routing entries ---
    re_deleted = RoutingEntry.objects(from_node_id=node_id).delete()
    re_deleted += RoutingEntry.objects(destination_node_id=node_id).delete()
    re_deleted += RoutingEntry.objects(next_hop_node_id=node_id).delete()

    node.delete()

    print(f"[delete_node] Deleted node {node_id} + "
          f"{edges_deleted} edge(s) + {re_deleted} routing entry/entries")
    return True


def update_node(
    node_id: str,
    name: str = None,
    location: dict = None,
    cycle_time: int = None,
    is_active: bool = None
):
    node = Node.objects(node_id=node_id).first()
    if not node:
        return None

    if name is not None:
        node.name = name

    if location is not None:
        node.location = location

    if cycle_time is not None:
        # pass 0 or null from client to clear → auto-calculate
        node.cycle_time = cycle_time if cycle_time > 0 else None

    if is_active is not None:
        node.is_active = is_active

    node.updated_at = datetime.now()
    node.save()
    return node

def list_all_nodes():
    nodes = list(Node.objects.all())
    print(f"[DEBUG] list_all_nodes() found {len(nodes)} nodes")
    for n in nodes:
        print(f"  - {n.node_id}: {n.name}")
    return nodes



def create_edge(edge_id: str, name: str, in_node_id: str, out_node_id: str,
			 camera_id: str, road_length_m: float, road_width_m: float,
			 num_lanes: int = 1, is_active: bool = True):
	"""Create and save an Edge.

	Returns the saved `Edge` document.
	"""
	edge = Edge(
		edge_id=edge_id,
		name=name,
		in_node_id=in_node_id,
		out_node_id=out_node_id,
		camera_id=camera_id,
		road_length_m=road_length_m,
		road_width_m=road_width_m,
		num_lanes=num_lanes,
		is_active=is_active,
		created_at=datetime.now(),
	)
	edge.save()
	return edge

def delete_edge(edge_id: str) -> bool:
    """Delete an Edge by its ID.
    
    Returns:
        True if deleted, False if not found.
    """
    edge = Edge.objects(edge_id=edge_id).first()
    if not edge:
        return False

    edge.delete()
    return True

def update_edge(
    edge_id: str,
    name: str = None,
    in_node_id: str = None,
    out_node_id: str = None,
    camera_id: str = None,
    road_length_m: float = None,
    road_width_m: float = None,
    num_lanes: int = None,
    is_active: bool = None
):
    """Update an existing Edge. Only provided (non-None) fields are updated.
    
    Returns:
        The updated `Edge` document, or None if not found.
    """
    edge = Edge.objects(edge_id=edge_id).first()
    if not edge:
        return None

    if name is not None:
        edge.name = name

    if in_node_id is not None:
        edge.in_node_id = in_node_id
        
    if out_node_id is not None:
        edge.out_node_id = out_node_id

    if camera_id is not None:
        edge.camera_id = camera_id

    if road_length_m is not None:
        edge.road_length_m = road_length_m
        
    if road_width_m is not None:
        edge.road_width_m = road_width_m

    if num_lanes is not None:
        edge.num_lanes = num_lanes

    if is_active is not None:
        edge.is_active = is_active

    edge.save()
    return edge

def list_all_edges():
    """Retrieve all Edge documents."""
    return list(Edge.objects.all())



def get_edges_for_node(node_id: str):
	"""Return all edges connected to `node_id` (incoming and outgoing)."""
	incoming = list(Edge.objects(in_node_id=node_id))
	outgoing = list(Edge.objects(out_node_id=node_id))
	return {
		"incoming": incoming,
		"outgoing": outgoing
	}



def _apply_traffic_update(edge, updates: dict):
	"""Internal: merge updates into edge.outgoing_traffic and save timestamp."""
	data = edge.outgoing_traffic or {}
	for k, v in updates.items():
		data[k] = v
	edge.outgoing_traffic = data
	edge.save()
	return edge


def update_traffic_by_node(node_id: str, edge_id: str, updates: dict):
    """
    Update outgoing_traffic for an edge from its controlling node.
    node_id must be the out_node_id of the edge (the signal-controlling node).
    """
    edge = Edge.objects.get(edge_id=edge_id)

    if edge.out_node_id == node_id:
        return _apply_traffic_update(edge, updates)

    raise ValueError(
        f"Node {node_id} is not the controlling (out) node of edge {edge_id}"
    )


def create_routing_entry(from_node, dest_node, next_hop, cost):
    entry = RoutingEntry(
        from_node_id=from_node,
        destination_node_id=dest_node,
        next_hop_node_id=next_hop,
        cost=float(cost),
        last_updated=datetime.now()
    )
    entry.save()
    return entry


def seed_all_traffic():
    """
    Fill in realistic but varying traffic data for all edges in the system.
    Useful for testing/seeding purposes.

    Generates per edge:
    - total_vehicles: 5-100+, scaled by time-of-day rush-hour multiplier
    - queue_length_m: capped at MAX_QUEUE_M (80m) so Qn is spread [0, 1]
      rather than clamping everything heavy to Qn=1.0
    - density: [0, 1] proportional to vehicle count
    - last_green_ts: staggered randomly over the past MAX_CYCLE_TIME seconds
      so edges appear at different points in their natural cycle instead of
      all having Wn=0 (which zeros out the wait-pressure component immediately
      after seeding and flattens green-time differentiation)
    """

    now = int(time.time())

    # Get current hour for rush hour simulation
    from datetime import datetime as dt
    current_hour = dt.now().hour

    # Rush hour multiplier (8-9am, 5-7pm)
    if (8 <= current_hour < 10) or (17 <= current_hour < 19):
        multiplier = random.uniform(2.5, 3.5)   # Heavy traffic
    elif (10 <= current_hour < 17) or (19 <= current_hour < 22):
        multiplier = random.uniform(1.2, 1.8)   # Moderate traffic
    else:
        multiplier = random.uniform(0.3, 0.8)   # Light traffic

    # Match the normalisation ceiling used by green_time_service so seeded
    # values produce a useful spread across [0, 1] after Qn = q / MAX_QUEUE_M.
    MAX_QUEUE_M = 80.0   # mirrors green_time_service.MAX_QUEUE_M
    MAX_CYCLE_S = 180    # mirrors green_time_service.MAX_CYCLE_TIME

    # Fetch all active edges
    edges = list(Edge.objects(is_active=True))

    if not edges:
        print("⚠️ No active edges found in database")
        return {"updated": 0, "total": 0}

    updated_count = 0

    for edge in edges:
        try:
            # Base traffic level per edge (varies edge-to-edge)
            base_vehicles = random.uniform(10, 30)
            noise = random.uniform(-0.2, 0.3)
            total_vehicles = max(5, int(base_vehicles * multiplier * (1 + noise)))

            # Cap queue so Qn = queue/80 is well within [0, 1].
            # Old formula (vehicles * 3-8m) could reach 840m → Qn clamps to
            # 1.0 for all busy edges, flattening green-time differentiation.
            queue_fraction = min(1.0, (total_vehicles / 100.0) * random.uniform(0.4, 1.0))
            queue_length_m = round(queue_fraction * MAX_QUEUE_M, 1)

            density = min(1.0, (total_vehicles / 150.0) * random.uniform(0.6, 1.2))

            # Stagger last_green_ts randomly over the last MAX_CYCLE_S seconds.
            # All edges at last_green_ts=now → Wn=0 for everyone → the wait
            # component contributes nothing to pressure/demand, which makes every
            # green phase identical regardless of how long an edge has been waiting.
            elapsed_since_green = random.uniform(0, MAX_CYCLE_S)
            last_green_ts = now - int(elapsed_since_green)

            traffic_updates = {
                'total_vehicles': total_vehicles,
                'queue_length_m': queue_length_m,
                'density': round(density, 3),
                'last_green_ts': last_green_ts,
            }

            # Apply updates to outgoing_traffic
            _apply_traffic_update(edge, traffic_updates)
            updated_count += 1

        except Exception as e:
            print(f"❌ Error updating edge {edge.edge_id}: {str(e)}")
            continue

    print(f"✅ Updated traffic for {updated_count}/{len(edges)} edges")
    print(f"   Multiplier: {multiplier:.2f}x (Hour: {current_hour})")

    return {
        "updated": updated_count,
        "total": len(edges),
        "multiplier": round(multiplier, 2),
        "timestamp": now
    }