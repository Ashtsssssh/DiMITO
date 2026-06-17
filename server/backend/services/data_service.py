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
    node = Node.objects(node_id=node_id).first()
    if not node:
        return False

    node.delete()
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
			 is_active: bool = True):
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
    is_active: bool = None
):
    """Update an existing Edge. Only provided fields are updated.
    
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

    if is_active is not None:
        edge.is_active = is_active

    # Assuming Edge model has an updated_at field like Node
    edge.updated_at = datetime.now()
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



def _apply_traffic_update(edge, field: str, updates: dict):
	"""Internal: merge updates into edge.{field} and save timestamp."""
	assert field in ("incoming_traffic", "outgoing_traffic")
	data = getattr(edge, field) or {}
	# Merge numeric fields; replace others
	for k, v in updates.items():
		data[k] = v

	data["last_update_ts"] = int(time.time())
	setattr(edge, field, data)
	edge.save()
	return edge


def update_traffic_by_node(node_id: str, edge_id: str, updates: dict):
    """
    Generic traffic update function.

    - If node_id == out_node_id  → updates outgoing_traffic
    - If node_id == in_node_id   → updates incoming_traffic
    """

    edge = Edge.objects.get(edge_id=edge_id)

    if edge.out_node_id == node_id:
        return _apply_traffic_update(edge, "outgoing_traffic", updates)

    if edge.in_node_id == node_id:
        return _apply_traffic_update(edge, "incoming_traffic", updates)

    raise ValueError(
        f"Node {node_id} is not connected to edge {edge_id}"
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
    
    Generates:
    - total_vehicles: varies from 5-100 with time-based multipliers (rush hours 2-3.5x)
    - queue_length_m: proportional to vehicle count (50-500m)
    - pressure: traffic pressure 0-1
    - density: traffic density 0-1
    - last_green_ts: current timestamp for remaining time calculations
    """
    
    now = int(time.time())
    
    # Get current hour for rush hour simulation
    from datetime import datetime as dt
    current_hour = dt.now().hour
    
    # Rush hour multiplier (8-9am, 5-7pm)
    if (8 <= current_hour < 10) or (17 <= current_hour < 19):
        multiplier = random.uniform(2.5, 3.5)  # Heavy traffic
    elif (10 <= current_hour < 17) or (19 <= current_hour < 22):
        multiplier = random.uniform(1.2, 1.8)  # Moderate traffic
    else:
        multiplier = random.uniform(0.3, 0.8)  # Light traffic
    
    # Fetch all active edges
    edges = list(Edge.objects(is_active=True))
    
    if not edges:
        print("⚠️ No active edges found in database")
        return {"updated": 0, "total": 0}
    
    updated_count = 0
    
    for edge in edges:
        try:
            # Base traffic level per edge type
            base_vehicles = random.uniform(10, 30)
            
            # Add some randomness
            noise = random.uniform(-0.2, 0.3)
            
            # Calculate traffic metrics
            total_vehicles = max(5, int(base_vehicles * multiplier * (1 + noise)))
            queue_length_m = max(20, int(total_vehicles * (random.uniform(3, 8))))  # ~3-8m per vehicle
            density = min(1.0, (total_vehicles / 150.0) * random.uniform(0.6, 1.2))
            
            # Generate realistic traffic data
            # NOTE: pressure is no longer stored — the controller computes it
            #       from queue + density + wait_time at read time.
            traffic_updates = {
                'total_vehicles': total_vehicles,
                'queue_length_m': queue_length_m,
                'density': round(density, 3),
                'last_green_ts': now  # Critical for remaining time calculation
            }
            
            # Apply updates to outgoing_traffic
            _apply_traffic_update(edge, "outgoing_traffic", traffic_updates)
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
