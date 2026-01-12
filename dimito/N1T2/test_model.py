"""
Traffic Analyzer Module
Simple callable function for traffic analysis
"""

from .infer import TrafficAnalyzer
import json
import os
import cv2


def analyze_traffic_image(image_path, camera_id, save_visual=True):
    """
    Analyze a traffic image and return JSON results
    
    Args:
        image_path (str): Path to the input image
        camera_id (str): Camera identifier (e.g., "CC_01")
        save_visual (bool): Whether to save annotated image (default: True)
    
    Returns:
        dict: JSON data containing detection results
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
    
    # Initialize analyzer
    analyzer = TrafficAnalyzer(MODEL_PATH, OUTPUT_DIR)
    
    # Run prediction
    result = analyzer.predict(
        image_path=image_path,
        camera_id=camera_id,
        save_visual=save_visual
    )
    
    # Extract filename
    base_name = os.path.splitext(os.path.basename(image_path))[0]
    
    # Save JSON
    json_path = os.path.join(OUTPUT_DIR, f"output_json/{base_name}.json")
    with open(json_path, "w") as f:
        json.dump(result["json"], f, indent=4)
    
    # Save image if requested
    if save_visual and result["img"] is not None:
        image_path = os.path.join(OUTPUT_DIR, f"output_images/{base_name}.jpg")
        cv2.imwrite(image_path, result["img"])
    
    # Return JSON data
    return result["json"]