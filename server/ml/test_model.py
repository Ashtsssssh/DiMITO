"""
Traffic Analyzer Module
Loads the YOLO model and runs detection on a pre-masked image.
ROI lookup / masking and post-processing live in ml_service.py.
"""

from .infer import TrafficAnalyzer
import os
import cv2
import numpy as np


def analyze_traffic_image(image_path, roi_polygon, save_visual=True):
    """
    Load model, run YOLO on a pre-masked image, return raw counts.

    Args:
        image_path  (str):  Path to the input image
        roi_polygon (list): List of (x, y) polygon points for ROI
        save_visual (bool): Whether to save annotated image (default: True)

    Returns:
        dict with keys:
            vehicle_counts: {'car': int, 'bike': int, 'truck': int, 'total': int}
            annotated_img:  numpy array or None
    """
    # Get absolute path to model (relative to this file's location)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    MODEL_PATH = os.path.join(current_dir, 'runs', 'detect', 'train', 'weights', 'best.pt')
    OUTPUT_DIR = r'C:\Users\ashut\DiMITO\N1T2\STUB\output'

    # Validate paths
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"Model not found: {MODEL_PATH}")

    # Create output directories
    os.makedirs(os.path.join(OUTPUT_DIR, "output_json"), exist_ok=True)
    if save_visual:
        os.makedirs(os.path.join(OUTPUT_DIR, "output_images"), exist_ok=True)

    # Load image and apply ROI mask
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Could not read image: {image_path}")

    poly = np.array(roi_polygon, dtype=np.int32)
    mask = np.zeros(image.shape[:2], dtype=np.uint8)
    cv2.fillPoly(mask, [poly], 255)
    masked_image = cv2.bitwise_and(image, image, mask=mask)

    # Initialize analyzer and run prediction
    analyzer = TrafficAnalyzer(MODEL_PATH, OUTPUT_DIR)
    result = analyzer.predict(
        masked_image=masked_image,
        roi_polygon=poly,
        save_visual=save_visual,
    )

    # Save annotated image if available
    base_name = os.path.splitext(os.path.basename(image_path))[0]
    if save_visual and result["annotated_img"] is not None:
        img_path = os.path.join(OUTPUT_DIR, f"output_images/{base_name}.jpg")
        cv2.imwrite(img_path, result["annotated_img"])

    return {
        "vehicle_counts": result["vehicle_counts"],
    }