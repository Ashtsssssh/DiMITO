import time

# ─── Green-time bounds ─────────────────────────────────────────
MIN_GREEN = 8           # seconds — minimum green for any edge
MAX_GREEN = 45          # seconds — maximum green for any edge

# Dynamic cycle_time: scales with number of edges
CYCLE_PER_EDGE = 30     # base seconds per edge
MIN_CYCLE_TIME = 40     # floor (even for 1-2 edges)
MAX_CYCLE_TIME = 180    # ceiling (many edges)

# ─── Normalisation ceilings ────────────────────────────────────
MAX_QUEUE_M = 80.0      # metres — cap for Qn normalisation
MAX_WAIT    = 90        # seconds — cap for Wn (prevents runaway pressure)

# ─── Pressure EMA (smooths ML noise across calls) ─────────────
ALPHA_EMA = 0.7         # weight for new sample; (1-α) for previous
_pressure_ema = {}      # {edge_id: smoothed_P}

# ─── Pressure weights:  P = w1*Qn + w2*D + w3*Wn ──────────────
W_P_QUEUE   = 0.50
W_P_DENSITY = 0.30
W_P_WAIT    = 0.20

# ─── Demand weights:    D = a*Qn + b*Wn + c*P ─────────────────
W_D_QUEUE    = 0.60
W_D_WAIT     = 0.25
W_D_PRESSURE = 0.15

MIN_DEMAND = 0.01       # floor so every lane gets some green


def _dynamic_cycle_time(n_edges: int) -> int:
    """
    Scale cycle_time proportionally to the number of edges.
    More edges -> longer cycle so each still gets meaningful green.

    2 edges -> 60s,  3 -> 90s,  4 -> 120s,  5 -> 150s,  6+ -> 180s cap
    """
    return max(MIN_CYCLE_TIME, min(MAX_CYCLE_TIME, n_edges * CYCLE_PER_EDGE))


def compute_green_times(states, cycle_time=None):
    """
    Controller-layer green-time allocation.

    Pipeline per edge:
        1. Normalise physical measurements to [0, 1]
           Qn = queue_length_m / MAX_QUEUE_M
           Wn = wait_time      / MAX_WAIT
           D  = density         (already [0, 1])

        2. Compute pressure (dimensionless, [0, 1])
           P = w1·Qn + w2·D + w3·Wn

        3. Compute demand   (dimensionless)
           demand = a·Qn + b·Wn + c·P

        4. Proportional allocation
           green = (demand / Σdemand) × cycle_time
           clamped to [MIN_GREEN, MAX_GREEN]

    Args:
        states: list of dicts with keys:
            - edge_id
            - queue_length_m
            - density
            - last_green_ts
        cycle_time: total cycle time in seconds.
                    If None, auto-scaled by number of edges.

    Returns:
        dict { edge_id : green_time }
    """
    n_edges = len(states)
    if n_edges == 0:
        return {}

    if cycle_time is None:
        cycle_time = _dynamic_cycle_time(n_edges)

    now = int(time.time())
    demand = {}

    for state in states:
        edge_id = state['edge_id']

        # --- raw values ---
        Qm         = state.get('queue_length_m', 0.0)
        D          = state.get('density', 0.0)
        last_green = state.get('last_green_ts', 0)

        # --- Step 1: normalise to [0, 1] ---
        Qn = min(Qm / MAX_QUEUE_M, 1.0) if MAX_QUEUE_M > 0 else 0.0
        W  = max(now - last_green, 0)
        Wn = min(W / MAX_WAIT, 1.0)
        # D is already normalised [0, 1] from ml_service

        # --- Step 2: pressure (controller-computed, EMA-smoothed) ---
        P_raw = W_P_QUEUE * Qn + W_P_DENSITY * D + W_P_WAIT * Wn
        P_raw = min(P_raw, 1.0)
        P_prev = _pressure_ema.get(edge_id, P_raw)  # first call → use raw
        P = ALPHA_EMA * P_raw + (1 - ALPHA_EMA) * P_prev
        _pressure_ema[edge_id] = P

        # --- Step 3: demand (all dimensionless) ---
        edge_demand = W_D_QUEUE * Qn + W_D_WAIT * Wn + W_D_PRESSURE * P
        demand[edge_id] = max(edge_demand, MIN_DEMAND)

    total_demand = sum(demand.values()) or 1

    # --- Step 4: proportional allocation ---
    green_times = {}
    for state in states:
        edge_id = state['edge_id']
        g = (demand[edge_id] / total_demand) * cycle_time
        g = max(MIN_GREEN, min(MAX_GREEN, int(g)))
        green_times[edge_id] = g

    return green_times