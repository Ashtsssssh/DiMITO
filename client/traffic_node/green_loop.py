import time
import requests
from config import RECOMPUTE_BEFORE


class GreenManager:
    def __init__(self, node_id, edge_images, base_url=None):
        self.node_id = node_id
        self.edge_images = edge_images
        self.base_url = base_url or BASE_URL
        self.edge_order = list(edge_images.keys())  # Fixed order for cycling
        
        # Initialize schedule with all edges (times to be filled)
        self.green_schedule = [{"edge": e, "green": 30.0} for e in self.edge_order]
        
        self.current_phase = 0
        self.phase_end = 0
        self._recomputed = False
        self._initialized = False
        self.is_active = True  # Track if this node is actively running
        self.last_status_time = 0  # For periodic status updates
        self.last_printed_state = None  # Track last printed signal state


    def compute_green(self, remaining_time=None, target_edge=None):
        """
        Send all edge images to backend, get green time for the target edge.
        Backend returns: { "edge_id": ..., "green_time": seconds }
        If target_edge is None, uses the first edge in the schedule.
        """
        if target_edge is None:
            target_edge = self.edge_order[0]
        print(f"\n🟢 Requesting green times for edges: {self.edge_order}")
        files = []

        for eid in self.edge_order:
            path = self.edge_images[eid]
            try:
                f = open(path, "rb")
                files.append((eid, f))
                print(f"   ✓ Image for {eid}: {path}")
            except Exception as e:
                print(f"   ❌ Cannot open image for {eid}: {path} - {e}")

        if not files:
            print("⚠️ No images available, skipping green computation")
            return False

        try:
            r = requests.post(
                f"{self.base_url}/green/{self.node_id}/{target_edge}/",
                files=files,
                timeout=3
            )

            if r.status_code != 200:
                print(f"⚠️ Green API error: {r.status_code}")
                print(f"   Response: {r.text}")
                return False

            data = r.json()
            print(f"   Backend response: {data}")

            green_time = data.get("green_time")
            returned_edge = data.get("edge_id")

            if green_time is None or returned_edge is None:
                print(f"⚠️ Green API returned unexpected format")
                print(f"   Full response: {data}")
                return False

            # Update only the target edge in the schedule
            for phase in self.green_schedule:
                if phase["edge"] == returned_edge:
                    phase["green"] = green_time
                    break

            now = time.time()

            # First time: start with first edge in schedule
            if not self._initialized:
                self.current_phase = 0
                self.phase_end = now + self.green_schedule[0]["green"]
                self._initialized = True
                first_edge = self.green_schedule[0]['edge']
                print(f"\n🟢 INITIAL GREEN: {first_edge} ({self.green_schedule[0]['green']:.1f}s)")

                # Update backend so signal API has a fresh last_green_ts
                try:
                    requests.post(
                        f"{self.base_url}/edge/update/{first_edge}/{self.node_id}/",
                        json={
                            "updates": {
                                "last_green_ts": int(time.time()),
                                "is_active": self.is_active
                            }
                        },
                        timeout=2
                    )
                except Exception as ex:
                    print(f"⚠️ Failed to set initial last_green_ts: {ex}")

                self.last_printed_state = None
            else:
                print(f"\n🔄 UPDATED: {returned_edge} green = {green_time:.1f}s")

            self._recomputed = False
            self.last_printed_state = None
            return True

        except Exception as e:
            print(f"⚠️ Green computation failed: {e}")
            import traceback
            traceback.print_exc()
            return False

    def tick(self):
        """
        Called every 1 second. Manages:
        1. Current signal state display (only when changes)
        2. Recomputation before phase ends
        3. Phase transitions with rotation
        """
        if not self.green_schedule:
            return

        now = time.time()
        remaining = self.phase_end - now

        # --- PRINT STATE WHEN IT CHANGES ---
        self._print_state_if_changed(remaining)

        # --- RECOMPUTE before phase ends (at T-10 seconds) ---
        if remaining <= RECOMPUTE_BEFORE and not self._recomputed:
            print(f"\n⏰ Recompute triggered (T-{RECOMPUTE_BEFORE}s remaining)")
            self.compute_green(remaining_time=remaining)
            self._recomputed = True

        # --- PHASE TRANSITION (when time reaches 0) ---
        if remaining <= 0:
            self._transition_phase(now)

    def _print_signal_status(self, remaining):
        """Print current signal state - ONLY ONE edge should be GREEN"""
        if not self.green_schedule or not self._initialized:
            print("⚠️ Signal not initialized")
            return
            
        current_edge = self.green_schedule[self.current_phase]["edge"]
        current_green = self.green_schedule[self.current_phase]["green"]
        
        print(f"\n🚦 SIGNAL STATUS (Phase {self.current_phase}/{len(self.green_schedule)-1}):")
        print(f"   ⏱️  Active edge: {current_edge}")
        print(f"   ⏳ Time remaining: {remaining:.1f}s / {current_green:.1f}s")
        print(f"\n📊 All Edges:")
        for i, phase in enumerate(self.green_schedule):
            edge = phase["edge"]
            is_active = (i == self.current_phase)
            if is_active:
                print(f"      🟢 {edge:3s} - GREEN  ({remaining:.1f}s left)")
            else:
                print(f"      🔴 {edge:3s} - RED    (waiting)")

    def _print_state_if_changed(self, remaining):
        """Print signal state only when it changes (phase transition or recompute)"""
        if not self.green_schedule or not self._initialized:
            return
        
        # Build current state string: "e1-🟢(12.5s) e2-🔴 e3-🔴"
        state_parts = []
        current_edge = self.green_schedule[self.current_phase]["edge"]
        
        for phase in self.green_schedule:
            edge = phase["edge"]
            if edge == current_edge:
                state_parts.append(f"{edge}-🟢({remaining:.1f}s)")
            else:
                state_parts.append(f"{edge}-🔴")
        
        current_state = " ".join(state_parts)
        
        # Only print if state changed
        if current_state != self.last_printed_state:
            print(f"🟢 Node {self.node_id}: {current_state}")
            self.last_printed_state = current_state

    def _transition_phase(self, now):
        """Handle phase transition and rotation"""
        # Move to next phase
        old_edge = self.green_schedule[self.current_phase]["edge"]
        self.current_phase = (self.current_phase + 1) % len(self.green_schedule)
        new_edge = self.green_schedule[self.current_phase]["edge"]
        new_green = self.green_schedule[self.current_phase]["green"]

        print(f"\n{'='*70}")
        print(f"🔄 PHASE TRANSITION")
        print(f"   Previous: {old_edge} (GREEN) → 🔴 RED")
        print(f"   Current:  {new_edge} → 🟢 GREEN ({new_green:.1f}s)")
        print(f"{'='*70}\n")

        # Update backend with new active edge
        try:
            requests.post(
                f"{self.base_url}/edge/update/{new_edge}/{self.node_id}/",
                json={
                    "updates": {
                        "last_green_ts": int(time.time()),
                        "is_active": self.is_active
                    }
                },
                timeout=2
            )
        except Exception as e:
            print("⚠️ Failed to update last_green_ts:", e)

        # Set next phase end time
        self.phase_end = now + new_green
        self._recomputed = False
        self.last_printed_state = None  # Clear state so new phase gets printed

    def get_green_edge(self):
        """Return the currently GREEN edge. All others are RED."""
        if not self.green_schedule or not self._initialized:
            return None
        return self.green_schedule[self.current_phase]["edge"]

    def get_all_signal_states(self):
        """Return dict of {edge: 'GREEN'|'RED'} for all edges"""
        if not self.green_schedule or not self._initialized:
            return {edge: "RED" for edge in self.edge_images.keys()}
        
        states = {}
        green_edge = self.get_green_edge()
        for phase in self.green_schedule:
            edge = phase["edge"]
            states[edge] = "GREEN" if edge == green_edge else "RED"
        
        return states
