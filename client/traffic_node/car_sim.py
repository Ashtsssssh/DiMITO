import socket
import json
import time

NODE_HOST = "127.0.0.1"
NODE_PORT_MAP = {
    "a": 9001,
    "b": 9002,
    "c": 9003,
    "d": 9004,
    "N1": 9001,
    "N2": 9002,
    "N3": 9003,
    "N4": 9004,
}

# Define journeys: [start_node, destination_node]
# Add your test cases here!
# JOURNEYS = [
#     ["a", "d"],      # Car at 'a' going to 'd'
#     ["b", "c"],      # Car at 'b' going to 'c'
#     ["c", "a"],      # Car at 'c' going to 'a'
#     ["d", "b"],      # Car at 'd' going to 'b'
# ]

JOURNEYS = [
    ["b", "a"],["b", "a"],["b", "a"],["b", "a"],["b", "a"],["b", "a"],["b", "a"],
    ["b", "a"],
]


def get_node_port(node_id):
    """Get the port for a node ID"""
    return NODE_PORT_MAP.get(node_id, 9001)


def ask_next_hop(current_node, destination):
    """
    Ask current node for next hop to reach destination.
    
    Args:
        current_node: Current node ID (e.g., "a", "b")
        destination: Target node ID
    
    Returns:
        dict with 'next_node' or 'error'
    """
    port = get_node_port(current_node)
    
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2)
        s.connect((NODE_HOST, port))

        req = {
            "type": "NEXT_EDGE",
            "destination": destination
        }

        s.send(json.dumps(req).encode())
        resp = json.loads(s.recv(4096).decode())
        s.close()

        return resp
    except Exception as e:
        return {"error": str(e)}


def simulate_journey(start_node, destination):
    """
    Simulate a car's complete journey from start to destination.
    Follows the routing table at each hop.
    
    Args:
        start_node: Starting node
        destination: Target node
    
    Returns:
        Path taken by the car
    """
    path = [start_node]
    current = start_node
    hops = 0
    max_hops = 10  # Prevent infinite loops
    
    print(f"\n{'='*70}")
    print(f"🚗 JOURNEY: {start_node} → {destination}")
    print(f"{'='*70}")
    
    while current != destination and hops < max_hops:
        # Ask current node for next hop
        resp = ask_next_hop(current, destination)
        
        if "error" in resp:
            print(f"❌ Error at node {current}: {resp['error']}")
            path.append(f"❌ ({resp['error']})")
            break
        
        next_node = resp.get("next_node")
        
        if next_node is None:
            print(f"❌ Node {current} returned no next_node: {resp}")
            break
        
        # Move to next node
        current = next_node
        path.append(current)
        hops += 1
        
        print(f"  Hop {hops}: {path[-2]} → {current}", end="")
        
        if current == destination:
            print(f" ✅ DESTINATION REACHED!")
        else:
            print()
        
        time.sleep(0.1)  # Small delay for readability
    
    if current == destination:
        print(f"\n✅ SUCCESS: Reached {destination} in {hops} hops")
        print(f"   Path: {' → '.join(path)}")
    else:
        print(f"\n❌ FAILED: Did not reach {destination}")
        print(f"   Path taken: {' → '.join(path)}")
    
    print(f"{'='*70}")
    
    return path


if __name__ == "__main__":
    print("\n" + "="*70)
    print("🚗🚗🚗 MULTI-JOURNEY CAR SIMULATOR 🚗🚗🚗")
    print("="*70)
    print(f"\nTesting {len(JOURNEYS)} journeys...\n")
    
    results = []
    
    for start, dest in JOURNEYS:
        path = simulate_journey(start, dest)
        results.append({
            "journey": f"{start} → {dest}",
            "path": path,
            "success": path[-1] == dest
        })
    
    # Summary
    print("\n" + "="*70)
    print("📊 JOURNEY SUMMARY")
    print("="*70)
    
    success_count = 0
    for result in results:
        status = "✅" if result["success"] else "❌"
        print(f"{status} {result['journey']}: {' → '.join(result['path'])}")
        if result["success"]:
            success_count += 1
    
    print(f"\n{success_count}/{len(JOURNEYS)} journeys completed successfully!")
    print("="*70 + "\n")
    
    # Instructions
    print("📝 TO MODIFY JOURNEYS:")
    print("   Edit the 'JOURNEYS' list at the top of this file")
    print("   Example: JOURNEYS = [['a', 'd'], ['b', 'c'], ...]")
    print("\n📝 TO ADD NEW NODES:")
    print("   Add to NODE_PORT_MAP: {'node_id': port_number}")
    print()

