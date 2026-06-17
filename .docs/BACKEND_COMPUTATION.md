# DiMITO — Backend Computation Reference

> **Scope.** This document covers the two core verticals of the DiMITO backend —
> **Adaptive Green-Time Allocation** and **Distance-Vector Routing** — along
> with the shared ML perception layer that feeds both.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)

2. [Shared Perception Layer (ML)](#2-shared-perception-layer-ml)
   - 2.1 YOLO Detection
   - 2.2 Queue Length
   - 2.3 Density
3. [Vertical 1 — Adaptive Green-Time Allocation](#3-vertical-1--adaptive-green-time-allocation)
   - 3.1 Theoretical Foundation
   - 3.2 Input Normalisation
   - 3.3 Pressure Computation
   - 3.4 EMA Smoothing
   - 3.5 Demand Computation
   - 3.6 Proportional Green Allocation
   - 3.7 Dynamic Cycle Time
   - 3.8 Signal Phase Scheduling
   - 3.9 Node-Sim Green Loop
4. [Vertical 2 — Distance-Vector Routing](#4-vertical-2--distance-vector-routing)
   - 4.1 Theoretical Foundation
   - 4.2 Edge Cost Function
   - 4.3 Bootstrap Phase
   - 4.4 DV Propagation
   - 4.5 Stability Controls
   - 4.6 Routing Table Serving
   - 4.7 Probabilistic Path Selection
5. [Data Model](#5-data-model)
6. [End-to-End Flow Diagrams](#6-end-to-end-flow-diagrams)
7. [Constants Reference](#7-constants-reference)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      client/traffic_node (per node)                    │
│   ┌──────────────┐           ┌──────────────┐              │
│   │  green_loop   │           │ routing_loop  │              │
│   │ (GreenManager)│           │ (fetch table) │              │
│   └──────┬───────┘           └──────┬───────┘              │
│          │ POST /green/:n/:e        │ GET /gettable/:n      │
│          ▼                          ▼                       │
├──────────────────── Django REST API ────────────────────────┤
│   views.py                                                  │
│     ├─ process_green_signal()  ─┐                           │
│     │                           │                           │
│     ├─ get_signal_state()       │  get_routing_table()      │
│     │                           │        │                  │
│     ▼                           ▼        ▼                  │
│  ┌──────────┐  ┌────────────┐ ┌──────────────────┐          │
│  │ml_service│  │green_time_ │ │routing_dv_service│          │
│  │          │  │service     │ │                  │          │
│  └────┬─────┘  └────────────┘ └──────────────────┘          │
│       │            ▲                    ▲                   │
│       │  metrics   │ states             │ edge costs        │
│       ▼            │                    │                   │
│  ┌──────────┐  ┌───┴────────────────────┴──┐                │
│  │  N1T2/   │  │      MongoDB (edges,      │                │
│  │  infer   │  │    nodes, routing_table)  │                │
│  └──────────┘  └───────────────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

**Key principle:** The ML layer produces only *physical measurements*
(`queue_length_m`, `density`). All *control quantities* (pressure, demand,
cost) are computed in the controller/routing layer, which has access to
temporal context (wait time) that ML does not.

---

## 2. Shared Perception Layer (ML)

**Files:** `ml_service.py` → `test_model.py` → `infer.py`

### 2.1 YOLO Detection

1. **ROI Lookup** — `ml_service._get_roi(camera_id)` resolves the
   Region of Interest polygon + road geometry for the camera.
2. **Image Masking** — `test_model.py` loads the image, creates a black
   mask outside the ROI polygon, and passes the masked image to YOLO.
3. **Inference** — `infer.py` runs YOLOv8n detection inside the ROI,
   returning per-class counts:

```python
vehicle_counts = {
    "car":   int,
    "bike":  int,
    "truck": int,
    "total": int
}
```

### 2.2 Queue Length — $Q_e$

**Formula:**

$$Q_e = \min\!\left(\sum_{i} l_i,\; L_q\right)$$

| Symbol | Meaning | Value |
|--------|---------|-------|
| $l_i$ | Length of detected vehicle $i$ | car = 4.5 m, bike = 2.0 m, truck = 10.0 m |
| $L_q$ | Queue zone (= `road_length_m`) | per edge (from DB) |

Per-class lengths are summed; any vehicles not classified as car/bike/truck
use a fallback of 4.5 m. The sum is capped at road length to prevent
physically impossible queue values.

### 2.3 Density — $D_e$

**Formula (Occupancy Ratio):**

$$D_e = \min\!\left(\frac{Q_e}{L_{\text{lane}} \times n_{\text{lanes}}},\; 1\right)$$

| Symbol | Meaning | Derivation |
|--------|---------|------------|
| $L_{\text{lane}}$ | Lane length | `road_length_m` |
| $n_{\text{lanes}}$ | Number of lanes | `road_width_m / 3.5` (≥ 1) |

$D_e \in [0, 1]$ — this is an **occupancy ratio**, not a raw vehicle count.

### 2.4 ML Output

```python
{
    "vehicle_counts": int,       # total detections
    "queue_length_m":  float,    # Q_e in metres
    "density":         float     # D_e ∈ [0, 1]
}
```

**Pressure is NOT computed here.** It requires `last_green_ts` (wait-time
context) that only the controller layer possesses.

---

## 3. Vertical 1 — Adaptive Green-Time Allocation

**File:** `green_time_service.py`  
**Technique:** Demand-proportional allocation with controller-derived pressure

### 3.1 Theoretical Foundation

The green-time controller implements a **demand-proportional fixed-cycle
allocation**. Each approach edge (arm) to an intersection is assigned a
*demand score* that combines:

- **Queue congestion** — how physically full the road is
- **Waiting fairness** — how long since the edge last had green
- **Pressure** — a composite congestion signal

Green time is then distributed proportionally to demand, subject to
minimum/maximum bounds. This is a variant of the *Webster cycle split*
approach adapted for real-time ML feeds rather than static loop-detector
counts.

### 3.2 Input Normalisation

All raw measurements are normalised to $[0,\,1]$ **before** any
computation. This prevents dimensional mixing (metres vs seconds vs ratios).

| Normalised Variable | Formula | Ceiling Constant |
|---------------------|---------|-------------------|
| $Q_n$ (queue) | $\min\!\left(\dfrac{Q_m}{\text{MAX\_QUEUE}},\; 1\right)$ | MAX_QUEUE = **80 m** |
| $W_n$ (wait) | $\min\!\left(\dfrac{t_{\text{now}} - t_{\text{last\_green}}}{\text{MAX\_WAIT}},\; 1\right)$ | MAX_WAIT = **90 s** |
| $D_n$ (density) | Already $\in [0,1]$ from ML | — |

**Why MAX_QUEUE = 80 m?** A typical urban arterial approach at an
intersection is 60–120 m. At 80 m the normalised queue reaches 1.0
for a moderately full road, triggering maximum response early enough
to prevent queue spillback.

**Why MAX_WAIT = 90 s?** Beyond 90 s of red, driver frustration grows
non-linearly. Capping at 90 ensures $W_n = 1.0$ triggers maximum
"unfairness" pressure before the situation becomes unacceptable.

### 3.3 Pressure Computation

Pressure $P$ is a weighted composite of the three normalised inputs.
It serves as a **single congestion indicator** that captures both spatial
(queue, density) and temporal (wait) aspects.

$$P = w_q \cdot Q_n + w_d \cdot D_n + w_w \cdot W_n$$

| Weight | Symbol | Value | Role |
|--------|--------|-------|------|
| Queue | $w_q$ | **0.50** | Primary congestion signal |
| Density | $w_d$ | **0.30** | Road occupancy |
| Wait | $w_w$ | **0.20** | Fairness |

Since all inputs $\in [0,1]$ and weights sum to 1.0:

$$P \in [0,\; 1]$$

Queue dominates because physical backup is the strongest indicator
of a need for green time. Wait time provides a fairness guarantee —
even a lightly loaded edge will accumulate pressure over time.

### 3.4 EMA Smoothing (Stability)

ML detections fluctuate frame-to-frame due to occlusion, lighting, and
model noise. To prevent green-time oscillation, pressure is smoothed
with an **Exponential Moving Average**:

$$P_{\text{smooth}} = \alpha \cdot P_{\text{raw}} + (1 - \alpha) \cdot P_{\text{prev}}$$

| Parameter | Value | Effect |
|-----------|-------|--------|
| $\alpha$ | **0.7** | 70% new sample, 30% history |

- **First call** for an edge: $P_{\text{prev}} := P_{\text{raw}}$ (no cold-start artefact)
- **Warm-up:** one cycle is enough; the dict resets naturally on server restart
- **Memory:** in-process `dict` keyed by `edge_id` (no DB writes on the read path)

### 3.5 Demand Computation

Demand $d_e$ determines each edge's share of the cycle. It combines the
normalised inputs with the smoothed pressure:

$$d_e = a \cdot Q_n + b \cdot W_n + c \cdot P$$

| Weight | Symbol | Value | Role |
|--------|--------|-------|------|
| Queue | $a$ | **0.60** | Direct need |
| Wait | $b$ | **0.25** | Starvation prevention |
| Pressure | $c$ | **0.15** | Composite refinement |

All three terms are dimensionless and $\in [0,1]$, so:

$$d_e \in [0,\; 1]$$

A **minimum demand floor** `MIN_DEMAND = 0.01` ensures every edge gets
at least a small share even when all signals read zero.

### 3.6 Proportional Green Allocation

Given demands $\{d_e\}$ and a cycle time $C$:

$$g_e = \frac{d_e}{\displaystyle\sum_{e'} d_{e'}} \times C$$

Then clamped:

$$g_e = \text{clamp}(g_e,\; \text{MIN\_GREEN},\; \text{MAX\_GREEN})$$

| Bound | Value |
|-------|-------|
| `MIN_GREEN` | **8 s** |
| `MAX_GREEN` | **45 s** |

This guarantees every approach gets at least 8 s of green (enough for
pedestrians + one platoon) and no single edge monopolises the cycle.

### 3.7 Dynamic Cycle Time

When `cycle_time` is not provided explicitly, it scales with the number
of edges $n$:

$$C = \text{clamp}(n \times 30,\; 40,\; 180)$$

| Edges | Cycle Time |
|-------|-----------|
| 2 | 60 s |
| 3 | 90 s |
| 4 | 120 s |
| 5 | 150 s |
| 6+ | 180 s (cap) |

Larger intersections need longer cycles so each arm still gets
meaningful green after clamping.

### 3.8 Signal Phase Scheduling

**File:** `signal_service.py`

`get_signal_phase(node_id)` determines which edge currently has the
green light and how many seconds remain:

1. Collect all outgoing edges for the node
2. Call `compute_green_times(states)` → `{edge_id: green_seconds}`
3. Sort edges by `edge_id` for a **stable phase queue**
4. Identify the **anchor** — the edge with the most recent `last_green_ts`
5. Walk forward through the queue from the anchor, subtracting elapsed
   time modulo the total cycle, to find the current phase and remaining
   time

This is a **virtual round-robin** — there is no physical timer; the
server reconstructs the current state from timestamps on every call.

### 3.9 Node-Sim Green Loop

**File:** `client/traffic_node/green_loop.py`

Each simulated node runs a `GreenManager` that:

1. **Initialises** with a default schedule (30 s each edge)
2. **Every second** (`tick()`):
   - Prints signal state if changed
   - At `T − 10 s` before phase end: calls `compute_green()` which
     POSTs all edge images to `/api/green/<node_id>/<edge_id>/`
   - At `T = 0`: transitions to next phase and writes `last_green_ts`
     back to the backend via `/api/edge/update/`

This creates a **feedback loop**: ML reads the road → controller sets
green times → green times change the road state → ML reads again.

---

## 4. Vertical 2 — Distance-Vector Routing

**Files:** `routing_dv_service.py` (DV algorithm), `routing_service.py`
(table serving)

### 4.1 Theoretical Foundation

DiMITO uses a **distributed Bellman–Ford (distance-vector)** algorithm
to compute shortest paths through the traffic network. Each node
maintains a routing table:

$$\text{cost}(A \to D) = \min_{B \in \text{neighbors}(A)}\left[\text{cost}(A \to B) + \text{cost}(B \to D)\right]$$

This is the classic DV recurrence. Unlike traditional networking where
link costs are static latencies, **DiMITO's edge costs are dynamic** —
they incorporate real-time congestion (queue, density, pressure) so
routing adapts to live traffic conditions.

The algorithm runs in **discrete iterations** triggered manually (via
`trigger_dv_iteration()` or `dv_update_service` management command).
Multiple iterations converge to a consistent routing table across all
nodes.

### 4.2 Edge Cost Function

**Formula:**

$$\text{cost}(e) = 0.6 \cdot Q_n \cdot Q_{\max} + 0.3 \cdot P \cdot 100 + 0.1 \cdot L_{\text{road}}$$

Where:

| Term | Derivation | Range | Purpose |
|------|-----------|-------|---------|
| $Q_n$ | $\min(Q_m / 80,\; 1)$ | $[0, 1]$ | Normalised queue |
| $P$ | $0.5 Q_n + 0.3 D_n + 0.2 W_n$ (EMA-smoothed) | $[0, 1]$ | Congestion composite |
| $L_{\text{road}}$ | `edge.road_length_m` | metres | Static distance |

The three components are **scaled back** to comparable numeric ranges
before summing:

| Component | Scale | Max Contribution |
|-----------|-------|-----------------|
| Queue | $Q_n \times 80$ | 48 (at 0.6 weight, $Q_n=1$) |
| Pressure | $P \times 100$ | 30 (at 0.3 weight, $P=1$) |
| Road length | $L_{\text{road}}$ | ~10–50 (typical) |

This ensures that **congestion dominates short-term routing decisions**
while road length provides a static baseline (prefer shorter roads
when congestion is equal).

**Pressure is computed identically** to green-time (same formula,
same EMA smoothing, separate in-process cache per module), ensuring
both verticals share the same congestion model.

### 4.3 Bootstrap Phase (Phase 0 + Phase 1)

**Phase 0 — Self-routes:**

For every node $N$ in the graph, create a trivial routing entry:

$$\text{Route}(N \to N,\; \text{via } N) = 0$$

**Phase 1 — Direct edges:**

For every active edge $A \to B$:

$$\text{Route}(A \to B,\; \text{via } B) = \text{cost}(A \to B)$$

If the entry already exists, update with an **exponential moving average**
to prevent cost jitter:

$$c_{\text{new}} = (1 - \alpha_r) \cdot c_{\text{old}} + \alpha_r \cdot c_{\text{computed}}$$

where $\alpha_r = 0.2$ (routing EMA, distinct from the pressure EMA).

### 4.4 DV Propagation (Phase 2)

For every edge $A \to B$, examine all routes from $B$:

$$\forall\; \text{Route}(B \to D):\quad c_{A \to D \text{ via } B} = \text{cost}(A \to B) + c_{B \to D}$$

If $D \neq A$:
- **Existing route:** update with EMA ($\alpha_r = 0.2$)
- **New route:** insert if competitive (see stability controls)

Duplicate processing is prevented with a `processed` set keyed by
$(A, D, B)$.

### 4.5 Stability Controls

| Control | Constant | Purpose |
|---------|----------|---------|
| **EMA smoothing** | $\alpha_r = 0.2$ | Gradually blend new costs, preventing oscillation |
| **MAX_INFLATION** | $1.5\times$ | Reject routes whose cost exceeds the current cost by >50% |
| **Competitive filter** | $1.5\times$ best | New routes must be within 1.5× the best existing route |
| **Pressure EMA** | $\alpha_p = 0.7$ | Smooth raw pressure before it enters cost (§3.4) |

These safeguards prevent the classic **count-to-infinity** problem and
routing oscillations caused by ML noise.

### 4.6 Routing Table Serving

**File:** `routing_service.py`

`build_routing_table_for_node(node_id)` converts raw `RoutingEntry`
documents into a probabilistic routing table:

1. Group entries by `destination_node_id`
2. For each destination, filter to paths with cost ≤ `MAX_COST_RATIO × best_cost`:

$$\text{MAX\_COST\_RATIO} = 3.3$$

3. Convert costs to **Boltzmann probabilities**:

$$w_i = e^{-\beta \cdot c_i}$$

$$p_i = \frac{w_i}{\displaystyle\sum_j w_j}$$

where $\beta = 0.08$ (inverse temperature / randomness control).

**Output format:**

```json
{
  "destination_X": [
    {"next_hop": "node_B", "prob": 0.62},
    {"next_hop": "node_C", "prob": 0.38}
  ]
}
```

### 4.7 Probabilistic Path Selection

**File:** `client/traffic_node/node_server.py`

When a car connects via TCP and sends `{"type": "NEXT_EDGE", "destination": "X"}`:

1. The node looks up `routing_table[destination]`
2. Selects `next_hop` via **weighted random choice** (`random.choices`)
   using the Boltzmann probabilities

This implements **stochastic load balancing** — not all cars take the
shortest path, which naturally distributes traffic across multiple
competitive routes and prevents herd behaviour.

---

## 5. Data Model

### Edge (MongoDB)

```
edge_id          str          Unique identifier
in_node_id       str          Source node
out_node_id      str          Destination node
camera_id        str          Camera for ML
road_length_m    float        Road segment length
road_width_m     float        Road width
outgoing_traffic DictField    {
                                total_vehicles:  int
                                queue_length_m:  float
                                density:         float
                                last_green_ts:   int (unix timestamp)
                                last_update_ts:  int (unix timestamp)
                              }
```

### RoutingEntry (MongoDB)

```
from_node_id        str       Origin node
destination_node_id str       Ultimate destination
next_hop_node_id    str       Next node on path
cost                float     Computed edge cost
last_updated        datetime  Timestamp
```

**Unique index:** `(from_node_id, destination_node_id, next_hop_node_id)`
— a node can have multiple routes to the same destination via
different next hops.

---

## 6. End-to-End Flow Diagrams

### Green-Time Flow

```
client/traffic_node/green_loop.py                     Django Backend
       │                                        │
       │──── POST /green/{node}/{edge}/ ──────▶|
       │     (multipart: {edge_id: image} ×N)   │
       │                                        │
       │      ┌─────────────────────────────────┤
       │      │ For each image:                 │
       │      │   ml_service.analyze_edge_image │
       │      │     → ROI lookup                │
       │      │     → YOLO detection            │
       │      │     → Q_e, D_e computation      │
       │      │   data_service.update_traffic   │
       │      │     → write DB                  │
       │      └─────────────────────────────────┤
       │                                        │
       │      ┌─────────────────────────────────┤
       │      │ Reload all edge states from DB  │
       │      │ green_time_service:             │
       │      │   Normalise → Pressure (EMA)    │
       │      │   → Demand → Proportional alloc │
       │      └─────────────────────────────────┤
       │                                        │
       │◀───{green_time:28,ml_results: [...]}──│
       │                                        │
       │ (Phase transition at T=0)              │
       │──── POST /edge/update/{e}/{n}/ ──────▶│
       │     { last_green_ts: now }             │
```

### Routing Flow

```
client/traffic_node/routing_loop             Django Backend
       │                               │
       │  (every 10s)                  │
       │── GET /gettable/{node}/ ─────▶│
       │                               │ routing_service:
       │                               │   query RoutingEntries
       │                               │   filter + Boltzmann probs
       │◀── { routing_table: {...} } ──│
       │                               │
       │                               │
 car_sim (TCP)                         │
       │                               │
       │──── {"type":"NEXT_EDGE",      │
       │      "destination":"X"} ─────▶│ (handled by node_server)
       │                               │   random.choices(probs)
       │◀── {"next_node":"B"} ────────│
```

### DV Iteration (Separate Trigger)

```
trigger_dv_iteration()  or  manage.py dv_update
       │
       ▼
  routing_dv_service.run_routing_dv_iteration()
       │
       ├── Phase 0: self-routes
       ├── Phase 1: bootstrap (edge costs, EMA update)
       └── Phase 2: Bellman-Ford propagation
              For each edge A→B:
                For each route B→D:
                  new_cost = cost(A→B) + cost(B→D)
                  insert or EMA-update Route(A→D via B)
```

---

## 7. Constants Reference

### Green-Time Service

| Constant | Value | Purpose |
|----------|-------|---------|
| `MIN_GREEN` | 8 s | Minimum green per edge |
| `MAX_GREEN` | 45 s | Maximum green per edge |
| `CYCLE_PER_EDGE` | 30 s | Base cycle contribution per edge |
| `MIN_CYCLE_TIME` | 40 s | Floor for dynamic cycle |
| `MAX_CYCLE_TIME` | 180 s | Ceiling for dynamic cycle |
| `MAX_QUEUE_M` | 80 m | Queue normalisation ceiling |
| `MAX_WAIT` | 90 s | Wait normalisation ceiling |
| `ALPHA_EMA` | 0.7 | Pressure EMA weight (new sample) |
| `W_P_QUEUE` | 0.50 | Pressure: queue weight |
| `W_P_DENSITY` | 0.30 | Pressure: density weight |
| `W_P_WAIT` | 0.20 | Pressure: wait weight |
| `W_D_QUEUE` | 0.60 | Demand: queue weight |
| `W_D_WAIT` | 0.25 | Demand: wait weight |
| `W_D_PRESSURE` | 0.15 | Demand: pressure weight |
| `MIN_DEMAND` | 0.01 | Demand floor |

### Routing Service

| Constant | Value | Purpose |
|----------|-------|---------|
| `ALPHA` | 0.2 | Routing cost EMA weight |
| `MAX_INFLATION` | 1.5× | Max cost increase per iteration |
| `MAX_QUEUE_M` | 80 m | Queue normalisation (same as green-time) |
| `MAX_WAIT` | 90 s | Wait normalisation (same as green-time) |
| `ALPHA_EMA` | 0.7 | Pressure EMA weight |
| `BETA` | 0.08 | Boltzmann inverse temperature |
| `MAX_COST_RATIO` | 3.3× | Path filter vs best cost |

### ML Service

| Constant | Value | Purpose |
|----------|-------|---------|
| `VEHICLE_LENGTHS` car | 4.5 m | Queue length per car |
| `VEHICLE_LENGTHS` bike | 2.0 m | Queue length per bike |
| `VEHICLE_LENGTHS` truck | 10.0 m | Queue length per truck |
| `AVG_VEHICLE_LENGTH_M` | 4.5 m | Fallback for unclassified |
| `AVG_LANE_WIDTH_M` | 3.5 m | Lane width for n_lanes calc |

---

*Generated from source: `green_time_service.py`, `routing_dv_service.py`,
`routing_service.py`, `ml_service.py`, `signal_service.py`,
`data_service.py`, `models.py`, `green_loop.py`, `node_server.py`*
