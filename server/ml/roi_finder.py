
def select_road_roi(camera_id):
    """
    Load or select ROI for a given camera.
    """
    # Example: load from JSON / dict
    default_roi = {
        "polygon":  [(2, 636), (5, 486), (214, 186), (418, 175), (639, 422), (637, 635)],
        "real_length_m": 50.0,
        "real_width_m": 10.0
    }
    
    ROI_DB = {
        "cam_N2N1": default_roi.copy(),
        "cam_N31": default_roi.copy(),
        "cam_N41": default_roi.copy(),
        "cam_N51": default_roi.copy(),
        "cam_e1": default_roi.copy(),
        "cam_e2": default_roi.copy(),
        "cam_e3": default_roi.copy(),
        "cam_e4": default_roi.copy(),
    }

    return ROI_DB.get(camera_id, default_roi)
