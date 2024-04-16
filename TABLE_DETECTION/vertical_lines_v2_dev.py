import cv2 as cv
import sys
import numpy as np

inhouse_ocr_wd, inhouse_ocr_ht = 2479, 3508

def correction_vert_lines(val1):
    val = val1[:]
    # val.reverse()
    lists = []
    inner_list = []
    # print("val : ", val)
    for i in range(len(val) - 1):
        pixel_here = val[i]
        pixel_next = val[i + 1]
        inner_list.append(pixel_here)
        if (pixel_next - pixel_here > 100):
            # print("lists before : ", lists)
            lists.append(inner_list)
            # print("lists after : ", lists)
            inner_list = []
        elif (i == len(val) - 2):
            inner_list.append(pixel_next)
            lists.append(inner_list)
        else:
            pass
    # print("lists : ", lists)
    # print("inner_list : ", inner_list)
    master_diff = 0
    list_to_return = []
    for j in range(len(lists)):
        list_here = lists[j]
        diff_here = list_here[-1] - list_here[0]
        if (master_diff < diff_here):
            master_diff = diff_here
            list_to_return = list_here
    return list_to_return
    
def returnLineCoOrds( im ):
    min_pix_val = 250
    minLineLength = 10
    
    # im = cv.imread(im)
    scale_wd = ( inhouse_ocr_wd / im.shape[1] ) if im.shape[1] < inhouse_ocr_wd else\
                ( im.shape[1]/ inhouse_ocr_wd )
    scale_ht = ( inhouse_ocr_ht / im.shape[0] ) if im.shape[0] < inhouse_ocr_ht else\
                ( im.shape[0]/ inhouse_ocr_ht )
    
    gray = cv.cvtColor( im , cv.COLOR_BGR2GRAY)
    gray = cv.bitwise_not(gray)
    bw = cv.adaptiveThreshold(gray, 255, cv.ADAPTIVE_THRESH_MEAN_C, \
                                    cv.THRESH_BINARY, 15, -2)
    horizontal = np.copy(bw)
    vertical = np.copy(bw)
    cv.imwrite('bw_img.jpg', bw )	
    if 1 == 1:
        rows = vertical.shape[0]
        verticalsize = 50
        # verticalsize = 75
        # verticalsize = 100
        # Create structure element for extracting vertical lines through morphology operations
        verticalStructure = cv.getStructuringElement(cv.MORPH_RECT, (1, verticalsize))
        # Apply morphology operations
        vertical = cv.erode(vertical, verticalStructure)
        vertical = cv.dilate(vertical, verticalStructure)
        cv.imwrite('prayer_vertical.jpg', vertical ) 

    kk = ( cv.imread( 'prayer_vertical.jpg', cv.IMREAD_GRAYSCALE ) )    
    h, w = kk.shape
    tempLineCoords = dict()
    print( 'PRAYER->SHAPE->', kk.shape )
    #print( np.where( kk >= min_pix_val ) )
    y_arr , x_arr = np.where( kk >= min_pix_val )
    #print( len(y_arr), len(x_arr) )
    #print("y_arr , x_arr : ", y_arr , x_arr)

    prev = -100000
    ymin = -1000
    ymax = -1000
    final_line_coords = dict()

    for xctr in range( len(x_arr) ):
        elem = x_arr[ xctr ]
        y_elem = y_arr[ xctr ]
        if elem in final_line_coords.keys():
            ll = final_line_coords[ elem ]
        else:
            ll = list()
        ll.append( y_elem )
        final_line_coords[ elem ] = ll

    fn = dict()
    for key, val in final_line_coords.items():
        val.sort()
        val = correction_vert_lines(val)
        #print("Correction Vert Lines : ", val)
        if type(val) == list and len(val) > 0 and  val[-1] - val[0] > 20:
            fn[ int( key*scale_ht ) ] = ( int( val[0]*scale_wd ), int( val[-1]*scale_wd ) )

    import collections
    od = collections.OrderedDict(sorted(fn.items()))
    # return( dict(od), x_arr, y_arr )
    return( dict(od) )
   
if __name__ == "__main__":
    import time
    st_ = time.time()

    print( returnLineCoOrds( cv.imread( sys.argv[1] ) ) )
    print( time.time() - st_ )
