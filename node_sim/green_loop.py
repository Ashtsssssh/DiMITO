import time
import requests
from config import BASE_URL, RECOMPUTE_BEFORE


class GreenManager:
    def __init__(self, node_id, edge_images):
        self.node_id = node_id
        self.edge_images = edge_images
        self.green_schedule = []
        self.current_phase = 0
        self.phase_end = 0
        self._recomputed = False
        self._initialized = False


    def compute_green(self):
        files = []

        for eid, path in self.edge_images.items():
            try:
                files.append((eid, open(path, "rb")))
            except Exception as e:
                print(f"⚠️ Cannot open image for {eid}:", e)

        if not files:
            print("⚠️ No images available, skipping green computation")
            return

        try:
            r = requests.post(
                f"{BASE_URL}/green/{self.node_id}/",
                files=files,
                timeout=3
            )

            if r.status_code != 200:
                print("⚠️ Green API error:", r.status_code, r.text)
                return

            data = r.json()
            greens = data.get("green_times")

            if not greens:
                print("⚠️ Green API returned no green_times:", data)
                return

            self.green_schedule = [
                {"edge": e, "green": t}
                for e, t in greens.items()
            ]
            
            now = time.time()

# first ever compute
            if not self._initialized:
                self.current_phase = 0
                self.phase_end = now + self.green_schedule[0]["green"]
                self._initialized = True
            else:
                # recompute: keep current phase, only adjust remaining time
                cur_edge = self.green_schedule[self.current_phase]["edge"]
                new_green = next(
                    p["green"] for p in self.green_schedule if p["edge"] == cur_edge
                )
                self.phase_end = now + new_green
            
            self._recomputed = False

            print("🚦 Green schedule updated")
            for i, phase in enumerate(self.green_schedule):
                print(
                    f"   Phase {i}: "
                    f"edge={phase['edge']} | "
                    f"green={phase['green']:.1f}s"
    )
            

        except Exception as e:
            print("⚠️ Green computation failed:", e)

    def tick(self):
        if not self.green_schedule:
            return

        now = time.time()
        remaining = self.phase_end - now

        # recompute once before phase ends
        if remaining <= RECOMPUTE_BEFORE and not self._recomputed:
            self.compute_green()
            self._recomputed = True

        # phase transition
        if remaining <= 0:
            self.current_phase = (self.current_phase + 1) % len(self.green_schedule)
            edge_id = self.green_schedule[self.current_phase]["edge"]
            print("🚦 SIGNAL STATE:")
            for phase in self.green_schedule:
                e = phase["edge"]
                if e == edge_id:
                    print(f"   🟢 GREEN  {e}")
                else:
                    print(f"   🔴 RED    {e}")


            # mark actual green start
            try:
                requests.post(
                    f"{BASE_URL}/edge/update/{edge_id}/{self.node_id}/",
                    json={
                        "updates": {
                            "last_green_ts": int(time.time())
                        }
                    },
                    timeout=2
                )
            except Exception as e:
                print("⚠️ Failed to update last_green_ts:", e)

            dur = self.green_schedule[self.current_phase]["green"]
            self.phase_end = now + dur
            self._recomputed = False
