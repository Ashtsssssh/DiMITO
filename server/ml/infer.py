"""
Traffic Analysis Inference Module
ONLY handles YOLO detection + vehicle counting.
ROI masking and all post-processing live in ml_service.py.
"""

import cv2
import numpy as np
from ultralytics import YOLO


class TrafficAnalyzer:

    # YOLO COCO class IDs mapping
    CLASS_MAPPING = {
        'car': [2],           # car
        'bike': [1, 3],       # bicycle, motorcycle
        'truck': [5, 7]       # bus, truck
    }

    def __init__(self, model_path, output_dir):
        """
        Args:
            model_path (str): Path to YOLOv8 model weights
            output_dir (str): Base directory for outputs (handled by caller)
        """
        self.model = YOLO(model_path)
        self.output_dir = output_dir

    def predict(self, masked_image, roi_polygon, save_visual=True):
        """
        Run YOLO on a pre-masked image, count vehicles inside the ROI polygon.

        Args:
            masked_image (np.ndarray): Already-masked image (ROI applied by caller)
            roi_polygon  (np.ndarray): Polygon used for point-in-polygon filtering
            save_visual  (bool):       Whether to generate annotated image

        Returns:
            dict with keys:
                vehicle_counts: {'car': int, 'bike': int, 'truck': int, 'total': int}
                annotated_img:  numpy array or None
        """
        # Run YOLO detection
        results = self.model.predict(source=masked_image, conf=0.5, imgsz=640, verbose=False)
        result = results[0]

        # Count vehicles by type (only if center is inside polygon)
        vehicle_counts = {'car': 0, 'bike': 0, 'truck': 0, 'total': 0}

        for box in result.boxes:
            x_center, y_center = box.xywh[0][:2].cpu().numpy()

            if cv2.pointPolygonTest(roi_polygon, (float(x_center), float(y_center)), False) >= 0:
                class_id = int(box.cls[0].item())

                if class_id in self.CLASS_MAPPING['car']:
                    vehicle_counts['car'] += 1
                elif class_id in self.CLASS_MAPPING['bike']:
                    vehicle_counts['bike'] += 1
                elif class_id in self.CLASS_MAPPING['truck']:
                    vehicle_counts['truck'] += 1

                vehicle_counts['total'] += 1

        # Generate annotated image if requested
        annotated_img = None
        if save_visual:
            annotated_img = result.plot(line_width=2)
            cv2.polylines(annotated_img, [roi_polygon], isClosed=True,
                         color=(0, 255, 0), thickness=3)

        return {
            "vehicle_counts": vehicle_counts,
            "annotated_img": annotated_img,
        }