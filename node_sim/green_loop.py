import time
import requests
from config import BASE_URL, RECOMPUTE_BEFORE

# sdfgfdsdf
class GreenManager:
    def __init__(self, node_id, edge_images):
        self.node_id = node_id
        self.edge_images = edge_images
        self.green_schedule = []
        self.current_phase = 0
        self.phase_end = 0

    def compute_green(self):
        files = [(eid, open(path, "rb")) for eid, path in self.edge_images.items()]

        r = requests.post(
            f"{BASE_URL}/green/{self.node_id}/",
            files=files
        )
        r.raise_for_status()

        greens = r.json()["green_times"]
        self.green_schedule = [{"edge": e, "green": t} for e, t in greens.items()]

        self.current_phase = 0
        self.phase_end = time.time() + self.green_schedule[0]["green"]
        print("🚦 Green schedule updated")

    def tick(self):
        now = time.time()
        remaining = self.phase_end - now

        if remaining <= RECOMPUTE_BEFORE:
            self.compute_green()

        if remaining <= 0:
            self.current_phase = (self.current_phase + 1) % len(self.green_schedule)
            dur = self.green_schedule[self.current_phase]["green"]
            self.phase_end = now + dur
