import os
import sys
import threading
import time

from django.apps import AppConfig


# How often (seconds) the background distance-vector routing loop recomputes.
# Max relaxation passes per cycle. A single run_routing_dv_iteration() call
# only propagates one extra hop — relaxing several times per cycle lets
# multi-hop routes converge within one cycle instead of needing many manual
# clicks of "Compute Routing (DV)" in the admin panel.
# Give Mongo / Django a moment to finish booting before the first pass.
# All three values are read from server/.env via algo_config.cfg at startup.
def _loop_settings():
    from backend.algo_config import cfg
    return cfg.DV_LOOP_INTERVAL_S, cfg.DV_LOOP_MAX_PASSES, cfg.DV_LOOP_STARTUP_DELAY_S




class TrafficConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'backend'

    def ready(self):
        # AppConfig.ready() fires for EVERY manage.py command (migrate,
        # shell, test, ...), not just the dev server — only start this loop
        # when actually running `runserver`.
        if 'runserver' not in sys.argv:
            return

        # `runserver` (without --noreload) uses an autoreloader that imports
        # every app TWICE: once in the watcher process, once in the actual
        # server process it spawns — and only that spawned process has
        # RUN_MAIN=true. Without this check we'd start two competing
        # threads. With --noreload there's only one process and RUN_MAIN is
        # never set at all, so we don't gate on it in that case.
        autoreload_enabled = '--noreload' not in sys.argv
        if autoreload_enabled and os.environ.get('RUN_MAIN') != 'true':
            return

        # NOTE: this in-process thread approach is fine for a single
        # `runserver` process (how this project runs today). If you ever
        # deploy behind gunicorn/uwsgi with multiple worker processes, each
        # worker would start its own competing loop — move this to a
        # `manage.py` command driven by cron/systemd-timer instead at that
        # point.
        interval_s, max_passes, startup_delay_s = _loop_settings()
        threading.Thread(target=self._dv_loop, daemon=True).start()
        print(f"[DV LOOP] Background distance-vector routing thread started "
              f"(every {interval_s}s, up to {max_passes} passes/cycle).")

    @staticmethod
    def _dv_loop():
        # Imported here (not at module level) so Django finishes app setup
        # before we touch models/services.
        from server.mongo import connect_mongo
        from backend.services.routing_dv_service import run_routing_dv_iteration

        connect_mongo()  # idempotent — safe even if already connected elsewhere

        _, _, startup_delay_s = _loop_settings()
        time.sleep(startup_delay_s)

        while True:
            interval_s, max_passes, _ = _loop_settings()
            try:
                for _ in range(max_passes):
                    changes = run_routing_dv_iteration(verbose=False)
                    if changes == 0:
                        break  # converged for this cycle, no need to keep relaxing
            except Exception as e:
                print(f"[DV LOOP] iteration failed: {e}")

            time.sleep(interval_s)