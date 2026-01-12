import time

MIN_GREEN = 8
MAX_GREEN = 40

ALPHA = 0.9 # waiting-time weight
BETA = 3.0    # arrival-rate weight


def compute_green_times(states, cycle_time=100):
    """
    Calculate green times based on traffic states.
    
    Args:
        states: list of dicts with keys:
            - edge_id
            - total_vehicles (queue)
            - last_green_ts
            - density
            - pressure
        cycle_time: total cycle time in seconds
        
    Returns:
        dict { edge_id : green_time }
    """
    now = int(time.time())
    demand = {}

    for state in states:
        edge_id = state['edge_id']
        Q = state.get('total_vehicles', 0)  # Queue length
        last_green = state.get('last_green_ts', 0)
        
      
        T = min(now - last_green, 60)

        Qm = state['queue_length_m']
        P  = state['pressure']

        D = 1.5 * Qm + 0.8 * T + 4.0 * P

        # T = max(now - last_green, 1)
        # # Arrival rate
        # A = Q / T if T > 0 else 0
        # # Total demand calculation
        # D = Q + ALPHA * T + BETA * A
        demand[edge_id] = D

        

    total_demand = sum(demand.values()) or 1

    green_times = {}

    for state in states:
        edge_id = state['edge_id']
        g = (demand[edge_id] / total_demand) * cycle_time
        g = max(MIN_GREEN, min(MAX_GREEN, int(g)))
        green_times[edge_id] = g

    return green_times