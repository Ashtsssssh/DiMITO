import os
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import platform

def plot_learning_curve(df, train_loss_col, val_loss_col, title, save_path):
    """Generates and saves a specific loss comparison plot."""
    plt.figure(figsize=(12, 5))
    sns.lineplot(data=df, x='epoch', y=train_loss_col, label='Train Loss', color='#141140', linewidth=2)
    sns.lineplot(data=df, x='epoch', y=val_loss_col, label='Validation Loss', color='orangered', linestyle='--', linewidth=2)
    plt.title(title)
    plt.xlabel('Epochs')
    plt.ylabel('Loss')
    plt.legend()
    plt.savefig(save_path)
    plt.close() # Close to prevent memory build-up

def generate_metrics(training_dir):
    results_csv = os.path.join(training_dir, 'results.csv')
    confusion_matrix_path = os.path.join(training_dir, 'confusion_matrix_normalized.png')
    
    if not os.path.exists(results_csv):
        print(f"Error: {results_csv} not found.")
        return

    # Load and clean data
    df = pd.read_csv(results_csv)
    df.columns = df.columns.str.strip()

    # 1. Define the metrics to plot
    metrics_to_plot = [
        ('train/box_loss', 'val/box_loss', 'Box Loss Learning Curve', 'box_loss.png'),
        ('train/cls_loss', 'val/cls_loss', 'Classification Loss Learning Curve', 'cls_loss.png'),
        ('train/dfl_loss', 'val/dfl_loss', 'Distribution Focal Loss Learning Curve', 'dfl_loss.png')
    ]

    # 2. Generate and open each plot
    for train_col, val_col, title, filename in metrics_to_plot:
        save_path = os.path.join(training_dir, filename)
        plot_learning_curve(df, train_col, val_col, title, save_path)
        open_file(save_path)

    # 3. Open Confusion Matrix
    if os.path.exists(confusion_matrix_path):
        open_file(confusion_matrix_path)

def open_file(path):
    """Opens the image file using the system's default viewer."""
    try:
        if platform.system() == 'Windows':
            os.startfile(path)
        elif platform.system() == 'Darwin': # macOS
            os.system(f'open "{path}"')
        else: # Linux
            os.system(f'xdg-open "{path}"')
    except Exception as e:
        print(f"Could not open {path}: {e}")

if __name__ == "__main__":
    # Path to your latest training run
    generate_metrics('./runs/detect/train')