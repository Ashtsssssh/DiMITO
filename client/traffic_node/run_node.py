"""
Node starter file.
Run this to bring a traffic node (RSU) online.

Usage: python run_node.py <node_key>

  <node_key> can be either:
    - the short `name` you gave the node in the frontend (e.g. "a"), or
    - its real node_id (e.g. "node_1750000000000")

  Either works because config.py registers nodes under both keys. To see
  which keys/ports are currently available, just run this file (or
  run_all_nodes.py) — config.py prints them on load, e.g.:
      ✅ [config] a (node_1750000000000) → port 9001  edges: [...]
"""

import sys
from node_server import NodeServer


def main():
    if len(sys.argv) < 2:
        print("Usage: python run_node.py <node_key>")
        print("  node_key = the node's short `name` or its real node_id")
        print("  (see config.py's startup log for the available keys/ports)")
        sys.exit(1)

    node_id = sys.argv[1]
    print(f"🚀 Starting traffic node: {node_id}")
    node = NodeServer(node_id)
    node.start()


if __name__ == "__main__":
    main()