# DiMITO — Changes Done

> Running log of all fixes applied to the project.  
> Format per entry: file path → what changed → why.

---

## Tier 1 — Critical Backend Fixes ✅

### `server/backend/views.py`

#### Modified: `trigger_dv_iteration`
- **Before:** Called `run_routing_dv_iteration()` exactly once and returned `updates_applied`.
- **After:** Loops up to 50 iterations until the function returns `0` (fully converged). Only the first pass logs verbosely (subsequent passes are silent to avoid console spam).
- **Response fields changed:**
  - ~~`updates_applied`~~ removed
  - ✅ Added `converged` (bool)
  - ✅ Added `iterations_run` (int)
  - ✅ Added `total_updates_applied` (int)
  - ✅ Added `message` (human-readable convergence status string)
- **Why:** A single Bellman-Ford pass only propagates routes one hop at a time. Multi-hop routes (the majority of real destinations) were never populated, causing "No routes to this destination" in the visualizer and dead routing tables in the simulator.

#### Modified: `process_green_signal` response
- **Before:** Returned only `{ node, edge_id, green_time, ml_results }`.
- **After:** Returns `{ node, edge_id, green_time, green_times: {edge_id: seconds, ...}, ml_results }`.
- ✅ Added `green_times` — full dictionary of computed green seconds for all edges in the intersection.
- **Why:** The backend was already computing green times for all edges but discarding all except the requested one. The simulator left every other edge at a stale 30s default, causing the full schedule to desync.

---

### `server/backend/services/green_time_service.py`

#### Modified: `MAX_WAIT` constant
- **Before:** `MAX_WAIT = 90` (seconds)
- **After:** `MAX_WAIT = 180` (seconds, aligned with `MAX_CYCLE_TIME`)
- **Why:** A 4-6 edge intersection has a cycle of 120-180s. With MAX_WAIT=90, every waiting edge hit Wn=1.0 prematurely, destroying the system's ability to differentiate longer-waiting edges from shorter-waiting ones.

---

### `client/traffic_node/green_loop.py`

#### Modified: `GreenManager.compute_green()`
- **Before:** Only updated the `target_edge` slot in `green_schedule` from the response. All other edges kept their 30s initialization value.
- **After:**
  - Reads `data.get("green_times")` — the full schedule dict from the backend.
  - Bulk-updates ALL slots in `green_schedule` from `green_times` in a single loop.
  - Logs each edge's old -> new time when a value changes.
  - Falls back to single-edge update if backend returns no `green_times` dict (backward compatibility).
- **Why:** Without this, the simulator's local phase clock progressively diverged from the backend's computed proportions.
- **Docstring:** Fully rewritten to describe the new bulk-sync behavior.

---

## Tier 2 — High: Silent Data Corruption Fix ✅

### `client/frontend/src/pages/AddPage.jsx`

#### Added: `activeEdge` state variable
- `const [activeEdge, setActiveEdge] = useState(null);`
- Cleared on form cancel and on success.
- **Why:** Scaffolding to prevent stale edge data leaking between form sessions.

#### Modified: `edge/edit` submit handler — lanes guard
- **Before:** `const lanes = parseInt(data.lanes, 10);` — if the user left the field blank, this sent NaN and corrupted `num_lanes` in the DB.
- **After:** Falls back to `edge.num_lanes` from the DB record if the user leaves `lanes` blank or submits a non-positive value.
- **Why:** Prevents silent num_lanes corruption on partial edits.

#### Modified: `handleDVUpdate`
- **Before:** Read `data.updates_applied` (stale field removed by Tier 1 fix).
- **After:** Reads `data.total_updates_applied ?? data.updates_applied ?? 0` with graceful fallback. Displays convergence status (`converged`, `iterations_run`) in the toast.
- **Removed:** `setTimeout(() => fetchEdges(), 500)` — unnecessary side effect.
- Toast timeout changed: 4000ms -> 6000ms.

#### Modified: `handleItemClick`
- Added `setActiveEdge(null)` when opening any new form.

#### Modified: `FormRenderer` render — added `resolvedEdge` prop
- Passes the DB edge found by `findEdgeBetweenNodes(selectedEdgeNodes[0], selectedEdgeNodes[1])` when `apiType === 'edge/edit'` and two nodes are selected.
- **Why:** In the node-pair edge/edit flow, `selectedEdge` (direct-click flow) is always null, so `FormRenderer` had no data to prefill `lanes` from.

---

### `client/frontend/src/components/ui/FormRenderer.jsx`

#### Modified: Component signature
- Added `resolvedEdge` prop.

#### Modified: `lanes` prefill logic
- **Before:** `if (field.name === 'lanes' && selectedEdge && ...)` — never fired in the node-pair flow because `selectedEdge` is always null there.
- **After:** `const edgeSrc = resolvedEdge || selectedEdge; if (edgeSrc) value = edgeSrc.num_lanes;`
- **Why:** Ensures `lanes` is always pre-populated from the current DB value, preventing accidental num_lanes corruption on edit.

---

## Tier 3 — Medium: Orphaned Form Correctness ✅

### `client/frontend/src/components/forms/AddNodeForm.jsx`

#### Modified: `fetch` URL
- **Before:** `fetch("/api/node/", ...)` — relative URL with no `/add` suffix. No route is registered at `/api/node/` → **404 on every submit**.
- **After:** `fetch("http://localhost:8000/api/node/add", ...)` — matches the registered URL pattern `api/node/add`.

#### Modified: `payload.location` keys
- **Before:** `{ latitude: ..., longitude: ... }` — keys not recognised by the backend `Node` model or `views.create_node`. Backend stores `location` as `{lat, lng}` everywhere else.
- **After:** `{ lat: ..., lng: ... }` — consistent with `api.js`, `MapView.jsx`, `App.jsx`, and the Node model.

> **Note:** This component is not currently wired into any active route (superseded by `FormRenderer` + `dropdownConfigs` in `AddPage.jsx`). These fixes ensure it works correctly if re-enabled in the future.

---

## Tier 4 — Low: Code Quality / Fragility ✅

### `client/frontend/src/pages/AddPage.jsx`

#### Modified: `DropDown` import casing
- **Before:** `import Dropdown from '@/components/ui/Dropdown'` — lowercase `d`. Works on Windows/macOS (case-insensitive FS). **Fails on Linux CI/prod** (case-sensitive FS → module not found).
- **After:** `import DropDown from '@/components/ui/DropDown'` — matches actual filename exactly.
- JSX usage updated: `<Dropdown` → `<DropDown`.

#### Modified: `handleGenerateTraffic` — removed raw `fetch()`
- **Before:** Inline `fetch("http://localhost:8000/api/edge/update", ...)` — bypassed `api.js`, duplicated headers/error handling, and hardcoded the base URL a third time.
- **After:** `await trafficAPI.seedAll()` — routed through `api.js`.
- Removed: manual `res.ok` branching (error thrown automatically by `apiCall`).

#### Modified: `handleClearDatabase` — removed raw `fetch()`
- **Before:** Inline `fetch("http://localhost:8000/api/db/clear-all/", ...)` — same pattern as above.
- **After:** `await dbAPI.clearAll()` — routed through `api.js`.
- Bonus: `data.deleted.nodes` → `data.deleted?.nodes ?? 0` (safe access — prevents crash if response shape is unexpected).

#### Modified: import line
- Added `trafficAPI, dbAPI` to named imports from `@/api/api`.

---

### `client/frontend/src/api/api.js`

#### Added: `trafficAPI` namespace
- `seedAll()` — POST `/edge/update` — seeds all edges with randomised traffic.

#### Added: `dbAPI` namespace  
- `clearAll()` — POST `/db/clear-all/` — deletes all DB data (confirm-guarded in UI).

#### Note: Fix 4c (port map inconsistency) — already fixed
`car_sim.py` already imports from `config.NODES` (not a separate hardcoded map). No change needed.

---

## Tier 5 — Polish / Hygiene ✅

### 5a — Orphaned File Removal

**Deleted:**
| File | Reason |
|------|--------|
| `src/components/Sidebar.jsx` | Not imported anywhere; superseded by `AddPage.jsx` panel |
| `src/components/ui/MagicBento.jsx` | Decorative GSAP kit, no active route imports it |
| `src/components/ui/PillNav.jsx` | Same — decorative, not wired in |
| `src/api/http.js` | Duplicate API client; nothing imports it; `api.js` is the canonical client |
| `src/pages/TrafficView.jsx` | Empty file |
| `public/map/` (entire directory) | Source files (hooks, markers, types) in Vite's unbundled static folder — never imported, JSX can't be processed here |

**Verified** via grep before deletion — none were imported in any active file.

---

### 5b — `print()` → `logging` module

**Skipped.** The systems work correctly with `print()` for a dev/research context. Replacing logging across all backend services is a large mechanical change with no functional benefit at this stage. Flagged for when the project approaches production hardening.

---

### 5c — Auth Guard on `/api/db/clear-all/` — `server/backend/views.py`

#### Modified: `clear_database` view
- Added `import os`.
- Added opt-in API key check: if env var `CLEAR_API_KEY` is set, the request must supply a matching `X-Clear-API-Key` header or receive a **403 Forbidden**.
- If `CLEAR_API_KEY` is **not** set (default), the endpoint behaves exactly as before — zero breakage for existing dev setups.
- To harden: `export CLEAR_API_KEY=some-secret` in the server environment.

---

### 5d — Dead `tick()` Code — `client/traffic_node/green_loop.py`

#### Modified: `GreenManager.tick()`
- **Before:** Full 25-line implementation (print state, recompute at T-10s, phase transition on timer). Was intended to be called every second by an external loop — but `node_server.green_loop()` uses a direct `time.sleep()` loop instead and never calls `tick()`.
- **After:** Replaced body with `pass` + explanatory docstring pointing to `node_server.green_loop()` as the real active code path.

#### Removed: `GreenManager._print_state_if_changed()`
- Only ever called inside `tick()`. Now dead. Removed (~22 lines).

---

## ✅ All 5 Tiers Complete

| Tier | Fixes | Status |
|------|-------|--------|
| 1 🔴 Critical | DV convergence loop · MAX_WAIT fix · schedule sync | ✅ Done |
| 2 🟠 High | num_lanes corruption · DV response field rename | ✅ Done |
| 3 🟡 Medium | AddNodeForm URL + location key | ✅ Done |
| 4 🔵 Low | DropDown casing · API consolidation · port map (pre-fixed) | ✅ Done |
| 5 ⚪ Polish | Orphan deletion · API key guard · dead tick() removal | ✅ Done |

---

## Batch 2 — Remaining Issues ✅

### `page2.jsx` — Removed

- **Deleted** `src/pages/page2.jsx` — duplicated signal-polling logic already covered by `SignalScheduleVisualizer.jsx`. Was also the source of the last raw `fetch()` calls against the signal and node APIs.
- **`App.jsx`**: removed `Page2` import, `signalStates` state, `/page2` route, and `onSignalUpdate` callback. `signalStates` prop on `MapView` replaced with empty object literal + explanatory comment.

---

### B1 — `MapView.jsx` raw fetch calls

#### Modified: `fetchNodes` + `fetchEdges`
- **Before:** `fetch('http://localhost:8000/api/node/get_all')` / `fetch('http://localhost:8000/api/edge/get_all')` — raw hardcoded URLs, no error handling.
- **After:** `await nodeAPI.getAll()` / `await edgeAPI.getAll()` via `api.js`.
- Added `import { nodeAPI, edgeAPI } from '@/api/api'`.
- Added `try/catch` with `console.error` on both — previously a failed fetch silently left the map empty with no log.

**Result:** Zero raw `fetch()` / hardcoded `localhost:8000` calls remain anywhere in `src/` except `api.js` itself (`API_BASE_URL`).

---

### B4 — `delete_node` cascade — `server/backend/services/data_service.py`

#### Modified: `delete_node()`
- **Before:** Deleted only the `Node` document. Orphaned `Edge` and `RoutingEntry` documents stayed in the DB indefinitely.
- **After:** Explicit cascade before `node.delete()`:
  - `Edge.objects(in_node_id=node_id).delete()`
  - `Edge.objects(out_node_id=node_id).delete()`
  - `RoutingEntry.objects(from_node_id=node_id).delete()`
  - `RoutingEntry.objects(destination_node_id=node_id).delete()`
  - `RoutingEntry.objects(next_hop_node_id=node_id).delete()`
- Logs a deletion summary to stdout.
- **Why needed:** MongoEngine doesn't cascade on plain `StringField` IDs — only on `ReferenceField`. This is the only safe place to enforce it.

---

## Batch 3 — Simulator Timeout + Routing Probability Skew ✅

### `client/traffic_node/green_loop.py`

#### Modified: `GreenManager.compute_green()` — timeout
- **Before:** `timeout=3` on the `/api/green/` POST request.
- **After:** `timeout=30`.
- **Why:** The `/api/green/` endpoint runs YOLO ML inference on every uploaded image before responding. Inference takes 5–30+ seconds depending on hardware and image count. The 3-second timeout meant the simulator *always* timed out, producing the `⚠️ [GREEN LOOP] Initial compute failed` loop and preventing any green times from ever being received. 30s gives the server enough headroom while still bounding truly hung requests.

---

### `server/backend/services/routing_service.py`

#### Modified: `build_routing_table_for_node()` — probability skew on symmetric graphs

**Root cause:** `rel_cost` was computed as an **absolute difference in seconds** (`cost - best_cost`). The tier boundaries (1s, 3s) were calibrated for very short roads. On real roads, a 36s free-flow time means two nearly-equal 200s paths might have EMA-induced differences of 20–30s — landing in Tier 3 (`rel_cost > 3`) and producing extreme 98%/2% weight splits even when both paths were less than 15% apart in real cost.

- **Before:** `rel_cost = cost - best_cost` (absolute seconds), tier thresholds at 1s and 3s.
- **After:** `rel = (cost - best_cost) / max(best_cost, 1.0)` — a **dimensionless ratio** (0 = as good as best, 0.5 = 50% more expensive). Tier thresholds now at **0.15 and 0.60** (15% and 60% overhead).
- `MAX_COST_RATIO` tightened from 3.3× to **2.0×** — paths more than 2× the best cost are pruned before weighting (a path that costs twice as much as the best is not a useful alternative in any real network).
- Added `MIN_BEST_COST = 1.0s` floor to prevent division-by-zero on self-routes (cost=0).

**Effect on symmetric graph (a→b→c→d→a, equal edges):**
- Before: ≈98%/2% split (small EMA noise mapped to huge absolute rel_cost).
- After: ≈50%/50% split (EMA noise is <5% relative → both paths land in Tier 1, weights ≈ 1.0 each).


