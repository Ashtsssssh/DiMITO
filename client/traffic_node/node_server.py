import socket
import json
import threading
import random
import time
import requests
import sys

from green_loop import GreenManager
from config import NODES


class NodeServer:
    def __init__(self, node_id):
        # Look up config from unified NODES dict
        if node_id not in NODES:
            raise ValueError(f"Unknown node_id '{node_id}'. Available: {list(NODES.keys())}")
        cfg = NODES[node_id]
        self.NODE_ID = cfg["NODE_ID"]
        self.NODE_HOST = cfg["NODE_HOST"]
        self.NODE_PORT = cfg["NODE_PORT"]
        self.BASE_URL = cfg["BASE_URL"]
        self.EDGE_IMAGES = cfg["EDGE_IMAGES"]
        self.RECOMPUTE_BEFORE = cfg.get("RECOMPUTE_BEFORE", 10)
        
        self.routing_table = {}
        self.green_mgr = GreenManager(self.NODE_ID, self.EDGE_IMAGES, self.BASE_URL)
        self._initialized = False


    # ---------- ROUTING ----------
    def fetch_routing_table(self):
        try:
            r = requests.get(
                f"{self.BASE_URL}/gettable/node/{self.NODE_ID}/",
                timeout=2
            )
            if r.status_code != 200:
                print("⚠️ Routing API error:", r.status_code, r.text)
                return

            data = r.json()
            rt = data.get("routing_table")
            # Distinguish between missing key (None) and an empty routing table ({} / [])
            if rt is None:
                print("⚠️ No routing_table key in response:", data)
                return

            if not rt:
                # routing_table present but empty — informational, not an error
                print("ℹ️ routing_table present but empty:", {"node_id": data.get("node_id"), "generated_at": data.get("generated_at")})
                # keep routing_table as empty dict
                self.routing_table = {}
                return

            self.routing_table = rt
            # print("📡 Routing table:")
            # for dest, choices in self.routing_table.items():
            #     print(f"   Destination {dest}: {len(choices)} path(s)")
            #     for c in choices:
            #         nh = c["next_hop"]
            #         p = c["prob"]
            #         print(f"      → next_hop={nh}, prob={p:.3f} ({p*100:.1f}%)")


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

            # Get current signal states
            signal_states = self.green_mgr.get_all_signal_states()
            green_edge = self.green_mgr.get_green_edge()

            if not choices:
                print(f"⚠️ Car from {addr[0]}:{addr[1]} requested unreachable destination: {dest}")
                resp = {"error": "NO_ROUTE"}
            else:
                # Extract next hops and probabilities
                next_nodes = [c["next_hop"] for c in choices]
                probs = [c["prob"] for c in choices]
                
                # Log what options are available
                print(f"\n🚗 Car request from {addr[0]}:{addr[1]}")
                print(f"   Destination: {dest}")
                print(f"   📡 Signal state:")
                for edge, state in signal_states.items():
                    symbol = "🟢" if state == "GREEN" else "🔴"
                    print(f"      {symbol} {edge}: {state}")
                # print(f"   🛣️ Available paths:")
                # for nh, prob in zip(next_nodes, probs):
                #     print(f"      → {nh}: {prob*100:.1f}%")
                
                # Randomly select based on probability weights
                next_node = random.choices(next_nodes, probs)[0]
                
                print(f"   ✅ Selected: {next_node}")
                resp = {"next_node": next_node}

            conn.send(json.dumps(resp).encode())

        except Exception as e:
            print("⚠️ Car handling failed:", e)

        finally:
            conn.close()

    # ---------- GREEN LOOP ----------
    def green_loop(self):
        # initial backend call to get green times
        try:
            print("\n🟢 [GREEN LOOP] Starting green manager initialization...")
            success = self.green_mgr.compute_green()
            while not success:
                print("⚠️ [GREEN LOOP] Initial compute failed, retrying in 5s...")
                time.sleep(5)
                success = self.green_mgr.compute_green()
        except Exception as e:
            print(f"⚠️ [GREEN LOOP] Initial green compute failed: {e}")
            return

        recompute_before = self.RECOMPUTE_BEFORE

        while True:
            try:
                phase = self.green_mgr.green_schedule[self.green_mgr.current_phase]
                green_time = phase["green"]
                edge = phase["edge"]

                self.green_mgr._print_signal_status(green_time)

                if green_time > recompute_before:
                    # sleep until T-10s
                    wait = green_time - recompute_before
                    print(f"⏳ {edge} GREEN for {green_time:.1f}s — sleeping {wait:.1f}s before recompute")
                    time.sleep(wait)

                    # at T-10s: call backend for next edge's green time
                    next_idx = (self.green_mgr.current_phase + 1) % len(self.green_mgr.green_schedule)
                    next_edge = self.green_mgr.green_schedule[next_idx]["edge"]
                    print(f"\n⏰ Recompute triggered ({recompute_before}s left for {edge}) — fetching {next_edge}")
                    self.green_mgr.compute_green(remaining_time=recompute_before, target_edge=next_edge)

                    # sleep the remaining 10s
                    time.sleep(recompute_before)
                else:
                    # green <= 10s: recompute immediately, then wait full duration
                    next_idx = (self.green_mgr.current_phase + 1) % len(self.green_mgr.green_schedule)
                    next_edge = self.green_mgr.green_schedule[next_idx]["edge"]
                    print(f"\n⏰ Green {green_time:.1f}s ≤ {recompute_before}s — fetching {next_edge} now")
                    self.green_mgr.compute_green(remaining_time=green_time, target_edge=next_edge)
                    time.sleep(green_time)

                # phase transition: current GREEN → RED, next edge → GREEN
                self.green_mgr._transition_phase(time.time())

            except Exception as e:
                print(f"⚠️ [GREEN LOOP] Error: {e}")
                time.sleep(1)

    # ---------- SERVER ----------
    def start(self):
        threading.Thread(target=self.green_loop, daemon=True).start()
        threading.Thread(target=self.routing_loop, daemon=True).start()

        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        s.bind((self.NODE_HOST, self.NODE_PORT))
        s.listen(10)

        print(f"🚦 Node {self.NODE_ID} on {self.NODE_HOST}:{self.NODE_PORT}")

        while True:
            conn, addr = s.accept()
            threading.Thread(
                target=self.handle_car,
                args=(conn, addr),
                daemon=True
            ).start()
