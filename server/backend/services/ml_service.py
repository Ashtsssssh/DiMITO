import tempfile
import os
from ml.test_model import analyze_traffic_image
from ml.roi_finder import select_road_roi


# --- Post-processing constants ---
VEHICLE_LENGTHS = {
    'car':   4.5,   # metres
    'bike':  2.0,
    'truck': 10.0,
}
AVG_VEHICLE_LENGTH_M = 4.5     # fallback (used when per-class isn't ready)
AVG_LANE_WIDTH_M = 3.5         # standard lane width for n_lanes calc


# ─── ROI lookup ────────────────────────────────────────────────
def _get_roi(camera_id: str) -> dict:
    """
    Resolve ROI for a camera.

    Currently delegates to the static dict in N1T2/roi_finder.py.
    TODO: replace with a DB lookup once the ROI model exists, e.g.
          ROI.objects(camera_id=camera_id).first()
    """
    return select_road_roi(camera_id)


# ─── Traffic metric computation ────────────────────────────────
def _compute_traffic_metrics(vehicle_counts: dict,
                             road_length_m: float,
                             road_width_m: float) -> dict:
    """
    Derive traffic metrics from raw vehicle counts + road geometry.

    Formulas
    --------
    Queue length  Q_e = min( Σ l_i , L_q )
        l_i  = per-vehicle length (4.5 m car, 2.0 m bike, 10.0 m truck)
        L_q  = road_length_m  (queue zone = full road segment)

    Density       D_e = Q_e / (L_lane × n_lanes)
        L_lane   = road_length_m
        n_lanes  = road_width_m / AVG_LANE_WIDTH_M
        D_e ∈ [0, 1]   (occupancy ratio, not raw count)

    NOTE: Pressure is NOT computed here — it belongs to the controller
          (green_time_service / routing_dv_service) which has access to
          wait-time context that ML does not.

    Args:
        vehicle_counts: {'car': int, 'bike': int, 'truck': int, 'total': int}
        road_length_m:  road / queue-zone length (L_q)
        road_width_m:   road width

    Returns:
        dict with keys: vehicle_counts (int), queue_length_m, density
    """
    total = vehicle_counts.get('total', 0)

    # ── Queue length: Q_e = min(Σ l_i, L_q) ──
    # Sum per-class lengths; fallback to avg length for any "total" overflow
    sum_lengths = (
        vehicle_counts.get('car', 0)   * VEHICLE_LENGTHS['car']
        + vehicle_counts.get('bike', 0)  * VEHICLE_LENGTHS['bike']
        + vehicle_counts.get('truck', 0) * VEHICLE_LENGTHS['truck']
    )
    # If per-class counts don't add up to total (e.g. unknown class),
    # attribute remaining vehicles the average length
    classified = (
        vehicle_counts.get('car', 0)
        + vehicle_counts.get('bike', 0)
        + vehicle_counts.get('truck', 0)
    )
    unclassified = max(0, total - classified)
    sum_lengths += unclassified * AVG_VEHICLE_LENGTH_M

    L_q = road_length_m                         # queue zone = road segment
    queue_length_m = round(min(sum_lengths, L_q), 2)

    # ── Density: D_e = Q_e / (L_lane × n_lanes), bounded [0, 1] ──
    n_lanes = max(road_width_m / AVG_LANE_WIDTH_M, 1.0)
    L_lane = road_length_m
    denom = L_lane * n_lanes
    density = round(min(queue_length_m / denom, 1.0), 4) if denom > 0 else 0.0

    return {
        "vehicle_counts": total,
        "queue_length_m":  queue_length_m,
        "density":         density,
    }


# ─── Main entry point ─────────────────────────────────────────
def analyze_edge_image(image_file, camera_id, save_vis):
    """
    Full pipeline:
        1. Look up ROI for this camera
        2. Save uploaded file to temp path
        3. Call YOLO inference (passing ROI polygon)
        4. Compute traffic metrics from raw counts + road geometry
        5. Cleanup temp file

    Args:
        image_file: Django UploadedFile
        camera_id:  str
        save_vis:   bool

    Returns:
        dict: {vehicle_counts, queue_length_m, density}
    """
    print("ML INPUT:", image_file.name, image_file.size)

    # Step 1: ROI lookup (will later come from DB)
    roi_data = _get_roi(camera_id)
    roi_polygon = roi_data['polygon']
    road_length_m = roi_data['real_length_m']
    road_width_m = roi_data['real_width_m']

    # Step 2: save uploaded image to temp file
    suffix = os.path.splitext(image_file.name)[1] or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        for chunk in image_file.chunks():
            tmp.write(chunk)
        tmp_path = tmp.name

    try:
        # Step 3: raw ML detection (masking happens inside test_model now)
        raw = analyze_traffic_image(
            image_path=tmp_path,
            roi_polygon=roi_polygon,
            save_visual=save_vis,
        )

        # Step 4: post-processing
        result = _compute_traffic_metrics(
            vehicle_counts=raw["vehicle_counts"],
            road_length_m=road_length_m,
            road_width_m=road_width_m,
        )
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    return result
