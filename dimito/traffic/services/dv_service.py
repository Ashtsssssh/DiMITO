from datetime import datetime
from ..db.models import Edge, RoutingEntry

ALPHA = 0.2
MAX_INFLATION = 1.5


def edge_cost(edge: Edge):
    t = edge.outgoing_traffic or {}
    return (
        0.6 * t.get("queue_length_m", 0.0)
        + 0.3 * t.get("pressure", 0.0) * 100
        + 0.1 * edge.road_length_m
    )


def run_dv_update_once():
    """
    Single iteration of distance-vector update.
    Call this multiple times manually for convergence.
    """
  
    edges = Edge.objects(is_active=True)
    
   
    # Get all nodes
    all_nodes = set()
    for edge in edges:
        all_nodes.add(edge.in_node_id)
        all_nodes.add(edge.out_node_id)
    
 
    # ----------------------------
    # PHASE 0: Add self-routes (only first time)
    # ----------------------------
    for node in all_nodes:
        entry = RoutingEntry.objects(
            from_node_id=node,
            destination_node_id=node,
            next_hop_node_id=node
        ).first()
        
        if not entry:
            RoutingEntry(
                from_node_id=node,
                destination_node_id=node,
                next_hop_node_id=node,
                cost=0.0
            ).save()
           
    # ----------------------------
    # PHASE 1: Bootstrap from edges
    # ----------------------------
    for edge in edges:
        A = edge.in_node_id
        B = edge.out_node_id
        cost_AB = edge_cost(edge)
        
        entry = RoutingEntry.objects(
            from_node_id=A,
            destination_node_id=B,
            next_hop_node_id=B
        ).first()

        if entry:
            entry.cost = (1 - ALPHA) * entry.cost + ALPHA * cost_AB
            entry.last_updated = datetime.now()
            entry.save()
        else:
            RoutingEntry(
                from_node_id=A,
                destination_node_id=B,
                next_hop_node_id=B,
                cost=cost_AB
            ).save()
           
    # ----------------------------
    # PHASE 2: DV propagation (SINGLE ITERATION)
    # ----------------------------
    
    changes = 0
    processed = set()  # Avoid processing same route twice
    
    for edge in edges:
        A = edge.in_node_id
        B = edge.out_node_id
        cost_AB = edge_cost(edge)
        
        # Get all routes from B
        routes_from_B = RoutingEntry.objects(from_node_id=B)

        for r in routes_from_B:
            D = r.destination_node_id
            
            # Skip if destination is source
            if D == A:
                continue

            # Calculate new cost: A -> B -> D
            new_cost = cost_AB + r.cost
            
            # Create unique key to avoid duplicates
            route_key = (A, D, B)
            if route_key in processed:
                continue
            processed.add(route_key)

            # Check if this specific route exists
            entry = RoutingEntry.objects(
                from_node_id=A,
                destination_node_id=D,
                next_hop_node_id=B
            ).first()

            if entry:
                # Update existing route
                old_cost = entry.cost
                
                # Check inflation limit
                if new_cost > old_cost * MAX_INFLATION:
                    continue
                
                # Apply exponential moving average
                entry.cost = (1 - ALPHA) * entry.cost + ALPHA * new_cost
                entry.last_updated = datetime.now()
                entry.save()
                changes += 1
             
            else:
                # New route - check if competitive
                best_existing = RoutingEntry.objects(
                    from_node_id=A,
                    destination_node_id=D
                ).order_by('cost').first()
                
                if best_existing and new_cost > best_existing.cost * MAX_INFLATION:
                    continue
                
                # Create new route
                RoutingEntry(
                    from_node_id=A,
                    destination_node_id=D,
                    next_hop_node_id=B,
                    cost=new_cost
                ).save()
                changes += 1
             
    # Print summary
    total = RoutingEntry.objects().count()
   
    
    for node in sorted(all_nodes):
        routes = RoutingEntry.objects(from_node_id=node)
        dests = set(r.destination_node_id for r in routes)
      
    return changes  # Return number of changes (0 = converged)