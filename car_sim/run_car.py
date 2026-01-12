from car_sim.car_client import Car
from node_sim.node import TrafficNode
from node_sim.config import NODE_ID, EDGE_IMAGES

# NOTE:
# This is only for local simulation.
# In real deployment, cars talk to node over HTTP / socket.

node = TrafficNode(NODE_ID, EDGE_IMAGES)
node.fetch_routing_table()

cars = [
    Car("C1", "N5"),
    Car("C2", "N5"),
    Car("C3", "N8"),
]

for car in cars:
    car.ask_node(node)
