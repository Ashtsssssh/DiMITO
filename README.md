# DiMITO: Distributed Machine-Learning Intelligent Traffic Optimization

DiMITO is a comprehensive, adaptive traffic management system designed to optimize traffic light schedules and vehicle routing across a network of intersections. By combining real-time computer vision with dynamic graph routing algorithms, DiMITO minimizes wait times and improves overall traffic flow in complex road networks.

## Key Features

*   **Adaptive Traffic Signals**: Uses YOLO-based object detection (YOLOv8/11) to analyze traffic camera feeds and dynamically calculate optimal green light durations for each edge of an intersection.
*   **Dynamic Network Routing**: Implements a Distance Vector routing engine (Bellman-Ford) to compute optimal multi-hop paths for vehicles, responding in real-time to congestion and wait times.
*   **Interactive Visualizer & Editor**: A React-based frontend dashboard that allows users to interactively map out road networks, edit intersections (nodes) and roads (edges), and visualize traffic state and signal schedules.
*   **Distributed Traffic Simulation**: A Python-based traffic node simulator that acts as independent intersection controllers, continuously uploading traffic images and applying dynamic phase schedules from the central server.
*   **Robust Backend**: Built on Django and MongoDB, ensuring fast API responses, efficient data storage, and scalable traffic data management.

## Technology Stack

*   **Backend Server**: Python, Django, Django REST Framework
*   **Database**: MongoDB (via MongoEngine)
*   **Machine Learning**: Ultralytics YOLO (Object Detection), OpenCV, NumPy, Pillow
*   **Frontend Client**: React, Vite, Tailwind CSS
*   **Traffic Simulator**: Python (Local distributed processes via `run_all_nodes.py`)

## Project Structure

```text
DiMITO/
├── client/
│   ├── frontend/         # React + Vite frontend application
│   └── traffic_node/     # Python traffic node simulator & green loop controllers
├── server/
│   ├── backend/          # Django server, routing logic, DB models, and API endpoints
│   ├── ml/               # YOLO model weights and ROI extraction for vehicle detection
│   └── server/           # Django project configuration
├── requirements.txt      # Python backend and ML dependencies
└── changes_done.md       # Running log of fixes and architectural changes
```

## How It Works

1.  **Network Setup**: Using the frontend visualizer, nodes (intersections) and edges (roads) are mapped out, defining properties like lane counts and assigning traffic cameras.
2.  **Traffic Simulation**: The `traffic_node` scripts simulate intersection controllers. Each node periodically captures traffic images (or uses simulated assets) and sends them to the server.
3.  **ML Inference**: The backend receives the images, passing them through the YOLO model to detect vehicle density and queue lengths.
4.  **Signal Optimization**: The system calculates the optimal green light duration for each lane based on the detected traffic and a weighted cost model.
5.  **Dynamic Routing**: The server updates the network graph costs and runs a Bellman-Ford iteration to recalculate the best routes across the entire city network.
6.  **Real-time Updates**: The new signal timings are pushed back down to the simulator nodes, and the frontend updates its visual representation of the network flow.

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- MongoDB instance running locally or accessible via connection string.

### 1. Backend Setup
```bash
# Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the Django server
cd server
python manage.py runserver
```

### 2. Frontend Setup
```bash
cd client/frontend

# Install Node dependencies
npm install

# Start the Vite development server
npm run dev
```

### 3. Run the Traffic Simulator
Ensure the backend server is running and the database has a configured network (via the frontend UI).
```bash
cd client/traffic_node

# Run all simulated intersection nodes
python run_all_nodes.py
```

## Contributing
Refer to `changes_done.md` for a historical log of system architecture decisions, critical fixes, and known edge cases to assist with further development.

---
*Built to make cities smarter and commutes faster.*
