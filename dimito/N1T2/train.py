import os
import torch
import gc
from ultralytics import YOLO



def run_training(dataset_yaml, epochs=30, imgsz=640):
    # Clear CUDA memory
    if torch.cuda.is_available():
        gc.collect()
        torch.cuda.empty_cache()
    
    # Load model (Pre-trained)
    model = YOLO('yolov8n.pt')
    
    # Train
    model.train(
        data=dataset_yaml,
        epochs=30,
        imgsz=640,
        device=0 if torch.cuda.is_available() else 'cpu',
        patience=20,
        batch=8,  #INCREASE TO REDUCE NOISE
        optimizer='auto',
        lr0=0.0001, #LOWER TO REDUCE NOISE
        dropout=0.1,
        seed=0
    )
 

    # Export to ONNX for production
    best_model_path = 'runs/detect/train/weights/best.pt'
    if os.path.exists(best_model_path):
        model = YOLO(best_model_path)
        model.export(format='onnx')
        print(f"Training Complete. Best weights at: {best_model_path}")

if __name__ == "__main__":
    run_training('../Vehicle_Detection_Image_Dataset/data.yaml')
    # MAKE A VARIABLE INSTEAD OF HARDCODED 