from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework import status

from django.views.decorators.csrf import csrf_exempt

import time

from backend.db.models import Node, Edge

from backend.services import (
    data_service,
    compute_green_times,
    analyze_edge_image,
    build_routing_table_for_node,
    get_signal_phase,
    run_routing_dv_iteration,
    clear_all_data,
)



# NODE CRUD
@api_view(["POST"])
def create_node(request):
    data = request.data

    if not data.get("node_id") or not data.get("name"):
        return Response(
            {"error": "node_id and name are required"},
            status=400
        )

    # cycle_time: optional int; omit or null → auto-calculated
    cycle_time = data.get("cycle_time")
    if cycle_time is not None:
        cycle_time = int(cycle_time) if int(cycle_time) > 0 else None

    node = data_service.create_node(
        node_id=data["node_id"],
        name=data["name"],
        location=data.get("location", {}),
        cycle_time=cycle_time,
        is_active=data.get("is_active", True)
    )

    return Response({
        "node_id": node.node_id,
        "name": node.name,
        "cycle_time": node.cycle_time,
    })

@api_view(["POST"])
def delete_node(request):
    data = request.data

    if not data.get("node_id"):
        return Response(
            {"error": "node_id is required"},
            status=400
        )

    ok = data_service.delete_node(data["node_id"])

    if not ok:
        return Response(
            {"error": "Node not found"},
            status=404
        )

    return Response({
        "message": f"Node {data['node_id']} deleted successfully"
    })

@api_view(["POST"])
def update_node(request):
    data = request.data

    if not data.get("node_id"):
        return Response(
            {"error": "node_id is required"},
            status=400
        )

    cycle_time = data.get("cycle_time")
    if cycle_time is not None:
        cycle_time = int(cycle_time)

    node = data_service.update_node(
        node_id=data["node_id"],
        name=data.get("name"),
        location=data.get("location"),
        cycle_time=cycle_time,
        is_active=data.get("is_active")
    )

    if not node:
        return Response(
            {"error": "Node not found"},
            status=404
        )

    return Response({
        "node_id": node.node_id,
        "name": node.name,
        "location": node.location,
        "cycle_time": node.cycle_time,
        "is_active": node.is_active
    })

@api_view(["GET"])
def list_nodes(request):
    nodes = data_service.list_all_nodes()
    response = Response([
        {
            "node_id": n.node_id,
            "name": n.name,
            "location": n.location,
            "cycle_time": n.cycle_time,
            "is_active": n.is_active
        }
        for n in nodes
    ])
    response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response['Pragma'] = 'no-cache'
    response['Expires'] = '0'
    return response



# EDGE CRUD
@api_view(["POST"])
def create_edge(request):
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

    edge = data_service.create_edge(
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

@api_view(["POST"])
def delete_edge(request):

    data = request.data
    if not data.get("edge_id"):
        return Response(
            {"error": "edge_id is required"},
            status=400
        )

    ok = data_service.delete_edge(data["edge_id"])

    if not ok:
        return Response(
            {"error": "Edge not found"},
            status=404
        )

    return Response({
        "message": f"Edge {data['edge_id']} deleted successfully"
    })

@api_view(["POST"])
def update_edge(request):
    data = request.data

    if not data.get("edge_id"):
        return Response(
            {"error": "edge_id is required"},
            status=400
        )

    edge = data_service.update_edge(
        edge_id=data["edge_id"],
        name=data.get("name"),
        in_node_id=data.get("in_node_id"),
        out_node_id=data.get("out_node_id"),
        camera_id=data.get("camera_id"),
        road_length_m=float(data.get("road_length_m", 0)),
        road_width_m=float(data.get("road_width_m", 0)),
        is_active=data.get("is_active")
    )

    if not edge:
        return Response(
            {"error": "Edge not found"},
            status=404
        )

    return Response({
        "edge_id": edge.edge_id,
        "name": edge.name,
        "in_node_id": edge.in_node_id,
        "out_node_id": edge.out_node_id,
        "camera_id": edge.camera_id,
        "road_length_m": edge.road_length_m,
        "road_width_m": edge.road_width_m,
        "is_active": edge.is_active
    })

@api_view(["GET"])
def list_edges(request):
    edges = data_service.list_all_edges()

    response = Response([
        {
            "edge_id": e.edge_id,
            "name": e.name,
            "in_node_id": e.in_node_id,
            "out_node_id": e.out_node_id,
            "camera_id": e.camera_id,
            "road_length_m": e.road_length_m,
            "road_width_m": e.road_width_m,
            "is_active": e.is_active
        }
        for e in edges
    ])
    response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response['Pragma'] = 'no-cache'
    response['Expires'] = '0'
    return response




@csrf_exempt
@api_view(["POST"])
@parser_classes([MultiPartParser])
def process_green_signal(request, node_id, edge_id):
    """
    Client uploads images as:
        { edge_id : image }

    Flow:
    - For each edge image:
        - Run ML
        - Update DB via update_traffic_by_node
    - Collect outgoing_traffic for all outgoing edges
    - Compute green times (needs all edges for proportional calc)
    - Return only the requested edge_id's green time
    """


    uploaded = request.FILES
   
    # ---------- Fetch outgoing edges ----------
    outgoing_edges = {
        e.edge_id: e
        for e in Edge.objects(out_node_id=node_id, is_active=True)
    }


    ml_results = []

    # ---------- Run ML + Update DB ----------
    for img_eid, image_file in uploaded.items():
        if img_eid not in outgoing_edges:
            print(f"[GREEN] ⚠️ Skipping invalid edge {img_eid} for node {node_id}")
            continue

        edge = outgoing_edges[img_eid]
        print("[GREEN] processing edge", img_eid, "image:", image_file.name, image_file.size)

        # ---- ML call ONLY through this function ----
        ml_json = analyze_edge_image(
            image_file=image_file,
            camera_id=edge.camera_id,
            save_vis=True
        )

        # Transform ML JSON to match Edge model structure
        # NOTE: pressure is no longer computed by ML — the controller
        #       (green_time_service) derives it from queue + density + wait
        traffic_updates = {
            'total_vehicles': ml_json['vehicle_counts'],
            'queue_length_m': ml_json['queue_length_m'],
            'density': ml_json['density'],
        }

        
        data_service.update_traffic_by_node(
            node_id=node_id,
            edge_id=img_eid,
            updates=traffic_updates
        )


        ml_results.append({
            "edge_id": img_eid,
            "ml": ml_json
        })

    # ---------- Prepare data for green-time ----------
    states = []
    for edge in outgoing_edges.values():
        state = edge.outgoing_traffic.copy()
        state["edge_id"] = edge.edge_id
        states.append(state)

    # ---------- Green time calculation ----------
    # Use node's stored cycle_time if set, else auto-calculate
    node_obj = Node.objects(node_id=node_id).first()
    node_cycle_time = node_obj.cycle_time if node_obj else None
    green_times = compute_green_times(states, cycle_time=node_cycle_time)

    if edge_id not in green_times:
        return Response(
            {"error": f"Edge {edge_id} not found in computed green times"},
            status=404
        )

    return Response({
        "node": node_id,
        "edge_id": edge_id,
        "green_time": green_times[edge_id],
        "ml_results": ml_results
    })


@api_view(["POST"])
def create_routing_entry(request):
    data = request.data
    required = ["from_node", "dest_node", "next_hop", "cost"]
    missing = [k for k in required if k not in data]
    if missing:
        return Response({"error": missing}, status=400)

    entry = data_service.create_routing_entry(
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







# TRAFFIC UPDATE
@api_view(["POST"])
def update_edge_traffic(request, edge_id, node_id):
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
        edge = data_service.update_traffic_by_node(
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

@api_view(["GET"])
def get_signal_state(request, node_id):
    """Returns current signal state for a node."""
    result = get_signal_phase(node_id)
    if result is None:
        return Response(
            {"error": f"No outgoing edges for node {node_id}"},
            status=404,
        )
    return Response(result)




# FIND ROUTING TABLE FOR A NODE
@api_view(["GET"])
def get_routing_table(request, node_id):
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
    
    response_data = {
        "node_id": node_id,
        "routing_table": routing_table,
        "generated_at": int(time.time())
    }
    
    print(f"\n{'='*80}")
    print(f"🛣️  ROUTING TABLE REQUESTED FOR NODE: {node_id}")
    print(f"{'='*80}")
    print(f"Routing Table Data:")
    import json
    print(json.dumps(response_data, indent=2, default=str))
    print(f"{'='*80}\n")

    return Response(response_data)




# TEST ONLY 
@api_view(["POST"])
def trigger_dv_iteration(request):
    """TESTING ONLY. Triggers one DV update iteration."""
    updates = run_routing_dv_iteration()

    return Response({
        "status": "ok",
        "updates_applied": updates,
    })




# UPDATE ALL TRAFFIC (Testing Utility)
@api_view(["POST"])
def seed_all_traffic(request):
    """
    Fill in realistic but varying traffic data for all edges in the system.
    Useful for testing/checking purposes without running the simulator.
    
    POST /api/update-all-traffic/
    """
    try:
        result = data_service.seed_all_traffic()
        return Response({
            "status": "success",
            "message": f"Updated traffic for {result['updated']} edges",
            **result
        })
    except Exception as e:
        return Response({
            "status": "error",
            "message": str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@csrf_exempt
@api_view(["POST"])
def clear_database(request):
    """
    DELETE ALL DATA from the database (nodes, edges, routing entries).
    WARNING: This action cannot be undone!
    
    POST /api/db/clear-all/
    """
    try:
        result = clear_all_data()
        
        if result['success']:
            return Response({
                "status": "success",
                "message": f"Database cleared! Deleted {result['total']} documents",
                **result
            })
        else:
            return Response({
                "status": "error",
                "message": result.get('error', 'Unknown error')
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    except Exception as e:
        return Response({
            "status": "error",
            "message": str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)