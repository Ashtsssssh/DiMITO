"""
Builds the NODES config dict by querying the live backend for every node
and edge that currently exists — no hardcoded node list. Add/remove nodes
and edges from the frontend, then just restart the simulator (or re-run
run_all_nodes.py) and it picks up the current network automatically.

PORT ASSIGNMENT
---------------
Each node that controls at least one outgoing edge gets a TCP port,
assigned deterministically as BASE_PORT + index after sorting all such
nodes by their real `node_id`. As long as the set of nodes doesn't change,
this gives the same port to the same node across separate process launches
(so `run_node.py <id>` run by itself still gets the same port `run_all_nodes.py`
would have given it).

IMAGE RESOLUTION (the "which photo goes with which road" problem)
-------------------------------------------------------------------
The old version assigned images by *sorted position* among a node's edges
(e1.jpg, e2.jpg, ...) — fragile, because edge_id order has nothing to do
with which road is which once you're creating edges from the frontend.

Now each edge's image is resolved explicitly, in this order:
  1. node_imgs/by_camera/<camera_id>.<jpg|jpeg|png>
     — if you set a Camera ID when creating the edge in the frontend
       ("Edge → Add" / "Edge → Edit" form), drop a photo named after
       that camera_id here.
  2. node_imgs/by_edge/<edge_id>.<jpg|jpeg|png>
     — always available and unambiguous: every edge_id is unique
       (e.g. "e_node_1750000001_node_1750000002"). Look it up from
       GET /api/edge/get_all or the AddPage "Selected Edge" panel.
  3. SINGLE_IMAGE_PATH (assets/E12.jpg)
     — generic fallback so the pipeline runs end-to-end even before
       you've collected real per-road photos. Every edge using this
       fallback will report near-identical traffic, by design.
If none of these resolve, the edge is skipped (a warning is printed) and
that edge simply won't get an ML-based update on this cycle.
"""

import requests
import sys
import os

BASE_URL = "http://127.0.0.1:8000/api"
NODE_HOST = "127.0.0.1"
RECOMPUTE_BEFORE = 10

# First port handed out; node #2 (by sorted node_id) gets BASE_PORT+1, etc.
BASE_PORT = 9001

IMG_ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "node_imgs")
BY_CAMERA_DIR = os.path.join(IMG_ROOT, "by_camera")
BY_EDGE_DIR = os.path.join(IMG_ROOT, "by_edge")
IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png")

# Fallback used whenever an edge has no by_camera/by_edge image yet.
USE_SINGLE_IMAGE = True
SINGLE_IMAGE_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "assets", "E12.jpg"
)


def _find_image(directory, key):
    """Return the first existing <directory>/<key>.<ext>, or None."""
    if not key:
        return None
    for ext in IMAGE_EXTENSIONS:
        candidate = os.path.join(directory, f"{key}{ext}")
        if os.path.isfile(candidate):
            return candidate
    return None


def _resolve_image_for_edge(edge: dict):
    """Pick which local image file to upload for this edge. See module docstring."""
    camera_id = edge.get("camera_id")
    if camera_id:
        path = _find_image(BY_CAMERA_DIR, camera_id)
        if path:
            return path

    path = _find_image(BY_EDGE_DIR, edge["edge_id"])
    if path:
        return path

    if USE_SINGLE_IMAGE and os.path.isfile(SINGLE_IMAGE_PATH):
        return SINGLE_IMAGE_PATH

    return None


def _fetch_config_from_backend():
    nodes_resp = requests.get(f"{BASE_URL}/node/get_all", timeout=5).json()
    edges_resp = requests.get(f"{BASE_URL}/edge/get_all", timeout=5).json()

    edges_by_out_node = {}
    for e in edges_resp:
        edges_by_out_node.setdefault(e["out_node_id"], []).append(e)

    # A node with no outgoing edges has nothing to signal-control, so it
    # doesn't need a simulator process.
    controllable_nodes = [
        n for n in nodes_resp
        if n.get("is_active", True) and edges_by_out_node.get(n["node_id"])
    ]
    # Deterministic order -> deterministic ports across separate launches.
    controllable_nodes.sort(key=lambda n: n["node_id"])

    config = {}
    for idx, node in enumerate(controllable_nodes):
        node_id = node["node_id"]
        port = BASE_PORT + idx

        out_edges = sorted(edges_by_out_node[node_id], key=lambda e: e["edge_id"])

        edge_images = {}
        for edge in out_edges:
            img_path = _resolve_image_for_edge(edge)
            if img_path:
                edge_images[edge["edge_id"]] = img_path
            else:
                print(
                    f"⚠️  [config] No image for edge {edge['edge_id']} "
                    f"(camera_id={edge.get('camera_id') or '—'}). Add "
                    f"node_imgs/by_edge/{edge['edge_id']}.jpg, or set USE_SINGLE_IMAGE."
                )

        entry = {
            "NODE_ID": node_id,
            "NODE_HOST": NODE_HOST,
            "NODE_PORT": port,
            "BASE_URL": BASE_URL,
            "RECOMPUTE_BEFORE": RECOMPUTE_BEFORE,
            "EDGE_IMAGES": edge_images,
        }

        # Reachable by raw node_id...
        config[node_id] = entry
        # ...and also by its short `name`, if it has one and it differs
        # from the node_id, so `python run_node.py a` keeps working for
        # nodes you named "a"/"b"/etc. — but nothing requires that naming
        # anymore.
        short_name = (node.get("name") or "").strip().lower()
        if short_name and short_name != node_id:
            config[short_name] = entry

        label = f"{short_name} ({node_id})" if short_name else node_id
        print(f"✅ [config] {label} → port {port}  edges: {list(edge_images.keys())}")

    if not controllable_nodes:
        print(
            "⚠️  [config] No nodes with outgoing edges found. Create nodes + "
            "edges from the frontend (the /add page), then restart the simulator."
        )

    return config


def load_nodes():
    """Load config, retrying until backend is reachable."""
    try:
        cfg = _fetch_config_from_backend()
        if cfg:
            return cfg
    except Exception as e:
        print(f"[config] WARNING: Backend not reachable: {e}")

    print("[config] ERROR: Could not build config from backend. Is the server running?")
    sys.exit(1)


# Auto-load on import
NODES = load_nodes()