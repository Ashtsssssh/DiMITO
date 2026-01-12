import socket
import json
import threading
import random
import time
import requests

from config import *
from green_loop import GreenManager
# 

class NodeServer:
    def __init__(self):
        self.routing_table = {}
        self.green_mgr = GreenManager(NODE_ID, EDGE_IMAGES)

    # ---------- ROUTING ----------
    def fetch_routing_table(self):
        r = requests.get(f"{BASE_URL}/gettable/node/{NODE_ID}/")
        r.raise_for_status()
        self.routing_table = r.json()["routing_table"]
        print("📡 Routing table loaded")

    # ---------- CAR REQUEST ----------
    def handle_car(self, conn, addr):
        try:
            data = conn.recv(4096).decode()
            req = json.loads(data)

            if req["type"] == "NEXT_EDGE":
                dest = req["destination"]
                choices = self.routing_table.get(dest)

                if not choices:
                    resp = {"error": "NO_ROUTE"}
                else:
                    edges = [c["edge_id"] for c in choices]
                    probs = [c["prob"] for c in choices]
                    edge = random.choices(edges, probs)[0]
                    resp = {"next_edge": edge}

                conn.send(json.dumps(resp).encode())
        finally:
            conn.close()

    # ---------- GREEN LOOP ----------
    def green_loop(self):
        self.green_mgr.compute_green()
        while True:
            self.green_mgr.tick()
            time.sleep(1)

    # ---------- SERVER ----------
    def start(self):
        self.fetch_routing_table()

        threading.Thread(target=self.green_loop, daemon=True).start()

        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.bind((NODE_HOST, NODE_PORT))
        s.listen(10)

        print(f"🚦 Node {NODE_ID} listening on {NODE_HOST}:{NODE_PORT}")

        while True:
            conn, addr = s.accept()
            threading.Thread(
                target=self.handle_car,
                args=(conn, addr),
                daemon=True
            ).start()


# if __name__ == "__main__":
#     NodeServer().start()
