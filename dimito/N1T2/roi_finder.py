
def select_road_roi(camera_id):
    """
    Load or select ROI for a given camera.
    """
    # Example: load from JSON / dict
    ROI_DB = {
        "CC_01": {
            "polygon":  [(2, 636), (5, 486), (214, 186), (418, 175), (639, 422), (637, 635)],
            "real_length_m": 50.0,
            "real_width_m": 10.0
        }
    }

    return ROI_DB[camera_id]
