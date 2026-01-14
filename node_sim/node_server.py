import socket
import json
import threading
import random
import time
import requests

from config import *
from green_loop import GreenManager


class NodeServer:
    def __init__(self):
        self.routing_table = {}
        self.green_mgr = GreenManager(NODE_ID, EDGE_IMAGES)
        self._initialized = False


    # ---------- ROUTING ----------
    def fetch_routing_table(self):
        try:
            r = requests.get(
                f"{BASE_URL}/gettable/node/{NODE_ID}/",
                timeout=2
            )
            if r.status_code != 200:
                print("⚠️ Routing API error:", r.status_code, r.text)
                return

            data = r.json()
            rt = data.get("routing_table")
            if not rt:
                print("⚠️ No routing_table in response:", data)
                return

            self.routing_table = rt
            print("📡 Routing table:")
            for dest, choices in self.routing_table.items():
                print(f"   Destination {dest}:")
                for c in choices:
                    nh = c["next_hop"]
                    p = c["prob"]
                    print(f"      → next_hop={nh}, prob={p:.3f}")


        except Exception as e:
            print("⚠️ Routing fetch failed:", e)

    def routing_loop(self):
        while True:
            self.fetch_routing_table()
            time.sleep(10)  # later can be 15–30s

    # ---------- CAR REQUEST ----------
    def handle_car(self, conn, addr):
        try:
            conn.settimeout(2)
            data = conn.recv(4096).decode()
            req = json.loads(data)

            if req.get("type") != "NEXT_EDGE":
                conn.send(json.dumps({"error": "INVALID_REQUEST"}).encode())
                return

            dest = req.get("destination")
            choices = self.routing_table.get(dest)

            if not choices:
                resp = {"error": "NO_ROUTE"}
            else:
                next_nodes = [c["next_hop"] for c in choices]
                probs = [c["prob"] for c in choices]
                next_node = random.choices(next_nodes, probs)[0]
                resp = {"next_node": next_node}

            conn.send(json.dumps(resp).encode())

        except Exception as e:
            print("⚠️ Car handling failed:", e)

        finally:
            conn.close()

    # ---------- GREEN LOOP ----------
    def green_loop(self):
        # try initial computation, but never crash
        try:
            self.green_mgr.compute_green()
        except Exception as e:
            print("⚠️ Initial green compute failed:", e)

        while True:
            try:
                self.green_mgr.tick()
            except Exception as e:
                print("⚠️ Green loop error:", e)
            time.sleep(1)

    # ---------- SERVER ----------
    def start(self):
        threading.Thread(target=self.green_loop, daemon=True).start()
        threading.Thread(target=self.routing_loop, daemon=True).start()

        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind((NODE_HOST, NODE_PORT))
        s.listen(10)

        print(f"🚦 Node {NODE_ID} on {NODE_HOST}:{NODE_PORT}")

        while True:
            conn, addr = s.accept()
            threading.Thread(
                target=self.handle_car,
                args=(conn, addr),
                daemon=True
            ).start()
