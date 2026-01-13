import socket
import json

NODE_HOST = "127.0.0.1"
NODE_PORT = 9001   # N1 port

def ask_next_hop(destination):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect((NODE_HOST, NODE_PORT))

    req = {
        "type": "NEXT_EDGE",
        "destination": destination
    }

    s.send(json.dumps(req).encode())
    resp = json.loads(s.recv(4096).decode())
    s.close()

    return resp


if __name__ == "__main__":
    dest = "N4"
    resp = ask_next_hop(dest)
    print("🚗 Car wants to go to", dest)
    print("➡️ Node replied:", resp)
