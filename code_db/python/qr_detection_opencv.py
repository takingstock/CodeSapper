from kraken import binarization
from PIL import Image
import cv2
import numpy as np
import sys

def detectQR( image_path, debug=False ):

    # binarization using kraken
    fnm_ = image_path.split('/')[-1]
    im = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    print( im.shape )
    blur = cv2.GaussianBlur(im, (91, 91), 0)
    ret, bw_im = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY+cv2.THRESH_OTSU)
    # zbar
    cv2.imwrite( 'bw.jpg', bw_im )

    # Preprocess the image if needed (e.g., blur, thresholding)

    # Find contours
    contours, _ = cv2.findContours( bw_im, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    # Filter contours based on area
    largest_contour = None
    max_area, resp_ = 0, []
    for contour in contours:
        # Get bounding rectangle coordinates
        x, y, w, h = cv2.boundingRect(contour)
        if x == 0 or w < 100 or h < 100 or (w/h) < 0.9 or (h/w) < 0.9: 
            if y < 0.3*im.shape[0] and w > 75 and h > 75 and ( ( (w/h) > 0.9 and (w/h) < 1.1 ) or\
                    ( (h/w) > 0.9 and (h/w) < 1.1 ) ):
                resp_.append( (x, y, w, h ) )
                return resp_

            continue

        print( x, y, w, h )
        resp_.append( (x, y, w, h ) )
        # Draw the rectangle on the original image
        cv2.rectangle( bw_im, (x, y), (x + w, y + h), (0, 255, 0), 2)

    # Display the result
    if debug is True:
        cv2.imwrite('BOUNDED/'+fnm_, bw_im)

    return resp_

if __name__ == "__main__":
    import os
    ll_ = os.listdir( 'TEST' )
    import time
    result_ = dict()
    for img in ll_:
        tm = time.time()
        resp_ = detectQR( 'TEST/'+img, debug=True )
        print('Time taken->', time.time() - tm )
        if len( resp_ ) > 0:
            result_[ img ] = 'YES'

    import json
    with open( 'QR_DETECTION.json', 'a' ) as fp:
        json.dump( result_ , fp)
