import requests
import sys
import os

BASE_URL = "http://127.0.0.1:8000/api"
NODE_HOST = "127.0.0.1"
RECOMPUTE_BEFORE = 10

# Static name → port mapping (these stay fixed)
NODE_PORTS = {
    "a": 9001,
    "b": 9002,
    "c": 9003,
    "d": 9004,
    "e": 9005,
}

# Image directory per short name
IMG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "node_imgs")

# Single image mode for consistent node-side ML inputs during DV evaluation.
# When enabled, every edge of every node points to this same file.
USE_SINGLE_IMAGE = True
SINGLE_IMAGE_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "assets", "E12.jpg"
)


def _fetch_config_from_backend():
    """
    Auto-build NODES config by querying the backend for real node/edge IDs.

    1. GET /node/get_all  → list of {node_id, name, ...}
    2. GET /edge/get_all  → list of {edge_id, in_node_id, out_node_id, ...}

    For each node whose `name` matches a key in NODE_PORTS (a, b, c, ...):
      - find all outgoing edges (out_node_id == node.node_id)
      - assign images e1.jpg, e2.jpg, ... in sorted edge order
    """
    nodes_resp = requests.get(f"{BASE_URL}/node/get_all", timeout=5).json()
    edges_resp = requests.get(f"{BASE_URL}/edge/get_all", timeout=5).json()

    # name → real node_id  (names are "a", "b", etc.)
    name_to_node = {}
    for n in nodes_resp:
        short = n["name"].strip().lower()
        name_to_node[short] = n["node_id"]

    config = {}
    for short_name, port in NODE_PORTS.items():
        real_id = name_to_node.get(short_name)
        if real_id is None:
            print(f"⚠️  [config] No DB node with name='{short_name}', skipping")
            continue

        # Outgoing edges for this node (the ones this node controls signals for)
        out_edges = sorted(
            [e for e in edges_resp if e["out_node_id"] == real_id],
            key=lambda e: e["edge_id"],
        )

        if not out_edges:
            print(f"⚠️  [config] Node '{short_name}' ({real_id}) has no outgoing edges, skipping")
            continue

        # Map real edge_id → local image file.
        edge_images = {}
        if USE_SINGLE_IMAGE:
            if not os.path.isfile(SINGLE_IMAGE_PATH):
                print(f"⚠️  [config] Single image not found: {SINGLE_IMAGE_PATH}")
            else:
                edge_images = {e["edge_id"]: SINGLE_IMAGE_PATH for e in out_edges}
                print(f"🖼️  [config] Single-image mode ON ({SINGLE_IMAGE_PATH})")

        # Fallback (or explicit mode): per-edge images e1.jpg, e2.jpg, ...
        if not edge_images:
            img_folder = os.path.join(IMG_DIR, short_name)
            for idx, edge in enumerate(out_edges, start=1):
                img_path = os.path.join(img_folder, f"e{idx}.jpg")
                if not os.path.isfile(img_path):
                    print(f"⚠️  [config] Missing image {img_path} for edge {edge['edge_id']}")
                    continue
                edge_images[edge["edge_id"]] = img_path

        config[short_name] = {
            "NODE_ID": real_id,
            "NODE_HOST": NODE_HOST,
            "NODE_PORT": port,
            "BASE_URL": BASE_URL,
            "RECOMPUTE_BEFORE": RECOMPUTE_BEFORE,
            "EDGE_IMAGES": edge_images,
        }

        print(f"✅ [config] {short_name} → {real_id}  edges: {list(edge_images.keys())}")

    return config


def load_nodes():
    """Load config, retrying until backend is reachable."""
    try:
        cfg = _fetch_config_from_backend()
        if cfg:
            return cfg
    except Exception as e:
        print(f"⚠️  [config] Backend not reachable: {e}")

    print("❌ [config] Could not build config from backend. Is the server running?")
    sys.exit(1)


# Auto-load on import
NODES = load_nodes()
