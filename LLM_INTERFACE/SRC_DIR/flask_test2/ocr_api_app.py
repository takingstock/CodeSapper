import os
import sys
sys.path.append(os.getcwd())
from flask import Flask, redirect, url_for, request, render_template, jsonify
from flask_cors import CORS, cross_origin
from werkzeug.utils import secure_filename
# os.environ["OPENCV_IO_MAX_IMAGE_PIXELS"] = str(pow(2,40))
import cv2
from main.unet_model import get_mask
from main.orientation_model import get_orientation
from utils.text_detection import TextDetection
from main.start_ocr import model_extract
import imutils
import time

# Define a flask app
app = Flask(__name__)
cors = CORS(app)
app.config['CORS_HEADERS'] = 'Content-Type'

basepath = os.getcwd()
host_address = "0.0.0.0"
port = 8113
print("port :", port)

print('checking git 1')


@app.route('/td_api', methods=['GET', 'POST'])
@cross_origin()
def start_td():
    if request.method == 'POST':
        # Get the file from post request
        try:
            im_path = request.form['orig_path']
            dst_path = request.form['dst_path']
            img = cv2.imread(im_path)
            im_ = cv2.imread(im_path,0)
            orig_img = img.copy()
            text_mask = get_mask([im_])[0]
            text_mask = cv2.threshold(text_mask, 125, 255, cv2.THRESH_BINARY)[1]
            text_mask_bw = text_mask
            text_mask = cv2.cvtColor(text_mask, cv2.COLOR_GRAY2BGR)
            orientation_pred = get_orientation([text_mask])[0]
            if orientation_pred == 90:
                img = imutils.rotate_bound(img, -90)
                text_mask_bw = imutils.rotate_bound(text_mask_bw, -90)
            ocr_res = TextDetection(img, im_path, text_mask_bw)
            im_out = ocr_res.oriented_orig_img_color.copy()
            color_1 = [0, 0, 255]
            color_2 = [0, 255, 0]
            color_3 = [255, 0, 0]
            curr_color = color_1
            lines = ocr_res.lines
            if True:
                for line_idx, line in enumerate(lines):
                    if curr_color == color_1:
                        curr_color = color_2
                    elif curr_color == color_2:
                        curr_color = color_3
                    else:
                        curr_color = color_1
                    pts_line = []
                    for block_idx, block in enumerate(line):
                        # id = block["id"]
                        [x, y, w, h] = block["pts"]
                        new_id = block["id"]
                        block["id"] = new_id
                        lines[line_idx][block_idx]["id"] = new_id
                        # if h<13:
                        cv2.rectangle(im_out, (x, y), (x + w, y + h), curr_color, 2)
                        # remove_bg(im_out_2[y:y+h,x:x+w],h,w)
                        pts_line.append(block['pts'])
                        # print("w",w,"h",h)
                        # print('BLOCK->', block)
                        # text_blocks.append(block)
                    # print("pts", pts_line)
                cv2.imwrite(dst_path, im_out)
        except:
            print("Error in ",im_path)
        return jsonify("Success")


@app.route('/extractText', methods=['GET', 'POST'])
@cross_origin()
def start_ocr():
    if request.method == 'POST':
        # Get the file from post request
        files = request.files
        basepath = os.path.dirname(__file__)
        file = files['file']
        name = secure_filename(file.filename)
        print("Raw file input to OCR: ", str(time.time()), name, file)
        dst_folder = os.path.join(basepath, 'uploads', 'jpg')
        im_path = os.path.join(dst_folder, name)
        dst_path = os.path.join(basepath,'mod_jpg',name)
        file.save(im_path)
        ocr_res = model_extract(im_path,dst_path)
        if ocr_res:
            os.remove(dst_path)
            return jsonify(ocr_res)
        return jsonify({"line":[],"path":''})




if __name__=="__main__":
    # app.run(host=host_address, debug=False, port=port, threaded=False)
    print('starting on', port)
    app.run(host=host_address, port=port,threaded=False)
