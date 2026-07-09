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
        Send all edge images to backend, get green times for ALL edges.

        Backend now returns:
            {
              "edge_id":    <target_edge>,
              "green_time": <seconds for target>,
              "green_times": { edge_id: seconds, ... },   # full schedule
              "ml_results": [...]
            }

        We update the ENTIRE green_schedule from `green_times` so that
        all upcoming phases run with freshly-computed durations, not the
        stale 30s default they were initialised with.

        Falls back to single-edge update if backend is an older version
        that doesn't include the `green_times` dict.
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
                timeout=30   # ML inference (YOLO) can take 5-30s per request
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

            # ── Bulk-update schedule from full green_times dict ──────────────
            # The backend now returns green times for ALL edges in the
            # intersection. Applying them here keeps every upcoming phase in
            # sync with the latest ML + wait-pressure computation, instead of
            # leaving non-target edges at their stale initialisation value (30s).
            all_green_times = data.get("green_times")  # {edge_id: seconds}

            if all_green_times:
                for phase in self.green_schedule:
                    eid = phase["edge"]
                    if eid in all_green_times:
                        old = phase["green"]
                        phase["green"] = all_green_times[eid]
                        if old != all_green_times[eid]:
                            print(f"   📅 Schedule updated: {eid} {old:.1f}s → {all_green_times[eid]:.1f}s")
                print(f"   ✅ Full schedule synced ({len(all_green_times)} edges)")
            else:
                # Backward-compat: old backend returns only the target edge's time
                for phase in self.green_schedule:
                    if phase["edge"] == returned_edge:
                        phase["green"] = green_time
                        break
                print(f"   ⚠️ Backend did not return green_times dict — "
                      f"only {returned_edge} updated (upgrade backend for full sync)")

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
        NOTE: This method is NOT called by node_server.green_loop().
        node_server uses a direct sleep-based loop that calls compute_green(),
        _transition_phase(), and _print_signal_status() directly.

        Kept for reference only — do not wire in without reviewing the timing
        logic in node_server.green_loop() first.
        """
        pass

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
