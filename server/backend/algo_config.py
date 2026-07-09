"""
backend/algo_config.py
======================
Single source of truth for all tunable algorithm parameters.

Values are read from environment variables (populated from server/.env via
python-dotenv, which is loaded in settings.py).  Every variable carries a
hard-coded default so the system works even when .env is absent.

Usage in service files:
    from backend.algo_config import cfg

    # then use cfg.GREEN_MIN_SECONDS, cfg.DV_EMA_ALPHA, etc.
"""

import os


def _f(key: str, default: float) -> float:
    """Read an env var and cast to float, falling back to *default*."""
    raw = os.environ.get(key)
    if raw is None:
        return default
    try:
        return float(raw)
    except ValueError:
        print(f"[algo_config] WARNING: {key}={raw!r} is not a valid float — using default {default}")
        return default


def _i(key: str, default: int) -> int:
    """Read an env var and cast to int, falling back to *default*."""
    raw = os.environ.get(key)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError:
        print(f"[algo_config] WARNING: {key}={raw!r} is not a valid int — using default {default}")
        return default


class _Config:
    """Namespace that lazily reads all algorithm parameters from the environment."""

    # ── Traffic Normalisation ──────────────────────────────────────────────
    @property
    def TRAFFIC_MAX_QUEUE_M(self) -> float:
        return _f("TRAFFIC_MAX_QUEUE_M", 80.0)

    @property
    def TRAFFIC_MAX_DENSITY(self) -> float:
        return _f("TRAFFIC_MAX_DENSITY", 1.0)

    # ── Green Time Service ─────────────────────────────────────────────────
    @property
    def GREEN_MIN_SECONDS(self) -> int:
        return _i("GREEN_MIN_SECONDS", 8)

    @property
    def GREEN_MAX_SECONDS(self) -> int:
        return _i("GREEN_MAX_SECONDS", 45)

    @property
    def GREEN_CYCLE_PER_EDGE(self) -> int:
        return _i("GREEN_CYCLE_PER_EDGE", 30)

    @property
    def GREEN_MIN_CYCLE_TIME(self) -> int:
        return _i("GREEN_MIN_CYCLE_TIME", 40)

    @property
    def GREEN_MAX_CYCLE_TIME(self) -> int:
        return _i("GREEN_MAX_CYCLE_TIME", 180)

    @property
    def GREEN_MAX_WAIT_SECONDS(self) -> int:
        return _i("GREEN_MAX_WAIT_SECONDS", 180)

    @property
    def GREEN_EMA_ALPHA(self) -> float:
        return _f("GREEN_EMA_ALPHA", 0.7)

    @property
    def GREEN_PRESSURE_W_QUEUE(self) -> float:
        return _f("GREEN_PRESSURE_W_QUEUE", 0.50)

    @property
    def GREEN_PRESSURE_W_DENSITY(self) -> float:
        return _f("GREEN_PRESSURE_W_DENSITY", 0.30)

    @property
    def GREEN_PRESSURE_W_WAIT(self) -> float:
        return _f("GREEN_PRESSURE_W_WAIT", 0.20)

    @property
    def GREEN_DEMAND_W_QUEUE(self) -> float:
        return _f("GREEN_DEMAND_W_QUEUE", 0.60)

    @property
    def GREEN_DEMAND_W_WAIT(self) -> float:
        return _f("GREEN_DEMAND_W_WAIT", 0.25)

    @property
    def GREEN_DEMAND_W_PRESSURE(self) -> float:
        return _f("GREEN_DEMAND_W_PRESSURE", 0.15)

    @property
    def GREEN_MIN_DEMAND(self) -> float:
        return _f("GREEN_MIN_DEMAND", 0.01)

    # ── Distance-Vector Routing ────────────────────────────────────────────
    @property
    def DV_EMA_ALPHA(self) -> float:
        return _f("DV_EMA_ALPHA", 0.2)

    @property
    def DV_MAX_INFLATION(self) -> float:
        return _f("DV_MAX_INFLATION", 1.5)

    @property
    def DV_CONVERGE_EPSILON(self) -> float:
        return _f("DV_CONVERGE_EPSILON", 0.001)

    @property
    def DV_LOOP_INTERVAL_S(self) -> int:
        return _i("DV_LOOP_INTERVAL_S", 10)

    @property
    def DV_LOOP_MAX_PASSES(self) -> int:
        return _i("DV_LOOP_MAX_PASSES", 5)

    @property
    def DV_LOOP_STARTUP_DELAY_S(self) -> int:
        return _i("DV_LOOP_STARTUP_DELAY_S", 3)

    # ── Probabilistic Routing Table ────────────────────────────────────────
    @property
    def ROUTING_MAX_COST_RATIO(self) -> float:
        return _f("ROUTING_MAX_COST_RATIO", 2.0)

    @property
    def ROUTING_MIN_BEST_COST(self) -> float:
        return _f("ROUTING_MIN_BEST_COST", 1.0)

    @property
    def ROUTING_TIER1_THRESHOLD(self) -> float:
        return _f("ROUTING_TIER1_THRESHOLD", 0.15)

    @property
    def ROUTING_TIER2_THRESHOLD(self) -> float:
        return _f("ROUTING_TIER2_THRESHOLD", 0.60)

    @property
    def ROUTING_TIER1_DECAY(self) -> float:
        return _f("ROUTING_TIER1_DECAY", 0.2)

    @property
    def ROUTING_TIER2_EXP_RATE(self) -> float:
        return _f("ROUTING_TIER2_EXP_RATE", 1.5)

    @property
    def ROUTING_TIER3_EXP_RATE(self) -> float:
        return _f("ROUTING_TIER3_EXP_RATE", 4.0)

    # ── ML Service ─────────────────────────────────────────────────────────
    @property
    def ML_AVG_VEHICLE_LENGTH_M(self) -> float:
        return _f("ML_AVG_VEHICLE_LENGTH_M", 4.5)

    @property
    def ML_AVG_LANE_WIDTH_M(self) -> float:
        return _f("ML_AVG_LANE_WIDTH_M", 3.5)


# Module-level singleton — import this in all service files
cfg = _Config()
