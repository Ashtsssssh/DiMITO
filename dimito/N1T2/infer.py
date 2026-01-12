"""
Traffic Analysis Inference Module
Handles vehicle detection, counting, and traffic metric calculations
"""

import cv2
import numpy as np
from ultralytics import YOLO
from .roi_finder import select_road_roi


class TrafficAnalyzer:


    # YOLO COCO class IDs mapping
    CLASS_MAPPING = {
        'car': [2],           # car
        'bike': [1, 3],       # bicycle, motorcycle
        'truck': [5, 7]       # bus, truck
    }
    
    # Average vehicle dimensions (length × width in meters)
    VEHICLE_DIMENSIONS = {
        'car': {'length': 4.5, 'width': 1.8, 'area': 8.1},
        'bike': {'length': 2.0, 'width': 0.8, 'area': 1.6},
        'truck': {'length': 10.0, 'width': 2.5, 'area': 25.0}
    }
    
    # Pressure calculation weights
    ALPHA = 0.6  # Queue length weight
    BETA = 0.4   # Density weight
    
    def __init__(self, model_path, output_dir):
        """
        Args:
            model_path (str): Path to YOLOv8 model weights
            output_dir (str): Base directory for outputs (handled by caller)
        """
        self.model = YOLO(model_path)
        self.output_dir = output_dir
    
    def predict(self, image_path, camera_id, save_visual=True):
        """
        Analyze traffic image and calculate metrics
        
        Args:
            image_path (str): Path to input image
            camera_id (str): Camera identifier
            save_visual (bool): Whether to generate annotated image
        
        Returns:
            dict: Contains 'json' (metrics) and 'img' (annotated image or None)
        """
        # Load image
        image = cv2.imread(image_path)
        if image is None:
            raise ValueError(f"Could not read image: {image_path}")
        
        # Get ROI data for this camera
        roi_data = select_road_roi(camera_id)
        roi_polygon = np.array(roi_data['polygon'], dtype=np.int32)
        road_length_m = roi_data['real_length_m']
        road_width_m = roi_data['real_width_m']
        total_road_area_m2 = road_length_m * road_width_m
        
        # Apply polygon mask to image
        mask = np.zeros(image.shape[:2], dtype=np.uint8)
        cv2.fillPoly(mask, [roi_polygon.astype(np.int32)], 255)
        masked_image = cv2.bitwise_and(image, image, mask=mask)
        
        # Run YOLO detection
        results = self.model.predict(source=masked_image, conf=0.5, imgsz=640, verbose=False)
        result = results[0]
        
        # Count vehicles by type (only if center is inside polygon)
        vehicle_counts = {'car': 0, 'bike': 0, 'truck': 0, 'total': 0}
        
        for box in result.boxes:
            x_center, y_center = box.xywh[0][:2].cpu().numpy()
            
            # Check if center point is inside polygon
            if cv2.pointPolygonTest(roi_polygon, (float(x_center), float(y_center)), False) >= 0:
                class_id = int(box.cls[0].item())
                
                if class_id in self.CLASS_MAPPING['car']:
                    vehicle_counts['car'] += 1
                elif class_id in self.CLASS_MAPPING['bike']:
                    vehicle_counts['bike'] += 1
                elif class_id in self.CLASS_MAPPING['truck']:
                    vehicle_counts['truck'] += 1
                
                vehicle_counts['total'] += 1
        


        # Calculate total occupied area
        # total_vehicle_area_m2 = (
        #     vehicle_counts['car'] * self.VEHICLE_DIMENSIONS['car']['area'] +
        #     vehicle_counts['bike'] * self.VEHICLE_DIMENSIONS['bike']['area'] +
        #     vehicle_counts['truck'] * self.VEHICLE_DIMENSIONS['truck']['area']
        # )
        #  !!!!!!!!!!!!!!!!!!!!!!!!!CURRENT PRE-CLASS WORKAROUND!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
        total_vehicle_area_m2 = (
            vehicle_counts['total'] * 5.0  # Assume average area per vehicle is 5 m²
        )
        
        
        # Calculate density
        density = round(total_vehicle_area_m2 / total_road_area_m2, 4)
        
        # Calculate queue length  but queue length shall also consider average road b readth, if road broad lesse q len 
        # CALCULATE AVG width avg_lanes = road_width_m / 3.5 (avg lane width)
        if vehicle_counts['total'] > 0:
            # avg_vehicle_length = (
            #     vehicle_counts['car'] * self.VEHICLE_DIMENSIONS['car']['length'] +
            #     vehicle_counts['bike'] * self.VEHICLE_DIMENSIONS['bike']['length'] +
            #     vehicle_counts['truck'] * self.VEHICLE_DIMENSIONS['truck']['length']
            # ) / vehicle_counts['total']
            # queue_length_m = round(vehicle_counts['total'] * avg_vehicle_length/ avg_lanes , 2)

            queue_length_m = round(vehicle_counts['total'] * 5.0 / (road_width_m / 3.5), 2)
        else:
            queue_length_m = 0.0
        
        # Calculate pressure: α × (queue_length / road_length) + β × density
        queue_ratio = min(queue_length_m / road_length_m, 1.0)
        pressure = self.ALPHA * queue_ratio + self.BETA * density
        pressure = round(min(pressure, 1.0), 4)
        
        # Generate annotated image if requested
        annotated_image = None
        if save_visual:
            annotated_image = result.plot(line_width=2)
            cv2.polylines(annotated_image, [roi_polygon], isClosed=True, 
                         color=(0, 255, 0), thickness=3)
        
        # Build JSON output
        json_output = {
            "vehicle_counts": vehicle_counts['total'],
            "queue_length_m": queue_length_m,
            "density": density,
            "pressure": pressure,
         
        }
        
        return {
            "json": json_output,
            "img": annotated_image
        }