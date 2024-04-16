from PIL import Image
import subprocess
import time

import sys


def convert_to_black_and_white(input_image):
    # Open the image
    # Convert the image to grayscale (black and white)
    grayscale_image = input_image.convert("L")

    return grayscale_image

import pytesseract
from Levenshtein import distance
from pdf2image import convert_from_path
import time, json, os
import multiprocessing, subprocess
## NOTE -> ideally the below should be in a config file .. IN case u want a standardized op for your ocr files
inhouse_ocr_wd, inhouse_ocr_ht = 2550, 3300

def get_image_ocr_data_tesseract_api( path, res_path ):
        # start_time = time.time()
        img_path = path
        image = Image.open( img_path )
        print('Size width, height = ', image.size, img_path )
        fnm_ = img_path.split('/')[-1]
        image.save( fnm_ + '.png', "PNG" )


        gray_img_ = convert_to_black_and_white( image )

        try:
          os.remove( fnm_ + '.png' )
        except OSError:
          pass

        boxes = pytesseract.image_to_data( gray_img_ )  

        scale_wd = ( inhouse_ocr_wd / image.size[0] ) if image.size[0] < inhouse_ocr_wd else\
                ( image.size[0]/ inhouse_ocr_wd )
        scale_ht = ( inhouse_ocr_ht / image.size[1] ) if image.size[1] < inhouse_ocr_ht else\
                ( image.size[1]/ inhouse_ocr_ht )

        pytesseract_dict_ = dict()
        uid, prev_y0, prev_y2, prev_midpoint  = 1, None, None, None
        lines_, curr_line_, storeD = [], [], dict()

        for b in boxes.splitlines():
          b = b.split('\t')
          try:
            bound_ = [ int( int( b[-6] )*scale_wd ), \
                       int( int( b[-5] )*scale_ht ), \
                       int( (int( b[-6] ) + int( b[-4] ))*scale_wd ), \
                       int( (int( b[-5] ) + int( b[-3] ))*scale_ht ) ]
          except:
            continue  
          if len( b[-1] ) < 1 or b[-1] in [' ','  ','']: continue

          refKey = None

          for key, val_arr in storeD.items():
              xy_ = key.split('_')
              x0, y0, y2 = int( xy_[0] ), int( xy_[1] ), int( xy_[2] )
              midpoint_y = y0 + ( y2 - y0 )/2
              midpoint_y_curr_ = bound_[1] + ( bound_[-1] - bound_[1] )/2

              if ( bound_[1] >= y0 and bound_[1] <= midpoint_y ) or abs( bound_[1] - y0 ) < 10\
                      or ( y0 >= bound_[1] and y0 <= midpoint_y_curr_ ):
                  refKey = key
                  break

          refined_text = b[-1].replace( '|','' ).replace('[', '').replace(']', '').replace('_','')

          if prev_y0 is None:
              prev_y0 = bound_[1]
              prev_y2 = bound_[-1]
              prev_midpoint = prev_y0 + ( prev_y2 - prev_y0 )/2

          elif prev_y0 is not None and bound_[1] > prev_midpoint:
              ## new line begins
              lines_.append( curr_line_ )
              curr_line_ = []
              prev_y0 = bound_[1]
              prev_y2 = bound_[-1]
              prev_midpoint = prev_y0 + ( prev_y2 - prev_y0 )/2

          elif prev_y0 is not None and bound_[1] < prev_midpoint:
              ## new line begins
              prev_y0 = bound_[1]
              prev_y2 = bound_[-1]
              prev_midpoint = prev_y0 + ( prev_y2 - prev_y0 )/2

          curr_line_.append( { 'id': str(uid), 'ids':[ uid ], 'pts': bound_, 'text': refined_text } )    
          uid += 1

          if refKey is None:
              storeD[ str(bound_[0])+'_'+str(bound_[1])+'_'+str(bound_[-1]) ] = \
                      [ { 'id': str(uid), 'ids':[ uid ], 'pts': bound_, 'text': refined_text } ]
          else:
              ll_ = storeD[ refKey ]
              ll_.append( { 'id': str(uid), 'ids':[ uid ], 'pts': bound_, 'text': refined_text } )

          print( refined_text, ' Bounds-> ', bound_ )
          pytesseract_dict_[ refined_text+'#'+str( bound_[0] )+str( bound_[1] ) ] = bound_

        y_sorted_ = dict( sorted( storeD.items(), key=lambda x: int( (x[0].split('_'))[1] ) ) )
        finalResponse_ = []
        for key, val in y_sorted_.items():
            sorted_x_ = sorted( val, key=lambda x:x['pts'][0] )
            finalResponse_.append( sorted_x_ )
        # print(f"Page {i+1} OCR completed in {ocr_time:.2f} seconds.")
        print( { "lines":finalResponse_ , \
                 "height": image.size[1] ,"width":image.size[0] } )

        return { "lines":finalResponse_ , \
                 "height": image.size[1] ,"width":image.size[0] }


if __name__ == "__main__":
  start_time = time.time()

  import sys
  resp_json_ = get_image_ocr_data_tesseract_api( sys.argv[1], sys.argv[2] )

  '''
  import json
  print('DUM->', sys.argv[2] + resjson_file)
  with open( sys.argv[2] + resjson_file, 'a' ) as fp:
      json.dump( resp_, fp )

  '''
  end_time = time.time()
  ocr_time = end_time - start_time

  print(f"Page OCR completed in {ocr_time:.2f} seconds.")




