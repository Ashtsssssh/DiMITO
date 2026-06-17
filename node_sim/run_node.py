"""
Node starter file.
Run this to bring a traffic node (RSU) online.
"""

from node_server import NodeServer
from config import NODE_ID


def main():
    print(f"🚀 Starting traffic node {NODE_ID}")
    node = NodeServer()
    node.start()


if __name__ == "__main__":
    main()
