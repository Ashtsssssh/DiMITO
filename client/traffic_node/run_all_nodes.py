"""
Discovers every controllable node from the backend (via config.py's
auto-built NODES dict) and runs one simulator process per node, in parallel.

No hardcoded node list anymore: add nodes/edges from the frontend, then just
re-run this script and it picks them up automatically.
"""

import subprocess
import sys
import time
import os

from config import NODES


def _unique_node_keys():
    """
    config.NODES is keyed by BOTH the raw node_id and the short `name`
    (when the node has one), so the same node can appear twice under
    different keys. Dedupe by NODE_ID before spawning — otherwise we'd
    launch two processes trying to bind the same port.
    """
    seen_node_ids = set()
    keys = []
    for key, cfg in NODES.items():
        if cfg["NODE_ID"] in seen_node_ids:
            continue
        seen_node_ids.add(cfg["NODE_ID"])
        keys.append(key)
    return keys


def run_node_instance(node_key):
    """Run a single node instance, referenced by whichever key we discovered it under."""
    cmd = [sys.executable, "run_node.py", node_key]
    return subprocess.Popen(
        cmd,
        cwd=os.path.dirname(os.path.abspath(__file__))
    )


def main():
    node_keys = _unique_node_keys()

    if not node_keys:
        print(
            "❌ No controllable nodes found. Create nodes + edges from the "
            "frontend (the /add page) first, then re-run this script."
        )
        sys.exit(1)

    processes = []

    print(f"🌐 Starting {len(node_keys)} traffic node(s)...")
    print("=" * 50)

    for key in node_keys:
        try:
            p = run_node_instance(key)
            processes.append((key, p))
            print(f"✅ Started node '{key}' (port {NODES[key]['NODE_PORT']})")
            time.sleep(0.5)  # Stagger startup
        except Exception as e:
            print(f"❌ Failed to start node '{key}': {e}")

    print("=" * 50)
    print(f"🎯 Running {len(processes)} node instance(s)")
    for key, _ in processes:
        print(f"   - {key} on port {NODES[key]['NODE_PORT']}")
    print("\nPress Ctrl+C to stop all")
    print("=" * 50)

    try:
        while True:
            time.sleep(1)
            for key, p in processes:
                if p.poll() is not None:
                    print(f"⚠️  node '{key}' died with code {p.returncode}")
    except KeyboardInterrupt:
        print("\n\n🛑 Stopping all nodes...")
        for key, p in processes:
            try:
                p.terminate()
                p.wait(timeout=2)
                print(f"✅ Stopped node '{key}'")
            except Exception:
                p.kill()
                print(f"❌ Killed node '{key}'")


if __name__ == "__main__":
    main()