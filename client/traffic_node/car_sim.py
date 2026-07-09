import socket
import json
import time

from config import NODES

NODE_HOST_DEFAULT = "127.0.0.1"

# =============================================================================
#  JOURNEY CONFIGURATION  — edit this to test different routes
#
#  Format: ["start_node", "destination_node"]
#
#  Valid node keys: use the short name you gave a node in the frontend
#  (e.g. "a", "b", "c") OR the full node_id (e.g. "node_abc123").
#  Run `python config.py` to see all currently available node keys.
#
#  Examples:
#    ["a", "c"]   — from node a to node c
#    ["b", "d"]   — from node b to node d
# =============================================================================

JOURNEYS = [
    ["a", "c"],   # ← change these to match your network
    ["b", "d"],
]



def get_node_port(node_key):
    """
    Resolve the TCP port for a node, using the same auto-discovered config
    run_node.py / run_all_nodes.py use — no separate hardcoded port map to
    drift out of sync.
    """
    cfg = NODES.get(node_key) or NODES.get(node_key.strip().lower())
    if not cfg:
        available = sorted(set(c["NODE_ID"] for c in NODES.values()))
        raise ValueError(f"Unknown node '{node_key}'. Available node_ids: {available}")
    return cfg["NODE_HOST"], cfg["NODE_PORT"]


def ask_next_hop(current_node, destination):
    """
    Ask current node for next hop to reach destination.

    Args:
        current_node: Current node key (short name or node_id)
        destination: Target node key (short name or node_id)

    Returns:
        dict with 'next_node' or 'error'
    """
    try:
        host, port = get_node_port(current_node)
    except ValueError as e:
        return {"error": str(e)}

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(2)
        s.connect((host, port))

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
        start_node: Starting node key
        destination: Target node key

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
        resp = ask_next_hop(current, destination)

        if "error" in resp:
            print(f"❌ Error at node {current}: {resp['error']}")
            path.append(f"❌ ({resp['error']})")
            break

        next_node = resp.get("next_node")

        if next_node is None:
            print(f"❌ Node {current} returned no next_node: {resp}")
            break

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

    print("📝 TO MODIFY JOURNEYS:")
    print("   Edit the 'JOURNEYS' list at the top of this file, using any")
    print("   node key shown in config.py's startup log (name or node_id).")
    print()