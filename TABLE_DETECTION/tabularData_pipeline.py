import json, os, sys, subprocess, traceback
import pytesseract_api as tess
import google_ocr as goog
import extractLineFeatures_v3 as table_extract

with open( 'ocr_config.json', 'r' ) as fp:
    config_json_ = json.load( fp )

def checkFmt( path, result_json_path ):
    '''
    if the image is a pdf convert it into a jpeg since most OCR systems accept only images
    '''
    _, file_extension = os.path.splitext(path)
    fnm_ = os.path.basename(path).split('.')[0]

    if file_extension.lower() == '.pdf':
        ## convert using imagemagick
        subprocess.check_output( 'convert -density 300 -quality 90 -alpha remove ' + path + ' ' + \
                                 result_json_path + '/' + fnm_ + '.jpg', shell=True )

        return result_json_path + '/' + fnm_ + '.jpg'

    return path

def tableContents( file_path ):

    try:
        file_path = checkFmt( file_path, config_json_['JSON_FOLDER'] )
        ## OCR extraction     
        if config_json_['ocr_engine'] == 'TESSERACT':
            response_json_ = tess.get_image_ocr_data_tesseract_api( file_path, config_json_['JSON_FOLDER'] )

        elif config_json_['ocr_engine'] == 'GOOGLE':
            response_json_ = goog.get_image_ocr_data_google_api( file_path, config_json_['JSON_FOLDER'] )

        fnm_ = (file_path.split('/')[-1]).split('.')[0]
        result_json_path_ = config_json_['JSON_FOLDER'] + fnm_ + '.json'
        
        print('write->', result_json_path_)
        with open( result_json_path_, 'w' ) as fp:
            json.dump( response_json_, fp )

        ## now invoke the table detection and extraction which uses both visual and textual cues
        table_deets_ = table_extract.locateTableAndExtractCellInfo( file_path, result_json_path_ )
        
        print( table_deets_ )
    except:
        print( 'Some issue with table extraction :( ', traceback.format_exc() )
    ## finally we need to convert the table deets into some format that can be inserted into the KG

if __name__ == '__main__':
    tableContents( sys.argv[1] )
