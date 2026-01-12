import tempfile
import os
from N1T2.test_model import analyze_traffic_image


def run_ml_for_edge(image_file, camera_id, save_vis):
    """
    Runs ML on an uploaded Django file.

    - Saves file to temp path
    - Passes file path to ML
    - Cleans up automatically
    """

    # Create a temp file
    suffix = os.path.splitext(image_file.name)[1] or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        for chunk in image_file.chunks():
            tmp.write(chunk)
        tmp_path = tmp.name

    try:
        result = analyze_traffic_image(
            image_path=tmp_path,
            camera_id=camera_id,
            save_visual=save_vis
        )
        
    
        print("ML RESULT VALUE:", result)

    finally:
        # Cleanup temp file
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    return result
