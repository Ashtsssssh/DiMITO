"""
CALLER FOR THE FUNC, RETURNS JSON WE NEED
STORES IMAGHE IN STUBS->OUTPUT->OUTPUT_IMAGES

// EITHER RETRAIN MODEL OR RECALIBRATE CALCULATIONS IF NOT SATISFACTORY
"""

from N1T2.test_model import analyze_traffic_image

 
test_image = r'C:\Users\ashut\DiMITO\c.jpg'

# Call the function and get JSON result
result = analyze_traffic_image(
    image_path=test_image,
    camera_id="CC_01",
    save_visual=True
)

# Use the result
print(result)




# i have my N1T2 ready for now, i call the function and it gives me the output, now i want to make a django app so that i can take in requestes from a client and return t