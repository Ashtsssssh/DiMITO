"""
Database cleanup utilities - delete all data
"""
from backend.db.models import Node, Edge, RoutingEntry


def clear_all_data():
    """
    Delete all nodes, edges, and routing entries from the database.
    
    Returns:
        dict with counts of deleted documents
    """
    try:
        nodes_count = Node.objects.delete()
        edges_count = Edge.objects.delete()
        routing_count = RoutingEntry.objects.delete()
        
        result = {
            'success': True,
            'deleted': {
                'nodes': nodes_count,
                'edges': edges_count,
                'routing_entries': routing_count
            },
            'total': nodes_count + edges_count + routing_count
        }
        
        print(f"[DB CLEANUP] Deleted {nodes_count} nodes, {edges_count} edges, {routing_count} routing entries")
        return result
    except Exception as e:
        print(f"[DB CLEANUP] Error: {e}")
        return {
            'success': False,
            'error': str(e)
        }
