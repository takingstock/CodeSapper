import os, json, sys, cv2, random, traceback
import numpy as np
from scipy.spatial import distance
import doc_utils
import generateCLRData
import vertical_lines_v2_dev, horizontal_lines_v2_dev

vector_max_len_, distance_thresh_, counter_norm_scale_, y_offset_norm = 10, 0.2, 10, 100
inhouse_ocr_wd, inhouse_ocr_ht = 2479, 3508
color_schema_ = [ (0, 255, 0), ( 0, 0, 255), (255, 0, 0) , ( 255, 0 , 255 ), ( 0, 255, 255 ) ]

dIdx = {'ALNUM': 1, 
'ALL_CAPS': 2,
'DIGIT': 3,
'TEXT': 4,
'NA': 5,
'DATE': 6 }

with open( 'ocr_config.json', 'r' ) as fp:
    config_json_ = json.load( fp )

def quickDtypeStr( line_ ):

    str_dtype_ = 0

    for wd in line_:
        if doc_utils.dataType( wd['text'] ) in [ 'ALL_CAPS', 'TEXT' ] or wd['text'] == '': str_dtype_ += 1

    print( 'in quickDtypeStr->', len( line_ ), str_dtype_ )
    if str_dtype_ == len( line_ ): return True
    return False

def allDtypesStr( ln_idx, raw_jsn_, intra_dtypes, hor_lines_, maxY, minYNext, width_ ):
    num_matches_, nonzero = 0, 0
    ## find if there's a horizontal line between lines
    tbl_upper_bound_ = locateHor( hor_lines_, maxY, minYNext, width_ )

    print('ANY TABLE FOUND BELOW ??', tbl_upper_bound_)

    if tbl_upper_bound_ is not None: 
        ## ensure the imm line below is not ALL STR ..else its mostly an FP
        if ln_idx < len( raw_jsn_ ) - 1 and quickDtypeStr( raw_jsn_[ ln_idx+1 ] ) is False:
            return True
        else:
            print('ERRHM next line is ALL STR !!')

    for elem in intra_dtypes:
        if elem in [ 2, 4 ]: num_matches_ += 1
        if elem != 0: nonzero += 1
        if elem in [ 3, 6 ] : num_matches_ -= 1

    print('GONZO->', ln_idx, intra_dtypes, nonzero, num_matches_ )
    if nonzero - num_matches_ <= 1: return True
    return False

def getFeatVec_new( ln_idx, raw_jsn_, width, height, potential_headers_, hor_lines_ ):

    intra_dtypes, intra_distances_ = np.zeros( vector_max_len_ ), np.zeros( vector_max_len_*2 )
    ref_line_, nxt_ln_ = raw_jsn_[ ln_idx ], raw_jsn_[ min( ( ln_idx + 1 ), len( raw_jsn_ ) - 1 ) ]


    if len( ref_line_ ) < 3: return np.zeros( vector_max_len_*3 ).tolist()
    #if len( ref_line_ ) < 3: return np.zeros( vector_max_len_*6 ).tolist()
    ## intra line feats

    maxY, minYNext, width_ = findYandXBounds( ref_line_, nxt_ln_ )

    for wdidx, wd in enumerate( ref_line_ ):
        if wdidx > (vector_max_len_) - 1: break

        intra_dtypes[ wdidx ] = dIdx[ doc_utils.dataType( wd['text'] ) ]

        ## make 2 entries into intra_distances_ ..x dist to prev and next
        if wdidx > 0 and wdidx < len(ref_line_) - 1:
            intra_distances_[ wdidx*2 ] = ( ( wd['pts'][0] - ref_line_[ wdidx - 1 ]['pts'][2] )/width )
            intra_distances_[ wdidx*2 + 1 ] = ( ( ref_line_[ wdidx + 1 ]['pts'][0] - wd['pts'][2] )/width )

        elif wdidx == 0 :
            intra_distances_[ wdidx*2 ] = ( 0.0 )
            intra_distances_[ wdidx*2 + 1 ] = ( ( ref_line_[ wdidx + 1 ]['pts'][0] - wd['pts'][2] )/width )

        elif wdidx == len(ref_line_) - 1:
            intra_distances_[ wdidx*2 ] = ( ( wd['pts'][0] - ref_line_[ wdidx - 1 ]['pts'][2] )/width )
            intra_distances_[ wdidx*2 + 1 ] = ( 0.0 )

    ## inter line feats
    inter_distances_, inter_dtypes_, num_x_matches_ = np.zeros( vector_max_len_ ), np.zeros( vector_max_len_ ),\
                                                      np.zeros( vector_max_len_ )

    already_matched_ = []
    x_match_ctr, y_offset_, dtype_match_, y_offset_lines_ = 0, 0, 0, []

    for ref_wdidx, ref_wd in enumerate( ref_line_ ):
        if ref_wdidx > vector_max_len_-1: break

        ## just check previous 2 lines
        for localidx, line_idx in enumerate( range( ln_idx - 2, ln_idx + 5 ) ):
            if line_idx > 0 and line_idx != ln_idx and line_idx <= len( raw_jsn_ ) - 1:
                local_line_ = raw_jsn_[ line_idx ]

                for locidx, locwd in enumerate( local_line_ ):
                    if doc_utils.xOverlapBetter( locwd['pts'], ref_wd['pts'] ) and\
                            locwd['pts'] not in already_matched_: 

                        x_match_ctr += 1
                        already_matched_.append( locwd['pts'] )
                        y_offset_lines_.append( line_idx )

                        if locwd['pts'][-1] < ref_wd['pts'][1] and ref_wd['pts'][1] - locwd['pts'][-1] > y_offset_:
                            y_offset_ = ref_wd['pts'][1] - locwd['pts'][-1]
                        elif locwd['pts'][1] > ref_wd['pts'][-1] and locwd['pts'][1] - ref_wd['pts'][-1] > y_offset_:
                            y_offset_ = locwd['pts'][1] - ref_wd['pts'][-1]

                        if doc_utils.dataType( locwd['text'] ) == doc_utils.dataType( ref_wd['text'] ):
                            dtype_match_ += 1

    res_vec_ = intra_dtypes.tolist() + intra_distances_.tolist()
    print('CASEY->', ref_line_, [ x_match_ctr ] )
    hdr_dtypes_ = allDtypesStr( ln_idx, raw_jsn_, intra_dtypes, hor_lines_, maxY, minYNext, width_ )
    ## check the # of overlaps .. in total they have to be atleast equal to num contours in ref line
    if x_match_ctr >= len( ref_line_ ):
    #if x_match_ctr >= len( ref_line_ ) or x_match_ctr >= 5:
        ## since y offset is measuring the absolute max distance between ref line and prev 2 overlapping lines
        avg_y_offset_ = y_offset_/len( y_offset_lines_ )
        ## now blend all 3 num overlap matches; y offset ; dtype match count and multiply it to res vector
        ## res vector is a combo of intra_dtypes, intra_distances_
        
        ## just normalize the scaling factor ..we dont want ANY element of the vector to exceed 1
        scaling_factor_ = (x_match_ctr +avg_y_offset_+ dtype_match_)/ max( x_match_ctr, avg_y_offset_, dtype_match_ )
        scaling_factor_ += np.std( intra_distances_ ) ## purely random

        print('ROCKET->', x_match_ctr, avg_y_offset_, dtype_match_, len( ref_line_ ), y_offset_, scaling_factor_,\
                np.mean( intra_distances_ ), np.std( intra_distances_ ) )
        res_vec_ = [ scaling_factor_+x for x in res_vec_ ]

        if hdr_dtypes_ is True:
            potential_headers_[ ln_idx ] = res_vec_ 

    return res_vec_ 

def generateTblData( raw_jsn_, fpath, hor_lines_, ver_lines_ ):
  
    dd_ = dict()

    potential_headers_ = dict()

    actual_lines_ = generateCLRData.stitchEmUp( raw_jsn_['lines'] )   
    for ln_idx, line in enumerate( actual_lines_ ):

            featVec = getFeatVec_new( ln_idx, actual_lines_, raw_jsn_['width'], \
                                      raw_jsn_['height'],potential_headers_, hor_lines_ )
            print( np.asarray( featVec ).shape )

            dd_[ ln_idx ] = featVec

    hack_ = dict()
    for key, val in potential_headers_.items():
        for k1, v1 in dd_.items():
            if key == k1 or sum( val ) == 0 or sum( v1 ) == 0 or \
                    len( val ) <= 0.5*len( v1 ) or len( v1 ) <= 0.5*len( val ): continue

            if distance.cosine( val, v1 ) <= distance_thresh_:
                print('COS DIST->', key, val,'\n', k1, v1,'\n',distance.cosine( val, v1 ))

                if key in hack_:
                    ll = hack_[ key ]
                else:
                    ll = []

                ll.append( k1 )
                hack_[ key ] = ll

    return potential_headers_, hack_, actual_lines_

def pureTextAndStraddlesMoreThanOneCol( hdr_row_, curr_row_, lines_ ):

    hdr, curr = lines_[ hdr_row_ ], lines_[ curr_row_ ]
    text_, overlap_ = 0, 0

    for i1, c1 in enumerate( curr ):
        if doc_utils.dataType( c1['text'] ) in [ 'TEXT', 'ALL_CAPS' ]: text_ += 1

        for i2, c2 in enumerate( hdr ):
            if doc_utils.xOverlapBetter( c1['pts'], c2['pts'] ):
                overlap_ += 1
                break

    if text_ == len( curr ) and overlap_ > 1 and curr_row_ - hdr_row_ > 1:
        ## the last and condition is because at times the header itself spreads across 2 rows
        ## in such cases, it can just break in the header row itself
        print('intra period break->', curr_row_)
        return True

    return False

def tblBounds( tbl_beg, tbl_end, lines_, fnm_, img_path ):

    ## first thing to check, is to find, is if there's a line in between beg and END that is pure text
    ## and straddles atleast 2 columns in header ..this does 2 things, one, it ensures that in cases where
    ## the description stretches across 2 lines, we cant mistakenly end the table there
    ## NOTE -> this condition will need to be removed for generic tables since TEXT only tables will
    ## routinely meet this condition
    breaking_bad_, jpg_file_ = None, img_path

    if tbl_end == len( lines_ )-1: 
        print('TBL END')
        return None

    for idx in range( tbl_beg+1 , tbl_end+1 ): ## add 1 since we subtracted 1 before calling this
        if pureTextAndStraddlesMoreThanOneCol( tbl_beg, idx, lines_ ):
            breaking_bad_ = idx
            break

    if breaking_bad_ is not None: tbl_end = breaking_bad_

    img_ = cv2.imread( jpg_file_ )

    if img_ is not None:
        xarr, yarr = [], []
        for ln_ in lines_[ tbl_beg: tbl_end ]:
            for wd in ln_:
                xarr.append( wd['pts'][0] )
                xarr.append( wd['pts'][2] )
                yarr.append( wd['pts'][1] )
                yarr.append( wd['pts'][3] )

        xarr.sort(); yarr.sort()
        print('DRAWING RECT->', ( xarr[0], yarr[0] ), ( xarr[-1], yarr[-1] ) )

        return ( ( xarr[0], yarr[0] ), ( xarr[-1], yarr[-1] ) )

def findYandXBounds( ln_, next_ ):

            y_arr_, x_arr_ = [], []

            for wd in ln_: 
                y_arr_.append( wd['pts'][1] )
                #y_arr_.append( wd['pts'][-1] )
                x_arr_.append( wd['pts'][0] )
                x_arr_.append( wd['pts'][2] )

            maxY = sorted( y_arr_ )[-1]
            x_arr_.sort()
            width_ = x_arr_[-1] - x_arr_[0]

            y_arr_, y2_arr_, x_arr_ = [], [], []

            for wd in next_: 
                y2_arr_.append( wd['pts'][-1] )
                y_arr_.append( wd['pts'][1] )

            prevMinYNxt = sorted( y_arr_ )[-1]

            if abs( maxY - prevMinYNxt ) <= 10:
                minYNext = sorted( y2_arr_ )[-1]
                print('OMG1')
            else:
                print('OMG2')
                minYNext = prevMinYNxt

            return maxY, minYNext, width_

def findVerticals( tbl_upper_bound_, bottom_, hor_lines_, ver_lines_ ):

    upperY, upperX1, upperX2 = tbl_upper_bound_
    lowerY, lowerX1, lowerX2 = bottom_
    min_dist_from_left_thresh_, min_dist_from_right_thresh_ = 0.025, 0.95

    vertical_counters_, last_assigned_ = [], 0 ## atleast 2 ? i mean a tables gotta have atleast 2 vertical lines 
    for xOff, ( y1, y2 ) in ver_lines_.items():

        proportion_ = abs( y1 - y2 )/abs( upperY - lowerY )
        
        print('Checking RECORD->', xOff, ( y1, y2 ), ' IN ', upperY, lowerY,\
                abs( y1 - upperY ), y2 > upperY, y2 > lowerY , abs(lowerY - y2), proportion_ )

        if ( ( y1 <= upperY and y2 > upperY and ( y2 > lowerY or proportion_ >= 0.9 ) and abs(lowerY - y2) >= 10 ) or\
                ( abs( y1 - upperY ) <= 20 and y2 > upperY and ( y2 > lowerY or proportion_ >= 0.9 ) and abs(lowerY - y2) >= 10 ) ) and\
                abs( last_assigned_ - xOff ) >= 20 and\
                xOff >= min_dist_from_left_thresh_*inhouse_ocr_wd and\
                xOff <= min_dist_from_right_thresh_*inhouse_ocr_wd : 
                    ## since like multiple hors at the same lev, u can get multiple verts and the same level
                    ## 100 randomly chosen
            vertical_counters_.append( (xOff, y1, y2) )
            last_assigned_ = xOff

    print('Would it find ANYTHING ??', vertical_counters_)
    if len( vertical_counters_ ) > 1:
        sorted_vert_ = sorted( vertical_counters_, key=lambda x:x[2] )
        ## find the lowest y2 
        lowestY2 = np.median( np.asarray( sorted_vert_ )[:, -1] )
        hor_ = None
        print('lowestY2->', lowestY2)
        for y_, ( xa, xb ) in hor_lines_.items():
            ## the y offset of the hor line must be close to the lowestY2 
            #print('Finding closest Y offset to lowestY2->', y_, abs( xa - xb )/abs( upperX1 - upperX2 ), lowestY2 )
            if ( y_ > lowestY2 or abs( y_ - lowestY2 ) <= 10 ) and\
                    abs( xa - xb ) >= 0.85*abs( upperX1 - upperX2 ):## 30 randomly chosen
                return ( y_, xa, xb ), sorted_vert_

    return None, None        

def closer( tbl_upper_bound_, hor_lines_, ver_lines_, lines_ ):

    y_off, x1, x2 = tbl_upper_bound_ ## assumption -> len of arr will always be 1
    bottom_, horizontal_bottom_ = None, False

    for y_, ( xa, xb ) in hor_lines_.items():
        if y_ > y_off and abs( xa - xb ) >= 0.7*abs( x1 - x2 ) and abs( y_ - y_off ) > 50: 
            ## 50, threshold randomly chosen since the y offsets generated by opencv can be super close
            ## meaning y off can be 1076 and 1080 and the x1, x2 can be the same ..so we need to move to
            ## the actual next y offset

            print('Found closer at ->', y_, ( xa, xb ) )
            bottom_ = ( y_, xa, xb  )
            ## now ensure this isn't simply a break for the table row indicator ..see if there were
            ## vertical lines between upper and this bottom and then check if they continue below this bottom
            neo_bottom_, _ = findVerticals( tbl_upper_bound_, bottom_, hor_lines_, ver_lines_ )
            
            if neo_bottom_ is not None: 
                print('Prev closer was FP .. latest->', neo_bottom_)
                return neo_bottom_, True

            break
        
    return bottom_, horizontal_bottom_

def locateHor( hor_lines_, maxY, minYNext, width_ ):
            
            tbl_upper_bound_ = None

            for y_offset, ( x1, x2 ) in hor_lines_.items():
                #print('IDLING-> y_offset, ( x1, x2 ), maxY, minYNext->', \
                #        y_offset, ( x1, x2 ), maxY, minYNext )

                if ( ( y_offset >= maxY and y_offset <= minYNext ) or \
                        ( y_offset < maxY and abs( y_offset - maxY ) <= 10 and \
                          y_offset <= minYNext ) or \
                        ( y_offset >= maxY and abs( y_offset - minYNext ) <= 10 and \
                        y_offset > minYNext ) ) and \
                        ( abs( x1 - x2 )/width_ ) >= 0.5 :

                            print('Found line below HDR !!->', y_offset, ( x1, x2 ))
                            tbl_upper_bound_ = ( y_offset, x1, x2 )
                            break

            return tbl_upper_bound_

def findCoOrds( tbl_upper_bound_, closer_, lines_, potential_header_line_numbers_, horizontal_bottom_ ):

    x0, x1, y0, y1 = None, None, None, None
    maxx12 = -1
    upperBound_ln_ = None

    fn, fn2 = False, False
    for lnidx, ln in enumerate( lines_ ):

        if x0 is not None and x1 is not None: break
        #print('ROAMING-> Ln, tbl_upper_bound_, closer_->', ln, tbl_upper_bound_, closer_, fn, fn2)

        for wd in ln:
            if wd['pts'][1] > tbl_upper_bound_[0] and fn is False:
                fn = True
                upperBound_ln_ = lnidx
                print('Breaking for LN->', ln, lines_[ upperBound_ln_ ] )
                break

        for wd in ln:
            if wd['pts'][1] >= closer_[0] and fn2 is False:
                fn2 = True
                print('Breaking for LN2->', ln, closer_, lines_[ upperBound_ln_ ] )
                break

        if fn is True and x0 is None:
            x, y = [], []
            print('Checking LN->', lines_[ lnidx ])
            for wd in lines_[ lnidx ]:
                x.append( wd['pts'][0] )
                y.append( wd['pts'][1] )
                if wd['pts'][2] > maxx12: maxx12 = wd['pts'][2]

            x.sort(); y.sort()
            x0, y0 = x[0], y[0]

        if fn2 is True and x1 is None:
            x, y = [], []
            for wd in lines_[ max( lnidx - 1, 0 ) ]:
                x.append( wd['pts'][2] )
                y.append( wd['pts'][3] )

            x.sort(); y.sort()
            x1, y1 = x[-1], y[-1] ## take max elements

    if x0 is not None and x1 is None:
        ## first check for horizontal_bottom_
        if horizontal_bottom_ is True:
                x, y = [], []
                print('Just goin to use last line since hor bot is True', lines_[ -1 ])
                for wd in lines_[ -1 ]:
                    x.append( wd['pts'][2] )
                    y.append( wd['pts'][3] )

                x.sort(); y.sort()
                x1, y1 = x[-1], y[-1] ## take max elements
          ## go throgh pot hdr lines and find a break, beginning upperBound_ln_
        else:
          for id, lnidx in enumerate( potential_header_line_numbers_ ):
            if lnidx <= upperBound_ln_: continue
            next_ = potential_header_line_numbers_[ min(id + 1, len(potential_header_line_numbers_)-1) ]
            print('DUMM->', lnidx, next_)

            if next_ - lnidx > 2:
                print('Breaking at line #-', lnidx)
                x, y = [], []
                for wd in lines_[ lnidx ]:
                    x.append( wd['pts'][2] )
                    y.append( wd['pts'][3] )

                x.sort(); y.sort()
                x1, y1 = x[-1], y[-1] ## take max elements

        if x1 is None:
            ## simply take the last elem of potential_header_line_numbers_
            last_elem_ = potential_header_line_numbers_[-1]
            if last_elem_ > upperBound_ln_:
                x, y = [], []
                for wd in lines_[ lnidx ]:
                    x.append( wd['pts'][2] )
                    y.append( wd['pts'][3] )

                x.sort(); y.sort()
                x1, y1 = x[-1], y[-1] ## take max elements

    if x1 is not None:
        print('ROOTS->', ( x0, y0 ), ( max( x1, maxx12 ), y1 ) )
        return ( x0, y0 ), ( max( x1, maxx12 ), y1 )
    
    return ( x0, y0 ), ( x1, y1 )

def lastMaxOverlap( line_number_, fwd_siblings_, lines_ ):

    ref_line_ = lines_[ line_number_ ]

    last_one_ = None
    for curr in fwd_siblings_:
        overlap_cnt_ = 0
        for refwd in ref_line_:

            for wd in lines_[ curr ]:
                if doc_utils.xOverlapBetter( refwd['pts'], wd['pts'] ):
                    overlap_cnt_ += 1

        print('Eval->', ref_line_, lines_[ curr ], overlap_cnt_)
        if overlap_cnt_ == len( ref_line_ ) or ( overlap_cnt_ >= 5 and abs( overlap_cnt_ - len( ref_line_ ) ) <= 2 ):
            print('100 overlap with refline->', curr)
            last_one_ = curr

    if last_one_ is not None:
        xarr, yarr = [], []
        for ln_ in lines_[ line_number_: last_one_ ]:
            for wd in ln_:
                xarr.append( wd['pts'][0] )
                xarr.append( wd['pts'][2] )
                yarr.append( wd['pts'][1] )
                yarr.append( wd['pts'][3] )

        xarr.sort(); yarr.sort()
        print('DRAWING RECT->', ( xarr[0], yarr[0] ), ( xarr[-1], yarr[-1] ) )

        return ( ( xarr[0], yarr[0] ), ( xarr[-1], yarr[-1] ) )

    return None

def partOf( obj, dict_ ):
    ## obj can be any data type and dict_ will be a dict with value being a list
    for kk, arr_ in dict_.items():
        for elem, bool in arr_:
            if elem == obj: return True

    return False

def drawTables( potential_headers_, hack_, lines_, fnm_, img_path, hor_lines_, ver_lines_, debug ):

    ## BEGIN HACK - if tables present beyond the first 25% of doc, simply ignore the first quarter .. mostly FP
    legit_count_, maxElems_, ignore_first_N_rows_, response_D = dict(), 0, 5, []

    for elem in list( potential_headers_.keys() ):
        if elem <= ignore_first_N_rows_ and maxElems_ < len( lines_[elem] ):
            maxElems_ = len( lines_[elem] )
    print('In the first QTR of the doc, max ->', maxElems_)

    for elem in list( potential_headers_.keys() ):
        if elem > ignore_first_N_rows_ and len( lines_[elem] ) > maxElems_ : 
            legit_count_[ elem ] = potential_headers_[ elem ]

    if len( legit_count_ ) >= 2:
        potential_headers_ = legit_count_

    ## END HACK - if tables present beyond the first 25% of doc, simply ignore the first quarter .. mostly FP

    print('ALL POT HEADERS->', potential_headers_.keys(), len(lines_))
    potential_header_line_numbers_, tbl_upper_bound_, closer_ = sorted( list( potential_headers_.keys() ) ), \
                                                                 None, None

    ## first check hor and vertical lines
    horizontal_bottom_ = False
    visual_detection_ = []
    if len( hor_lines_ ) > 0:
        ## go through the header lines and see which of them have hor line just below
        for hdrLn in potential_header_line_numbers_:
            if hdrLn >= len( lines_ ) - 1: continue

            ln_, next_ = lines_[ hdrLn ], lines_[ hdrLn + 1 ]
            maxY, minYNext, width_ = findYandXBounds( ln_, next_ )

            ## now try and find the next horizontal line ..so a few things can happen
            ## a) we find the closing horizontal line ..in this case we need to ensure
            ##    1. the lenght of the closer is 70+% in length as the opener
            ##    2. if not found (i.e. 1) then go through regular route to find closing line
            ##    3. if found then ensure that the vertical lines present in the y bandwidth
            ##       also end .. if they are continuing then just go all the way to the end of that
            ##       and find the last horizontal line
            tbl_upper_bound_ = locateHor( hor_lines_, maxY, minYNext, width_ )
            print('Did it find any UB using hor lines ?', tbl_upper_bound_, ' FOr hdr ->', hdrLn, maxY, minYNext)
            if ( tbl_upper_bound_ ) is not None:

                ## find the closer
                closing_tbl_bound_, horizontal_bottom_ = closer( tbl_upper_bound_, hor_lines_, ver_lines_, lines_ )

                if closing_tbl_bound_ is not None:
                    closer_ = closing_tbl_bound_
                    
                    visual_detection_.append( ( tbl_upper_bound_, closer_, horizontal_bottom_, hdrLn ) )
                    print('FOr hdr ADDING->', hdrLn,  maxY, minYNext, ( tbl_upper_bound_, closer_, horizontal_bottom_ ))

    tbl_bounds_ = []

    for tbl_upper_bound_, closer_, hb, hdrLn in visual_detection_:
        print('EVALING FOR ',hdrLn, tbl_upper_bound_,closer_)
        if tbl_upper_bound_ is not None and closer_ is not None:
            ( x0, y0 ), ( x2, y2 ) = findCoOrds( tbl_upper_bound_, closer_, lines_, \
                                                    potential_header_line_numbers_, hb )

            if x2 is None: continue

            tbl_bounds_.append( ( ( x0, y0 ), ( x2, y2 ) ) )
            print('ADDITIONS->', ( ( x0, y0 ), ( x2, y2 ) ))

    potential_header_line_numbers_ = sorted( list( potential_headers_.keys() ) )

    for line_number_, siblings_ in hack_.items():
        siblings_.sort()

        tmp_ = []
        for idx, sib in enumerate( siblings_ ):
            if idx == len( siblings_ ) - 1: break
            if siblings_[idx+1] - siblings_[idx] > 10: break
            tmp_.append( sib )

        siblings_ = tmp_

        fwd_siblings_ = [ x for x in siblings_ if x > line_number_ ]
        ## at ttimes the lines below the header can have lots of gibberish before the first meaningful line
        ## so give a good margin of 5 lines
        found_first_child_ = False
        for xx in range(5):
            if line_number_ + xx in fwd_siblings_:
                found_first_child_ = True
                break

        if found_first_child_ is False:
            print('FP..not a table header')
            continue

        ## now continue in the siblings list till we find
        ## a) the next sibling ( for eg if the current siblings are [ 12, 14, 17 ] and the next line_number_ / KEY is 17, it means that 17 is the beginning of a new table , so the tbl begin will be current line_number_ and end will be 16
        if line_number_ not in potential_header_line_numbers_: continue

        curr_ln_idx_ = potential_header_line_numbers_.index( line_number_ )
        if curr_ln_idx_ < len( potential_header_line_numbers_ ) - 1:
            next_ln_number_ = potential_header_line_numbers_[ curr_ln_idx_ + 1 ]

            if next_ln_number_ in fwd_siblings_:

                print('Found table bottom For ->', line_number_, ' and it is ', next_ln_number_ )
                if next_ln_number_ - line_number_ <= 1 and next_ln_number_ < len( lines_ ) - 1:
                    next_ln_number_ += 1

                resp_ = tblBounds( line_number_, next_ln_number_ , lines_, fnm_, img_path )

                if resp_ is not None:
                    tbl_bounds_.append( resp_ )
                continue
        ## b) the next sibling doesnt exist in the potential line headers then we just continue till then end
        elif len( fwd_siblings_ ) >= 1:
            print('No other potential headers found //pick last element as table end ')
            resp_ = tblBounds( line_number_, fwd_siblings_[-1] + 1 \
                                             if fwd_siblings_[-1] < len( lines_ ) -1 \
                                             else len( lines_ ) -1, lines_, fnm_, img_path )

            if resp_ is not None:    
                tbl_bounds_.append( resp_ )
            else:
                ## simply find the last line with 100% overlap with header
                resp_ = lastMaxOverlap( line_number_, fwd_siblings_, lines_ )
                if resp_ is not None:
                    tbl_bounds_.append( resp_ )
            continue

    img_ = cv2.imread( img_path )

    backup_ , written_ = None, 0
    master_ = dict()

    ##NOTE-> the section between this NOTE and the next one is all basically refinement of table extraction

    '''
    SECTION 1 -> if there's a small table with 1 row above the main table it seems to get merged with the
    main table .. separate them out
    '''
    tbl_bounds_ = sorted( tbl_bounds_, key=lambda x:x[1][1] )
    print('JUST B4->', tbl_bounds_)
    ## if the first row of the table intersecting from below is all num / alpha and the imm row below
    ## is ALL str then make the next row as the hdr
    for tup_idx, tup in enumerate( tbl_bounds_ ):
        curr_, next_ = tbl_bounds_[ tup_idx ], tbl_bounds_[ min( len( tbl_bounds_ ) - 1, tup_idx + 1 ) ]
        print('CHECKING OUT->', curr_, next_)
        if next_[0][1] < curr_[1][1] and next_[1][1] > curr_[1][1]:
            print('SECTION-1. Break ; ', curr_, next_ )
            status_, new_hdr_ = firstRowIllegit( next_, lines_ )
            print('Updating tup->', next_, ' To ', ( new_hdr_, next_[1] ) )
            next_ = ( new_hdr_, next_[1] )

    '''
    SECTION 2 -> MERGE intersecting tables and DELETE duplicate tables
    '''
    for elem in tbl_bounds_:
        ## find any intersections
        ## check if elem already part of master_
        if partOf( elem, master_ ): continue

        for inner in tbl_bounds_:
            if elem == inner: continue
            ## check if elem already part of master_
            if partOf( inner, master_ ): continue
            
            refy1, refy2 = elem[0][1], elem[1][1]
            refx1, refx2 = elem[0][0], elem[1][0]

            innery1, innery2 = inner[0][1], inner[1][1]
            innerx1, innerx2 = inner[0][0], inner[1][0]

            ref_key_ = (elem)
            if ref_key_ in master_:
                ll_ = master_[ ref_key_ ]
            else:
                ll_ = list()

            if len( ll_ ) > 0:
                ll_ = sorted( ll_, key=lambda x:x[0][1][1], reverse=True )
                maxY1_so_far_ = ll_[0][0][0][1]
                maxY2_so_far_ = ll_[0][0][1][1]
            else:
                maxY1_so_far_, maxY2_so_far_ = -1, -1
            ## if inner is within 
            if ( innery1 >= refy1 and innery2 <= refy2 ) or ( innery1 >= refy1 and innery2 <= maxY2_so_far_ ):

                ll_.append( ( inner, 'INSIDE' ) )
                master_[ ref_key_ ] = sorted( ll_, key=lambda x:x[0][1][1] )
                continue
            ## if inner has lower y intersecting with ref OR is < 20 px away from TOP of ref ( super hackey )
            if ( innery1 < refy1 and innery2 > refy1 and innery2 < refy2 ) or \
                    ( innery2 < refy1  and refy1 - innery2 <= 5 ) or \
                    ( innery2 < maxY1_so_far_ and maxY1_so_far_ - innery2 <= 5 ):

                ll_.append( ( inner, 'INTERSECTION_WITH_TOP_Y' ) )
                master_[ ref_key_ ] = sorted( ll_, key=lambda x:x[0][1][1] )
                continue
            ## if inner has upper y intersecting with ref OR is < 20 px away from BOTTOM of ref ( super hackey )
            if ( innery1 > refy1 and innery1 < refy2 and innery2 > refy2 ) or \
                    ( innery1 > refy2 and innery1 - refy2 <= 5 ) or \
                    ( innery1 > maxY2_so_far_ and innery1 - maxY2_so_far_ <= 5 ) or\
                    ( innery1 > refy1 and innery1 < maxY2_so_far_ ):

                ll_.append( ( inner, 'INTERSECTION_WITH_BOTTOM_Y' ) )
                master_[ ref_key_ ] = sorted( ll_, key=lambda x:x[0][1][1] )
                continue

            print('INNER ESCAPE->', inner, master_ )

        if partOf( elem, master_ ) is False:
            master_[ elem ] = []
        else:
            print('Apparently a part of something else ->',elem)

    print( 'MASTER_RES1->', master_ )

    ##NOTE-> the section between this NOTE and the prev one is all basically refinement of table extraction

    final_master_ = refineFurther( master_, lines_ )
    #final_master_ = master_
    print( 'MASTER_RES2->', final_master_ )
    final_master_ = lastStage( final_master_, lines_ )
    
    print( 'MASTER_RES->', final_master_ )
    final_resp_, maxYSoFar = [], -1
    for ref_, ll_ in final_master_.items():
    #for ref_, ll_ in master_.items():
        print('Starting with ->', ref_)
        refx, refy = ref_[0]
        refx2, refy2 = ref_[1]
        ## now manipulate the above based on the contents of the list..the final ref* will be drawn on the canvas
        for elem, posn_ in ll_:
            ## both y and x can be impacted ..the 4 condns below easily take care of all possibilities
            if elem[0][0] < refx: refx = elem[0][0]
            if elem[1][0] > refx2: refx2 = elem[1][0]
            if elem[0][1] < refy: refy = elem[0][1]
            if elem[1][1] > refy2: refy2 = elem[1][1]

        final_resp_.append( ((refx, refy), ( refx2, refy2 )) )
        print('Ending with ->', ( (refx, refy), ( refx2, refy2 ) ))

        color_choice_ = random.randint( 0, len(color_schema_)-1 )
        ## resize co-ords to fit img size inhouse_ocr_wd, inhouse_ocr_ht = 2550, 3300
        if inhouse_ocr_wd < img_.shape[0] or inhouse_ocr_ht < img_.shape[1]:
            scale_wd_, scale_ht_ = 1, 1
        else:    
            scale_wd_, scale_ht_ = img_.shape[1]/inhouse_ocr_wd, img_.shape[0]/inhouse_ocr_ht

        x1,y1 = refx, refy; x2, y2 = refx2, refy2 

        x1 *= scale_wd_ ; x2 *= scale_wd_ ; y1 *= scale_ht_ ; y2 *= scale_ht_ 

        if abs( x2 - x1 ) < 0.5*img_.shape[1] or ( y2 < maxYSoFar*scale_ht_ ):
            print('Too Small to be a table ..ignore->', elem, abs( x2 - x1 ), img_.shape[1], y2, maxYSoFar*scale_ht_ )
            backup_ = ( ( int(x1), int(y1) ), ( int(x2), int(y2) ) )
            continue

        stat_ = cv2.rectangle( img_, ( int(x1), int(y1) ), ( int(x2), int(y2) ), \
                color_schema_[ color_choice_ ] , 3 )
        print('Just wrote->', ((refx, refy), ( refx2, refy2 )), (( int(x1), int(y1) ), ( int(x2), int(y2) )) )

        ln_idx, row_hdr_ = locateRow( refy, lines_ )
        hdr_row_ = list( sorted( row_hdr_, key=lambda x: x['pts'][0] ) )
        print('Adding TBL DEETS->', [ refx, refy, refx2, refy2 ], hdr_row_ )
        response_D.append( ( [ refx, refy, refx2, refy2 ], hdr_row_, ln_idx ) )

        maxYSoFar = refy2

        written_ += 1

    if debug == True:
        if written_ == 0 and backup_ is not None:
            cv2.rectangle( img_, backup_[0], backup_[1], color_schema_[0], 3 )

        print('Writing TO->', config_json_['DEBUG_FOLDER'] + ((fnm_.split('/'))[-1]).split('.json')[0]+'.jpg' )    
        cv2.imwrite( config_json_['DEBUG_FOLDER'] + ((fnm_.split('/'))[-1]).split('.json')[0]+'.jpg', img_ )

    return response_D

def lastStage( final_master_, lines_ ):

    ## now blend overlaps
    resp2_ = dict()
    for key, ll_ in final_master_.items():
        topy, bottomy, minx, maxx = key[0][1], key[1][1], key[0][0], key[1][0]
        if alreadyIn( resp2_, topy, bottomy ):
            print('Lets skip this since top and bottom accounted->', key, resp2_, topy, bottomy )
            continue

        for innerkey, innerll_ in final_master_.items():
            print('INNER GARGOYLE->', innerkey, topy, bottomy )
            if innerkey[1][1] > topy and innerkey[1][1] < bottomy and innerkey[0][1] < topy:
                topy = innerkey[0][1]
                minx = min( innerkey[0][0], minx )
                maxx = max( innerkey[1][0], maxx )
            elif innerkey[0][1] > topy and innerkey[0][1] < bottomy and innerkey[1][1] > bottomy:
                bottomy = innerkey[1][1]
                minx = min( innerkey[0][0], minx )
                maxx = max( innerkey[1][0], maxx )

        neo_ = ( ( minx, topy ), ( maxx, bottomy ) )
        print('ADDING GARGOYLE ->', key, neo_ ) 
        resp2_[ neo_ ] = ll_
    ## if table overlaps > 80% and its y1 is >= to y1 of the larger table
    print('STG1->', resp2_)
    resp_ = dict()
    for key, ll_ in resp2_.items():
        isPartOf = False

        for refkey, refll_ in resp2_.items():
            reftop, refbottom = refkey
            top, bottom = key

            if key == refkey: continue
            #print('Evaluation in STG2 top, reftop, bottom, refbottom ', top, reftop, bottom, refbottom )
            if top[1] >= reftop[1] and bottom[1] <= refbottom[1]:
                print( key ,' is  a part of ', refkey )
                isPartOf = True
                break

        if isPartOf is True: continue
        resp_[ key ] = ll_
    ## final devilish hack ..complete tables by checking overlap with lines below as long as
    ## xoverlap matches and dtype matches too
    resp3_ = dict()

    for key, ll in resp_.items():
        e1, e2 = key[0], key[1]
        lidx, ln = locateRow( e2[1], lines_ )
        if lidx < len( lines_ ) - 1:

            for idx_ctr in range( 1, len( lines_ ) - lidx ):
          
                nextln = lines_[ lidx + idx_ctr ]
                print('TBL COMPLETION ,curr, next ->', ln, nextln)
                overlap_ctr_ = 0
                for refwd in ln:
                    for rwd in nextln:
                        if doc_utils.xOverlapBetter( refwd['pts'], rwd['pts'] ) and \
                                doc_utils.dataType( refwd['text'] ) == doc_utils.dataType( rwd['text'] ):
                                    print('WE MATCH ->', refwd, rwd, \
                                            doc_utils.dataType( refwd['text'] ), doc_utils.dataType( rwd['text'] ))
                                    overlap_ctr_ += 1
                                    break

                if abs( overlap_ctr_ - len( ln ) ) <= 1 and len( ln ) > 2:
                    print('MATCHED!!!!')
                    x_, y_ = [], []
                    for wd in nextln:
                        x_.append( wd['pts'][0] ); x_.append( wd['pts'][2] ); y_.append( wd['pts'][3] )
                    x_.sort(); y_.sort()

                    neo_key_ = ( ( min( x_[0], e1[0] ), e1[1] ), ( max( x_[-1], e2[0] ), y_[-1] ) )
                    resp3_[ neo_key_ ] = ll_
                    continue
                else:
                    print('NO MAS SENOR!')
                    break
        
        resp3_[ key ] = ll_

    return resp3_

def alreadyIn( resp2_, topy, bottomy ):

    for key, val in resp2_.items():
        if topy > key[0][1] and bottomy < key[1][1]: return True

    return False

def locateRow( y_off, lines_ ):

    for line_idx, line_ in enumerate( lines_ ):
        miny, maxy = 10000, -1
        for wd in line_:
            if wd['pts'][1] < miny: miny = wd['pts'][1]
            if wd['pts'][-1] > maxy: maxy = wd['pts'][-1]

        if y_off >= miny and y_off <= maxy:
            return line_idx, line_

    return None, None

def refineFurther( master_, lines_ ):
    
    final_resp_, min_elem_hdr_row_ = dict(), 3
    print('INCOMING MASTER->', master_)
    ## first get rid of tables where the # of header elements is <= 3
    for mst_idx, act_master_key in enumerate( list( master_.keys() ) ):
        elem = act_master_key 
        y_off_ = elem[0][1]
        first_row_line_num_, first_row_ = locateRow( y_off_, lines_ )
        print('EVALUATING->', elem, first_row_)
        if first_row_ is not None and len( first_row_ ) <= min_elem_hdr_row_ and\
                first_row_line_num_ >= len( lines_ ) - 1:
            print('The table that has the co-ords->', elem,' & line->', first_row_)
            continue
        elif first_row_ is not None and len( first_row_ ) <= 3 and first_row_line_num_ < len( lines_ ) - 1:
            next_row_ = lines_[ first_row_line_num_ + 1 ]
            if quickDtypeStr( next_row_ ) is True:
                print('Forst ROW contained <= 3 elements and next row is potential hdr ..so moving')
                minx, miny = 10000, 10000
                for wd in next_row_:
                    if wd['pts'][0] < minx: minx = wd['pts'][0]
                    if wd['pts'][1] < miny: miny = wd['pts'][1]
                elem = ( ( minx, miny ), elem[1] )
        ## now check if the first row of the table is MIXED ( not all STR ) and the row after has ANY DIGITS
        if first_row_ is not None and quickDtypeStr( first_row_ ) is False and first_row_line_num_ < len(lines_) - 2:
            next_line_ = lines_[ first_row_line_num_ + 1 ]
            if quickDtypeStr( next_line_ ) is True:
                print('The table that has the co-ords->', elem,' is MIXED and its next line is just STR..ignore->',\
                        first_row_, next_line_ )
                continue
        ## now check if the last row of the table is the first row of the next "elem" and if this last row
        ## is MIXED and the first row of next is all STR, move the next table down
        if first_row_ is not None and mst_idx < len( master_ ) - 1:
        #if first_row_ is not None and quickDtypeStr( first_row_ ) is False and mst_idx < len( master_ ) - 1:
            next_elem_ = list( master_.keys() )[ mst_idx + 1 ]
            y1_off_, y2_off_, yn_off_ = elem[0][1], elem[1][1], next_elem_[0][1]

            lidx ,last_row_curr_elem_ = locateRow( y2_off_, lines_ )
            flidx ,flast_row_curr_elem_ = locateRow( y1_off_, lines_ )
            fidx ,first_row_next_elem_ = locateRow( yn_off_, lines_ )

            print('Is it Coming here ? ->', last_row_curr_elem_, first_row_next_elem_, lidx, fidx)

            if last_row_curr_elem_[0]['pts'] == first_row_next_elem_[0]['pts'] and fidx + 1 < len( lines_ ) - 1:
                print('Last row and first row of next elem is common', elem, next_elem_)

                sec_row_next_elem_ = lines_[ fidx + 1 ]
                if quickDtypeStr( first_row_next_elem_ ) is False and quickDtypeStr( sec_row_next_elem_ ) is True:
                    print('Move the table 1 line below->', next_elem_)
                    minx, miny = 10000, 10000
                    for wd in sec_row_next_elem_:
                        if wd['pts'][0] < minx: minx = wd['pts'][0]
                        if wd['pts'][1] < miny: miny = wd['pts'][1]
                    next_elem_ = ( ( minx, miny ), next_elem_[1] )
                    print('New table->', next_elem_)

            elif lidx > fidx and  lidx - fidx == 1:
                    print( 'The prior table is extending into the next table !!')
                    actual_curr_bound_ = fidx
                    minx, miny = 10000, 10000
                    for wd in lines_[ actual_curr_bound_ ]:
                        if wd['pts'][0] < minx: minx = wd['pts'][0]
                        if wd['pts'][1] < miny: miny = wd['pts'][1]

                    if miny > elem[0][1]:
                        elem = ( elem[0], ( minx, miny ) )
                        print('New table->', elem)

        ## now series of ops with the elem
        if first_row_line_num_ > 0:
            prev_line_ = lines_[ first_row_line_num_ - 1 ]
            if quickDtypeStr( prev_line_ ) is True and len( prev_line_ ) > min_elem_hdr_row_:
                print('Merging ', elem, ' with prev line since its ALL STR')
                minx, miny = 10000, 10000
                for wd in prev_line_:
                        if wd['pts'][0] < minx: minx = wd['pts'][0]
                        if wd['pts'][1] < miny: miny = wd['pts'][1]
                elem = ( ( minx, miny ), elem[1] )
            ## now adjust left and right bounds
            yoff_last_row = elem[1][1]
            lrow, last_row_ = locateRow( yoff_last_row, lines_ )
            if lrow is not None and lrow > first_row_line_num_:
                xarr, yarr = [], []
                for row in range( first_row_line_num_, lrow ):
                    ln = lines_[ row ]
                    for wd in ln:
                        xarr.append( wd['pts'][0] )
                        xarr.append( wd['pts'][2] )
                        yarr.append( wd['pts'][1] )
                        yarr.append( wd['pts'][3] )
                
                xarr.sort(), yarr.sort()
                print( xarr, yarr )
                print('MYSTERY UPDATE->', first_row_line_num_, lrow, elem, \
                        ( ( xarr[0], elem[0][1] ), ( xarr[-1], elem[1][1] ) ) )

                elem = ( ( xarr[0], elem[0][1] ), ( xarr[-1], elem[1][1] ) )

        final_resp_[ elem ] = []

    return final_resp_

def firstRowIllegit( next_, lines_ ):

    refy1 = next_[0][1]

    chosen_ = None
    for lineidx, line in enumerate( lines_ ):
        for wd in line:
            if refy1 >= wd['pts'][1] and refy1 < wd['pts'][-1]:
                chosen_ = lineidx
                break
        if chosen_ is not None:
            break

    if chosen_ is not None:
        if quickDtypeStr( lines_[ chosen_ ] ) is False:
            print('First Line in next table isnt ALL STR->', lines_[ chosen_ ])
            ## now check the next line
            if chosen_ < len( lines_ ) - 1:
                nxt_ = lines_[ chosen_ + 1 ]

                if quickDtypeStr( nxt_ ) is True:
                    print('2nd line, it is->', nxt_)
                    ## find new x0, y0
                    xarr, yarr = [], []
                    for wd in nxt_:
                        xarr.append( wd['pts'][0] ); yarr.append( wd['pts'][1] )

                    xarr.sort(), yarr.sort()

                    return True, ( xarr[0], yarr[0] )

    return False, None

def findHorizontals( tbl_top, tbl_bot, hdr_row, hor_lines_, wdth, hght ):
    maxY, hor_elems_ = -1, []
    for elem in hdr_row:
        if elem['pts'][-1] > maxY: maxY = elem['pts'][-1]

    last_ass_ = -1
    for y_off, ( x1, x2 ) in hor_lines_.items():
        if y_off > maxY and abs( x1 - x2 ) > 0.8*wdth and abs( y_off - last_ass_ ) >= 50 and \
                y_off >= tbl_top and y_off <= tbl_bot and abs( y_off - last_ass_ ) <= 1000:
            hor_elems_.append( ( y_off, ( x1, x2 ) ) )
            last_ass_ = y_off

    return hor_elems_

def allStr( co_ords, ln_idx, lines_ ):

    bottom_idx = None
    for lidx, ln in enumerate( lines_[ ln_idx: ] ):
        for wd in ln:
            if wd['pts'][1] > co_ords[3]:
                bottom_idx = lidx - 1
                break
        if bottom_idx is not None:
            break

    if bottom_idx is not None and bottom_idx > ln_idx:
        print('DOO ->', ln_idx, bottom_idx )
        for ln in range( ln_idx, bottom_idx ):
            print('UFC->', lines_[ ln ] )
            if quickDtypeStr( lines_[ ln ] ) is False: return False

        return True

    return False

def blended( responseD, lines_ ):
    ## need to check if the table co-ords are close to each other
    final_ = []
    for idx0, ( co_ords, hdr_row, ln_idx ) in enumerate( responseD ):

        ## if co_ords are already part of the final, skip
        accounted_ = False
        for co, _, _ in final_:
            if co_ords[3] <= co[3] and co_ords[1] >= co[1]:
                print('Already part of integrated table->', co_ords)
                accounted_ = True
                break

        if accounted_ is True: continue
        blend_ = False

        for idx2, ( co_ords2, hdr_row2, ln_idx2 ) in enumerate( responseD ):
            if idx0 == idx2: continue

            ## now check if the outer tbl is all str, and if so, blend with inner
            if co_ords[3] < co_ords2[1] and abs( co_ords2[1] - co_ords[3] ) <= 30 \
                    and ( allStr( co_ords, ln_idx, lines_ ) is True or quickDtypeStr( lines_[ln_idx2] ) is False ): 
                ## we are checkiin if the above table is ALL str OR the below table begins with mixed and NOT str
                ## in either case we need to blend these 2 
                print( 'Blending ->', co_ords, ' & ', co_ords2, \
                        allStr( co_ords, ln_idx, lines_ ), quickDtypeStr( lines_[ln_idx2] ) )

                new_co_ords_ = [ min( co_ords[0], co_ords2[0] ), min( co_ords[1], co_ords2[1] ),\
                                max( co_ords[2], co_ords2[2] ), max( co_ords[3], co_ords2[3] ) ]
                new_hdr_row = hdr_row
                new_ln_idx  = ln_idx
                
                final_.append( ( new_co_ords_, new_hdr_row, new_ln_idx ) )
                blend_ = True

        if blend_ is False:
                final_.append( ( co_ords, hdr_row, ln_idx ) )

    if len( final_ ) == 0: final_ = responseD
    return final_

def incompleteHdr( ln_idx_main, lnidx_curr, lines_, co_ords_main, wdth ):
    curr_hdr_ = ln_idx_main
    hdrSpread_ = abs( lines_[ curr_hdr_ ][0]['pts'][0] - lines_[ curr_hdr_ ][-1]['pts'][2] )
    if hdrSpread_ < 0.3*( co_ords_main[2] - co_ords_main[0] ) and \
            lines_[ curr_hdr_ ][0]['pts'][0] < 0.5*wdth :

        print('INCOMPLETE HDR..checkng next ', hdrSpread_, lines_[ curr_hdr_ ], lines_[ lnidx_curr ] )

        for idd in range( lnidx_curr, len( lines_ ) ):
            curr_ = lines_[ idd ]
            if curr_[0]['pts'][1] > co_ords_main[3]: break
            
            neo_hdr_ = []

            for wd in lines_[ lnidx_curr ]:
                tmp_, fnd = wd, False
                for wd2 in lines_[ curr_hdr_ ]:
                    if doc_utils.xOverlapBetter( wd['pts'], wd2['pts'] ):
                        tmp_['text'] = wd2['text'] + ' ' + tmp_['text']
                        tmp_['pts'] = [ min( tmp_['pts'][0], wd2['pts'][0] ), min( tmp_['pts'][1], wd2['pts'][1] ),\
                                max( tmp_['pts'][2], wd2['pts'][2] ), max( tmp_['pts'][-1], wd2['pts'][-1] ) ]
                        fnd = True

                neo_hdr_.append( tmp_ )

            neo_hdr_ = sorted( neo_hdr_, key=lambda x:x['pts'][0] )
            neo_spread_ = abs( neo_hdr_[0]['pts'][0] - neo_hdr_[-1]['pts'][2] )

            if neo_spread_ > 0.5*( co_ords_main[2] - co_ords_main[0] ): return True

    return False

def blendHdrs( co_ords_main, hdr_row_main, ln_idx_main, lines_, hor_lines_, width_ ):

    bottom_idx = None
    print('WELCOME->', co_ords_main )
    for lidx, ln in enumerate( lines_[ ln_idx_main: ] ):
        for wd in ln:
            if wd['pts'][1] > co_ords_main[3]:
                bottom_idx = ln_idx_main + lidx - 1
                break
        if bottom_idx is not None:
            break

    final_hdr_, last_line_ = hdr_row_main, ln_idx_main
    if bottom_idx is not None:
        print('RANGE->', ln_idx_main, bottom_idx )
        for ln in range( ln_idx_main+1, bottom_idx ):
            
            inc_ = incompleteHdr( ln_idx_main, ln, lines_, co_ords_main, width_ )
            if ( quickDtypeStr( lines_[ ln ] ) is True and len( lines_[ ln ] ) > 1 ) or inc_:
                print('PURE STR->', lines_[ ln ])
                ## check if it xoverlaps with anything in final_hdr_
                last_line_ = ln
                for wd in lines_[ ln ]:
                    blended_ = False

                    for elem in final_hdr_:
                        if doc_utils.xOverlapBetter( elem['pts'], wd['pts'] ):
                            elem['text'] += ' ' + wd['text']
                            elem['pts'] = [ min( elem['pts'][0], wd['pts'][0] ), min( elem['pts'][1], wd['pts'][1] ),\
                                    max( elem['pts'][2], wd['pts'][2] ), max( elem['pts'][3], wd['pts'][3] ) ]
                            blended_ = True

                    if blended_ is False and wd['text'] != '':
                        final_hdr_.append( wd )
            else:
                break

            if inc_ is True:
                break

    if len(final_hdr_) > 0:
        final_hdr_ = list( sorted( final_hdr_, key=lambda x:x['pts'][0] ) )
        print('FINAL BLENDED HDR->', final_hdr_)
        print('FINAL LINE->', last_line_)

    return co_ords_main, final_hdr_, last_line_

def findCells( responseD, raw_jsn_, hor_lines_, ver_lines_ ):
    ## responseD -> array -> ( 4d vector - coords ; hdr row ; ln_idx )
    ## first check for vert and hor lines
    lines_, wdth, hght = raw_jsn_['lines'], raw_jsn_['width'], raw_jsn_['height']
    print('INCOMING HDR TABLES->', responseD)

    responseD = blended( responseD, lines_ )

    print('BLENDED HDR TABLES->', responseD)
    finalCells_ = dict()

    for co_ords_main, hdr_row_main, ln_idx_main in responseD:

        co_ords, hdr_row, ln_idx = blendHdrs( co_ords_main, hdr_row_main, ln_idx_main, lines_, hor_lines_, wdth )

        tbl_top, tbl_bot, tbl_ub, tbl_lb = co_ords[1], co_ords[3], ( co_ords[1], co_ords[0], co_ords[2] ),\
                                            ( co_ords[-1], co_ords[0], co_ords[2] )
        
        _, vert_arr_ = findVerticals( tbl_ub, tbl_lb, hor_lines_, ver_lines_ )
        hor_arr_ = findHorizontals( tbl_top, tbl_bot, hdr_row, hor_lines_, wdth, hght )
        hdr_D_ = dict()

        if vert_arr_ is not None and len( vert_arr_ ) > 0:
            ## add 0th and last vert lines IN case not present
            minx, miny, maxx, maxy = 10000, 10000, -1, -1
            vert_arr_ = sorted( vert_arr_, key=lambda x:x[0] )
            for x,y1,y2 in vert_arr_:
                if x < minx: minx = x
                if x > maxx: maxx = x
                if y1 < miny: miny = y1
                if y2 > maxy: maxy = y2

            if abs( minx - co_ords[0] ) > 50: ## this condn proves that the nearest vertical line to the LEFT isnt already present in the vert_arr_ ( coz sometimes tables dont have starting and closing vertical lines for tables as they are assumed and ONLY middle columns have vertical dividers ) ..||| ly there will be a condn for the maxx ..capisce ?
                vert_arr_.insert( 0, ( co_ords[0], miny, maxy ) ) ## insert at 1st posn since its closest to lef
            if abs( maxx - co_ords[2] ) > 50:
                vert_arr_.append( ( co_ords[2], miny, maxy ) )

            prev_ = vert_arr_[0][0]

            for idd, (x_off, y1, y2) in enumerate( vert_arr_ ):
                hdr_txt_ = ''
                for wd in hdr_row:
                    print('DIO->', wd, x_off, prev_ )
                    if wd['pts'][2] <= x_off and wd['pts'][0] >= prev_: hdr_txt_ += ' ' + wd['text']

                if hdr_txt_ == '': continue

                hdr_D_[ idd ] = hdr_txt_
                prev_ = x_off

        print('For hdr_row->', hdr_row, ' hdr_arr_ ->', hdr_D_, hor_arr_)
        #vert_arr_ = None

        if vert_arr_ is not None and len( vert_arr_ ) > 0 and len( hor_arr_ ) > 1:
            ## hor arr includes any line just below the HDR array so if its just 1 line then its 99.99% the 
            ## one below the header
            row_num_, cell_contents_, prevYoff = -1, dict(), None
            hor_arr_.append( ( co_ords[3], hor_arr_[0][1] ) ) ## add entry for last line
            print('NEO hor_arr ->', hor_arr_)

            for y_off, ( x1, x2 ) in hor_arr_:
                row_num_ += 1

                for xoffidx, ( x_off, y1, y2 )  in enumerate( vert_arr_ ):
                    if xoffidx == 0 or xoffidx not in hdr_D_: continue

                    cell_text_ , bottom_found_ = '', False
                    
                    local_subset_ = lines_[ ln_idx+1: ]
                    for lidx, ln in enumerate( local_subset_ ):
                        for wd in ln:
                            if prevYoff is not None and wd['pts'][1] < prevYoff: continue

                            if wd['pts'][2] <= x_off and wd['pts'][0] > vert_arr_[ xoffidx -1 ][0] \
                                    and wd['pts'][-1] < y_off:
                                cell_text_ += ' ' + wd['text']
                            if wd['pts'][1] > y_off:
                                bottom_found_ = True
                                break

                        if bottom_found_ is True: break
                    ## find which col header this belongs to 
                    if row_num_ not in cell_contents_:
                        ll_ = []
                    else:
                        ll_ = cell_contents_[ row_num_ ]

                    ll_.append( { 'HDR': hdr_D_[ xoffidx ], 'CELL_INFO': cell_text_ } )
                    
                    cell_contents_[ row_num_ ] = ll_
                    print('For Row Num->', row_num_, ' CellInfo List->', ll_)

                prevYoff = y_off
            
            final_d_ = dict()

            for rn, ll in cell_contents_.items():
                ft_ = ''
                for k in ll: ft_ += k['CELL_INFO']
                if len( ft_ ) > 0:
                    final_d_[ rn ] = ll

            print('Finall CELLINFO = ', final_d_)
            finalCells_[ ln_idx_main ] = final_d_

        else:
            print('Ok the table has no hor and vert lines')
            ## now start with identifying the correct header row ( since the first row might only be partial )
            ## for this iterate through the table and find the row with the most "spread" ; for now we can just 
            ## take the max diff between x0 and x2 ;; ref  "co_ords, hdr_row, ln_idx"
            bottom_idx_, maxSpread_ = None, dict()
            header_row_ = hdr_row
            hdr_y2_ = header_row_[0]['pts'][-1]
            for idx_ln, line in enumerate( lines_ ):
                minx, maxx = 10000, -1

                for wd in line:
                    if wd['pts'][1] < hdr_y2_: continue
                    if wd['pts'][0] < minx: minx = wd['pts'][0]
                    if wd['pts'][2] > maxx: maxx = wd['pts'][2]

                    if wd['pts'][1] > co_ords[3]:
                        bottom_idx_ = idx_ln
                        break

                if bottom_idx_ is not None: break

                maxSpread_[ idx_ln ] = maxx - minx
                #print('MAXSPREAD->', maxx - minx, ' For line->', line)

            dd_ = dict( sorted( maxSpread_.items(), key=lambda x:x[1], reverse=True ) )
            longest_ln_idx_, max_line_spread_ = list( dd_.keys() )[0], dd_[ list( dd_.keys() )[0] ]

            ## now check if spread of header isn't as long as longest spread
            hdr_spread_ = header_row_[-1]['pts'][2] - header_row_[0]['pts'][0]

            print('Tabular HDR LONGEST & BOTTOM->', header_row_, lines_[ longest_ln_idx_ ],\
                    hdr_spread_, max_line_spread_)

            final_hdr_line_, hdrMaxY2 = header_row_, header_row_[0]['pts'][-1]
            
            cell_info_, hdr_x_bounds_ = dict(), dict()

            if ( hdr_spread_ < 0.5*max_line_spread_ or \
                    len( lines_[ ln_idx ] ) < 0.5*len( lines_[ longest_ln_idx_ ] ) ) and\
                    ln_idx + 1 != longest_ln_idx_: ## in some tables it might be the longest !!
                print('off ..')
                ##check next line for having xoverlap with longest_ln_idx_
                nxt_ln, cmp_ln, overlap_ctr = lines_[ ln_idx + 1 ], lines_[ longest_ln_idx_ ], 0
                for wd in nxt_ln:
                    for wd2 in cmp_ln:
                        if doc_utils.xOverlapBetter( wd['pts'], wd2['pts'] ):
                            overlap_ctr += 1
                            print('Matched ->', wd, ' From next Ln with ', wd2, ' from longest line')
                            break

                if ( len(lines_[ longest_ln_idx_ ]) <= 5 and abs(len(lines_[ longest_ln_idx_ ]) - overlap_ctr) <=1 )                         or\
                  ( len(lines_[ longest_ln_idx_ ]) > 5 and abs(len(lines_[ longest_ln_idx_ ]) - overlap_ctr) <= 2 ):
                  print('Adding Next to hdr line->')
                  new_hdr_ = dict()
                  for hdr_elem in hdr_row:
                    found_ = False

                    for next_elem in nxt_ln:
                        if doc_utils.xOverlapBetter( hdr_elem['pts'], next_elem['pts'] ):
                            hdr_elem['text'] += ' ' + next_elem['text']
                            hdr_elem['pts'] = [ min( hdr_elem['pts'][0], next_elem['pts'][0] ),\
                                                min( hdr_elem['pts'][1], next_elem['pts'][1] ),\
                                                max( hdr_elem['pts'][2], next_elem['pts'][2] ),\
                                                max( hdr_elem['pts'][3], next_elem['pts'][3] ) ]
                            found_ = True

                    new_hdr_[( hdr_elem['pts'][0], hdr_elem['pts'][1] )] = hdr_elem

                  for next_elem in nxt_ln:  
                      found_ = False

                      for _, ele in new_hdr_.items():  
                          if next_elem['pts'][0] >= ele['pts'][0] and next_elem['pts'][2] <= ele['pts'][2]:
                              found_ = True
                              break

                      if found_ is False:
                        new_hdr_[ (next_elem['pts'][0], next_elem['pts'][1]) ] = next_elem

                  ## now just sort the combined header
                  dd_ = dict( sorted( new_hdr_.items(), key=lambda x:x[1]['pts'][0] ) )
                  new_hdr_line_ = list( dd_.values() )

                  ## stitch closer words together
                  final_hdr_line_, y_already_ = [], []
                  for idx, elem in enumerate( new_hdr_line_ ):
                      inner_copy_ = elem.copy()
                      if elem['pts'][2] in y_already_: continue
                      
                      for idx2, elem2 in enumerate( new_hdr_line_ ):
                        if elem2['pts'][0] > inner_copy_['pts'][2] and elem2['pts'][0] - inner_copy_['pts'][2] <= 20:
                            inner_copy_['text'] += ' ' + elem2['text']
                            inner_copy_['pts'] = [ inner_copy_['pts'][0], inner_copy_['pts'][1], elem2['pts'][2],\
                                                        elem2['pts'][3] ]

                      final_hdr_line_.append( inner_copy_ )
                      y_already_.append( inner_copy_['pts'][2] )

                  print('ELECTRIC CHAIR->', final_hdr_line_)
                  ## now find the xoverlap per line with header

            ## find col bounds 
            col_bounds_ = findColBounds( final_hdr_line_, co_ords, lines_, hght, vert_arr_ )
            if len( col_bounds_ ) > 0:
                row_bounds_ = findRowBounds( final_hdr_line_, co_ords, lines_, col_bounds_ )

                if row_bounds_ is not None and len( row_bounds_ ) > 0:
                    print('Now peacefully extract and create cell contents')

                    final_cell_ = extractCellContents( row_bounds_, col_bounds_, lines_, final_hdr_line_ )

                    print( 'Finall CELLINFO = ', final_cell_ )

                    finalCells_[ ln_idx_main ] = final_cell_

    return finalCells_

def extractCellContents( row_bounds_, col_bounds_, lines_, final_hdr_line_ ):

    '''
    ll_.append( { 'HDR': hdr_D_[ xoffidx ], 'CELL_INFO': cell_text_ } )
    cell_contents_[ row_num_ ] = ll_
    rows -> x0, bottom Y, x1
    cols -> col_hdr : ( x bounds )
    '''
    print('Getting into final cell extraction for ->', final_hdr_line_)

    start_Y, finality_ = final_hdr_line_[0]['pts'][-1], dict()

    for rowidx, (_, bottom_Y,_) in enumerate( row_bounds_ ):

        full_cont_ = ''

        for col_hdr, ( xleft_bound, xright_bound ) in col_bounds_.items():
            cell_contents_ = ''
            
            print('For rowidx->', rowidx, ' col_hdr-> ( start_Y, bottom_Y, xleft_bound, xright_bound ',\
                    ( start_Y, bottom_Y, xleft_bound, xright_bound ) )

            for ln in lines_:
                for wd in ln:
                    if ( wd['pts'][1] >= start_Y or abs( wd['pts'][1] - start_Y ) <= 10 ) and\
                        ( wd['pts'][-1] <= bottom_Y or abs( wd['pts'][-1] - bottom_Y ) <= 10 ) and \
                            doc_utils.xOverlapBetter( wd['pts'], (xleft_bound, start_Y, xright_bound, bottom_Y ) ):
                        cell_contents_ += ' ' + wd['text']
                        print('ADDING->', wd['pts'][1], start_Y, wd['pts'][-1], bottom_Y,\
                                abs( wd['pts'][1] - start_Y ) <= 10,\
                                abs( wd['pts'][-1] - bottom_Y ) <= 10,\
                          doc_utils.xOverlapBetter( wd['pts'], (xleft_bound, start_Y, xright_bound, bottom_Y )))

            if rowidx in finality_:
                tmp_ = finality_[ rowidx ]
            else:
                tmp_ = list()

            tmp_.append( { 'HDR': col_hdr, 'CELL_INFO': cell_contents_ } )
            finality_[ rowidx ] = tmp_
            full_cont_ += cell_contents_

        ## update the upper bound Y , start_Y with current lower bound
        start_Y = bottom_Y
        print('For ROWIDX->', rowidx, ' CELL CONT ->', full_cont_)
        if len( full_cont_ ) == 0:
            finality_.pop( rowidx )

    return finality_

def findRowBounds( final_hdr_line_, co_ords, lines_, col_bounds_ ):
    
    minY, maxY, proximity_thresh_, minx, maxx = -1, co_ords[3], 20, 10000, -1

    for ln in lines_:
        if ln[0]['pts'][1] < final_hdr_line_[0]['pts'][1]: continue
        if ln[0]['pts'][1] > maxY: break

        for wd in ln:
            if wd['pts'][0] < minx: minx = wd['pts'][0]
            if wd['pts'][2] > maxx: maxx = wd['pts'][2]

    for elem in final_hdr_line_:
        if elem['pts'][-1] > minY: minY = elem['pts'][-1]

    ## should we look for an anchor ? easy enough if we are looking for an INT
    ## but if we dont find ANY int/float/digit/date AND ONLY TEXT then we should
    ## lets take thef irst col in case of only text
    
    ## if the first col of col_bounds_ isnt closer to 0 ( meaning the x0 ) then it means its missing a header
    ## simply add 1 and call it Description
    cb_ = dict( sorted( col_bounds_.items(), key=lambda x:x[1][0] ) )
    first_tuple_ = list( cb_.values() )[0]
    if first_tuple_[0] > 0.25*( abs( co_ords[0] - co_ords[2] ) ) : ## 100 randomly chosen
        col_bounds_['Description'] = ( minx, first_tuple_[0] )

    col_bounds_ = dict( sorted( col_bounds_.items(), key=lambda x:x[1][0] ) )

    first_col_key_, last_col_key_ = list( col_bounds_ )[0], list( col_bounds_ )[-1]
    penultimate_col_key_ = list( col_bounds_ )[-2] if len( col_bounds_ ) > 2 else None

    anchor_col_ = None
    
    print('RB CHECK->', col_bounds_, first_col_key_, last_col_key_, penultimate_col_key_)

    for colhdr, tup in col_bounds_.items():
        if colhdr in [ first_col_key_ , last_col_key_, penultimate_col_key_ ]:
            non_text_count_, total_lines = [], 0

            for ln in lines_:
                if len( ln ) == 1 and ln[0]['text'] == '': continue
                if ln[0]['pts'][1] < final_hdr_line_[0]['pts'][-1] or fpLine( ln ) is True: continue
                if ln[0]['pts'][1] > maxY: break
                
                print('INCR->', ln, [total_lines])
                total_lines += 1

                for wd in ln:
                    if doc_utils.xOverlapBetter( wd['pts'], ( tup[0], wd['pts'][1], tup[1], wd['pts'][3] ) )\
                            and doc_utils.dataType( wd['text'] ) in [ 'ALNUM', 'DATE', 'DIGIT' ]:
                                non_text_count_.append( wd )
                                break
            
            print('Ln Count and nt count->', total_lines, non_text_count_)
            if total_lines == len( non_text_count_ ):
                print('Found the anchor COL->', colhdr)
                anchor_col_ = ( colhdr, tup, non_text_count_ )

    if anchor_col_ is not None:
       row_indicators_ = anchor_col_[-1]
       row_bounds_ = []
       for elem in row_indicators_:
           row_bounds_.append( ( minx, elem['pts'][1], maxx ) )
       
       row_bounds_.append( ( minx, co_ords[3], maxx ) )
       print('ROW BOUNDS !->', row_bounds_)
       return row_bounds_
    else:
        ## now use textual clues
        first_tup = col_bounds_[ first_col_key_ ]
        pot_anchor_ = dict()
        print('CHECKING TEXTUAL BOUNDS->', first_tup)
        for lnidx, ln in enumerate( lines_ ):
            if len( ln ) == 1 and ln[0]['text'] == '': continue
            if ln[0]['pts'][1] < final_hdr_line_[0]['pts'][1]: continue
            if ln[0]['pts'][1] > maxY: break
            
            txt_ = None
            print('PRACTICAL->', ln)
            for wd in ln:
                if doc_utils.xOverlapBetter( wd['pts'],(first_tup[0], wd['pts'][1], first_tup[1], wd['pts'][3]) ):
                    if txt_ is None:
                        txt_ = wd
                    else:
                        txt_['text'] += ' ' + wd['text']
                        txt_['pts'] = [ min( txt_['pts'][0], wd['pts'][0] ), min( txt_['pts'][1], wd['pts'][1] ),\
                                        max( txt_['pts'][2], wd['pts'][2] ), max( txt_['pts'][3], wd['pts'][3] ) ]

            if txt_ is not None:
                pot_anchor_[ lnidx ] = txt_

        ## now find the Y offsets
        print('FINAL POT->', pot_anchor_)
        y_anchor_ = dict()
        for idx, key in enumerate( list(pot_anchor_.keys()) ):
            if idx == len( pot_anchor_ ) - 1: break
            print('INTREPID->', list(pot_anchor_.keys())[idx], list(pot_anchor_.keys())[idx+1])
            elem, nxt = pot_anchor_[ list(pot_anchor_.keys())[idx] ], pot_anchor_[ list(pot_anchor_.keys())[idx+1] ]
            y_anchor_[( list(pot_anchor_.keys())[idx], list(pot_anchor_.keys())[idx+1] )] = \
                                                        ( abs( elem['pts'][-1] - nxt['pts'][1] ) )

        median_y_offset_ = np.median( np.asarray( list(y_anchor_.values()) ) )
        print('The MED->', median_y_offset_, y_anchor_)
        ## now figure out which 
        row_breakers_ = dict()
        for tup, yoff in y_anchor_.items():
            if ( yoff > median_y_offset_ and abs( median_y_offset_ - yoff ) > 10 ) or\
                lineHasDiffAnchor( tup, col_bounds_, first_col_key_, last_col_key_, penultimate_col_key_, lines_ ) :
                print('POTENTIAL ROW BREAK->', tup, yoff, median_y_offset_)
                row_breakers_[ tup ] = yoff

        if len( row_breakers_ ) == 0 and len( y_anchor_ ) > 0:
            print('Looks like the anchor text col is already spaced out !')
            row_bounds_ = []
            for tup, yoff in y_anchor_.items():
               ln0, ln1 = lines_[ tup[0] ], lines_[ tup[1] ]
               y_bound_ = ln0[0]['pts'][-1] + int( abs( ln0[0]['pts'][-1] - ln1[0]['pts'][1] ) )
               row_bounds_.append( ( minx, y_bound_, maxx ) )
           
            row_bounds_.append( ( minx, co_ords[3], maxx ) )
            print('ROW BOUNDS !->', row_bounds_)

            return row_bounds_
        elif len( row_breakers_ ) > 0:
            row_bounds_ = []
            for (upper, lower), yoff in row_breakers_.items():
                lnn = lines_[ lower ]

                yb_ = 10000
                for wd in lnn:
                    if wd['pts'][1] < yb_: yb_ = wd['pts'][1]

                row_bounds_.append( ( minx, yb_, maxx ) )

            row_bounds_.append( ( minx, co_ords[3], maxx ) )
            print('ROW BOUNDS !->', row_bounds_)

            return row_bounds_

    return None

def lineHasDiffAnchor( tup, col_bounds_, first_col_key_, last_col_key_, penultimate_col_key_, lines_ ):

    upper, lower = tup
    anchor_like_present_ = dict()

    for lnidx, ln in enumerate( lines_ ):
        if lnidx in tup:
            for k, v in col_bounds_.items():
                if k in [ first_col_key_, last_col_key_, penultimate_col_key_ ]:
                    for wd in ln:
                        if wd['pts'][0] >= v[0] and wd['pts'][2] <= v[1] and \
                                doc_utils.dataType( wd['text'] ) in [ 'DIGIT', 'DATE', 'ALNUM' ]:

                            anchor_like_present_[ lnidx ] = wd

    if len( anchor_like_present_.keys() ) >= 2:
        print('Both Lines ', tup,' have anchor elems ->', anchor_like_present_)
        return True

    return False

def fpLine( ln ):
    nonFP = 0
    for wd in ln:
        if len( wd['text'] ) > 1: return False

    return True

def findColBounds( final_hdr_line_, co_ords, lines_, hght, vert_arr_ ):
    
    minY, maxY, proximity_thresh_, resp_ = -1, co_ords[3], 20, dict()

    for elem in final_hdr_line_:
        if elem['pts'][-1] > minY: minY = elem['pts'][-1]

    if vert_arr_ is not None:
        vert_arr_ = sorted( vert_arr_, key=lambda x:x[0] )
        print('CHAI->', vert_arr_, final_hdr_line_)
        for idx, varr in enumerate( vert_arr_ ):
            if idx == len( vert_arr_ ) - 1: break

            curr, next_ = varr, vert_arr_[ idx+1 ]
            minx, maxx = curr[0], next_[0]

            for elem in final_hdr_line_:
                if elem['pts'][0] >= minx and elem['pts'][2] <= maxx:
                    resp_[ elem['text'] + '_' + str( elem['pts'][0] ) ] = ( minx, maxx )
                    break

        print('BRHMA->', len(final_hdr_line_), resp_)
        if len(final_hdr_line_) == len( resp_ ):
            ## ensure maxx of prior == minx of next
            for idx in range( len(resp_)-1 ):
                n, n1 = resp_[ list( resp_.keys() )[idx] ][1], resp_[ list( resp_.keys() )[idx+1] ][0]
                if n != n1:
                    resp_[ list( resp_.keys() )[idx] ] = ( resp_[ list( resp_.keys() )[idx] ][0],\
                                                            resp_[ list( resp_.keys() )[idx+1] ][0] )
            return resp_

    ## for each col hdr, find the extent of the spread of its children
    col_spread_ = dict()

    for col_hdr in final_hdr_line_:
        colKey_, leftOrRtAligned_ = col_hdr['text'] + '_' + str( col_hdr['pts'][0] ), None

        for lnidx, ln in enumerate( lines_ ):
            if ln[0]['pts'][1] < minY and abs( ln[0]['pts'][1] - minY ) > 10: continue
            if ln[0]['pts'][1] > maxY: break
            
            ln_item = { 'text': '', 'pts': [0, 0, 0, 0] }
            for wd in ln:
                ref_pts, pts_ = wd['pts'], ln_item['pts']
                cg_child_ = wd['pts'][0] + abs( wd['pts'][0] - wd['pts'][2] )/2
                cg_parent_ = col_hdr['pts'][0] + abs( col_hdr['pts'][0] - col_hdr['pts'][2] )/2
                if doc_utils.xOverlapBetter( wd['pts'], col_hdr['pts'] ):
                    ln_item['text'] += ' ' + wd['text']
                    if pts_[0] > 0:
                        ln_item['pts'] = [ min( ref_pts[0], pts_[0] ), min( ref_pts[1], pts_[1] ),\
                                       max( ref_pts[2], pts_[2] ), max( ref_pts[3], pts_[3] ) ]
                    else:
                        ln_item['pts'] = wd['pts']
                        ## if CG of the child is to the right of the CG of the parent, RT aligned
                        ## if CG of the child is to the left of the CG of the parent, LT aligned
                        if cg_child_ > cg_parent_: 
                            leftOrRtAligned_ = 'RIGHT'
                        else:
                            leftOrRtAligned_ = 'LEFT'
                
                print( col_hdr,' ALIGNMENT ->', leftOrRtAligned_, wd, cg_child_, cg_parent_ )
                ## now check for phrases to the left and the right of the ln_item text 
                ## for cols like Desc, the text could stretch far to the left and right of the col x overlap ..capisce
                if wd['pts'][2] < ln_item['pts'][0] and abs( wd['pts'][2] - ln_item['pts'][0] ) <= proximity_thresh_\
                        and leftOrRtAligned_ == 'RIGHT': ## if rt aligned ONLY look left
                    ln_item['text'] = wd['text'] + ' ' + ln_item['text']
                    ln_item['pts'] = wd['pts'][0] ## just change the left extremity ..rest remains same no ?
                
                if wd['pts'][0] > ln_item['pts'][2] and abs( wd['pts'][0] - ln_item['pts'][2] ) <= proximity_thresh_ \
                        and leftOrRtAligned_ == 'LEFT':
                    ln_item['text'] = ' ' + wd['text']
                    ln_item['pts'][3] = wd['pts'][3] ## just change the right extremity ..rest remains same no ?
            
            if colKey_ in col_spread_:
                ll_ = col_spread_[ colKey_ ]
            else:
                ll_ = []

            if ln_item['text'] != '':
                if len( ll_ ) > 0 and abs( ll_[-1]['pts'][-1] - ln_item['pts'][1] ) >= 0.2*hght: continue
                ll_.append( ln_item )
                col_spread_[ colKey_ ] = ll_


    print('Final col spread->', col_spread_)

    resp_ = dict()
    for colkey_, list_ in col_spread_.items():
        minx, maxx = 10000, -1
        for elem in list_:
            if elem['pts'][0] < minx : minx = elem['pts'][0]
            if elem['pts'][2] > maxx : maxx = elem['pts'][2]

        print('For Col HEADER->', colkey_,' COL BOUNDS = ', minx, maxx)
        resp_[ colkey_ ] = ( minx, maxx )

    resp_ = dict( sorted( resp_.items(), key=lambda x:x[1][0] ) )

    return resp_

def locateTableAndExtractCellInfo( img_path_, jsn_path_, debug=False ):
        '''
        img_path_ -> path of the image file 
        jsn_path_ -> path of the json file generated by the ocr code

        first pass will be to use all possible visual cues and then use text features

        output -> dictionary with key being an index ( which is simply a unique ID for the table )
                  since a doc / page can have multiple tables
                  *** MULTI PAGE TABLES NOT TACKLED HERE
                  the value of the dictionary is another dict
                  DICT [ row_number ] = [ dict -> key = column header name ; value = cell contents ]
        '''
        hor_lines_ = horizontal_lines_v2_dev.returnLineCoOrds( cv2.imread( img_path_ ) )    
        ver_lines_ = vertical_lines_v2_dev.returnLineCoOrds( cv2.imread( img_path_ ) )    

        print('HORI->', hor_lines_)
        print('VERT->', ver_lines_)

        with open( jsn_path_, 'r' ) as fp:
            raw_jsn_ = json.load( fp )

        potential_headers_, hack_, lines_ = generateTblData( raw_jsn_, \
                                       jsn_path_ , hor_lines_, ver_lines_ )    

        responseD = drawTables(potential_headers_, hack_, lines_, jsn_path_,img_path_, hor_lines_, ver_lines_, debug) 
        ## cell extraction..
        cell_info_ = findCells( responseD, raw_jsn_, hor_lines_, ver_lines_ )

        return cell_info_

if __name__ == '__main__':
  
    import time, cv2
    path_ = '/home/ubuntu/ABHIJEET/INVOICES/REQUORDIT/DEV/filtered_jpg_unique/'
    ll_ = os.listdir( path_ )

    for iidx, fnm_ in enumerate( ll_ ):
      try: 
        if sys.argv[1] not in fnm_: continue
        st_ = time.time()

        img_path_ = path_ + fnm_
        act_fnm_ = fnm_.split('.jpg')[0]
        #img_path_ = sys.argv[2]
        
        jsn_path_ = "/datadrive/ROHITH/S3_TASK/ALL_DATA_V3/raw/"+act_fnm_+'.json'
        with open( jsn_path_, 'r' ) as fp:
            raw_jsn_ = json.load( fp )

        #print('Processing->', img_path_, ' & ', sys.argv[1])
        print('Processing->', img_path_, ' & ', jsn_path_)
        locateTableAndExtractCellInfo( img_path_, jsn_path_ )

        print('TOtal time->', time.time() - st_)

      except:
          print('EXCPN->', fnm_)
          print( traceback.format_exc() )
          continue
