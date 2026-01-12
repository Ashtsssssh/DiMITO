import socket
import json

NODE_HOST = "127.0.0.1"
NODE_PORT = 9002


class Car:
    def __init__(self, car_id, destination):
        self.car_id = car_id
        self.destination = destination

    def ask_node(self):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.connect((NODE_HOST, NODE_PORT))

        req = {
            "type": "NEXT_EDGE",
            "car_id": self.car_id,
            "destination": self.destination
        }

        s.send(json.dumps(req).encode())
        resp = json.loads(s.recv(4096).decode())
        s.close()

        print(f"🚗 {self.car_id} → {resp}")


if __name__ == "__main__":
    cars = [
        Car("C1", "N5"),
        Car("C2", "N5"),
        Car("C3", "N8"),
    ]

    for car in cars:
        car.ask_node()
