from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response

from traffic.db.models import Node, Edge
from traffic.services import add_data
from traffic.services.green_time import compute_green_times
from traffic.services.ml_ingest import run_ml_for_edge
from traffic.services.routing_service import build_routing_table_for_node
from traffic.services.dv_service import run_dv_update_once

from rest_framework import status
import time

from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view
from rest_framework.response import Response

from traffic.db.models import RoutingEntry

from datetime import datetime

ALPHA = 0.2
MAX_INFLATION = 1.5



@csrf_exempt
@api_view(["POST"])
@parser_classes([MultiPartParser])
def calculate_green(request, node_id):

    uploaded = request.FILES

    outgoing_edges = {
        e.edge_id: e
        for e in Edge.objects(out_node_id=node_id, is_active=True)
    }

    ml_results = []
    states = []

    for edge_id, image_file in uploaded.items():
        if edge_id not in outgoing_edges:
            return Response(
                {"error": f"Edge {edge_id} is not outgoing from node {node_id}"},
                status=400
            )

        edge = outgoing_edges[edge_id]

        ml_json = run_ml_for_edge(
            image_file=image_file,
            camera_id=edge.camera_id,
            save_vis=True
        )

        traffic_updates = {
            "total_vehicles": ml_json["vehicle_counts"],
            "queue_length_m": ml_json["queue_length_m"],
            "density": ml_json["density"],
            "pressure": ml_json["pressure"],
        }

        add_data.update_traffic_by_node(
            node_id=node_id,
            edge_id=edge_id,
            updates=traffic_updates
        )

        states.append({
            "edge_id": edge_id,
            **traffic_updates
        })

        ml_results.append({
            "edge_id": edge_id,
            "ml": ml_json
        })

    green_times = compute_green_times(states)

    return Response({
        "node_id": node_id,
        "green_times": green_times,
        "edges_used": list(outgoing_edges.keys()),
        "ml_results": ml_results
    })


@api_view(["POST"])
def add_routing_entry_view(request):
    data = request.data
    required = ["from_node", "dest_node", "next_hop", "cost"]
    missing = [k for k in required if k not in data]
    if missing:
        return Response({"error": missing}, status=400)

    entry = add_data.add_routing_entry(
        data["from_node"],
        data["dest_node"],
        data["next_hop"],
        data["cost"]
    )

    return Response({
        "from": entry.from_node_id,
        "dest": entry.destination_node_id,
        "via": entry.next_hop_node_id,
        "cost": entry.cost
    })


# NODE CREATION
@api_view(["POST"])
def add_node(request):
    data = request.data

    if not data.get("node_id") or not data.get("name"):
        return Response(
            {"error": "node_id and name are required"},
            status=400
        )

    node = add_data.add_node(
        node_id=data["node_id"],
        name=data["name"],
        location=data.get("location", {}),
        is_active=data.get("is_active", True)
    )

    return Response({
        "node_id": node.node_id,
        "name": node.name
    })

@api_view(["POST"])
def add_edge(request):
    data = request.data

    required = [
        "edge_id", "name", "in_node_id",
        "out_node_id", "camera_id",
        "road_length_m", "road_width_m"
    ]
    missing = [k for k in required if k not in data]
    if missing:
        return Response(
            {"error": f"Missing fields: {missing}"},
            status=400
        )

    edge = add_data.add_edge(
        edge_id=data["edge_id"],
        name=data["name"],
        in_node_id=data["in_node_id"],
        out_node_id=data["out_node_id"],
        camera_id=data["camera_id"],
        road_length_m=float(data["road_length_m"]),
        road_width_m=float(data["road_width_m"]),
        is_active=data.get("is_active", True)
    )

    return Response({
        "edge_id": edge.edge_id,
        "in": edge.in_node_id,
        "out": edge.out_node_id
    })


# TRAFFIC UPDATE
@api_view(["POST"])
def update_traffic(request, edge_id, node_id):
    """
    Update traffic for a given edge from perspective of node.
    URL order MUST match urls.py
    """

    updates = request.data.get("updates")
    if not isinstance(updates, dict):
        return Response(
            {"error": "`updates` dict required"},
            status=400
        )

    try:
        edge = add_data.update_traffic_by_node(
            node_id=node_id,
            edge_id=edge_id,
            updates=updates
        )
    except ValueError as e:
        return Response({"error": str(e)}, status=400)

    return Response({
        "edge_id": edge.edge_id,
        "updated_for_node": node_id
    })


# -----------------------------
# FIND ROUTING TABLE FOR A NODE
# -----------------------------
@api_view(["GET"])
def get_table(request, node_id):
    """
    Called ONLY by traffic nodes.
    Returns routing table for that node.
    """

    node = Node.objects(node_id=node_id, is_active=True).first()
    if not node:
        return Response(
            {"error": "Invalid or inactive node"},
            status=status.HTTP_404_NOT_FOUND
        )

    routing_table = build_routing_table_for_node(node_id)

    return Response({
        "node_id": node_id,
        "routing_table": routing_table,
        "generated_at": int(time.time())
    })




# TEST ONLY 
# !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
@api_view(["POST"])
def dv_update_test(request):

    """
    TESTING ONLY.
    Triggers one DV update iteration.
    """
    updates = run_dv_update_once()

    return Response({
        "status": "ok",
        "updates_applied": updates
    })



# @api_view(["POST"])
# def create_test_network(request):
#     """
#     Creates a simple linear test network: A -> B -> C -> D
#     With shortcuts: A -> C, A -> D
    
#     This tests multi-hop routing propagation.
#     """
#     from traffic.db.models import Node, Edge, RoutingEntry
    
#     # Clear existing data
#     Node.objects().delete()
#     Edge.objects().delete()
#     RoutingEntry.objects().delete()
    
#     # Create nodes
#     for node_id in ['A', 'B', 'C', 'D']:
#         Node(
#             node_id=node_id,
#             name=f"Node {node_id}",
#             location={},
#             is_active=True
#         ).save()
    
#     # Create edges
#     # Main path: A -> B -> C -> D
#     # Shortcuts: A -> C (expensive), A -> D (very expensive)
#     edges_config = [
#         ('A', 'B', 'E1', 10.0),   # Cheap: A -> B
#         ('B', 'C', 'E2', 5.0),    # Cheap: B -> C
#         ('C', 'D', 'E3', 3.0),    # Cheap: C -> D
#         ('A', 'C', 'E4', 20.0),   # Expensive shortcut: A -> C
#         ('A', 'D', 'E5', 50.0),   # Very expensive shortcut: A -> D
#     ]
    
#     for from_n, to_n, edge_id, length in edges_config:
#         Edge(
#             edge_id=edge_id,
#             name=f"{from_n} to {to_n}",
#             in_node_id=from_n,
#             out_node_id=to_n,
#             camera_id=f"CAM_{edge_id}",
#             road_length_m=length,
#             road_width_m=10.0,
#             is_active=True,
#             outgoing_traffic={
#                 'queue_length_m': 0.0,
#                 'pressure': 0.0
#             }
#         ).save()
    
#     return Response({
#         "status": "Test network created",
#         "nodes": ['A', 'B', 'C', 'D'],
#         "edges": len(edges_config),
#         "instructions": [
#             "1. POST /api/routing/dv-update-test/ (run 3-4 times)",
#             "2. GET /api/test/verify/?node=A",
#             "3. GET /api/gettable/node/A/"
#         ],
#         "expected": {
#             "after_1_update": "A knows B, C, D (direct only)",
#             "after_2_updates": "A -> D via B appears (cost ~1.5)",
#             "after_3_updates": "A -> D via B->C appears (cost ~1.8)",
#             "converged": "A has 3 routes to D: direct(5.0), via B(1.5), via C(2.0)"
#         }
#     })


# @api_view(["GET"])
# def verify_routing(request):
#     """
#     Verifies multi-hop routing is working.
#     """
    
    
#     node_id = request.GET.get('node', 'A')
    
#     routes = RoutingEntry.objects(from_node_id=node_id)
    
#     # Group by destination
#     by_dest = {}
#     for r in routes:
#         if r.destination_node_id not in by_dest:
#             by_dest[r.destination_node_id] = []
#         by_dest[r.destination_node_id].append({
#             'via': r.next_hop_node_id,
#             'cost': round(r.cost, 2)
#         })
    
#     # Sort routes by cost
#     for dest in by_dest:
#         by_dest[dest] = sorted(by_dest[dest], key=lambda x: x['cost'])
    
#     # Verification checks
#     checks = {
#         'has_self_route': node_id in by_dest,
#         'total_destinations': len(by_dest),
#         'destinations': list(by_dest.keys())
#     }
    
#     # Check for multi-hop evidence
#     if 'D' in by_dest:
#         d_routes = by_dest['D']
#         checks['routes_to_D'] = len(d_routes)
#         checks['best_route_to_D'] = d_routes[0] if d_routes else None
        
#         # Multi-hop working if we have route A->D via B with cost < direct
#         via_b = [r for r in d_routes if r['via'] == 'B']
#         direct = [r for r in d_routes if r['via'] == 'D']
        
#         if via_b and direct and via_b[0]['cost'] < direct[0]['cost']:
#             checks['multi_hop_working'] = True
#             checks['evidence'] = f"A->D via B (cost {via_b[0]['cost']}) < direct (cost {direct[0]['cost']})"
#         else:
#             checks['multi_hop_working'] = False
    
#     return Response({
#         'node': node_id,
#         'routing_table': by_dest,
#         'verification': checks
#     })