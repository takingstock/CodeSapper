import cv2 as cv
import sys
import numpy as np

inhouse_ocr_wd, inhouse_ocr_ht = 2479, 3508

def returnLineCoOrds( im ):
    min_pix_val = 250
    minLineLength = 10


    scale_wd = ( inhouse_ocr_wd / im.shape[1] ) if im.shape[1] < inhouse_ocr_wd else\
                ( im.shape[1]/ inhouse_ocr_wd )
    scale_ht = ( inhouse_ocr_ht / im.shape[0] ) if im.shape[0] < inhouse_ocr_ht else\
                ( im.shape[0]/ inhouse_ocr_ht )
    
    
    print('GONDAL->', im.shape, scale_wd, scale_ht )
    # im = cv.imread(im)
    
    gray = cv.cvtColor( im , cv.COLOR_BGR2GRAY)
    gray = cv.bitwise_not(gray)
    bw = cv.adaptiveThreshold(gray, 255, cv.ADAPTIVE_THRESH_MEAN_C, \
                                    cv.THRESH_BINARY, 15, -2)
    horizontal = np.copy(bw)
    horizontal = np.copy(bw)
    if 1 == 1:
        cols = horizontal.shape[1]
        # horizontalsize = 50
        horizontalsize = 100
        # Create structure element for extracting horizontal lines through morphology operations
        horizontalStructure = cv.getStructuringElement(cv.MORPH_RECT, (horizontalsize, 1))
        # Apply morphology operations
        horizontal = cv.erode(horizontal, horizontalStructure)
        horizontal = cv.dilate(horizontal, horizontalStructure)
        cv.imwrite('prayer_hori.jpg', horizontal ) 

    kk = ( cv.imread( 'prayer_hori.jpg', cv.IMREAD_GRAYSCALE ) )    
    h, w = kk.shape

    tempLineCoords = dict()
    #print( kk.shape )
    #print( np.where( kk >= min_pix_val ) )
    y_arr , x_arr = np.where( kk >= min_pix_val )
    #print( "Horizontal Lines Array : ", len(y_arr), len(x_arr) )

    prev = -100000 
    xmin = 100000
    xmax = -1000
    ymin = 100000
    ymax = -1000
    final_line_coords = dict()

    for yctr in range( len(y_arr) ):
        elem = y_arr[ yctr ]
        if prev != -100000 and prev != elem:
            #print('y - ', prev , ' x range - ', ( xmin, xmax ) )
            if xmax - xmin > w*0.1:
                #print( 'Not wat we are lookin for ' )
                final_line_coords[ int(prev*scale_ht) ] = ( int( xmin*scale_wd ), int( xmax*scale_wd ) )
                #print('The length = ',(xmax - xmin), ' the line xmin, ymin ' , ( xmin, ymin ), ' xmax ymax ', ( xmax, ymax ) )
            xmin = -1000
            xmax = -1000
           
        prev = elem
        if xmin == -1000:
            xmin = x_arr[yctr]
            ymin = y_arr[yctr]
        xmax = x_arr[yctr]    
        ymax = y_arr[yctr]    

    # return( final_line_coords, x_arr, y_arr )
    return( final_line_coords )

if __name__ == "__main__":
    import time
    st_ = time.time()

    print( returnLineCoOrds( cv.imread( sys.argv[1] ) ) )
    print( time.time() - st_ )
