"""
Node starter file.
Run this to bring a traffic node (RSU) online.
Usage: python run_node.py <node_id>
  - python run_node.py a
  - python run_node.py b
  - python run_node.py e
"""

import sys
from node_server import NodeServer


def main():
    if len(sys.argv) < 2:
        print("Usage: python run_node.py <node_id>  (e.g. a, b, c, d, e)")
        sys.exit(1)

    node_id = sys.argv[1]
    print(f"🚀 Starting traffic node: {node_id}")
    node = NodeServer(node_id)
    node.start()


if __name__ == "__main__":
    main()
