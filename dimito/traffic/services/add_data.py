from datetime import datetime
import time

from dimito.mongo import connect_mongo
from traffic.db.models import Node, Edge
from traffic.db.models import RoutingEntry




# Ensure MongoDB connection is established when this module is imported
connect_mongo()


def add_node(node_id: str, name: str, location: dict = None, is_active: bool = True):
	"""Create and save a Node.

	Args:
		node_id: unique node identifier
		name: human-friendly name
		location: dict with lat/lng
		is_active: whether node is active

	Returns:
		The saved `Node` document.
	"""
	location = location or {}
	node = Node(
		node_id=node_id,
		name=name,
		location=location,
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
    is_active: bool = None
):
    node = Node.objects(node_id=node_id).first()
    if not node:
        return None

    if name is not None:
        node.name = name

    if location is not None:
        node.location = location

    if is_active is not None:
        node.is_active = is_active

    node.updated_at = datetime.now()
    node.save()
    return node

def get_all_nodes():
    return list(Node.objects.all())



def add_edge(edge_id: str, name: str, in_node_id: str, out_node_id: str,
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

def get_all_edges():
    """Retrieve all Edge documents."""
    return list(Edge.objects.all())



def get_edges_for_node(node_id: str):
	"""Return all edges connected to `node_id` (incoming and outgoing)."""
	incoming = list(Edge.objects(to_node_id=node_id))
	outgoing = list(Edge.objects(from_node_id=node_id))
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


def add_routing_entry(from_node, dest_node, next_hop, cost):
    entry = RoutingEntry(
        from_node_id=from_node,
        destination_node_id=dest_node,
        next_hop_node_id=next_hop,
        cost=float(cost),
        last_updated=datetime.now()
    )
    entry.save()
    return entry
