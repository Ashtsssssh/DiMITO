import cv2
import numpy as np

def select_road_roi(image_path):
    """
    Opens image and lets user click polygon points.
    Returns list of (x, y) pixel coordinates.
    """

    img = cv2.imread(image_path)
    if img is None:
        raise FileNotFoundError(f"Could not find image: {image_path}")

    clone = img.copy()
    points = []

    def mouse_callback(event, x, y, flags, param):
        nonlocal img, points

        if event == cv2.EVENT_LBUTTONDOWN:
            points.append((x, y))
            print(f"✓ Point {len(points)-1} added: ({x}, {y})")

        elif event == cv2.EVENT_RBUTTONDOWN:
            if points:
                removed = points.pop()
                print(f"✗ Point removed: {removed}")

        # redraw
        img = clone.copy()
        for i, p in enumerate(points):
            cv2.circle(img, p, 5, (0, 0, 255), -1)
            cv2.putText(img, str(i), (p[0]+5, p[1]-5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

        if len(points) > 1:
            cv2.polylines(img, [np.array(points)], False, (0, 255, 0), 2)
        
        # Show preview of closed polygon if we have 3+ points
        if len(points) >= 3:
            cv2.polylines(img, [np.array(points)], True, (255, 0, 0), 1)

    cv2.namedWindow("Select ROI", cv2.WINDOW_NORMAL)
    cv2.setMouseCallback("Select ROI", mouse_callback)

    print("\n" + "="*50)
    print("🖱️  Left click: add point")
    print("🖱️  Right click: undo last point")
    print("💾 Press 'S' to save and finish")
    print("❌ Press 'Q' or ESC to cancel")
    print("="*50 + "\n")

    while True:
        cv2.imshow("Select ROI", img)
        key = cv2.waitKey(1) & 0xFF

        if key == ord('s') or key == ord('S'):
            if len(points) >= 3:
                print("\n✅ ROI saved successfully!")
                break
            else:
                print("\n⚠️  Need at least 3 points to form a polygon")
        elif key == ord('q') or key == ord('Q') or key == 27:
            print("\n❌ Selection cancelled")
            points = []
            break

    cv2.destroyAllWindows()
    return points


# Run the selection
if __name__ == "__main__":
    image_path = r'C:\Users\ashut\DiMITO\N1T2\STUB\input\j.jpg'
    
    selected_points = select_road_roi(image_path)
    
    if selected_points:
        print("\n" + "="*50)
        print("📍 SELECTED ROI POINTS:")
        print("="*50)
        print(f"Points array: {selected_points}")
        print(f"\nTotal points: {len(selected_points)}")
        print("\nFormatted for code:")
        print(f"roi_polygon = {selected_points}")
        print("="*50)
    else:
        print("\n⚠️  No points selected")
 