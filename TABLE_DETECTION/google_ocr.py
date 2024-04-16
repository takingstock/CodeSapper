import os
import io
import json

import pandas as pd
from google.cloud import vision

basepath = os.path.dirname(__file__)

with open( 'ocr_config.json', 'r' ) as fp:
    config_json_ = json.load( fp )

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = config_json_["credentials_if_google_ocr"]
os.environ["GCLOUD_PROJECT"] = config_json_["project_name_if_google_ocr"]

def get_image_ocr_data_google_api(image_path, ocr_output_path):
    client = vision.ImageAnnotatorClient()
    image_location = image_path
    with io.open(image_location, 'rb') as img:
        content = img.read()

    image = vision.Image(content=content)
    response = client.text_detection(image=image)
    texts = response.text_annotations
   
    '''
    print("texts :", texts)
    
    with open("texts.txt", "w") as f:
        f.write(texts)
    
    '''
    # Group words by lines
    grouped_lines = group_by_lines(texts)

    # Formatting lines
    formatted_lines = []
    i = 0
    for line_data in grouped_lines:
        words_with_coords = []
        for i_add, word in enumerate(line_data['words']):
            # Extracting top-left and bottom-right coordinates for each word
            word_top_left = (texts[i + 1].bounding_poly.vertices[0].x, texts[i + 1].bounding_poly.vertices[0].y)
            word_bottom_right = (texts[i + 1].bounding_poly.vertices[2].x, texts[i + 1].bounding_poly.vertices[2].y)
            # Formatting as a list [x1, y1, x4, y4]
            word_pts = [word_top_left[0], word_top_left[1], word_bottom_right[0], word_bottom_right[1]]
            print("word_pts :", word_pts)
            words_with_coords.append({
                'text': word,
                'pts': word_pts
            })
            i = i + 1
            print("i :", i)
        formatted_lines.append(words_with_coords)

    # Safeguard for accessing image dimensions
    width, height = None, None
    if response.full_text_annotation.pages:
        width = response.full_text_annotation.pages[0].width
        height = response.full_text_annotation.pages[0].height

    # Constructing the final JSON structure
    result = {
        'path': image_path,
        'lines': formatted_lines,
        'width': width,
        'height': height
    }

    # Saving the data to a JSON file
    fnm_ = (image_path.split('/')[-1]).split('.')[0]
    with open(ocr_output_path + fnm_ + '.json', 'w') as json_file:
        json.dump(result, json_file)

    # Safeguard for printing the first line
    if result['lines']:
        print(result['lines'])
    else:
        print("No lines detected.")

    return result


def group_by_lines(texts):
    # Create a list to hold lines
    lines = []

    # Sort the words by their top y-coordinate
    sorted_texts = sorted(texts[1:], key=lambda t: t.bounding_poly.vertices[0].y)
    print('group_by_lines->', sorted_texts)

    for text in sorted_texts:
        added_to_line = False
        for line in lines:
            # If the word's top y-coordinate is close to a line's y-coordinate, add it to that line
            if abs(text.bounding_poly.vertices[0].y - line['top']) < 40:  # 40 is a threshold that may need adjustment
                line['words'].append(text.description)
                line['left'] = min(line['left'], text.bounding_poly.vertices[0].x)
                line['right'] = max(line['right'], text.bounding_poly.vertices[2].x)
                line['top'] = min(line['top'], text.bounding_poly.vertices[0].y)
                line['bottom'] = max(line['bottom'], text.bounding_poly.vertices[2].y)
                added_to_line = True
                break

        # If the word wasn't added to any line, create a new line for it
        if not added_to_line:
            lines.append({
                'words': [text.description],
                'left': text.bounding_poly.vertices[0].x,
                'right': text.bounding_poly.vertices[2].x,
                'top': text.bounding_poly.vertices[0].y,
                'bottom': text.bounding_poly.vertices[2].y
            })

    return lines

if __name__ == '__main__':
    import time, sys
    start_ = time.time()

    resp_json_ = get_image_ocr_data_google_api( sys.argv[1] , sys.argv[2] )

    print('Time taken->', time.time() - start_)

