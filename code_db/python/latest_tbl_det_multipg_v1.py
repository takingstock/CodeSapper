import os
import sys, time
import json, requests
import cv2
import horizontal_lines_v2_dev
import vertical_lines_v2_dev
import cellExtractionV2_trial as cellExtractionV2
# import document_type_trial_new as document_type
import tblDetMultiPage_v1 as tblDetMultiPage
import new_cell_extraction
import traceback, random
import cv2 as cv
import numpy as np
# new files for better Table detection
import detectTableBounds as dtb
import detectHeader as dth
import createJsonFeats
import tbl_db_utils, tbl_doc_utils
from fuzzywuzzy import fuzz
from scipy.spatial import distance
import tbl_genericPatterns

with open( 'eod_config.json', 'r' ) as fp:
    config_json_ = json.load( fp )

with open( 'master_config.json', 'r' ) as fp:
    master_config_json_ = json.load( fp )

exclude_columns_     = config_json_["excludeHeaders"]
raw_file_path_       = config_json_["rawFilePath"]
stitched_file_path_  = config_json_["stitchedFilePath"]
signatureMatchThresh = config_json_["signatureMatchThresh"]
numCommonKeys        = config_json_["numCommonKeys"]
contourDistThresh    = config_json_["contourDistThresh"]
exceptionLog         = config_json_["exceptionLog"]
minNumNeighbours     = config_json_["minNumNeighbours"]
minSubStrLen         = config_json_["minSubStrLen"]

useFeedback          = master_config_json_["use_feedback"]

def overlap_ratio(x1, y1, x2, y2, x1_here, y1_here, x2_here, y2_here):
    contour_area = (x2_here - x1_here) * (y2_here - y1_here)

    max_x1 = max(x1, x1_here)
    max_y1 = max(y1, y1_here)
    max_x2 = min(x2, x2_here)
    max_y2 = min(y2, y2_here)
    if (max_x2 - max_x1) <= 0:
        return 0.0
    elif (max_y2 - max_y1) <= 0:
        return 0.0
    else:
        area = (max_x2 - max_x1) * (max_y2 - max_y1)
        ratio = area / contour_area
        return ratio


def draw_contours(result, jpg_path):
    img = cv.imread(jpg_path)
    curr_colour = [255, 0, 0]
    # curr_colour_header = [150, 75, 0]
    curr_colour_header = [0, 0, 0]
    curr_colour_vline = [0, 255, 0]
    curr_colour_hline = [0, 0, 255]

    for keys in result["cell_info"]:
        # print(result["cell_info"], i)
        row = result["cell_info"][keys]
        for keys_inner in row:
            # print(row, j)
            dict_here = row[keys_inner]
            text = dict_here["text"]
            pts = dict_here["pts"]
            # print(pts)
            cv.rectangle(img, (pts[0], pts[1]), (pts[2], pts[3]), curr_colour, 6)
            cv.putText(img, str(keys), (pts[0], pts[1] - 10), cv.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 0), 4)

    for i in range(len(result["hdr_row"])):
        # print(result["cell_info"], i)
        row = result["hdr_row"][i]
        text = row["text"]
        pts = row["pts"]
        # print(pts)
        cv.rectangle(img, (pts[0], pts[1]), (pts[2], pts[3]), curr_colour_header, 6)

    """row_vector = result["row_vector"]
    column_vector = result["column_vector"]
    if len(row_vector) > 0 and len(column_vector) > 0: 
        min_cv = min(column_vector)
        max_cv = max(column_vector)
        min_rv = min(row_vector)
        max_rv = max(row_vector)
        for r in row_vector:
            cv.line(img, (min_cv, r), (max_cv, r), curr_colour_vline, 6)  
        for c in column_vector:
            cv.line(img, (c, min_rv), (c, max_rv), curr_colour_hline, 6)"""

    # write_path = ".".join(jpg_path.split(".")[:-1]) + "_image." + jpg_path.split(".")[-1]
    write_path = (os.getcwd() +
                  "/TABLE_OUTPUT_IMAGE/" +
                  ".".join(jpg_path.split("/")[-1].split(".")[:-1]) + "_image." + jpg_path.split(".")[-1])
    print("Write Path : ", write_path)
    cv.imwrite(write_path, img)

    # write_path = ".".join(jpg_path.split(".")[:-1]) + "_header_image." + jpg_path.split(".")[-1]
    # print("Write Path : ", write_path)
    # cv.imwrite(write_path, img)

    # return write_path
    return Image(filename=write_path)


def get_relevant_lines(pts, all_lines, flag_exist):
    print("Check Check Check Check : ", all_lines)
    counter = 0
    header = flag_exist
    footer = flag_exist
    rel_lines = []
    found = False

    length_all = len(all_lines)
    for i in range(len(all_lines)):
        line = all_lines[i]
        pts1 = line[0]["pts"]
        pts2 = all_lines[min(i + 1, length_all - 1)][0]["pts"]
        pts_bool = pts2[1] > pts[3]
        if header:
            if (pts1[3] > pts[1]):
                rel_lines.append(line)
                header = False
                found = True
        elif (footer and pts_bool):
            rel_lines.append(line)
            footer = False
            found = False
            return rel_lines
        elif found:
            rel_lines.append(line)
        else:
            pass
    return rel_lines


def extract(table_bounds, headers, jpg_path, raw_json_path, stit_json_path):
    print("Inside Main for Table Extraction")
    print("Printing Inputs")
    print("table_bounds :", table_bounds)
    print("headers :", headers)
    print("jpg_path :", jpg_path)
    print("raw_json_path :", raw_json_path)
    print("stit_json_path :", stit_json_path)

    ocr = None
    with open(stit_json_path, 'r') as f:
        ocr = json.load(f)

    lines = ocr["lines"]
    image_s3 = ocr["path"]
    height = ocr["height"]
    width = ocr["width"]

    im = cv2.imread(jpg_path)
    h_lines = horizontal_lines_v2_dev.returnLineCoOrds(im)
    v_lines = vertical_lines_v2_dev.returnLineCoOrds(im)

    print("table_bounds :", table_bounds)
    print('HORI LINES->', h_lines)
    print('VERT LINES->', v_lines)

    # error_function()

    relevant_lines = get_relevant_lines(table_bounds, lines, True)
    map_customer_table_header_static = [{"Invoices": ["Description", "Amount", "Quantity"]}]
    type_of_doc = "Invoices"

    try:
        cell_structure = new_cell_extraction.extract_cells(relevant_lines, height, width, jpg_path, headers)
    except:
        traceback.print_exc()
        cell_structure = cellExtractionV2.returnCellStructure(relevant_lines, height, width, jpg_path)

    draw_contours(cell_structure, jpg_path)

    # result = document_type.format_plus_integration(cell_structure, map_customer_table_header_static, type_of_doc)

    return "Hello"
    # return result


def extract_v2(master_jpg_list, master_stit_json, master_raw_json, potential_header_rows_=None ):
    cell_output_master = []
    input_json, table_deets_, vert_lines, hori_lines = [], [], [], []

    for k in range(len(master_jpg_list)):
        jpg_list_ind_here = master_jpg_list[k]
        stit_json_ind_here = master_stit_json[k]
        raw_json_ind_here = master_raw_json[k]
        json_here = {
          "json_stit": stit_json_ind_here,
          "json_raw": raw_json_ind_here,
          "jpg_path": jpg_list_ind_here
        }
        input_json.append(json_here)

    for i in range(len(input_json)):
        ith = input_json[i]
        # file_name = ith.get("file_name")
        json_stit = ith.get("json_stit")
        json_raw = ith.get("json_raw")
        jpg_path = ith.get("jpg_path")
        file_name = jpg_path.split("/")[-1].split(".")[0]

        with open(json_stit) as f:
            json1 = json.load(f)

        with open(json_raw) as f:
            json2 = json.load(f)

        if potential_header_rows_ is None: ## to handle cases where continuous table page has no header..in any case the for loop here is redundant since it always has 1 entry , so we use the same pot hdr row.. in case the page has NO header, we perform some tests and pass the same header back again
          potential_header_rows_ = dth.isolateHdr( json2 ) ## raw json input

        table_det = dtb.detectTableBounds( file_name, json2, potential_header_rows_, jpg_path )
        print('RETVAL->', table_det)
        #table_det = tblDetMultiPage.tableDetectionEndPoint([{"fnm": file_name, "json": json1, "json_raw": json2}])
        table_bounds = table_det[file_name]["TBL_BOUNDS"]
        headers = table_det[file_name]["TBL_HDRS"]
        print('TBL HDR DEETS->', table_bounds, headers )
        table_deets_.append((table_bounds, headers))
        inner_cell_local = []

        im = cv2.imread(jpg_path)
        print('img path->', jpg_path, im.shape)
        h_lines = horizontal_lines_v2_dev.returnLineCoOrds(im)
        v_lines = vertical_lines_v2_dev.returnLineCoOrds(im)
        print('HORI LINES->', h_lines)
        print('VERT LINES->', v_lines)

        ht_scale_, wd_scale_ = json1['height'] / im.shape[0], json1['width'] / im.shape[1]
        mod_h_lines, mod_v_lines = dict(), dict()

        for y_off, (x1, x2) in h_lines.items():
            mod_h_lines[int(y_off * ht_scale_)] = (int(x1 * wd_scale_), int(x2 * wd_scale_))

        for x_off, (y1, y2) in v_lines.items():
            mod_v_lines[int(x_off * wd_scale_)] = (int(y1 * ht_scale_), int(y2 * ht_scale_))

        print('HORI LINES->', mod_h_lines)
        print('VERT LINES->', mod_v_lines)

        # vert_lines.append( v_lines )
        # hori_lines.append( h_lines )

        vert_lines.append(mod_v_lines)
        hori_lines.append(mod_h_lines)

        
        """for j in range(len(table_bounds)):
            table_bounds_ind = table_bounds[j]
            headers_ind = headers[j]
            try:
                result = extract(table_bounds_ind, headers_ind, jpg_path, json_raw, json_stit)
            except BaseException as e:
                print('exception in inside func extract_v2  -->', e)
                
            inner_cell_local.append(result)"""

        
        cell_output_master.append(inner_cell_local)

    table_output_path = os.getcwd() + "/TABLE_OUTPUT/" + file_name + ".json"
    print('CONAN->', table_deets_)

    #with open(table_output_path, "w") as f:
    #    json.dump(cell_output_master, f)

    return cell_output_master, table_deets_, vert_lines, hori_lines


def noInterference(anchor_line_, pts):
    for elem in anchor_line_:
        if pts[0] >= elem['pts'][0] and pts[0] - elem['pts'][0] > 10 and pts[0] < elem['pts'][2]: return False

    return True

def overlap( rect1, rect2):

    x_overlap = max(0, min(rect1[2], rect2[2]) - max(rect1[0], rect2[0]))
    smaller_ = (rect2[2] - rect2[0]) if (rect2[2] - rect2[0]) < (rect1[2] - rect1[0]) else (rect1[2] - rect1[0])
    if smaller_ <= 0: return 0

    return x_overlap/smaller_

def findAlignmentDirection( sorted_unassigned_, curr_child, next_child, contour ):

    closest_rt = abs( contour['pts'][2] - next_child['pts'][0] )
    closest_lt = abs( contour['pts'][0] - curr_child['pts'][2] )
    print('INITIAL-> closest_rt, closest_lt = ', closest_rt, closest_lt)
    ## now check the unassigned for both close LT and close RT and overwrite
    for key, val in sorted_unassigned_.items():

        if val['pts'] == contour['pts']: continue

        if abs( val['pts'][0] - contour['pts'][2] ) < closest_rt:
            closest_rt = abs( val['pts'][0] - contour['pts'][2] )
            print('Found ->', val, ' to be the closest RT to ', contour ,' amongst UNASSIGNED..overwriting')

        if abs( val['pts'][2] - contour['pts'][0] ) < closest_lt:
            closest_lt = abs( val['pts'][2] - contour['pts'][0] )
            print('Found ->', val, ' to be the closest LT to ', contour ,' amongst UNASSIGNED..overwriting')

        if closest_lt > 3*closest_rt or closest_rt > 3*closest_lt: break    

    ## the closest value has to beat the other guy by atleast a factor of 3
    print('The finalists are ->', closest_rt, closest_lt)

    if closest_lt > 3*closest_rt: return 'RIGHT' ## since closest left is 3 times bigger
    if closest_rt > 3*closest_lt: return 'LEFT' ## since closest right is 3 times bigger

    return None

def alignAccordingToHdrs(anchor_line_, _hdr_arr, pg_wd):
    # print( anchor_line_ )
    print('alignAccordingToHdrs->', _hdr_arr)
    # exit()
    resp_anch_line_, unassigned_, assigned_, association_ = [], dict(), dict(), dict()
    for hdrelemctr in range(len(_hdr_arr)):
        if hdrelemctr == len(_hdr_arr) - 1:
            curr_, next_ = _hdr_arr[hdrelemctr], _hdr_arr[hdrelemctr]
            # next_['pts'][0] = pg_wd
        else:
            curr_, next_ = _hdr_arr[hdrelemctr], _hdr_arr[hdrelemctr + 1]

        tmp_ = {'text': '', 'pts': [0, 0, 0, 0]}
        for anch_idx, anchor_raw in enumerate( anchor_line_ ):
            ref_pts_ = curr_['pts'].copy()
            if next_['pts'] == curr_['pts']:
                ref_pts_[2] = pg_wd
            elif noInterference(anchor_line_, next_['pts']):
                ref_pts_[2] = next_['pts'][0] - 20

            nxt_anchor_ = 2550 if hdrelemctr == len( _hdr_arr ) - 1 else _hdr_arr[ hdrelemctr+1 ]['pts'][0]

            print( 'Overlap check->', anchor_raw, curr_, nxt_anchor_,\
               tblDetMultiPage.xOverlap(anchor_raw['text'], anchor_raw['pts'], curr_['text'], curr_['pts'], 700),\
               anchor_raw['pts'][2] < nxt_anchor_, overlap( anchor_raw['pts'], curr_['pts'] ) )

            if tblDetMultiPage.xOverlap(anchor_raw['text'], anchor_raw['pts'], curr_['text'], curr_['pts'], 700)\
                    and anchor_raw['pts'][2] < nxt_anchor_:# and overlap( anchor_raw['pts'], curr_['pts'] ) > 0.2:
                if tmp_['text'] == '':
                    tmp_ = anchor_raw.copy()
                else:
                    tmp_['text'] += ' ' + anchor_raw['text']
                    tmp_['pts'] = [ \
                        min(anchor_raw['pts'][0], tmp_['pts'][0]), \
                        min(anchor_raw['pts'][1], tmp_['pts'][1]), \
                        max(anchor_raw['pts'][2], tmp_['pts'][2]), \
                        max(anchor_raw['pts'][3], tmp_['pts'][3]) \
                        ]
                assigned_[ anchor_raw['text']+'_'+str( anchor_raw['pts'][0] ) ] = anchor_raw
            else:
                unassigned_[ anchor_raw['text']+'_'+str( anchor_raw['pts'][0] ) ] = anchor_raw

        print('GOJIRA-> tmp_, curr_, ref_pts_ = ', tmp_, curr_, ref_pts_, assigned_)
        association_[ curr_['text'] ] = tmp_
        resp_anch_line_.append(tmp_)

    actual_unass_ = dict()
    for key, val in unassigned_.items():
            if key not in assigned_:
                actual_unass_[ key ] = val

    print('MOZILLA->', actual_unass_, resp_anch_line_)
    ## now find out whom the unassigned belong to 
    ## sort them RT to left , wrt x0 ..this is done so that u can find the right most word between 2 columns
    ## and compare them to the nearest LT and RT and figure whom it belongs to 
    sorted_unassigned_ = dict( sorted( actual_unass_.items(), key=lambda x:x[1]['pts'][0] , reverse=True ) )
    sorted_unassigned_regular = dict( sorted( actual_unass_.items(), key=lambda x:x[1]['pts'][0] ) )

    ## now find between which 2 columns a particular element lies
    for key, contour in sorted_unassigned_.items():
        for idx, curr in enumerate( _hdr_arr ):
            next_ = _hdr_arr[ min( idx+1 , len( _hdr_arr )-1 ) ]

            if contour['pts'][0] > curr['pts'][2] and contour['pts'][0] < next_['pts'][0]:
                print('contour->', contour, ' lies between ->', curr, ' & ', next_)
                ## now fetch children of both curr and next
                curr_child, next_child = association_[ curr['text'] ], association_[ next_['text'] ]
                dirn_ = findAlignmentDirection( sorted_unassigned_, curr_child, next_child, contour )

                if dirn_ is not None:

                    if dirn_ == 'LEFT' and contour['text'] not in curr_child['text']:
                        ## everything between curr child text and contour FROM unassigned needs to be dumped in here
                        for inner_key, inner_cnt in sorted_unassigned_regular.items():
                            if inner_cnt['pts'][0] > curr_child['pts'][2] and \
                                    inner_cnt['pts'][2] < contour['pts'][0]:
                                        curr_child['text'] += ' ' + inner_cnt['text']
                                        curr_child['pts'] = [ curr_child['pts'][0], curr_child['pts'][1],\
                                                              inner_cnt['pts'][2], inner_cnt['pts'][3] ]

                                        print('abridged curr child->', curr_child)          

                        ## now finally add the contour itself
                        curr_child['text'] += ' ' + contour['text']
                        curr_child['pts'] = [ curr_child['pts'][0], curr_child['pts'][1],\
                                              contour['pts'][2], contour['pts'][3] ]

                    if dirn_ == 'RIGHT' and contour['text'] not in curr_child['text']:

                        ## first add the contour itself
                        store_tmp_ = curr_child.copy()
                        curr_child = contour
                        ## everything between curr child text and contour FROM unassigned needs to be dumped in here
                        for inner_key, inner_cnt in sorted_unassigned_regular.items():
                            if inner_cnt['pts'][0] > contour['pts'][2] and \
                                    inner_cnt['pts'][2] < store_tmp_['pts'][0]:
                                        curr_child['text'] += ' ' + inner_cnt['text']
                                        curr_child['pts'] = [ curr_child['pts'][0], curr_child['pts'][1],\
                                                              inner_cnt['pts'][2], inner_cnt['pts'][3] ]

                                        print('abridged curr child->', curr_child)          

                        ## now finally add the curr hild itself
                        curr_child['text'] += ' ' + store_tmp_['text']
                        curr_child['pts'] = [ curr_child['pts'][0], curr_child['pts'][1],\
                                              store_tmp_['pts'][2], store_tmp_['pts'][3] ]

    print('Current RESP->', resp_anch_line_, ' \n***ABRIDGED->', association_.values())                    
    #return list( association_.values() )
    return resp_anch_line_


def findAnchor(json_, _hdr_arr):
    ## the json_ is raw ..
    print('BEGIN findAnchor->', _hdr_arr)
    for lctr in range(len(json_['lines'])):

        tmp_arr_, max_x, anchor_elem_, anchor_line_, anchor_hdr_ = [], -1, None, None, None
        for wd in json_['lines'][lctr]:

            if wd['pts'][1] <= _hdr_arr[0]['pts'][1]: continue
            ## if its here it means its finally landed up at row 1
            if tblDetMultiPage.isAnchorRowElem(wd['text']) is True and wd['pts'][0] > max_x and \
                    wd['pts'][0] >= 0.6 * (json_['width']):
                max_x = wd['pts'][0]
                anchor_elem_ = wd

        if anchor_elem_ is not None:
            print('MYSTERY anch->', anchor_elem_)
            # find next row with xoverlapping this element ( but what if this is the only row ?? )
            ## just so that we dont get FPs in case of single rows .. we ll take a y off (max) of 300
            beginY = anchor_elem_['pts'][1]
            getOut_, tmparr_, foundVertical_neigh_ = False, [], False

            for ctt in range(lctr + 1, len(json_['lines'])):
                line_tmp = json_['lines'][ctt]
                adder_ = False

                print('DOGGY->', line_tmp)
                for wd in line_tmp:
                    xOverlap_ = tblDetMultiPage.xOverlap(wd['text'], wd['pts'], anchor_elem_['text'],
                                                         anchor_elem_['pts'])

                    if wd['pts'][1] - beginY >= 300 or xOverlap_ is True:
                        getOut_ = True
                        print('GOGO Power Ranger->', line_tmp)
                        if xOverlap_ is True: foundVertical_neigh_ = True

                        break

                if getOut_: break
                tmparr_.append(line_tmp)

            if foundVertical_neigh_ is False:
                anchor_line_ = json_['lines'][lctr]
                print('Sending back single LINE->', anchor_line_)
            else:
                anchor_line_ = json_['lines'][lctr]
                print('Sending back augmented LINE->', tmparr_, "\n", anchor_line_)
                for _tmp in tmparr_: anchor_line_ += _tmp

            break  ## for outermost FOR loop

    if anchor_line_ is None: 
        print('HELL YEAH FAIL->')
        return None, None

    print('PRE GUDBUD->', anchor_line_)
    final_anch_line_ = alignAccordingToHdrs(anchor_line_, _hdr_arr, json_['width'])
    print('Found anchor elem for tbl->', anchor_elem_, final_anch_line_, anchor_line_)
    return anchor_elem_, final_anch_line_

def noVertical( lt, rt, vert ):
    print('Check for VERT BOUNDS between ', lt, rt, vert)
    for elem in vert:
        if elem > lt and elem < rt: return True

    return False    


def returnBoundsBasedOnImg(new_hdr_arr_, _raw_json, vertical_bounds_):
    with open(_raw_json, 'r') as fp:
        rawJ = json.load(fp)

    lower_bound_tbl_hdr_ = new_hdr_arr_[2]
    print('RASCAL->', new_hdr_arr_, lower_bound_tbl_hdr_)
    ## ensure no double counting of cols
    tmparr_, dupes_ = new_hdr_arr_[0], []
    for elem in tmparr_:
        for el2 in tmparr_:
            if el2['pts'] != elem['pts'] and el2['pts'][0] >= elem['pts'][0] and el2['pts'][0] <= elem['pts'][2]:
                print('DUPE->', el2)
                dupes_.append(el2)

    neo_arr_ = []
    for elem in tmparr_:
        if elem in dupes_: continue
        neo_arr_.append(elem)

    new_hdr_arr_ = (neo_arr_, new_hdr_arr_[1], new_hdr_arr_[2], new_hdr_arr_[3])
    ## ensure no double counting of cols
    col_bounds_arr_ = new_hdr_arr_[-1]
    col_bounds_arr_.insert(0, 0)

    anchor_line_ = None

    coLB = dict()

    for lctr in range(len(rawJ['lines'])):
        for wdctr in range(len(rawJ['lines'][lctr])):
            wd_ = rawJ['lines'][lctr][wdctr]
            # print('PISS CHECK - >', wd_)
            if (wd_['pts'][1] > lower_bound_tbl_hdr_ or abs(lower_bound_tbl_hdr_ - wd_['pts'][1]) <= 10) and \
                    tblDetMultiPage.isAnchorRowElem(wd_['text']) and abs(lower_bound_tbl_hdr_ - wd_['pts'][1]) <= 300 \
                    and anchor_line_ is None and wd_['pts'][0] > 0.7 * rawJ['width']:
                anchor_line_ = rawJ['lines'][lctr]
                break

    print('Hv v found the children ?? ', anchor_line_)
    if anchor_line_ is not None:
        prevCol = None
        for col_bound_ctr in range(len(col_bounds_arr_)):
            left, right = col_bounds_arr_[col_bound_ctr], \
                col_bounds_arr_[min(col_bound_ctr + 1, len(col_bounds_arr_) - 1)]

            if left == right: right = rawJ['width']

            top, bottom = new_hdr_arr_[1], new_hdr_arr_[2]

            ## get header text
            print('Checking box L->R & T->B = ', left, right, top, bottom)
            hdr_elem_, child_elem = '', None
            for lctr in range(len(rawJ['lines'])):
                for wdctr in range(len(rawJ['lines'][lctr])):
                    wd_ = rawJ['lines'][lctr][wdctr]

                    if ((wd_['pts'][0] >= left or abs(wd_['pts'][0] - left) <= 10) and \
                            (wd_['pts'][2] <= right or abs(wd_['pts'][2] - right) <= 10) and \
                            (wd_['pts'][1] >= top or abs(wd_['pts'][1] - top) <= 10) and \
                            (wd_['pts'][-1] <= bottom or abs(wd_['pts'][-1] - bottom) <= 10)) \
                            and noVertical( left, right, vertical_bounds_ ):
                        hdr_elem_ += ' ' + wd_['text']

            if hdr_elem_ == '' and prevCol is not None:
                prev_pts_ = coLB[prevCol][1]['pts']
                left, top = prev_pts_[0], prev_pts_[1]
                hdr_elem_ = prevCol

            hdr_col_ = {'text': hdr_elem_, 'pts': [left, top, right, bottom]}
            print('Found HDR COL->', hdr_col_)
            ## now get child text
            prevCol = hdr_elem_

            child_ = None
            for anch_raw in anchor_line_:
                # print('Tryng to find the childre  = ', anch_raw)
                if (anch_raw['pts'][0] >= left or abs(anch_raw['pts'][0] - left) <= 10) and \
                        (anch_raw['pts'][2] <= right or abs(anch_raw['pts'][2] - right) <= 10) and child_ is None:
                    child_ = anch_raw
                elif child_ is not None and (anch_raw['pts'][0] >= left or abs(anch_raw['pts'][0] - left) <= 10) and \
                        (anch_raw['pts'][2] <= right or abs(anch_raw['pts'][2] - right) <= 10):
                    child_['text'] += ' ' + anch_raw['text']
                    child_['pts'] = [child_['pts'][0], child_['pts'][1], anch_raw['pts'][2], anch_raw['pts'][3]]

            # print('For range ->', left, right, ' The elems hdr = ', hdr_col_, ' Child = ', child_)
            coLB[hdr_elem_] = (child_, hdr_col_)

    return coLB


def findColBounds(new_hdr_arr_, master_stit_json, master_raw_json, vertical_bounds_):
    colBounds_arr, anchor_arr = [], []  # dict()
    print('DOGE COIN->', new_hdr_arr_)

    for ctr in range(len(new_hdr_arr_)):
        colBounds_ = dict()
        graphicalBounds = False
        if new_hdr_arr_[ctr][1] is not None and len(new_hdr_arr_[ctr][-1]) > 2:
            ## the 2nd or condn is since the last arr typically contains all the vertical bounds
            ## in some cases the algo only catches the beginning of the table hdr and the end
            ## as vertical bounds .. in such cases, its better to go with non img based col det
            graphical_col_bounds_ = returnBoundsBasedOnImg(new_hdr_arr_[ctr], master_raw_json[ctr], vertical_bounds_ )
            if len(graphical_col_bounds_) > 0 and \
                    (abs(len(graphical_col_bounds_) - len(new_hdr_arr_[ctr][0])) <= 1 or \
                     (len(new_hdr_arr_[ctr][0]) >= 4 and len(graphical_col_bounds_) >= len(new_hdr_arr_[ctr][0]))):
                graphicalBounds = True
                colBounds_arr.append(graphical_col_bounds_)

            print('COMIN 1 act arr , vert arr ', len(new_hdr_arr_[ctr][0]), len(graphical_col_bounds_), \
                  graphical_col_bounds_)
            # print( graphical_col_bounds_ )
        if graphicalBounds is False:
            json_file, raw_json_file, _hdr_arr = master_stit_json[ctr], master_raw_json[ctr], \
                new_hdr_arr_[ctr][0]
            print('COMIN 2', _hdr_arr)

            with open(json_file, 'r') as fp:
                json_ = json.load(fp)
            with open(raw_json_file, 'r') as fp:
                raw_json_ = json.load(fp)

            anchor_row_elem_, anchor_line_ = findAnchor(raw_json_, _hdr_arr)
            anchor_arr.append( anchor_row_elem_ )

            print('COMIN 2.5', _hdr_arr)
            if anchor_row_elem_ is not None:

                ## now start alogning first row items with headers to find out elems that are NOT x off
                ## if xoff is not available then we need to find row bounds
                orphans_, beginColBounds_len, unassigned_anchors = [], len(colBounds_arr), dict()
                for hdr_elem_ctr in range(len(_hdr_arr)):

                    hdr_elem = _hdr_arr[hdr_elem_ctr]
                    parent_found_ = False

                    print('Finding chilren for ->', hdr_elem, parent_found_, orphans_, anchor_line_)
                    for anchor_line_item in anchor_line_:
                        print('BEGINNING COL BOUND ARR = ', colBounds_, anchor_line_item)

                        nxt_anchor_ = 2550 if hdr_elem_ctr == len( _hdr_arr ) - 1 \
                                           else _hdr_arr[ hdr_elem_ctr+1 ]['pts'][0]

                        if tblDetMultiPage.xOverlap(hdr_elem['text'], hdr_elem['pts'], \
                                                    anchor_line_item['text'], anchor_line_item['pts'], 700)\
                                                    and anchor_line_item['pts'][2] < nxt_anchor_:

                            print('Huzzah !! Found child ', anchor_line_item, ' For parent = ', hdr_elem)
                            if hdr_elem['text'] in colBounds_ and colBounds_[hdr_elem['text']][-1]['pts'] != hdr_elem[
                                'pts']:
                                demark_ = str(random.randint(10, 1000))
                                colBounds_[hdr_elem['text'] + '_' + demark_] = (anchor_line_item, hdr_elem)
                            else:
                                colBounds_[hdr_elem['text']] = (anchor_line_item, hdr_elem)

                            parent_found_ = True

                    print('Found anything ?', parent_found_)

                    if parent_found_ is False:
                        prev, next_ = _hdr_arr[max(0, hdr_elem_ctr - 1)], \
                            _hdr_arr[min(hdr_elem_ctr + 1, len(_hdr_arr) - 1)]

                        add_ = True
                        for x, _, _ in orphans_:
                            if hdr_elem['pts'] == x['pts']: add_ = False

                        if add_ is True:
                            print('ADDING ORPHAN->', hdr_elem, prev, next_)
                            orphans_.append((hdr_elem, prev, next_))

                    print('Found Col Bounds ->', colBounds_)
                    print('These dont have any parents->', orphans_, anchor_line_)

                    ## for orphan parents check in anchor line ..the element should be unassigned and should be between
                ## bounds of neigh elements
                for anchor_line_item_ctr in range(len(anchor_line_)):
                    anchor_line_item = anchor_line_[anchor_line_item_ctr]
                    unassigned_ = True
                    colkeys_ = list(colBounds_.keys())
                    colvals_ = list(colBounds_.values())

                    for keyctr in range(len(colkeys_)):
                        if anchor_line_item == colBounds_[colkeys_[keyctr]]:
                            unassigned_ = False

                        if unassigned_:
                            ## go through orphans and see if its between orphan cols left and rt bounds
                            for tup in orphans_:
                                orphan, orphan_lt, orphan_rt = tup
                                if orphan['pts'] == orphan_rt['pts']:
                                    print('This is the last COL ..so make X0 and X2 for orphan rt == width of page ')
                                    orphan_rt['pts'][2] = raw_json_['width']

                                if anchor_line_item['pts'][0] >= orphan_lt['pts'][2] and \
                                        anchor_line_item['pts'][2] <= orphan_rt['pts'][0] and orphan[
                                    'text'] not in colBounds_:
                                    print('Uniting parent ->', orphan, ' with child -> ', anchor_line_item)

                                    colBounds_[orphan['text']] = (anchor_line_item, orphan)

                                    print('Post ORPHAN Col Bounds ->', colBounds_)
                                    unassigned_ = False

                if len(orphans_) > 0:
                    for tup in orphans_:
                        orphan, orphan_lt, orphan_rt = tup
                        if orphan['text'] not in colBounds_:
                            colBounds_[orphan['text']] = (None, orphan)
                            print('Post ORPHAN Col Bounds ->', colBounds_)

                # if beginColBounds_len == len( colBounds_arr ): ## meaning it has not added above, below Post ORPHAN print
                colBounds_arr.append(colBounds_)
                # print('Added to the daddy -> ', colBounds_)

    return colBounds_arr, anchor_arr


def lineBelowIsFull(_raw_json, linectr, colBound_pg, maxX2Boundary):
    ## go the line below linectr and check if 80-90% of cols , from colBound_pg, have values in them
    ## if yes, then return True ..actually its best to check upto 3 lines below linectr due to desc
    ## sometimes being wrapped and occupying the first few lines

    with open(_raw_json, 'r') as fp:
        raw_json_ = json.load(fp)

    colCnt, maxYDist, refY, = 0, 1500, raw_json_['lines'][linectr][0]['pts'][1]
    maxYoffset, anchorOverlap, cmpX2, cmpX0 = 300, False, -1, 10000

    for lctr in range(linectr + 1, min(linectr + 5, len(raw_json_['lines']))):
        lne_ = raw_json_['lines'][lctr]
        print('PUSH->', lne_)
        fillctr_ = 0
        colCnt = 0
        if abs(lne_[0]['pts'][1] - refY) > maxYoffset: break

        for colKey, colTuple in colBound_pg.items():
            first_entry, hdr_deet = colTuple
            colCnt += 1
            wd_overlaps = False
            if first_entry is None: first_entry = hdr_deet

            for wd_ in lne_:
                # print('Trying to see if ', wd_, ' has an overlap with PUSH ', first_entry)
                if wd_['pts'][0] > cmpX2: cmpX2 = wd_['pts'][0]
                if wd_['pts'][0] < cmpX0: cmpX0 = wd_['pts'][0]

                if tblDetMultiPage.xOverlap(wd_['text'], wd_['pts'], first_entry['text'], first_entry['pts'], maxYDist):
                    fillctr_ += 1
                    wd_overlaps = True
                    print('Found column overlap ', wd_, ' for colhdr ', hdr_deet)
                    break

                    # if wd_overlaps is True: break

        print('SPOTTY-> colcnt , overlaps = ', colCnt, fillctr_, cmpX2, cmpX0, maxX2Boundary,
              raw_json_['lines'][linectr])
        if (fillctr_ > 0.8 * colCnt or fillctr_ >= 4) and abs(cmpX2 - maxX2Boundary) <= 150 and \
                cmpX0 < 0.5 * raw_json_['width']:
            print('The line below subtotal ', lne_, ' indicates that the table is continuing ')
            return True

    return False


def numbersNextContour(line_, x2):
    _ctr = 0
    for wd in line_:
        if wd['pts'][0] > x2 and _ctr <= 3 and tblDetMultiPage.chkNum(wd['text']) is not None:
            return True
        elif wd['pts'][0] > x2 and _ctr <= 3 and tblDetMultiPage.chkNum(wd['text']) is None:
            _ctr += 1

    return False


def findTableEndCoOrds(colBounds_, new_hdr_arr_, master_stit_json, master_raw_json, vlines, hlines, pg_ctr):
    ## only 2 ways ..
    ## a) find the last line where the number of column values ( rather values assigned to the cols ) is
    ## < 50% of tot num of cols..for e.g. if ln # 10 has 2 values that can be assigned to cols, and the
    ## # of cols = 6 then prev line is the last
    ## b) if any col has the "total" kw in it BUT NOT subtotal

    ## but gotta b careful about lines where , due to misalignment half values are in 1 line and the rest
    ## are bekiw
    print('First check if the table has hor and vert lines ->', colBounds_)

    response_ = []

    for pg_ctr in range(len(colBounds_)):
        colBound_pg = colBounds_[pg_ctr]

        rt_, anchor_col_ = -1, None

        for colKey, colTuple in colBound_pg.items():
            first_entry, hdr_deet = colTuple

            ''' 
            if first_entry is not None and first_entry['pts'][0] > rt_ and\
                              tblDetMultiPage.isAnchorRowElem( first_entry['text'] ):
              rt_, anchor_col_ = first_entry['pts'][0], first_entry
  
            '''
            # print('ITER->',hdr_deet, hdr_deet['pts'][0] > rt_, len( hdr_deet['text'] ) > 0, first_entry is not None)
            if hdr_deet is not None and hdr_deet['pts'][0] > rt_ and len(hdr_deet['text']) >= 3 \
                    and first_entry is not None:
                rt_, anchor_col_ = hdr_deet['pts'][0], hdr_deet
                print('RT->', rt_, anchor_col_)

        with open(master_stit_json[pg_ctr], 'r') as fp:
            mst_json = json.load(fp)
        with open(master_raw_json[pg_ctr], 'r') as fp:
            local_jsn_ = json.load(fp)

        anchor_replaced_ = False
        print('The anchor col PRE REPL->', anchor_col_)

        if anchor_col_ is None:
            print('CELL INFO EITHER ABSENT / NOT DETECTED')
            response_.append({'anchor_col_': {'text': '', 'pts': [0, 0, 0, 0]}, \
                              'last_row_anchor_': {'text': '', 'pts': [0, 0, 0, 0]}})
            continue
        # for ll_ in mst_json['lines']:
        for ll_ in local_jsn_['lines']:
            for wd in ll_:
                if tblDetMultiPage.isAnchorRowElem(wd['text']) and \
                        tblDetMultiPage.xOverlap(wd['text'], wd['pts'], anchor_col_['text'], anchor_col_['pts'], 300) \
                        and wd['pts'][1] > anchor_col_['pts'][1] and wd['pts'][0] > 0.7 * mst_json['width']:
                    anchor_col_ = wd
                    anchor_replaced_ = True
                    break

            if anchor_replaced_: break

        print('The anchor col->', anchor_col_)

        last_row_anchor_ = anchor_col_  ## better than INIT with None
        if anchor_col_ is not None:
            maxYDist = 1500

            total_in_line_, fpLine, maxX2Boundary = False, -1, False

            for linectr in range(len(local_jsn_['lines'])):
                line_ = local_jsn_['lines'][linectr]
                if line_[0]['pts'][1] <= anchor_col_['pts'][1]: continue

                print('Hunting LINES ->', line_, last_row_anchor_)
                '''       
                if len( line_ ) <= 2:
                  print('ME THINKS TABLE ENDED ABOVE->', line_)
                  break
                '''

                for wd_ctr in range(len(line_)):
                    wd_ = line_[wd_ctr]
                    if wd_['pts'][0] > maxX2Boundary: maxX2Boundary = wd_['pts'][0]

                    if ( 'total' in wd_['text'].lower() or 'summary' in wd_['text'].lower() or \
                        'balance' in wd_['text'].lower() or 'pay' in wd_['text'].lower()[:3] or \
                        'PST' in wd_['text'] or 'description' in wd_['text'].lower() or\
                        'credits' in wd_['text'].lower() or \
                             ( 'total' in wd_['text'].lower() and 'pay' in wd_['text'].lower() ) \
                              ) and \
                            (line_[-1]['pts'][0] >= anchor_col_['pts'][0] or \
                             abs(line_[-1]['pts'][0] - anchor_col_['pts'][0]) <= 50) and \
                            numbersNextContour(line_, wd_['pts'][2]):
                        print('CHUGGA CHUGGA ->', wd_)
                        total_in_line_ = True
                    ## check if line has sub total/total ( and no "full" line below it ) or end of page
                    '''
                    if total_in_line_ is True:
                      ## if line below is "full" ..reverse ..ELSE stop lookin for table ends
                      if lineBelowIsFull( master_raw_json[ pg_ctr ], linectr, colBound_pg, maxX2Boundary ) is True:
                        total_in_line_ = False
                    '''

                    if wd_['pts'][1] > last_row_anchor_['pts'][1] and total_in_line_ is False and \
                            tblDetMultiPage.xOverlap(last_row_anchor_['text'], last_row_anchor_['pts'], \
                                                     wd_['text'], wd_['pts'], maxYDist):
                        last_row_anchor_ = wd_
                        print('Assigned as LAST ROW = ', last_row_anchor_)

                print('Total in LINES ->', total_in_line_)
                if total_in_line_ or FPTextLine( line_, local_jsn_, anchor_col_ ) or breakHere( line_, colBound_pg ): 
                    print('BREAKING FOR LINE due to FP or TOTAL or breakHere->', line_)
                    break

        print('The LAST anchor col and END OF TABLE ->', last_row_anchor_)

        response_.append({'anchor_col_': anchor_col_, 'last_row_anchor_': last_row_anchor_})

    return response_


def ColFurtherOut(pts, colKey, LRBounds_, mode):
    ## we decide LR bounds based on either the col contour width OR first childs contour width
    ## at times NEITHER of them is actually the width of the col ..this is mostly in cases where
    ## there are NO horizontal demarcators ..so in some cases its ok to assume that the widht
    ## of the col actually is the BEGIN of next col
    if mode == 'next':

        current_lt, current_rt = LRBounds_[colKey]
        next_lt, next_rt = None, None

        for colKey, (left, rt) in LRBounds_.items():
            print('Checking for ->', current_rt, (left, rt))
            if left >= current_rt or current_rt < rt:
                next_lt, next_rt = left, rt
                break

        if next_lt is not None and pts[0] >= current_lt and \
                ((pts[0] < current_rt and abs(pts[0] - current_rt) >= 10) or \
                 (pts[0] > current_rt and pts[0] < next_lt)) and \
                (pts[2] < next_lt or abs(pts[2] - next_lt) <= 10):
            print('Further OUT!!')
            return True

    if mode == 'prev':
        return False
        '''
        current_lt, current_rt = LRBounds_[ colKey ]
        prev_lt, prev_rt = None, None
  
        for colKey, ( left, rt ) in LRBounds_.items():
          print('Checking for ->', current_rt, ( left, rt ))
          if rt < current_lt and prev_rt is None:
            prev_lt, prev_rt = left, rt
  
          elif rt <= current_lt and prev_rt is not None and left > prev_lt:
            prev_lt, prev_rt = left, rt
  
        if prev_lt is not None and pts[0] < current_lt and\
          ( pts[0] > prev_rt ): 
          print('Further OUT!!', pts[0], current_lt, prev_rt ,' CONDN-> pts[0] < current_lt ; pts[0] > prev_rt')
          return True
  
        '''
    return False

def FPTextLine( line_, raw_jsn_, anchor_col_ ):
    numTxt, pg_width, minx, maxx, maxy0 = 0, raw_jsn_['width'], 10000, -1, -1

    for elem in line_:
        if dataType( elem['text'] ) == 'TEXT': numTxt += 1
        #else:
        #    print('Frog->', elem, dataType( elem['text'] ))
        if elem['pts'][0] < minx: minx = elem['pts'][0]
        if elem['pts'][2] > maxx: maxx = elem['pts'][2]
        if elem['pts'][1] > maxy0: maxy0 = elem['pts'][1]

    if len( line_ ) == numTxt and ( maxx - minx ) > 0.6*pg_width and maxy0 > anchor_col_['pts'][-1]: 
        print('HOWDY HOO-> FPTextLine->', line_)
        return True
    elif len( line_ ) != numTxt and ( maxx - minx ) > 0.6*pg_width : 
        print('BOWDY POO-> FPTextLine->', line_, numTxt)
        return False

    return False

def extractBlocks( LRBounds_, current_top, current_bot, raw_jsn_, rowD, avg_y_diff, prev, lctr_for_last_row_\
                     , follow_vertical_bounds_, row_separators_, tblEnding, maxY2_so_far=None ):
    prev_assigned_, prev_left_ = None, None

    colKeyList_ = list( LRBounds_.keys() )

    for colKey, (left, rt_) in LRBounds_.items():
        existin_ = None

        if colKeyList_.index( colKey ) == len( colKeyList_ ) - 1:
            print('Last COL->', left, rt_)
            rt = raw_jsn_['width']
        else:
            rt = rt_

        for lineCtr in range(len(raw_jsn_['lines'])):
            line_, fpLine = raw_jsn_['lines'][lineCtr], False
            
            ## why are you iterating lines that are not even within the bounds ..idiot
            if line_[0]['pts'][1] < current_top and current_top - line_[0]['pts'][1] >= 50: continue
            if line_[0]['pts'][1] > current_bot and line_[0]['pts'][1] - current_bot >= 50: continue


            ## check if line has subtotal in it .. its generally inserted in middle of the tables rows
            ## and typically has no practical use
            tot_subtot_present_ = False

            '''
            for wdCtr in range( len(line_) ):
              wd_ = line_[ wdCtr ]
              if 'total' in wd_['text'].lower(): tot_subtot_present_ = True
            '''

            # if tot_subtot_present_ is True: continue
            line_added_ = False
            for wdCtr in range(len(line_)):
                wd_ = line_[wdCtr]

                within_left_rt_bounds_, lbfornxt_ = False, False

                if follow_vertical_bounds_ == 'STRICT':
                    if ( wd_['pts'][0] >= left and wd_['pts'][2] <= rt ) or\
                            ( wd_['pts'][0] >= left and wd_['pts'][2] > rt and abs( wd_['pts'][2] - rt ) <= 10 ) or\
                            ( wd_['pts'][0] < left and wd_['pts'][2] <= rt and abs( wd_['pts'][0] - left ) <= 10 ) or\
                            overlap( wd_['pts'], [ left, 0, rt, 0 ] ) >= 0.6:
                        within_left_rt_bounds_ = True
                else:
                    if ( wd_['pts'][0] >= left or \
                         (wd_['pts'][0] < left and (abs(wd_['pts'][0] - left) <= 45 )) \
                       ) \
                       and \
                       ( wd_['pts'][2] <= rt or \
                       ( wd_['pts'][2] > rt and \
                          (abs(wd_['pts'][2] - rt) <= 15 or ColFurtherOut(wd_['pts'], colKey, LRBounds_, 'next'))\
                        )\
                        ):
                        within_left_rt_bounds_ = True

                print('LOGGIN-> wd_ = ', wd_, left, rt, current_top, current_bot,\
                  wd_['pts'][1] >= current_top, wd_['pts'][1] < current_bot,\
                  wd_['pts'][0] >= left, wd_['pts'][2] <= rt, prev_assigned_, within_left_rt_bounds_, maxY2_so_far,\
                  overlap( wd_['pts'], [ left, 0, rt, 0 ] ), dataType( wd_['text'] ))

                print('1.', ( wd_['pts'][1] >= current_top or \
                    ( wd_['pts'][1] < current_top and abs(wd_['pts'][1] - current_top) <= 15)) )
                print('2.', (wd_['pts'][1] < current_bot and abs(wd_['pts'][1] - current_bot) > 15) or \
                         lbfornxt_ is True )
                print('3.',( wd_['pts'][-1] < current_bot or abs(wd_['pts'][-1] - current_bot) <= 15 or\
                          ( wd_['pts'][1] > current_top and wd_['pts'][1] < current_bot and\
                                 wd_['pts'][1] - current_top >= 20 ) ) )
                print('4.', ( prev_assigned_ is None or \
                        (prev_assigned_ is not None and prev_assigned_['pts'] != wd_['pts']) ) )          

                #lbfornxt_, current_bot = lineBeforeNextAnchor(wd_, current_bot, row_separators_, existin_, tblEnding )

                if ( ( wd_['pts'][1] >= current_top or \
                     ( wd_['pts'][1] < current_top and abs(wd_['pts'][1] - current_top) <= 15)) and \
                     ( ( wd_['pts'][1] < current_bot and abs(wd_['pts'][1] - current_bot) > 15 ) or\
                        lbfornxt_ is True ) and \
                     ( wd_['pts'][-1] < current_bot or abs(wd_['pts'][-1] - current_bot) <= 15 or\
                          ( wd_['pts'][1] > current_top and wd_['pts'][1] < current_bot and\
                                 wd_['pts'][1] - current_top >= 20 ) \
                     ) and \
                        within_left_rt_bounds_ is True \
                        and ( prev_assigned_ is None or \
                        (prev_assigned_ is not None and prev_assigned_['pts'] != wd_['pts']) ) and\
                        ( maxY2_so_far is None or \
                          ( maxY2_so_far is not None and ( wd_['pts'][-1] >= maxY2_so_far \
                                                           or abs( wd_['pts'][-1] - maxY2_so_far ) <= 5 ) ) ) ):

                    #print('For COLKEY = ', colKey, ' adding wd ', wd_, ' top and bot = ', current_top, current_bot, \
                    #      prev_assigned_)
                    print('ENTERING THE DRAGON-BALL-Z')
                    line_added_ = True
                    '''
                    if colKey in rowD:
                      print('In the castle->', rowD[colKey]['pts'], wd_, current_bot, current_top,\
                              ( abs(rowD[colKey]['pts'][-1] - wd_['pts'][1]) <= ( current_bot - current_top ) ),\
                              ( existin_ is None or abs( existin_['pts'][1] - wd_['pts'][1] ) <= 300 ) )
                    '''

                    ## NOTE - addition of " dataType( wd_['text'] ) != 'DIGIT' " - BREAKING CHANGE
                    if colKey in rowD and \
                            ( ( abs(rowD[colKey]['pts'][-1] - wd_['pts'][1]) <= ( current_bot - current_top ) ) \
                             or (abs( abs(rowD[colKey]['pts'][-1] - wd_['pts'][1]) - (current_bot - current_top) )\
                                                                         <= 15 ) )\
                            and ( existin_ is None or abs( existin_['pts'][1] - wd_['pts'][1] ) <= 300 or\
                                  ( existin_ is not None and abs( existin_['pts'][-1] - wd_['pts'][1] ) <= 10 ) ):# and \
                            #dataType( wd_['text'] ) != 'DIGIT':

                        existin_ = rowD[colKey].copy()
                        print('EXISTING ADD->', wd_['text'], existin_, \
                                colKey in rowD,\
                                ( abs(rowD[colKey]['pts'][-1] - wd_['pts'][1]) <= ( current_bot - current_top ) ),\
                                existin_ is None, abs( existin_['pts'][1] - wd_['pts'][1] ) <= 300 )
                        existin_['text'] += ' ' + wd_['text']
                        existin_['pts'] = [min(existin_['pts'][0], wd_['pts'][0]), \
                                           min(existin_['pts'][1], wd_['pts'][1]), \
                                           max(existin_['pts'][2], wd_['pts'][2]), \
                                           max(existin_['pts'][3], wd_['pts'][3])]

                        rowD[colKey] = existin_
                        #prev_assigned_ = wd_
                        prev_assigned_ = existin_
                    elif colKey not in rowD:# or ( colKey in rowD and dataType( wd_['text'] ) == 'DIGIT' ):
                        rowD[colKey] = wd_
                        prev_assigned_ = wd_
                        print('BREAKING!!', wd_, colKey)
                        #break

                    if prev is None:
                        prev = wd_['pts'][1]
                    else:
                        avg_y_diff.append(abs(prev - wd_['pts'][1]))
                        prev = wd_['pts'][1]

                    if lctr_for_last_row_ < lineCtr: lctr_for_last_row_ = lineCtr

            #print('For LINE line added->', line_, line_added_)

        if colKey not in rowD: rowD[colKey] = {'text': '', 'pts': [0, 0, 0, 0]}
        print('For colkey = ', colKey, rowD[colKey])
        prev_left_ = left

def lineBeforeNextAnchor( wd_, current_bot, row_separators_, existin_, tblEnding ):

    '''
    if tblEnding is not None and 'last_row_anchor_' in tblEnding and 'anchor_col_' in tblEnding and \
            tblEnding['anchor_col_']['pts'] != tblEnding['last_row_anchor_']['pts'] :
                return False, current_bot
    '''

    try: 
      idx_ = row_separators_.index( current_bot )
    except: 
        print('Failed to find current_bot->', row_separators_)
        idx_ = 'NA'
        #return False, current_bot

    if idx_ == 'NA' or idx_ == len( row_separators_ ) - 1:
        next_anchor_ = wd_['pts'][-1]
    elif idx_ < len( row_separators_ ) - 1:
        next_anchor_ = current_bot

    last_row_anchor_ = tblEnding[0]['last_row_anchor_'] \
                       if tblEnding is not None and len( tblEnding ) > 0 and 'last_row_anchor_' in tblEnding[0] \
                       else None    

    if last_row_anchor_ is not None and abs( wd_['pts'][1] - last_row_anchor_['pts'][1] ) <= 10:
      return False, current_bot        

    print('lineBeforeNextAnchor->', wd_, idx_, current_bot, existin_, next_anchor_, tblEnding, \
                                                     row_separators_, last_row_anchor_)
    if ( wd_['pts'][1] < current_bot and abs( wd_['pts'][1] - current_bot ) <= 10 and\
            wd_['pts'][1] < next_anchor_ and abs( wd_['pts'][1] - next_anchor_ ) >= 20 ) or \
       ( existin_ is not None and wd_['pts'][1] < existin_['pts'][-1] and \
            abs( wd_['pts'][1] - existin_['pts'][-1] ) <= 10 and wd_['pts'][1] < next_anchor_ and\
                     abs( wd_['pts'][1] - next_anchor_ ) >= 20 ):
                return True , next_anchor_

    return False, current_bot        

def maxYinLine(ln_, minormax):
    maxy = -1
    for wd in ln_:
        if minormax == "y1" and wd['pts'][1] > maxy:
            maxy = wd['pts'][1]
        elif minormax == "y2" and wd['pts'][-1] > maxy:
            maxy = wd['pts'][-1]

    return maxy


def gatherCellRows(row_separators_, colBound_pg, raw_jsn_, last_row_anchor_, follow_vertical_bounds_, tblEnding):
    ## use the column headers / row headers in colBound_pg for L and R boundaries and use
    ## row_separators_ for T and Bottom boundaries
    ## whatever falls in between gets appended to the cell
    cellInfo_, rowCntr = dict(), 0
    LRBounds_, hdrY2 = dict(), -1
    ## demarcate LR bounds and find min Y for row extraction to begin
    print('Gel blaster->', colBound_pg, follow_vertical_bounds_)

    prevx2, maxHdrY2 = None, -1
    for colKey, (firstChild, colInfo) in colBound_pg.items():
        if colInfo['pts'][-1] > hdrY2: hdrY2 = colInfo['pts'][-1]
        if firstChild is None: firstChild = colInfo

        if colInfo['pts'][-1] > maxHdrY2: maxHdrY2 = colInfo['pts'][-1]

        print('COL->', colKey, prevx2 , colInfo['pts'], firstChild ) 
        if prevx2 is None: prevx2 = colInfo['pts'][2]
        elif prevx2 == colInfo['pts'][0]:
            LRBounds_[colKey] = ( colInfo['pts'][0], colInfo['pts'][2] )
            prevx2 = colInfo['pts'][2]
            continue
        
        ## NOTE - addition of STRICT in thef rist IF - BREAKING CHANGE
        if firstChild['pts'][0] == 0 or follow_vertical_bounds_ == 'STRICT':
            LRBounds_[colKey] = ( colInfo['pts'][0], colInfo['pts'][2] )
        else:    
            LRBounds_[colKey] = (min(firstChild['pts'][0], colInfo['pts'][0]), \
                             max(firstChild['pts'][2], colInfo['pts'][2]))

    ## iterate cell wise
    LRBounds_ = dict( sorted( LRBounds_.items(), key=lambda x:x[1][0] ) )

    print('LRBounds_ 0.0->', LRBounds_)
    ## one more poss
    tmp_ = dict()
    lrb_keys_ = list( LRBounds_.keys() )
    for idx, key_ in enumerate( lrb_keys_ ):
        next_ = lrb_keys_[ min( idx+1, len( lrb_keys_ )-1 ) ]
        if LRBounds_[ key_ ][1] > LRBounds_[ next_ ][0] and idx != len( lrb_keys_ )-1:
            tmp_[ key_ ] = ( LRBounds_[ key_ ][0], LRBounds_[ next_ ][0] )

        else:
            tmp_[ key_ ] = LRBounds_[ key_ ]

    LRBounds_ = tmp_
    ## overlap clear
    neo_ = dict()
    lr_keys_ ,idx = list( LRBounds_.keys() ), 0

    while idx <= len( lr_keys_ ) - 1:
        curr, next_ = LRBounds_[ lr_keys_[idx] ], LRBounds_[ lr_keys_[ min( idx+1, len(lr_keys_)-1 ) ] ]
        if ( curr[0] > next_[0] and curr[0] < next_[1] and curr[0] - next_[0] > 30 ) or\
                ( next_[0] > curr[0] and next_[0] < curr[1] and curr[1] - next_[0] > 30 ):
            neo_[ lr_keys_[idx] + ' ' + lr_keys_[idx+1] ] = ( min(curr[0], next_[0]), max( curr[1], next_[1] ) )
            idx += 2
        else:
            neo_[ lr_keys_[idx] ] = curr
            idx += 1
        
    print('LRBounds_->', LRBounds_, row_separators_, hdrY2, neo_, follow_vertical_bounds_)
    if follow_vertical_bounds_ != 'STRICT':
        LRBounds_ = neo_

    lctr_for_last_row_, avg_y_diff, prev = 0, [], None

    start_idx_ = 0
    for elem in row_separators_:
        if elem < hdrY2: start_idx_ += 1

    row_separators_ = row_separators_[ start_idx_: ]
    if hdrY2 != row_separators_[0]:
      row_separators_.insert( 0, hdrY2 )
    print('Updated ROW SEP->', row_separators_)
    

    maxYOffset_covered_, maxY2_so_far = None, -1
    for row_sep_ctr in range(len(row_separators_) - 1):
        current_top, current_bot = row_separators_[row_sep_ctr], row_separators_[row_sep_ctr + 1]
        rowD = dict()
        maxYOffset_covered_ = current_top
        print('HAMILTON->', current_top, current_bot)

        extractBlocks(LRBounds_, current_top, current_bot, raw_jsn_, rowD, avg_y_diff, \
                                 prev, lctr_for_last_row_, follow_vertical_bounds_, row_separators_, tblEnding )

        cellInfo_[rowCntr] = rowD
        for key, val in rowD.items():
            if val['pts'][-1] > maxY2_so_far: maxY2_so_far = val['pts'][-1]

        print('Row # ', rowCntr, ' The vals = ', rowD)
        print('The last row ctr = ', lctr_for_last_row_, ' and total lines = ', len(raw_jsn_['lines']))
        rowCntr += 1

    if maxYOffset_covered_ is None and len( row_separators_ ) == 1:
        maxYOffset_covered_ = row_separators_[0]
        ## for the last row, you need to go as long as the y diff is same as the existing rows
    ## OR we hit total
    y_diff = np.median(avg_y_diff)
    y_ref = last_row_anchor_['pts'][1]
    bottom = y_ref
    totalKw, reached_ = False, False
    print('The Y distance between lines is ', y_diff, avg_y_diff, ' and last anchor elem = ', y_ref, last_row_anchor_)

    for lctr in range(len(raw_jsn_['lines'])):
        line_ = raw_jsn_['lines'][lctr]

        if maxYinLine(line_, "y1") < y_ref and reached_ is False:
            continue
        else:
            reached_ = True

        print('Lower y = ', y_ref, line_)

        min_y_local = maxYinLine(line_, "y1")
        for wd in line_:
            if ( ( 'total' in wd['text'].lower() or 'page' in wd['text'].lower() \
              or 'description' in wd['text'].lower() ) and wd['pts'][0] >= 1000 ) or\
              ( last_row_anchor_ is not None and 'pts' in last_row_anchor_ and last_row_anchor_['pts'] == wd['pts'] ):
                totalKw = True
                break

        if totalKw: 
            print('Another total break!')
            break

        print('last y2 and curr y0 = ', y_ref, min_y_local)

        if follow_vertical_bounds_ == 'STRICT' and len( row_separators_ ) > 0 and min_y_local == row_separators_[-1]:
            break

        if abs(min_y_local - y_ref) <= 20 and min_y_local != y_ref:
            bottom = line_[-1]['pts'][-1]
            print('Table extended->', line_)
        else:
            break

        y_ref = maxYinLine(line_, "y2")

    rowD = dict()  ## now that we have the bottom of the last row, empty the row dict and again call extractBlocks
    if last_row_anchor_['pts'][1] == y_ref:
        y_ref = last_row_anchor_['pts'][-1]

    if len( row_separators_ ) == 1:
        print('Only 1 row to be extracted ..so we take upper y from hdr')
        upper_ , lower_ = maxHdrY2, y_ref
    else:
        upper_ , lower_ = last_row_anchor_['pts'][1], y_ref

    row_separators_.append( lower_ )
    row_separators_.sort()
    print('CALLIN for LAST ROW ->', upper_ , lower_, maxYOffset_covered_, last_row_anchor_, maxY2_so_far , row_separators_, maxHdrY2)

    if len( row_separators_ ) == 2 and maxY2_so_far == -1:
        maxY2_so_far = row_separators_[-1]

    if ( (maxYOffset_covered_ is not None and ( ( last_row_anchor_['pts'][1] >= maxYOffset_covered_ ) or \
             ( len( row_separators_ ) == 2 and abs( last_row_anchor_['pts'][1] - maxYOffset_covered_ ) <= 5 ) ) ) or \
            (len(row_separators_) == 1 and y_ref >= last_row_anchor_['pts'][1]) ) and \
            ( maxY2_so_far < row_separators_[-1] or abs( maxY2_so_far - row_separators_[-1] ) <= 10 ) and\
            lower_ > maxY2_so_far:
        #extractBlocks(LRBounds_, upper_ , lower_, raw_jsn_, \
        #     rowD, avg_y_diff, prev, lctr_for_last_row_, follow_vertical_bounds_, row_separators_, tblEnding,  maxY2_so_far)
        extractBlocks( LRBounds_, upper_ , lower_, raw_jsn_, \
             rowD, avg_y_diff, prev, lctr_for_last_row_, follow_vertical_bounds_, row_separators_, tblEnding )
    cellInfo_[rowCntr] = rowD

    print('Final CellInfo->', cellInfo_)
    ## validate amount field 
    for key, val in cellInfo_.items():
        candidates_ = dict()

        for colkey, coldict in val.items():
            if dataType( coldict['text'] ) in [ 'DIGIT', 'ALNUM' ]:
                candidates_[ colkey ] = coldict['text']

        print('Candidates for amount validation->',candidates_)  

        ## now go into loopy madness
        for colKey, colVal in candidates_.items():
            for innercolKey, innercolVal in candidates_.items():
                res_ = resultFound( colVal, innercolVal, candidates_ )
                if res_ is not None and res_[1] > 0:
                  print('Huzzah-> ',colKey, colVal, ' & ',innercolKey, innercolVal, ' result in ->', res_)

    return cellInfo_

def resultFound( t1, t2, candidates_ ):

    rt1, rt2 = cleanup( t1 ), cleanup( t2 )

    for k, v in candidates_.items():
        rt3 = cleanup( v )
        if abs( rt1*rt2 - rt3 ) <= 1: 
            print('HOMIE rt1*rt2, rt3->', rt1*rt2, rt3, k, v )
            return ( k, rt3 )

    return None    

def cleanup( t1 ):    

    ref_t1 , ref_t2 = '', ''

    for char in t1:
        if ( ord(char) >= 48 and ord(char) <= 57 ) or '.' == char: ref_t1 += char

    try:
        rt1 = float( ref_t1 )

    except:
        return 0

    return rt1

def breakHere( line_, colBound_pg ):
    ## 2 condns need to be fulfilled .. < 50% overlap in terms of num of columns AND
    ## the first overlap ( ie with the first column in the row ) is in the 2nd half of the doc
    first_match, numMatches = None, set()
    for colkey, (firstchild, colinfo) in colBound_pg.items():
        for wd in line_:  
            if tblDetMultiPage.xOverlap( colinfo['text'], colinfo['pts'], wd['text'], wd['pts'], 1500 ):
                if first_match is None: 
                    first_match = colinfo['pts'][0]

                numMatches.add( colkey )    

    print('BREAK_CHECK->', line_, first_match, numMatches, len(colBound_pg))
    if first_match is not None and len(numMatches) <= len(colBound_pg)*0.5 and first_match > 1500:
        # 1275 is 50% of expected 2550 width            
        print('Line break for ANCHORS->', line_ )
        return True

    return False


def findCells(colBounds_, tblEnding, master_raw_json, hlines, vertical_bounds_='LOOSE'):
    cellArr_, colHdrEnding = [], -1

    for pg_ctr in range(len(colBounds_)):
        neo_top_anchor_ = None

        colBound_pg = colBounds_[pg_ctr]
        print('MOFO1->',colBound_pg)
        ## the below is to shift the anchor column from first child to table header.. at times its best
        ## to begin collecting cell info from table header Y2 instead of first child Y1 snice there could
        ## be a few lines between the anchor value in the first child and the table header
        ## ------------------------------------------------
        ## HDR1             HDR2                 HDR3
        ## ------------------------------------------------
        ##  1             asdfasdf
        ##                asdafasasdfasdf        123.55
        ##                   ........................

        for colkey, (_, colDict) in colBound_pg.items():
            if colHdrEnding < colDict['pts'][-1]: colHdrEnding = colDict['pts'][-1]

            print('Trying to CHECK colDict, tblEnding->', colDict, tblEnding[pg_ctr]['anchor_col_'])
            if tblDetMultiPage.xOverlap(colDict['text'], colDict['pts'], \
                                        tblEnding[pg_ctr]['anchor_col_']['text'],
                                        tblEnding[pg_ctr]['anchor_col_']['pts'], 400):
                neo_top_anchor_ = colDict

        anchor_col_, child_anchor_, last_row_anchor_ = neo_top_anchor_, tblEnding[pg_ctr]['anchor_col_'], \
            tblEnding[pg_ctr]['last_row_anchor_']

        if anchor_col_ is None:
            cellArr_.append([])
            continue

            # anchor_col_, last_row_anchor_ = tblEnding[ pg_ctr ]['anchor_col_'], tblEnding[ pg_ctr ]['last_row_anchor_']
        with open(master_raw_json[pg_ctr], 'r') as fp:
            raw_jsn_ = json.load(fp)

        ## see if hor lines separate rows
        row_separators_ = []
        print('MOFO2->',colBound_pg)

        for y_offset, (x1, x2) in hlines[pg_ctr].items():

            if y_offset >= last_row_anchor_['pts'][1]: break
            if y_offset > anchor_col_['pts'][1] and abs(x1 - x2) > 0.7 * raw_jsn_['width'] \
                    and len(row_separators_) == 0:

                print('RSS->', y_offset, (x1, x2))
                row_separators_.append(y_offset)

            elif y_offset > anchor_col_['pts'][1] and abs(x1 - x2) > 0.7 * raw_jsn_['width'] \
                    and len(row_separators_) > 0 and abs(row_separators_[-1] - y_offset) >= 20:

                print('RSS->', y_offset, (x1, x2))
                row_separators_.append(y_offset)

        row_anch_ctr_ = []

        lastRow_reached_ = False
        print('MOFO3->',colBound_pg, anchor_col_, last_row_anchor_)

        for line_ in raw_jsn_['lines']:
            ## need to check for ending here u lil twat
            if len( row_anch_ctr_ ) > 0 and breakHere( line_, colBound_pg ) \
                    and line_[0]['pts'][1] >= last_row_anchor_['pts'][-1]: break
            for wd_ in line_:

                if wd_['pts'][1] > anchor_col_['pts'][1] and \
                        tblDetMultiPage.xOverlap( wd_['text'], wd_['pts'], anchor_col_['text'], anchor_col_['pts'],
                                                 1500) and abs( wd_['pts'][2] - anchor_col_['pts'][0] ) >= 10:
                    row_anch_ctr_.append(wd_)
                    print('DIMSUM wd_, anchor_col_ ->', wd_, anchor_col_)

                if wd_['pts'][1] >= last_row_anchor_['pts'][-1]:
                    lastRow_reached_ = True
                    break

            if lastRow_reached_: break

        hdrY2 = -1
        print('MOFO4->',colBound_pg)
        for colkey, (firstchild, colinfo) in colBound_pg.items():
            print('DODUS->', colkey, firstchild, colinfo)
            if firstchild is not None and abs(firstchild['pts'][1] - anchor_col_['pts'][1]) > 10 and\
                    firstchild['pts'][1] > 0:
                print('Another line above anchor col !! reducing Y1 for anchor col - firstchild, anchor_col_', \
                      firstchild, anchor_col_)

                if firstchild['pts'][1] < anchor_col_['pts'][1]:
                  anchor_col_['pts'][1] = firstchild['pts'][1]
                if colinfo['pts'][-1] > hdrY2: hdrY2 = colinfo['pts'][-1]
                print('POST CHANGES-> anchor_col_ = ', anchor_col_) 

                ## we will need 3 main row separators ..one, the bottom of the TBL HDR ..two, the first child
        ## and then final child ..thease are beig added separately for redundancy and also due to the
        ## iterator behaviour above

        ## SHADY -> only fr the first row, ensure top and bottom is demarcated using the y2 of the tbl hdr
        ## for the rest you can demarcate top and bottomw of every CELL using y1 of prev child and y1 of curr child
        tmp_anchor_col = anchor_col_.copy()
        '''
        tmp_anchor_col['pts'] = [tmp_anchor_col['pts'][0], tmp_anchor_col['pts'][-1], tmp_anchor_col['pts'][2], \
                                 tmp_anchor_col['pts'][-1]]
        '''
        print('TMP ANCH->', tmp_anchor_col, child_anchor_, last_row_anchor_, tblEnding)
        row_anch_ctr_.append(tmp_anchor_col)  ## ** NOTE that above we are assigning y2 to y1 due to SHADY
        row_anch_ctr_.append(child_anchor_)
        row_anch_ctr_.append(last_row_anchor_)

        ## add last line as well
        if 'last_line' in tblEnding[0]:
            row_anch_ctr_.append( tblEnding[0]['last_line'] )

        print('Hori separators = ', len(row_separators_), ' and anch counts = ', row_anch_ctr_)
        if len(row_separators_) in [len(row_anch_ctr_) - 1, len(row_anch_ctr_)]:
            ## since lower row anch is the stopping point .. # of hori lines can never be equal to # row anchs ..it ll be like 2 hor row delims and 3 anchor elems
            row_separators_.insert(0, anchor_col_['pts'][
                1])  ## if u have hori lines then pls include the first anchor since the hori lines begin below this
            print('We can use hori line markers ', row_separators_)
        else:
            print('Use top of row anchors ..no hori markers->', colHdrEnding)
            row_separators_, numlines = [], 0
            ## get num of lines between first row separator and header
            for lineidx, line in enumerate( raw_jsn_['lines'] ):
                for wd in line:
                    #if wd['pts'][1] > colHdrEnding and wd['pts'][1] < row_anch_ctr_[0]['pts'][1]\
                    if wd['pts'][1] > colHdrEnding and wd['pts'][1] < child_anchor_['pts'][1]\
                            and abs( wd['pts'][1] - child_anchor_['pts'][1] ) > 10:
                        numlines += 1
                        print('Line between HDR and First Anchor->', wd, colHdrEnding, child_anchor_)
                        break

            print('Total lines between HDR and First Anchor->', numlines, row_anch_ctr_)        
            ##NOTE - the below hard coding can be reviewed at a later date
            numlines = 0

            for ranch_ in row_anch_ctr_:

                if type( ranch_ ) is dict and ranch_['pts'][1] >= tmp_anchor_col['pts'][1] and numlines == 0:
                    row_separators_.append(ranch_['pts'][1])
                    print('APPENDAGE-> colHdrEnding, ranch_[pts][1]->', colHdrEnding, ranch_['pts'][1])

                elif type( ranch_ ) is dict and ranch_['pts'][1] >= tmp_anchor_col['pts'][1] and numlines > 0:
                    row_separators_.append(ranch_['pts'][-1])
                    print('APPENDAGE2-> colHdrEnding, ranch_[pts][1]->', colHdrEnding, ranch_['pts'][-1])

                elif type( ranch_ ) is int and ranch_ >= tmp_anchor_col['pts'][1]:
                    row_separators_.append( ranch_ )
                    print('APPENDAGE3-> colHdrEnding, ranch_->', colHdrEnding, ranch_)

            row_separators_ = sorted(row_separators_)
            if hdrY2 < row_separators_[0] and row_separators_[0] - hdrY2 > 60:  ## 60 is super random..sorry
                print('Need to replace first row marker with header bottom ->', hdrY2, row_separators_[0])
                neo_row_sep = [hdrY2]
                for row_sep_ctr in range(1, len(row_separators_)): neo_row_sep.append(row_separators_[row_sep_ctr])

            tmp_store_ = list( set(row_separators_) )
            tmp_store_.sort()
            print('We can use NON hori line markers ', row_separators_, set(row_separators_), colHdrEnding, tmp_store_)
            row_separators_.append( colHdrEnding ) ## else if there's a big gap between col hdr and first anchhor only the anchor row is picked, ignoring all values between header and first anchor

        # row_separators_ = list( set( row_separators_ ) )

        rs_ = set(row_separators_)
        rsl_ = list(rs_)
        row_separators_ = sorted(rsl_)
        pg_cell_info_ = gatherCellRows( row_separators_, colBound_pg, raw_jsn_, last_row_anchor_,\
                                                             vertical_bounds_, tblEnding )

        cellArr_.append(pg_cell_info_)

    if len( cellArr_ ) == 0: cellArr_.append(dict())
    return cellArr_


def inbetweenCols(wd, neo_col_hdr_, rawlinectr, raw_lines):
    # print('GORGOROTH->', wd, neo_col_hdr_, raw_lines[ rawlinectr ])
    maxy2 = neo_col_hdr_[0]['pts'][-1]
    for elem in neo_col_hdr_:
        if elem['pts'][-1] > maxy2: maxy2 = elem['pts'][-1]
        if tblDetMultiPage.xOverlap(wd['text'], wd['pts'], elem['text'], elem['pts']):
            print('ADDL FLOP-> This is an FP since its parent is already present in header arr..\
                          so this addition will double count the same column ..typical of multi line col hdrs', wd)
            return False

    for colctr in range(len(neo_col_hdr_)):
        c1, c2 = neo_col_hdr_[colctr], neo_col_hdr_[min(colctr + 1, len(neo_col_hdr_) - 1)]
        # print('CHecking COLS ->', c1, c2, wd)
        if wd['pts'][0] >= c1['pts'][2] and wd['pts'][2] <= c2['pts'][0] and wd['pts'][1] >= c1['pts'][1] and \
                wd['pts'][1] <= c1['pts'][-1]:
            ## check if the wd has an xoverlap with some child below .. proving its a col hdr
            # print('CHILD CHECK')
            for tmpctr in range(rawlinectr, rawlinectr + 5):  ## just search for 5 lines below
                for tmpwd in raw_lines[tmpctr]:
                    # print('GARBAGE->', tblDetMultiPage.xOverlap( wd['text'], wd['pts'], tmpwd['text'], tmpwd['pts'], 300 ),\
                    #            tmpwd, tblDetMultiPage.chkNum( wd['text'] ))
                    if tblDetMultiPage.xOverlap(wd['text'], wd['pts'], tmpwd['text'], tmpwd['pts'], 300) and \
                            tmpwd['pts'][1] > maxy2:
                        ## before returning TRUE, one last check would be to ensure it doesnt haven an overlap
                        ## with existing cols

                        print('Found CHILD ->', tmpwd, ' FOR ADDL PARENT ->', wd)
                        return True

    return False

def repairIfNeeded( colBounds_, master_raw_json ):
    print('Entering repairIfNeeded->', master_raw_json)
    print( colBounds_ )
    with open( master_raw_json[0], 'r' ) as fp:
        raw_js_ = json.load( fp )

    #sorted_ = dict( sorted( colBounds_.items(), key=lambda x: x[1][1]['pts'][0] ) )    

    key_list_ = list(colBounds_[0].keys())

    for idx, key in enumerate( key_list_ ):
        if idx < len(key_list_)-1:
            curr, next_ = colBounds_[0][ key_list_[idx] ], colBounds_[0][ key_list_[idx+1] ]
            ## now find the gap between the max of the curr and min of next_
            if curr[0] is None or next_[0] is None: continue
            curr_max, next_min = max( curr[0]['pts'][2], curr[1]['pts'][2] ), \
                                 min( next_[0]['pts'][0], next_[1]['pts'][0] )
            
            print('No MANS LAND between ->', curr, ' **AND** ',next_, curr_max, next_min)
            
            linedx_ = 0
            for idx, line_ in enumerate( raw_js_['lines'] ):
                for wdidx, wd_ in enumerate( line_ ):
                    if curr[0]['pts'][0] == wd_['pts'][0] and abs( curr[0]['pts'][1] - wd_['pts'][1] ) <= 10 and\
                            wd_['text'] in curr[0]['text']:
                        print('Found ANCHOR line->', line_)
                        linedx_ = idx
                        break
                if linedx_ != 0:
                    break
            ## now go through next 4 lines 
            minx0 = 10000
            for idx in range( linedx_, min( linedx_+4, len(raw_js_['lines'])-1 ) ):
                curr_line_ = raw_js_['lines'][idx]
                ## find minx0 of contours in no mans land
                for wdd in curr_line_:
                    if wdd['pts'][0] > curr_max and wdd['pts'][2] < next_min and minx0 > wdd['pts'][0]:
                      minx0 = wdd['pts'][0]
                      print('Marking ', wdd, ' as minx0 in NO MANS LAND')

            if minx0 < next_min:
                modified_hdr_ = next_[1]
                modified_hdr_['pts'] = [ minx0, next_[1]['pts'][1], next_[1]['pts'][2], next_[1]['pts'][3] ]

                next_ = ( next_[0], modified_hdr_ )
                print('MODIFIED COL BOUNDS->', next_)

    return colBounds_        


def extractLineItems(tblDeets_master, master_stit_json, master_raw_json, vlines, hlines, doc_type):
    cellInfoMaster_, replacedWithFeedback, feedback_based_last_line, feedback_anchor_col_ = [], False, None, None
    #cellInfoMaster_, colBounds_ = [], dict()
    print('First Line->', master_stit_json, master_raw_json)

    for pgctr in range(len(tblDeets_master)):

        ## at times the last column is missed
        bounds_arr, tbl_arr = tblDeets_master[pgctr]
        if len(bounds_arr) == 0:
            cellInfoMaster_.append([])
            continue

        deduplicated_tbl_arr = dict()

        for arr_ in tbl_arr:
            deduplicated_tbl_arr[str(arr_[0]['pts'][0]) + '-' + str(arr_[0]['pts'][1])] = arr_

        if len(deduplicated_tbl_arr) == 0:
            cellInfoMaster_.append([])
            continue

        print('Deduped->', list(deduplicated_tbl_arr.values()))
        ## remove duplicate COLs using a combo of col name and X0 co-ords
        print('BEGIN DEETS->', tblDeets_master)
        tbl_arr = list(deduplicated_tbl_arr.values())

        # for pgctr in range( len( tbl_arr ) ):
        if True:
            bounds_, tbl_d = bounds_arr[0], tbl_arr[0]
            print(bounds_, tbl_d)
            # bounds_, tbl_d = bounds_arr[ pgctr ], tbl_arr[ pgctr ]

            lastCol_0, tbl_rightmost = tbl_d[-1], bounds_[2]
            lt, top, rt, bot = lastCol_0['pts']

            with open(master_raw_json[pgctr], 'r') as fp:
                raw_js_ = json.load(fp)
            with open(master_stit_json[pgctr], 'r') as fp:
                _js_ = json.load(fp)

            ## remove overlapping cols
            nonOlap_, dupp, prev = dict(), dict(), None
            for elem in tbl_d:
                '''
                if prev is not None and abs(prev['pts'][2] - elem['pts'][0]) <= 20:
                    curr_ = prev
                    curr_['text'] += ' ' + elem['text']
                    curr_['pts'] = [curr_['pts'][0], curr_['pts'][1], elem['pts'][2], elem['pts'][3]]
                else:
                    curr_ = elem
                '''
                curr_ = elem
                dupp[curr_['pts'][0]] = curr_
                prev = curr_

            nonOlap_ = dict(sorted(dupp.items(), key=lambda x: x[0]))
            print('GROAN->', nonOlap_)
            tbl_d = list(nonOlap_.values())
            ## remove overlapping cols

            ## sometimes table detection ONLY sends the first line in a col hdr ..and we have 2 more foll lines
            lastCol, begintbl, endtbl = None, None, None
            potential_tbl_ends_ = []

            for yoff, (x1, x2) in hlines[pgctr].items():
                if yoff > lastCol_0['pts'][1] and abs(x1 - x2) > 0.8 * _js_['width'] and \
                        abs(yoff - lastCol_0['pts'][1]) < 400:
                    potential_tbl_ends_.append((yoff, x1, x2))

            hori_tbl_end = None

            for linectr in range(len(_js_['lines'])):
                line = _js_['lines'][linectr]

                for wd in line:
                    if wd['pts'][1] == lastCol_0['pts'][1]: begintbl = linectr

                    if tblDetMultiPage.isAnchorRowElem(wd['text']) and begintbl is not None and \
                            endtbl is None: break

            for elem in potential_tbl_ends_:
                if hori_tbl_end is None and elem[0] > lastCol_0['pts'][1] and endtbl is None:
                    hori_tbl_end = elem

            print('hori_tbl_end->', hori_tbl_end, potential_tbl_ends_, tbl_d)

            if hori_tbl_end is not None:
                tmpD_ = []
                for lctr in range(len(raw_js_['lines'])):
                    ltmp = raw_js_['lines'][lctr]
                    if tblDetMultiPage.chkLineForNum(ltmp) and len(tmpD_) > 0: break
                    for wd in ltmp:
                        if (wd['pts'][1] >= top or (wd['pts'][1] < top and abs(wd['pts'][1] - top) <= 10)) and \
                                wd['pts'][1] <= hori_tbl_end[0]:
                            append_ = False

                            for tup in tmpD_:
                                if tblDetMultiPage.xOverlap(tup['text'], tup['pts'], wd['text'], wd['pts']):
                                    tup['text'] += ' ' + wd['text']
                                    tup['pts'] = [tup['pts'][0], tup['pts'][1], wd['pts'][2], wd['pts'][3]]
                                    append_ = True

                            if (append_ is False and len(tmpD_) > 0 and \
                                ( \
                                                abs(tmpD_[-1]['pts'][2] - wd['pts'][0]) >= 20)) or \
                                    (append_ is False and len(tmpD_) == 0):
                                print('MOFO-> tmpD_[-1], wd ', tmpD_, wd)
                                tmpD_.append(wd)

                print('LLM->', tmpD_, tbl_d)
                ## this is being done primarily to align botton and top rows in a header ..but sometimes
                ## ------------------------------------------------ AMOUNT
                ## QTY             PRICE                 DESC
                ## happen, and in such cases, since AMOUNT occurcs first and NO xoverlap with below row
                ## it replaces the entire table header ..disaster . so we will check if the len of tmpD_
                ## is NOT significantly smaller

                #if len(tmpD_) > 0.5 * (len(tbl_d)):
                #    tbl_d = [tmpD_]

            else:
              firstX0, top, bottom = tbl_d[0]['pts'][0], tbl_d[0]['pts'][1], tbl_d[0]['pts'][-1]
              if firstX0 > 0.5 * _js_['width']:
                print('MONTANA')  
                for line in _js_['lines']:
                  for wd in line:
                    #print('TEST->', wd, firstX0, top, bottom)
                    if wd['pts'][0] < firstX0 and wd['pts'][1] >= top and \
                      ( abs( wd['pts'][-1] - bottom ) <= 10 or wd['pts'][-1] < bottom ):
                      tbl_d.append( wd ) 
               
                print( 'Revised Tbl Bounds->', tbl_d )
            ## sometimes table detection ONLY sends the first line in a col hdr ..and we have 2 more foll lines

            for line in raw_js_['lines']:
                numFound = False

                for wd in line:

                    if wd['pts'][0] > rt and wd['pts'][2] < tbl_rightmost and wd['pts'][1] > top and wd['pts'][3] < bot:
                        if lastCol is None:
                            lastCol = wd
                        else:
                            lastCol['text'] += ' ' + wd['text']
                            lastCol['pts'] = [lastCol['pts'][0], lastCol['pts'][1], wd['pts'][2], wd['pts'][3]]

            if lastCol is not None:
                print('Added MISSING COL !!', lastCol, tbl_rightmost, top, bot, tbl_d)
                tbl_d.append(lastCol)
                # tbl_d[0].append( lastCol )

            if type(tbl_d[0]) is dict:
                ## for some weird reason the code expects the list of dicts to be wrapped in another list
                tblDeets_master[pgctr] = (tblDeets_master[pgctr][0], [tbl_d])
            else:
                tblDeets_master[pgctr] = (tblDeets_master[pgctr][0], tbl_d)
            # tblDeets[0][1][ pgctr ] = tbl_d
            print('Begin and END = ', tblDeets_master)

        new_hdr_arr_ = []
        ## iterate through headers and see if the COL HDRS are either conjoined / separated and separate / disjoin
        for tblctr in range(len(tblDeets_master)):
            tbl = tblDeets_master[tblctr]
            _, pg_hdr_arr = tbl
            print('ITER-HDR-ARR = ', pg_hdr_arr)
            print(tblDeets_master)
            ## no table found in the page
            if len(pg_hdr_arr) == 0: continue
            ## no table found in the page

            pg_hdr = pg_hdr_arr[0]
            neo_col_hdr_, col_hdr_ctr = [], 0
            while True:
                if col_hdr_ctr >= len(pg_hdr): break

                col_hdr_, next_col = pg_hdr[col_hdr_ctr], pg_hdr[min(col_hdr_ctr + 1, len(pg_hdr) - 1)]
                '''
                if abs(col_hdr_['pts'][2] - next_col['pts'][0]) <= 10 and col_hdr_['pts'] != next_col['pts']:
                    new_block_ = col_hdr_
                    ## now modify the text and pts
                    new_block_['text'] += ' ' + next_col['text']
                    new_block_['pts'] = [new_block_['pts'][0], new_block_['pts'][1], next_col['pts'][2],
                                         next_col['pts'][3]]
                    col_hdr_ctr += 2
                    neo_col_hdr_.append(new_block_)

                else:
                    col_hdr_ctr += 1
                    neo_col_hdr_.append(col_hdr_)
                '''
                col_hdr_ctr += 1
                neo_col_hdr_.append(col_hdr_)

            ## find if any col got missed by tbl detection
            missing_cols = []
            for rawlinectr in range(len(raw_js_['lines'])):
                rawline = raw_js_['lines'][rawlinectr]
                if tblDetMultiPage.chkLineForNum(rawline): continue
                for wd in rawline:
                    if inbetweenCols(wd, neo_col_hdr_, rawlinectr, raw_js_['lines']):
                        ## check if no overlap with existing msising
                        ovlap_ = False
                        for elem in missing_cols:
                            if tblDetMultiPage.xOverlap(elem['text'], elem['pts'], wd['text'], wd['pts']): ovlap_ = True

                        if ovlap_ is True: continue
                        missing_cols.append(wd)
                        print('Added ADDL PARENT->', wd)

                        ##now add missing cols, if any
            for elem in missing_cols:
                neo_col_hdr_.append(elem)

            ## use vertical and horizontal lines and see if there's a bound for table headers
            ## FIRST HORIZONTAL BOUNDS
            with open(master_stit_json[tblctr], 'r') as fp:
                jsn_wd = json.load(fp)

            upperY, lowerY, width_ = 10000, -1, jsn_wd['width']
            vlines_, hlines_ = vlines[tblctr], hlines[tblctr]
            uc, lc = [], []
            for colhdr in neo_col_hdr_:
                if colhdr['pts'][1] < upperY: uc.append(colhdr['pts'][1])
                if colhdr['pts'][-1] > lowerY: lc.append(colhdr['pts'][-1])

            nearest_upper_, nearest_lower_ = dict(), dict()
            upperY, lowerY = int(np.median(uc)), int(np.median(lc))
            if abs(upperY - lowerY) > 100:
                upperY += (lowerY - upperY) / 2

            sorted_list = sorted(neo_col_hdr_, key=lambda x: x['pts'][0])
            neo_col_hdr_ = sorted_list
            print('Upper and Lower bounds for ', upperY, lowerY, neo_col_hdr_)
            ## UB and LB to demarcate Table Headers
            for yoffset, (x1, x2) in hlines_.items():
                ## find nearest upper bound
                if abs(x1 - x2) > 600 and (yoffset <= upperY or abs(yoffset - upperY) <= 10) \
                        and abs(yoffset - upperY) <= 100:
                    nearest_upper_[abs(yoffset - upperY)] = (yoffset, x1, x2)
                    ## find nearest lower bound
                if abs(x1 - x2) > 600 and (yoffset >= lowerY or abs(yoffset - lowerY) <= 10) \
                        and abs(yoffset - lowerY) <= 100:
                    nearest_lower_[abs(yoffset - lowerY)] = (yoffset, x1, x2)

            upper_bounds_ = sorted(list(nearest_upper_.keys()))
            lower_bounds_ = sorted(list(nearest_lower_.keys()))

            if len(nearest_lower_) == 0 and len(nearest_upper_) > 0:

                nearest_lower_[0] = (lowerY, nearest_upper_[upper_bounds_[0]][1], nearest_upper_[upper_bounds_[0]][2])
                lower_bounds_ = [0]
            elif len(nearest_lower_) == 0 and len(nearest_upper_) == 0:

                width_ = jsn_wd['width']
                nearest_lower_[0] = (lowerY, 0, width_)
                lower_bounds_ = [0]
                nearest_upper_[0] = (upperY, 0, width_)
                upper_bounds_ = [0]

            print('UB EXPORT', upper_bounds_, nearest_lower_[lower_bounds_[0]])

            if len(upper_bounds_) == 0 and len(lower_bounds_) > 0:
                for yoffset, (x1, x2) in hlines_.items():
                    ylb = nearest_lower_[lower_bounds_[0]][0]
                    if yoffset < ylb and abs(yoffset - ylb) <= 300 and \
                            abs(x1 - x2) > 0.5 * width_:
                        nearest_upper_[abs(yoffset - ylb)] = (yoffset, x1, x2)

                upper_bounds_ = sorted(list(nearest_upper_.keys()))

            elif len(lower_bounds_) == 0 and len(upper_bounds_) > 0:
                for yoffset, (x1, x2) in hlines_.items():
                    yub = nearest_upper_[upper_bounds_[0]][0]
                    if yoffset > yub and abs(yoffset - yub) <= 300 and \
                            abs(x1 - x2) > 0.5 * width_:
                        nearest_lower_[abs(yoffset - yub)] = (yoffset, x1, x2)

                lower_bounds_ = sorted(list(nearest_lower_.keys()))

            ## NW USING UB AND LB find vertical demarcation for the COLUMNS

            try:
                print('UB = ', nearest_upper_[upper_bounds_[0]], upper_bounds_[0])
                print('LB = ', nearest_lower_[lower_bounds_[0]], lower_bounds_[0])

                vertical_bounds_ = []
                for xoffset, (y1, y2) in vlines_.items():
                    ub_, lb_ = nearest_upper_[upper_bounds_[0]][0], nearest_lower_[lower_bounds_[0]][0]
                    # print('BOUND CHECK-> ub_, lb_, xoffset, (y1, y2) ', ub_, lb_, xoffset, (y1, y2))
                    if (y1 >= ub_ or abs(y1 - ub_) <= 60) and y1 < lb_ and \
                            ((y2 <= lb_ or abs(y2 - lb_) <= 60) or (y2 > lb_)) and abs(y2 - ub_) >= 20:

                        print('passed VERT TEST ->', xoffset, (y1, y2))
                        if (len(vertical_bounds_) > 0 and abs(vertical_bounds_[-1] - xoffset) >= 20) or \
                                len(vertical_bounds_) == 0:

                            ## to eliminate fake vertical bounds
                            fake_ = False
                            for elem in neo_col_hdr_:
                                if xoffset > elem['pts'][0] and xoffset < elem['pts'][2] and y1 > elem['pts'][1] and \
                                        y1 < elem['pts'][-1]:
                                    fake_ = True
                                    break
                            if fake_: break

                            vertical_bounds_.append(xoffset)
                            print('Vertical bounds found within Table HDR = ', xoffset, (y1, y2))

                new_hdr_arr_.append((neo_col_hdr_, nearest_upper_[upper_bounds_[0]][0], \
                                     nearest_lower_[lower_bounds_[0]][0], vertical_bounds_))

            except:
                print(traceback.format_exc())
                vertical_bounds_ = []

            if len(vertical_bounds_) == 0:
                print(' Checking if atleast lower bounds can be used for vertical bounds',
                      nearest_lower_[lower_bounds_[0]][0])
                if len(nearest_lower_) > 0:
                    ub_, lb_ = nearest_lower_[lower_bounds_[0]][0], nearest_lower_[lower_bounds_[0]][0] + 100
                    for xoffset, (y1, y2) in vlines_.items():
                        ## convert LB to UB since UB couldnt be found and just add an imaginary LB below it
                        ## try and find if there are vertical bounds atleast

                        if (y1 >= ub_ or abs(y1 - ub_) <= 20) and y1 < lb_ and \
                                ((y2 <= lb_ or abs(y2 - lb_) <= 20) or (y2 > lb_)):

                            if (len(vertical_bounds_) > 0 and abs(vertical_bounds_[-1] - xoffset) >= 20) or \
                                    len(vertical_bounds_) == 0:
                                vertical_bounds_.append(xoffset)
                                print('Vertical bounds found within Table HDR USING LB ALONE = ', xoffset, (y1, y2))

                    if (len(new_hdr_arr_) > 0 and vertical_bounds_ != new_hdr_arr_[-1][3]) or \
                            len(new_hdr_arr_) == 0:
                        new_hdr_arr_.append((neo_col_hdr_, ub_, lb_, vertical_bounds_))

                else:
                    new_hdr_arr_.append((neo_col_hdr_, None, None, None))

        print('Post balancing ->', new_hdr_arr_)

        ## one more round of stitching
        tmp_hdr_arr_ = []
        idx = 0
        while idx <= len( new_hdr_arr_[0][0] ) - 1:
            print('TOTO->', idx, len( new_hdr_arr_[0][0] ))
            curr, next = new_hdr_arr_[0][0][ idx ] , \
                        new_hdr_arr_[0][0][ min( idx+1, len( new_hdr_arr_[0][0] ) - 1 ) ]

            if idx < len( new_hdr_arr_[0][0] ) - 1:
                '''
                if abs( curr['pts'][2] - next['pts'][0] ) <= 20:
                    stitched_ = curr
                    stitched_['text'] = curr['text'] +' '+ next['text']
                    stitched_['pts'] = [ curr['pts'][0], curr['pts'][1], next['pts'][2], next['pts'][3] ]
                    tmp_hdr_arr_.append( stitched_ )
                    idx += 1
                else:
                    tmp_hdr_arr_.append( curr )
                '''
                tmp_hdr_arr_.append( curr )

            elif idx == len( new_hdr_arr_[0][0] ) - 1:
                    tmp_hdr_arr_.append( curr )

            idx += 1

        print('Post balancing ->', tmp_hdr_arr_)
        new_hdr_arr_ = [ ( tmp_hdr_arr_, new_hdr_arr_[0][1], new_hdr_arr_[0][2], new_hdr_arr_[0][3] ) ]

        colBounds_, anchor_arr_ = findColBounds(new_hdr_arr_, master_stit_json, master_raw_json, vertical_bounds_)
        print('Final Column Bounds->', colBounds_, anchor_arr_)
        colBounds_ = repairIfNeeded( colBounds_, master_raw_json )
        print('POST REPAIR Column Bounds->', colBounds_, new_hdr_arr_)
        firstKey_ = None
        for dd in colBounds_:
          sorted_dd_ = dict( sorted( dd.items(), key= lambda x: x[1][1]['pts'][0] ) )
          keys_ = list( sorted_dd_.keys() )[0]
          print('The first COL = ', sorted_dd_[ keys_ ][1]) 
          firstKey_ = keys_

        if firstKey_ is not None:
          #colBounds_[0][ firstKey_ ] = ( colBounds_[0][ firstKey_ ][0], colBounds_[0][ firstKey_ ][1]['pts' 
          colBounds_[0][ firstKey_ ][1]['pts'][0] = 0 
          print('iREVISED Final Column Bounds->', colBounds_)

        tblEnding = findTableEndCoOrds(colBounds_, new_hdr_arr_, master_stit_json, master_raw_json, vlines, hlines,
                                       pgctr)
        print('Final Tbl ENdings->', tblEnding, colBounds_)

        if tblEnding is None:
            cellInfoMaster_.append([])
            continue

        cellContents_ = findCells(colBounds_, tblEnding, master_raw_json, hlines)

        ## this is where we will need to trigger feedback based on flag - useFeedback
        feedbackColBounds_ = None
        print('Incoming useFeedback (boolean) == ', useFeedback)

        if useFeedback is True:
           try:  
              feedbackColBounds_, feedbackTblEnd_, tableEndSentinel, anchorColName, fb_cell_info = \
                                                               searchAndApplyFeedback( \
                                                                  master_stit_json[ pgctr ],\
                                                                  master_raw_json[ pgctr ], anchor_arr_, doc_type )
           except: 
                print('Search For Signature Failed .. switch back to natural table->', traceback.format_exc())
                pass

        if feedbackColBounds_ is not None:
            print('Replacing Existing cell contents->', cellContents_, tableEndSentinel)
            print('GOGO->', feedbackColBounds_, feedbackTblEnd_)

            cellContents_ = findCells( feedbackColBounds_, feedbackTblEnd_, master_raw_json, \
                                                           hlines, vertical_bounds_='STRICT' )
            colBounds_ = feedbackColBounds_
            feedback_based_last_line = tableEndSentinel
            feedback_anchor_col_ = anchorColName

            print('Post Feedback Replacement->', cellContents_, feedbackColBounds_)
            try:
              addConfidenceScores( fb_cell_info, cellContents_ ) 
            except:
                print('Confidence score EXCPN->', traceback.format_exc())

            replacedWithFeedback = True
            print('GOGO2->', feedbackColBounds_, feedbackTblEnd_)

        ## cleanup
        if len( cellContents_[0] ) > 0:
          try:  
            tmpCellContents_, finD = [], dict()
            for k, v in cellContents_[0].items():
              sum_pts_ = 0
              for colnm, colval in v.items():
                sum_pts_ += sum( colval['pts'] )
            
              if sum_pts_ == 0:
                print('Row #->', k,' is Fake ..ignore ->', v)
              else:
                finD[ len( finD ) ] = v

            cellContents_[0] = finD      
          except:
              print('EXCPN-> while trying to eliminate FP rows with 0 entries')


        cellInfoMaster_.append(cellContents_)

    print('JUDAS PRIEST-> cellInfoMaster_, colBounds_ = ', cellInfoMaster_, colBounds_)

    return cellInfoMaster_, colBounds_, replacedWithFeedback, feedback_based_last_line, feedback_anchor_col_

def addConfidenceScores( fb_cell_info, cellContents_ ):
   
    print('Adding CONFIDENCE')
    ## use tbl_genericPatterns.findMetaProperties for each cell
    ref_cell_info_ = fb_cell_info[0] ## u can take just the first row ..more than sufficient 
    ## now u get an array of dicts of the form {'local_column': 'Material', 'pts': [201, 1800, 540, 1944], 'text': '1025133'}
    curr_cell_info_ = cellContents_[0] #dict of form {0: {'Material': {'text': '', 'pts': [0, 0, 0, 0]}

    for row_num, row_deets_ in curr_cell_info_.items():
      for colNm, colDict in row_deets_.items():
        for refColD in ref_cell_info_:
          if refColD['local_column'] == colNm:
            print('For Col->', colNm, ' Ref Content = ', refColD['text'],' & Local Content = ', colDict['text'] )

            if len( colDict['text'] ) == 0 or len( refColD['text'] ) == 0:
                colDict['confidence_score_'] = 0.0
                continue

            refVec_ = ( tbl_genericPatterns.findMetaProperties( refColD['text'] ) )
            currVec_ = ( tbl_genericPatterns.findMetaProperties( colDict['text'] ) )

            conf_ = ( 1 - distance.cosine( refVec_, currVec_ ) )
            print('The confidence score for this chap->', conf_ )
            colDict['confidence_score_'] = conf_


def findCommonKeys( key_tup1, key_tup2 ):

    respObj_ = []

    print( 'KT1->', key_tup1 )
    print( 'KT2->', key_tup2 )

    for str1, norm1 in key_tup1:
        for str2, norm2 in key_tup2:
            if fuzz.ratio( str1, str2 ) > 80 and distance.cosine( norm1, norm2 ) <= contourDistThresh:
                respObj_.append( ( str1, norm1, str2, norm2 ) )

    print('Total common GKV->', respObj_, len( respObj_ ))
    return len( respObj_ )

def checkSignature( encoded_, key_coord_tup_, doc_type ):

    checkInp = dict()
    checkInp['docSignature'] = encoded_
    print('In checkSignature->', encoded_)
    db_srch_time_ = time.time()

    results_ = tbl_db_utils.searchSignature( checkInp )['searchRes_']

    matching_recs_, closest_match, self_rec, all_matches = [], None, None, dict()
    print('Whats the hit ?-?', time.time() - db_srch_time_, '\n', results_)
    highest_match_score_ , numCommonKeys, signatureMatchThresh = 0, 5, 0.5

    for res_num, res in results_.items():

        score_, db_rec_ = res['score'], res['payload']
        ## 3 stage check begins
        if db_rec_['doc_type'] != doc_type:
            print('DOC TYPE MISMATCH-> db_rec_["doc_type"], doc_type -> ', db_rec_['doc_type'] , doc_type )
            continue

        print('Evaluating in checkSignature INP-> SEARCH_RES->', db_rec_)
        if score_ >= signatureMatchThresh : ## stage 1 pass
            print('STAGE1-> score_, highest_match_score_ == ', res_num, score_, highest_match_score_)
            if findCommonKeys( db_rec_['tupArr'], key_coord_tup_ ) >= numCommonKeys and \
                    score_ > highest_match_score_: ## stage 2 pass
                print('STAGE2 - cleared and adding->', db_rec_['docID'], score_)
                all_matches[ score_ ] = db_rec_

        if score_ > highest_match_score_ and \
                findCommonKeys( db_rec_['tupArr'], key_coord_tup_ ) >= numCommonKeys:
            highest_match_score_ = score_
            print('CURRENT HIGHEST MATCH->', db_rec_['docID'], score_)

    if len( all_matches ) > 0:
      sortedK = sorted( list( all_matches.keys() ), reverse=True )
      neo_matches_ = dict( sorted( all_matches.items(), key=lambda x:x[0], reverse=True ) )
      print('SMOLENK->', neo_matches_)
      first_key_ = list( neo_matches_.keys() )[0]
      newD_ = dict()
      return { first_key_ : neo_matches_[ first_key_ ] } ## no need to send top 3 matches ..just the top matchisgood
      #return all_matches[ sortedK[0] ]

    else:
        return None

def findHdrColFromFeedback( headerColumnsDict, colBoundsArr, anchorColName, _raw_json, tblEnding, anchor_arr_, tblBounds ):

    if type( _raw_json ) is str:
        with open( _raw_json, 'r' ) as fp: rawJS = json.load( fp )
    elif type( _raw_json ) is dict:
        rawJS = _raw_json
    else:
        return None

    ## de-norm data
    wdth, hght = rawJS['width'], rawJS['height']
    # headerColumnsDict - key = col name ; val = norm co_ords
    # colBoundsArr - norm col bounds
    hcd, cbar = dict(), []

    for key, val in headerColumnsDict.items():
        hcd[ key ] = [ int( val[0]*wdth ), int( val[1]*hght ), int( val[2]*wdth ), int( val[3]*hght ) ]

    for elem in colBoundsArr:
        cbar.append( int( elem*wdth ) )

    potential_ = dict()
    for line_idx, line_ in enumerate( rawJS['lines'] ):
        anchor_elems = []

        for wd_idx, wd in enumerate( line_ ):
            for colNm, colCoOrds in hcd.items():
                ## we are looking for 2 exact matches ..ie xoverlap and fuzz match > 90
                if tblDetMultiPage.xOverlap( colNm, colCoOrds, wd['text'], wd['pts'] , 1500 ) and\
                       ( fuzz.ratio( colNm.lower(), wd['text'].lower() ) > 90 or ( len( wd['text'] ) >= 4 and \
                                                                   wd['text'] in colNm ) ):
                           anchor_elems.append( wd )

        if len( anchor_elems ) >= 2:
            print('Potential Anchor ? ',anchor_elems, line_ )
            potential_[ len( anchor_elems ) ] = line_idx

    sorted_potential_ = dict( sorted( potential_.items(), key=lambda x:x[0], reverse=True ) )
    print('Highest match->', sorted_potential_[ list( sorted_potential_.keys() )[0] ], sorted_potential_)

    ## now check if we need to complete names of the col by accessing prev row or next
    anchor_hdr_line_idx_ = sorted_potential_[ list( sorted_potential_.keys() )[0] ]
    hdr_arr_ = [ anchor_hdr_line_idx_ ]

    for len_anch_elem, lineIdx in potential_.items():
        if abs( anchor_hdr_line_idx_ - lineIdx ) == 1: hdr_arr_.append( lineIdx )

    for _, lineidx in potential_.items():
        for elem in hdr_arr_:# and lineidx not in hdr_arr_:
            if abs( elem - lineidx ) == 1 and lineidx not in hdr_arr_: hdr_arr_.append( lineidx )

    hdr_arr_, hdr_cols_ = sorted( hdr_arr_ ), []
    print('The line nums used to stitch ->', hdr_arr_, cbar, colBoundsArr)

    for lineidx in hdr_arr_:
      line_ = rawJS['lines'][lineidx]

      for wd in line_:
          found_ = None
          for idx, elem in enumerate( hdr_cols_ ):
              if tblDetMultiPage.xOverlap( elem['text'], elem['pts'], wd['text'], wd['pts'] ) or \
                      ( abs( elem['pts'][1] - wd['pts'][1] ) <= 10 and \
                        ( abs( elem['pts'][2] - wd['pts'][0] ) <= 10 ) ):
                  found_ = idx
                  break
          
          if found_ is not None:
              hdr_cols_[idx]['text'] += ' ' + wd['text']
              hdr_cols_[idx]['pts'] = [ min( hdr_cols_[idx]['pts'][0], wd['pts'][0] ),\
                                        min( hdr_cols_[idx]['pts'][1], wd['pts'][1] ),\
                                        max( hdr_cols_[idx]['pts'][2], wd['pts'][2] ),\
                                        max( hdr_cols_[idx]['pts'][3], wd['pts'][3] ) ]

          else:
              hdr_cols_.append( wd )

    
    print('post stitch ->', hdr_cols_, '\n', cbar, tblBounds)
    if sum( tblBounds ) > 0:
        cbar.append( tblBounds[0] )
        cbar.append( tblBounds[2] )
    else:
        cbar.append( 0 ) ## basically the bounds of the last line will be from the 0th col 
        cbar.append( 2450 ) ## basically the bounds of the last line will be till the N-1th col 
    ## might not cover the below cbar bound cases since the last bound in cbar will END
    ## just before the last COL ..and hence might miss the ANCHOR col
    cbar.sort()

    ## now see if u can separate cols and join cols based on vertical bounds
    ## then finally compare it with the ref col
    hdr_cols_ , final_hdr_col_ = sorted( hdr_cols_, key=lambda x:x['pts'][0] ), dict()

    for idx, colbound in enumerate( cbar ):
        nxt_, nxt_nxt_ = cbar[ min( idx+1, len( cbar )-1 ) ], cbar[ min( idx+2, len( cbar )-1 ) ]

        print('CHECKING BETWEEN ->', colbound, nxt_)
        for hdr_ in hdr_cols_:
            if colbound < hdr_['pts'][0] and ( nxt_ >= hdr_['pts'][2] or abs( nxt_ - hdr_['pts'][2] ) <= 10\
                    or ( nxt_ >= hdr_['pts'][0] and nxt_ <= hdr_['pts'][2] ) ):
                print('COL->', hdr_, ' Within bounds->', colbound, nxt_)

                neo_ = hdr_.copy()
                neo_['pts'][2] = max( nxt_, hdr_['pts'][2] )
                neo_['pts'][0] = min( colbound, hdr_['pts'][0] )

                if str(colbound)+'_'+str(nxt_) in final_hdr_col_:
                    print('Need to conjoin ->', hdr_,' with ', final_hdr_col_[ str(colbound)+'_'+str(nxt_) ] )
                    final_hdr_col_[ str(colbound)+'_'+str(nxt_) ]['text'] += ' ' + hdr_['text']
                    locpts = final_hdr_col_[ str(colbound)+'_'+str(nxt_) ]['pts']

                    final_hdr_col_[ str(colbound)+'_'+str(nxt_) ]['pts'] = [ min( locpts[0], hdr_['pts'][0] ),\
                            min( locpts[1], hdr_['pts'][1] ), max( locpts[2], hdr_['pts'][2] ),\
                                                              max( locpts[3], hdr_['pts'][3] ) ]

                else:

                    final_hdr_col_[ str(colbound)+'_'+str(nxt_) ] = neo_

            elif colbound < hdr_['pts'][0] and nxt_ > hdr_['pts'][0] and nxt_ < hdr_['pts'][2] \
                    and abs( nxt_ - hdr_['pts'][2] ) >= 10:
                print('COL Most likely joint1 ..need to split->', hdr_)

                section_ = abs( hdr_['pts'][0] - nxt_ )/abs( hdr_['pts'][0] - hdr_['pts'][2] )
                finalIdx = round( section_*len( hdr_['text'].split() ) )
                print('SPLITTER-> section_, finalIdx = ', section_, finalIdx)
                ## nw split them and add into final_hdr_col_
                #neo_, neo2_ = hdr_.copy(), hdr_.copy()
                neo_, neo2_ = dict(), dict()

                neo_['text'] = ' '.join( hdr_['text'].split()[: finalIdx] )
                neo_['pts'] = [ colbound, hdr_['pts'][1], nxt_, hdr_['pts'][3] ]

                final_hdr_col_[ str(colbound)+'_'+str(nxt_) ] = neo_

                neo2_['text'] = ' '.join( hdr_['text'].split()[finalIdx:] )
                neo2_['pts'] = [ nxt_, hdr_['pts'][1], hdr_['pts'][2], hdr_['pts'][3] ]

                final_hdr_col_[ str(nxt_)+'_'+str(neo2_['pts'][2]) ] = neo2_


    print('final stitch ->', final_hdr_col_, tblEnding, hcd)
    ## now check if the cols are mostly match and aligned
    # hcd, final_hdr_col_, rawJS, anchorColName
    if len( final_hdr_col_ ) == len( hcd ) or allLocalMatch( final_hdr_col_, hcd ):
        ## convert hcd to final_hdr_col_ format
        ## but first ensure y1 and y2 are taken from LOCAL
        minY1, maxY2 = 10000, -1
        for key, val in final_hdr_col_.items():
            if val['pts'][1] < minY1: minY1 = val['pts'][1]
            if val['pts'][-1] > maxY2: maxY2 = val['pts'][-1]

        final_hdr_col_ = dict() ## clear this 
        print('Going to replace with HCD-> minY1, maxY2 = ',  minY1, maxY2)
        for colNm, colCoOrds in hcd.items():
            if 'BLANK' in colNm: continue

            final_hdr_col_[ str(colCoOrds[0])+'_'+str(colCoOrds[2]) ] = \
                    { 'text': colNm, 'pts': returnCoOrds( cbar, colCoOrds, minY1, maxY2 ) }

        final_hdr_col_ = dict( sorted( final_hdr_col_.items(), key=lambda x:x[1]['pts'][0] ) )            

        print('STAGE 1 for COL EXTRACTION..now extract anchor row using new final_hdr_col_->', final_hdr_col_,\
                                                                           anchorColName, anchor_arr_ )
        localAnchor , rowAnchor, anchor_value_co_ords_ = None, None, anchor_arr_[0]['pts'] \
                                                                     if len( anchor_arr_ ) > 0 else [0, 0, 0, 0]

        for _, elem in final_hdr_col_.items():
            if fuzz.ratio( anchorColName, elem['text'] ) > 90 or anchorColName in elem['text'] or\
                    elem['text'] in anchorColName or \
                    ( tblDetMultiPage.xOverlap( elem['text'], elem['pts'], 'NA', anchor_value_co_ords_, 1500 )\
                      and elem['pts'][1] < anchor_value_co_ords_[1] ):# or \
                        localAnchor = elem
                        print('Assigned GRINGO->', elem, fuzz.ratio( anchorColName, elem['text'] ),\
                          tblDetMultiPage.xOverlap( elem['text'], elem['pts'], 'NA', anchor_value_co_ords_, 1500 ),\
                          elem['pts'][1] < anchor_value_co_ords_[1] )

        if localAnchor is not None:

            for lineidx, line in enumerate( rawJS['lines'] ):
                for wdidx, wd in enumerate( line ):

                  if tblDetMultiPage.isAnchorRowElem( wd['text'] ) and wd['pts'][1] > localAnchor['pts'][1] and \
                    tblDetMultiPage.xOverlap( wd['text'], wd['pts'], localAnchor['text'], localAnchor['pts'], 1500)\
                    and abs( wd['pts'][2] - localAnchor['pts'][0] ) > 10 \
                    and abs( wd['pts'][1] - localAnchor['pts'][1] ) > 15:
                          if rowAnchor is None:    
                              print('Found local anchor elem->', wd )
                              rowAnchor = wd

        else:
            print('Couldnt find local anchor .. despo trial..')
            ## reserve the last 2 cols and search for anchor elem
            keys_ = list( final_hdr_col_.keys() )
            anchor_arr_ = [ final_hdr_col_[ keys_[len(keys_)-2] ], final_hdr_col_[ keys_[len(keys_)-1] ] ]
            print('Potential despo anchors->', anchor_arr_)
            for localAnchor in anchor_arr_:

              for lineidx, line in enumerate( rawJS['lines'] ):
                for wdidx, wd in enumerate( line ):

                  if tblDetMultiPage.isAnchorRowElem( wd['text'] ) and wd['pts'][1] > localAnchor['pts'][1] and \
                    tblDetMultiPage.xOverlap( wd['text'], wd['pts'], localAnchor['text'], localAnchor['pts'], 1500)\
                    and abs( wd['pts'][2] - localAnchor['pts'][0] ) > 10 \
                    and abs( wd['pts'][1] - localAnchor['pts'][1] ) > 15:
                          if rowAnchor is None:    
                              print('Found local anchor elem->', wd )
                              rowAnchor = wd

            if rowAnchor is None:
              return None, None

        if rowAnchor is not None:
            finalResponse_, maxDist_ = extractFeedbackAnchor( rawJS['lines'], rowAnchor, final_hdr_col_ )
            ## also need to figure out last line and last anchor
            last_line_, lastAnchor = None, rowAnchor
            print('GROWL->', tblEnding)

            for lineidx, line in enumerate( rawJS['lines'] ):
                #tblEnding
                overlap_ctr, fuzz_match = 0, 0
                for wd in line:
                  for endwd in tblEnding:

                    if len( endwd['text'] ) <= 1: continue  

                    if ( tblDetMultiPage.xOverlap( wd['text'], wd['pts'], endwd['text'], endwd['pts'], 1500 ) and\
                          fuzz.ratio( wd['text'], endwd['text'] ) > 90 ) or \
                      ( tblDetMultiPage.xOverlap( wd['text'], wd['pts'], endwd['text'], endwd['pts'], 1500 ) and\
                          fuzz.ratio( wd['text'], endwd['text'] ) > 80 and len( wd['text'].split() ) >= 2 and \
                          ( wd['text'] in endwd['text'] or endwd['text'] in wd['text'] ) ) or \
                      ( tblDetMultiPage.xOverlap( wd['text'], wd['pts'], endwd['text'], endwd['pts'], 1500 ) and\
                      (dataType( wd['text'] ) == dataType( endwd['text'] ) and dataType( endwd['text'] ) != 'TEXT')):

                       overlap_ctr += 1

                       if ( tblDetMultiPage.xOverlap( wd['text'], wd['pts'], endwd['text'], endwd['pts'], 1500 ) and\
                            fuzz.ratio( wd['text'], endwd['text'] ) > 90 ) or \
                          ( tblDetMultiPage.xOverlap( wd['text'], wd['pts'], endwd['text'], endwd['pts'], 1500 ) and\
                            fuzz.ratio( wd['text'], endwd['text'] ) > 80 and len( wd['text'].split() ) >= 2 and \
                            ( wd['text'] in endwd['text'] or endwd['text'] in wd['text'] ) ):
                           fuzz_match += 1
                           print('FUZZ MATCH->', wd['text'], endwd['text'])

                       break


                if overlap_ctr >= 1 and fuzz_match >= 1:
                    print('INANE->', line, tblEnding[-1]['pts'][2] - tblEnding[0]['pts'][0], \
                                           line[-1]['pts'][2] - line[0]['pts'][0])

                if ( overlap_ctr >= 2 and ( abs( len(tblEnding) - overlap_ctr ) <= 2 or overlap_ctr >= 4 ) and \
                        abs( len(tblEnding) - len( line ) ) <=2 and fuzz_match >= 1 ) or \
                        ( overlap_ctr == 1 and fuzz_match == 1 and len( tblEnding ) == len( line ) and \
                           len( line ) == 1 ) or \
                         ( overlap_ctr == 1 and fuzz_match == 1 and textEqual( tblEnding, line ) ):
                    print( 'Lower Anchor found->', rawJS['lines'][lineidx] )
                    last_line_ = lineidx
                    break

            if last_line_ is not None:
                ## between the anchor col and this line Y1 see if thera are any more ahncor ..if so update

                for lineidx, line in enumerate( rawJS['lines'] ):
                    for wd in line:
                      if wd['pts'][-1] < rowAnchor['pts'][1] or \
                              wd['pts'][1] >= rawJS['lines'][last_line_][0]['pts'][1]: 
                          print('Breaking for line->', line)
                          break 
                      print('ANCHOREVAL->', wd)

                      if tblDetMultiPage.xOverlap(rowAnchor['text'], rowAnchor['pts'], wd['text'], wd['pts'], 1500):
                          print('1.Replacing bottom anchor->', lastAnchor,' with ', wd)
                          lastAnchor = wd

                return finalResponse_, [{ 'anchor_col_': rowAnchor, 'last_row_anchor_': lastAnchor, \
                 'last_line': list( sorted( rawJS['lines'][last_line_], key=lambda x:x['pts'][1] ) )[0]['pts'][1] }]

            elif last_line_ is None:

                for lineidx, line in enumerate( rawJS['lines'] ):
                    for wd in line:
                      if wd['pts'][-1] < rowAnchor['pts'][1] : continue  
                      if abs( wd['pts'][1] - lastAnchor['pts'][1] ) > (maxDist_+200): 
                          print('BREAKING AT->', line)
                          break

                      if tblDetMultiPage.xOverlap(rowAnchor['text'], rowAnchor['pts'], wd['text'], wd['pts'], 1500):
                          print('2.Replacing bottom anchor->', lastAnchor,' with ', wd)
                          lastAnchor = wd

                return finalResponse_, [ { 'anchor_col_': rowAnchor, 'last_row_anchor_': lastAnchor } ]

    print('Couldnt find anything ..')
    return None, None

def textEqual( l1, l2 ):
    txt1, txt2 = '', ''
    for elem in l1: txt1 += elem['text']
    for elem in l2: txt2 += elem['text']

    if txt1 == txt2 or fuzz.ratio( txt1, txt2 ) > 90:
        print('In textEqual l1, l2 ->', txt1, txt2, fuzz.ratio( txt1, txt2 ))
        return True

    return False

def returnCoOrds( cbar, colCoOrds, minY, maxY ):
    for idx, elem in enumerate( cbar ):
        nxt_ = cbar[ min( idx+1 , len( cbar )-1 ) ]
        if colCoOrds[2] > elem and colCoOrds[2] < nxt_ and abs( colCoOrds[2] - elem ) >= 20:
            print('JOHN OLIVER->', colCoOrds, elem, nxt_)
            return [ colCoOrds[0], minY, nxt_, maxY ]

    return [ colCoOrds[0], minY, colCoOrds[2], maxY ]    

def allLocalMatch( final_hdr_col_, hcd ):
    ## final_hdr_col_ ( local ) - dict - rand_key, colContour
    ## hcd            ( refer ) - dict - col name, col coords
    ## need to ensure that KEY is in final hdr col or fuzz ratio > 90 AND overlap area > 90
    fuzz_thresh_ , overlap_thresh_ = 75, 0.9

    match_ = 0
    for _, colcontour in final_hdr_col_.items():
        found = False
        for colnm, colcoords in hcd.items():
            #print('DUMM-> colnm, colcontour ->', colnm, colcontour, fuzz.ratio( colnm, colcontour['text'] ))
            if ( fuzz.ratio( colnm, colcontour['text'] ) >= fuzz_thresh_ or colnm in colcontour['text'] \
                    or colcontour['text'] in colnm ) \
                    and overlap( colcoords, colcontour['pts'] ) >= overlap_thresh_:
                        print('local match->', colcontour, colnm )
                        found = True
                        break
            
        if found is True:
            match_ += 1

    print('MOTO-> match_, hcd = ', match_, len( final_hdr_col_ ))
    if match_ == len( final_hdr_col_ ) or abs( match_ - len( final_hdr_col_ ) ) <= 1 or match_ >= 5:
        print('BKP col count matches !!')
        return True

    return False


def extractFeedbackAnchor( lines, rowAnchor, final_hdr_col_ ):

    respD = dict()
    maxY1begin , maxY2end = -1, rowAnchor['pts'][-1]

    for key, val in final_hdr_col_.items():
        if val['pts'][-1] > maxY1begin: maxY1begin = val['pts'][-1]

    for _, hdrcol in final_hdr_col_.items():
        found_ = False
        print('Beginning DRAMA->', hdrcol, maxY1begin, maxY2end)
        for lineidx, line in enumerate( lines ):
            for wd in line:
                if wd['pts'][1] > maxY1begin and wd['pts'][1] < maxY2end and overlap(wd['pts'], hdrcol['pts']) > 0.2\
                   and tblDetMultiPage.xOverlap( wd['text'], wd['pts'], hdrcol['text'], hdrcol['pts'], 1500 ) \
                   and (   abs( wd['pts'][2] - wd['pts'][0] ) <= abs( hdrcol['pts'][2] - hdrcol['pts'][0] ) or\
                         ( abs( ( wd['pts'][2] - wd['pts'][0] ) - ( hdrcol['pts'][2] - hdrcol['pts'][0] ) ) <= 100 ) \
                       ):
                            ## the last IF condition is super critical .. we need to ensure we aren't adding FP
                            ## to the columns anchors simply because we know NOW that these col bounds are coming
                            ## from feedback and we need to take them as gospel truth ..hence we ensure that the 
                            ## the text being added to the hdr col's child is NO BIGGER than the span of the hdr col
                            print('Prepping surgery->', wd, maxY1begin, hdrcol)
                            if hdrcol['text'] in respD:
                                ( elem, coldeets ) = respD[ hdrcol['text'] ]
                                tmp_ = elem.copy()
                                tmp_['text'] += ' ' + wd['text']
                                tmp_['pts'] = [ min( tmp_['pts'][0], wd['pts'][0] ),\
                                        min( tmp_['pts'][1], wd['pts'][1] ),\
                                        max( tmp_['pts'][2], wd['pts'][2] ),\
                                        max( tmp_['pts'][3], wd['pts'][3] ) ]

                                respD[ hdrcol['text'] ] = ( tmp_, hdrcol )
                            else:
                                respD[ hdrcol['text'] ] = ( wd, hdrcol )

                            found_ = True
        
        if found_ is False:
            respD[ hdrcol['text'] ] = ( { 'text': 'NA', 'pts': [0, 0, 0, 0] }, hdrcol )

    print('MAX BEAR->', respD)
    return respD, abs( maxY1begin - maxY2end )

      
def searchAndApplyFeedback( _stit_json, _raw_json, anchor_arr_, doc_type ):

    encoded_, key_coord_tup_ = createJsonFeats.returnJsonFeat( _stit_json,  _raw_json )

    match_rec_arr_ = checkSignature( encoded_, key_coord_tup_, doc_type )

    if match_rec_arr_ is not None:
        for score, match_rec_ in match_rec_arr_.items():

            found_fb_key_ = False
            key_applied_ = True

            headerColumnsDict, colBoundsArr, distanceHdrFirstRow, anchorColName, tableEndSentinel, fb_cell_info = \
                    match_rec_['headerColumnsDict'], match_rec_['colBoundsArr'], match_rec_['distanceHdrFirstRow'],\
                    match_rec_['anchorColName'], match_rec_['tableEndSentinel'], match_rec_['cellInfo']

            if 'tbl_bounds_' in match_rec_:
                tblBounds = match_rec_['tbl_bounds_']
            else:
                tblBounds = [0, 0, 0, 0]

            ## find headers and colbounds
            if anchorColName is None or len( anchorColName ) == 0: anchorColName = 'NOT_RECORDED'
            print('From searchAndApplyFeedback-> anchorColName = ', anchorColName)
            hdrColArr, tblEnd = findHdrColFromFeedback( headerColumnsDict, colBoundsArr, anchorColName,\
                                                   _raw_json, tableEndSentinel, anchor_arr_, tblBounds )

            print('COFFEEZILLA-> tblEnd = ',tblEnd)  
            if hdrColArr is None:
                return None, None, None, None, None

            return [ hdrColArr ], tblEnd, tableEndSentinel, anchorColName, fb_cell_info ## adding arr outside hdrcolarr since we expected a page indexed val

    return None, None, None, None, None


def dataType( txt_ ):

    if len( txt_ ) == 0: return 'NA' 
    numsmall, numcaps, numdigs, special = 0, 0, 0, 0
    for char in txt_:
        if ord(char) >= 48 and ord(char) <= 57: numdigs += 1
        elif ord(char) >= 65 and ord(char) <= 90: numcaps += 1
        elif ord(char) >= 97 and ord(char) <= 122: numsmall += 1
        else: special += 1 ## all special chars go into this bucket


    if len( txt_ ) == 1 and numcaps + numdigs == len( txt_ ): return 'DIGIT'
    if numsmall == 0 and numcaps + numdigs + special == len( txt_ ) and numcaps > 1 and numdigs > 0: return 'ALNUM'
    if numsmall == 0 and numdigs + special + numcaps == len( txt_ ) and numcaps <= 1 and numdigs > 0: return 'DIGIT'
    if ( numsmall > 1 or numdigs == 0 or ( numcaps + special == len( txt_ ) ) ) and len( txt_ ) >= 3: return 'TEXT'
    if numsmall == len( txt_ ): return 'TEXT'
    if numcaps > 1 and numdigs > 1 and numsmall <= 1: return 'ALNUM'
    return 'NA'

def refineCells(extractedCells_):
    tmp_, response_, non_zeros_ = extractedCells_[0][0], [], dict()
    print('ROB ZOMBIE->', tmp_)
    if len(tmp_) == 0: return None

    prevY2 = None
    for rowctr, rowarr in tmp_.items():
        max_elems_in_row_, minY2, maxY2, totalkw, numDigs, minx0 = 0, 100000, -1, False, 0, 100000
        rowkeys_ = list(rowarr.keys())
        for rkctr in range(len(rowkeys_)):
            colhdr, colval = rowkeys_[rkctr], rowarr[rowkeys_[rkctr]]
            if 'description' in colval['text'].lower():
              print('PUB->',colval, rkctr , len(rowkeys_), rowarr[rowkeys_[rkctr + 1]]['text'])  
            # print('JB->', rowarr[ rowkeys_[ rkctr+1 ] ])
            if ( 'total' in colval['text'].lower() or 'description' in colval['text'].lower() ) and\
                    rkctr < len(rowkeys_) - 1 and \
                    tblDetMultiPage.chkNum(rowarr[rowkeys_[rkctr + 1]]['text']):  ## roughly > one third
                print('Whats ging on ?->', rowarr[rowkeys_[rkctr + 1]]['text'], colval['text'])        
                totalkw = True

            if dataType( rowarr[rowkeys_[rkctr ]]['text'] ) in ['DIGIT', 'ALNUM'] and \
                    colval['pts'][0] > 1200:
                numDigs += 1

            if colval['pts'] != [0, 0, 0, 0]: max_elems_in_row_ += 1
            if colval['pts'][-1] < minY2 and colval['pts'] != [0, 0, 0, 0]: minY2 = colval['pts'][-1]
            if colval['pts'][-1] > maxY2 and colval['pts'] != [0, 0, 0, 0]: maxY2 = colval['pts'][-1]
            if colval['pts'][0] < minx0 and colval['pts'] != [0, 0, 0, 0]: minx0 = colval['pts'][0]

        if totalkw is True:
            print('Total KW found in KEY ', rowctr)
            # non_zeros_[ rowctr ] = 0
            break

        if max_elems_in_row_ == 0: continue
        print('BUZU->', rowarr, prevY2, maxY2, max_elems_in_row_)

        if ( max_elems_in_row_ <= 2 and len( non_zeros_ ) > 0 and minx0 > 1000 ) or numDigs == 0: break

        non_zeros_[rowctr] = (max_elems_in_row_, maxY2 if prevY2 is None else abs(prevY2 - minY2))
        if ( prevY2 is not None and abs( prevY2 - maxY2 ) > 300 ) : break

        prevY2 = maxY2

    tmp_resp_ = dict()
    print('JHUM JHUM->', non_zeros_)
    if len(non_zeros_.values()) > 0:
        maxval = sorted((np.asarray(list(non_zeros_.values()))[:, 0]).tolist(), reverse=True)[0]
        print('ROFL->', non_zeros_)
        first_record_found_, prevY = False, None

        tmprwkeys_ = list(tmp_[rowctr].keys())
        for rowctr, (cnt, y2dist) in non_zeros_.items():
            ## the below circus is to ensure that if the distance between 2 "anchor" Y2's or the dist between
            ## min Y1 of next row and min Y1 of prev row < some arbit value ( 800 here )
            if ( y2dist > 500 or (prevY is not None and tmp_[prevY][tmprwkeys_[-1]]['pts'] != [0, 0, 0, 0] and \
                  tmp_[rowctr][tmprwkeys_[-1]]['pts'] != [0, 0, 0, 0] and\
                  abs(tmp_[prevY][tmprwkeys_[-1]]['pts'][1] - tmp_[rowctr][tmprwkeys_[-1]]['pts'][1]) > 800) ) and \
                  first_record_found_:
                print('Ending Table here since ', tmp_[rowctr], ' is quite distant from previous ROW !!', prevY,\
                       tmp_[prevY][tmprwkeys_[-1]]['pts'], tmp_[rowctr][tmprwkeys_[-1]]['pts'] )
                break  ##
            if cnt == 0 or cnt < 0.3 * maxval:  ## num of pop cols < 1/3rd of row with ALL pop cols ..very arbit 40%
                print('Removing record as it looks suspicious->', tmp_[rowctr])
            else:
                tmp_resp_[rowctr] = tmp_[rowctr]
                prevY = rowctr

            first_record_found_ = True

    extractedCells_[0][0] = tmp_resp_

def extractAdditionalDetails( cellInfo, colBounds_ ):

    col_vectors_, row_vectors_, colHeaders_, final_col_vec = dict(), [], dict(), []

    ## first 2 entries for row vectors will be upper and lower bounds for table header
    hdrMinY = 10000
    for hdr_info in colBounds_:
      for hdrname, hdrtuple in hdr_info.items():
          if hdrMinY < hdrtuple[1]['pts'][1] and hdrtuple[1]['pts'][1] > 0: hdrMinY = hdrtuple[1]['pts'][1]

    hdrMaxY = -1
    for hdr_info in colBounds_:
      for hdrname, hdrtuple in hdr_info.items():
        if len( hdrname ) <= 0: continue

        colHeaders_[ hdrname.strip() ] = hdrtuple[1]
        if hdrname.strip() in col_vectors_:
          tup_list = col_vectors_[ hdrname.strip() ]
          ## for a pre existing col hdr, see if the left bound is min ..we need the min left and max RT bound 
          if tup_list[0] > hdrtuple[1]['pts'][0]: tup_list = ( hdrtuple[1]['pts'][0], tup_list[1] )
          if tup_list[1] < hdrtuple[1]['pts'][2]: tup_list = ( tup_list[0], hdrtuple[1]['pts'][2] )
        else:
          tup_list = ( hdrtuple[1]['pts'][0], hdrtuple[1]['pts'][2] )

        col_vectors_[ hdrname.strip() ] = tup_list

        if hdrtuple[1]['pts'][1] < hdrMinY and hdrtuple[1]['pts'][1] > 0: hdrMinY = hdrtuple[1]['pts'][1]
        if hdrtuple[1]['pts'][-1] > hdrMaxY: hdrMaxY = hdrtuple[1]['pts'][-1]

    row_vectors_.append( hdrMinY ) 
    row_vectors_.append( hdrMaxY )

    if type( cellInfo[0] ) is list: cellInfo = [{}]

    for row_num, row_details in cellInfo[0].items():
      #print('extractAdditionalDetails->', row_details )
      minY, maxY = 10000, -1
      for hdrname, values in row_details.items():
        ## we have taken into account hdr cols for col bounds BUT we also need to account for cell items for the same
        if hdrname.strip() in col_vectors_:
          tup_list = col_vectors_[ hdrname.strip() ]
          ## for a pre existing col hdr, see if the left bound is min ..we need the min left and max RT bound 
          if tup_list[0] > values['pts'][0]: tup_list = ( values['pts'][0], tup_list[1] )
          if tup_list[1] < values['pts'][2]: tup_list = ( tup_list[0], values['pts'][2] )
        else:
          tup_list = ( values['pts'][0], values['pts'][2] )

        col_vectors_[ hdrname.strip() ] = tup_list

        ##now try and fund the lower bound of the row_vec
        if values['pts'][-1] > maxY: maxY = values['pts'][-1] 

      row_vectors_.append( maxY ) 

    col_vectors_ = dict( sorted( col_vectors_.items(), key=lambda x: x[1][1] ) )
    ## first find 0th bound and ith bound of cols and then iterate cols to find max X offset -- final_col_vec
    minX, maxX = 10000, -1
    for hdr_name, tup in col_vectors_.items():
      if tup[0] < minX: minX = tup[0]
      if tup[1] > maxX: maxX = tup[1]

    final_col_vec.append( minX )
    print('COLVECS->', col_vectors_, colHeaders_ )
    #colHeaders_ = sorted( colHeaders_, key=lambda x: x['pts'][0] )
       
    for hdr_name, tup in col_vectors_.items():

      if tup[1] in final_col_vec: continue
      final_col_vec.append( tup[1] )

    if maxX not in final_col_vec: final_col_vec.append( maxX )

    return colHeaders_, row_vectors_, final_col_vec

def getNext( metaCol, hdrdeets ):
    # hdrnm , ( hdrdeets, mainDtype ) in metaCol.items
    ll = []
    for hdrnm , ( hdr, mainDtype ) in metaCol.items(): ll.append( hdr )
    ll_ = sorted( ll, key=lambda x:x['pts'][0] )
    store = -1
    for idx, elem in enumerate( ll_ ):
        if elem['pts'] == hdrdeets['pts']:
            store = idx
            break

    if store != -1 and store < len(metaCol)-1: return ll_[store+1]
    return hdrdeets


def checkForHeaderLess( extractedCells_pg0, raw_json_, colHdrs_pg0 ):

    ## first go through all columns in the extracted cells and find out DTypes ( median )
    ## next go through every line of raw json and find the "first line" that xoverlaps with each col header
    ## and also has the same datatype
    ## once u find this line simply modify the Y co-ords of the header extractd in the first page
    ## y2 can be just 50 px above the "first line" and y0 can also be reduced by width of the col hdr..Xs can remain

    # return data type = dict with random key and tuple as values ..0th elem = arr of dicts of col hdrs 
    #                                                             ..1st elem = arr of dicts of anchor items

    metaCol = dict() ## needs to store col nm, col coords, dict of datatype by count
    hdrColStore, pg0_firstRow = [], None

    for hdrnm, ( tmp, hdrdeets ) in colHdrs_pg0[0].items():
        dataTypeMeta = dict()
        hdrColStore.append( hdrdeets )

        for row_num, row_dict in extractedCells_pg0[0][0].items():
            if pg0_firstRow is None : 
                nz_found = False
                for k, v in row_dict.items():
                  if v['pts'][0] != 0:
                      nz_found = True
                      break

                if nz_found is True:
                  pg0_firstRow = row_dict

            for rowKey, rowDeets in row_dict.items():

                if hdrnm == rowKey or hdrnm in rowKey or rowKey in hdrnm:
                    dtype_ = dataType( rowDeets['text'] )

                    if dtype_ in dataTypeMeta:
                        dataTypeMeta[ dtype_ ] += 1
                    else:    
                        dataTypeMeta[ dtype_ ] = 1

        print('For hdr ->', hdrnm, ' meta data ->' , dataTypeMeta, hdrdeets )
        mainDtype = list(dict( sorted( dataTypeMeta.items(), key=lambda x:x[1], reverse=True ) ).keys())[0] \
                if len( dataTypeMeta ) > 0 else 'NA'
        metaCol[ hdrnm ] = ( hdrdeets, mainDtype )                 

    if len( metaCol ) > 0:
        ## now go through the raw json to find first full line of overlap
        print('Pg0 First Row->', pg0_firstRow)
        with open( raw_json_[0], 'r' ) as fp:
            rjs_ = json.load( fp )

        for line_ in rjs_['lines']:
            found = dict()
            for idx, wd in enumerate( line_ ):
                for hdrnm , ( hdrdeets, mainDtype ) in metaCol.items():
                    
                    nxtHdr = getNext( metaCol, hdrdeets )
                    print( wd, hdrdeets, nxtHdr, wd['pts'][2] < nxtHdr['pts'][0], dataType( wd['text'] ),\
                            mainDtype )

                    if ( tblDetMultiPage.xOverlap( wd['text'], wd['pts'], hdrdeets['text'], hdrdeets['pts'], 2000 ) \
                            or ( wd['pts'][2] < nxtHdr['pts'][0] ) ) and\
                      ( dataType( wd['text'] ) == mainDtype or ( \
                        dataType( wd['text'] ) in ['ALNUM', 'DIGIT'] and mainDtype in ['ALNUM', 'DIGIT'] ) ):

                          if hdrnm in found:
                              ll_ = found[ hdrnm ]
                          else:
                              ll_ = []

                          ll_.append( wd )    

                          found[ hdrnm ] = ll_
                          break

                    elif tblDetMultiPage.xOverlap( wd['text'], wd['pts'], hdrdeets['text'], hdrdeets['pts'], 2000 ) \
                            and\
                      dataType( wd['text'] ) != mainDtype:
                          print('BOZO->', hdrnm, hdrdeets, wd, dataType( wd['text'] ), mainDtype)

            print('HEADERLESS SEARCH ->', line_, len( metaCol ), len( found ) )
            print('REF->', metaCol )
            print('CURR->', found )

            ## check if atleast it matches the char of the first row extracted
            matches_first_row_pg0, non_zero_pg0, second_half_digit_match = 0, 0, 0

            if pg0_firstRow is not None:
                print('FRST page->', pg0_firstRow)
                for pg0_hdr, pg0_val in pg0_firstRow.items():

                    if pg0_val['pts'][0] != 0: non_zero_pg0 += 1
                    if pg0_hdr in found:
                        ## now check for data types
                        currtext = ''
                        for wdd in found[ pg0_hdr ]: currtext += ' ' + wdd['text']

                        if dataType( currtext.strip() ) == dataType( pg0_val['text'] ) or ( \
                                              dataType( currtext.strip() ) in ['ALNUM', 'DIGIT'] and\
                                              dataType( pg0_val['text'] ) in ['ALNUM', 'DIGIT'] ): 
                            print('Matched DTYPES for ->', pg0_hdr, found[ pg0_hdr ], ' d1, d2 = ', dataType( currtext ),\
                                    dataType( pg0_val['text'] ), [ currtext ], [ pg0_val['text'] ] )
                            matches_first_row_pg0 += 1

                            if len( found[ pg0_hdr ] ) > 0 and \
                                    found[ pg0_hdr ][0]['pts'][0] > 2000 and \
                                    dataType( currtext.strip() ) == 'DIGIT':
                                second_half_digit_match += 1

            print('First ROW SEARCH->', matches_first_row_pg0, non_zero_pg0, second_half_digit_match)

            if len( metaCol ) == len( found ) or len( found ) == len( metaCol ) - 1 \
                    or ( ( matches_first_row_pg0 == non_zero_pg0 \
                       or ( matches_first_row_pg0 == non_zero_pg0 - 1 and second_half_digit_match >= 1 ) or \
                    ( matches_first_row_pg0 >= non_zero_pg0 - 2 and second_half_digit_match >= 1 and\
                               non_zero_pg0 >= 6 ) or \
                    ( len( metaCol ) >= 6 and len( found ) >= ( len( metaCol ) - 2 ) ) ) and \
                           non_zero_pg0 > 0 ):
                print('Huzzah..First match found !')

                refY2 = line_[0]['pts'][1] - 50 # just take any y0 of "anchor line"
                ##now replace y0, y2 of the hdr cols
                neo_ = []
                for elem in hdrColStore:
                    refY = refY2 - 50
                    #refY = refY2 - ( elem['pts'][-1] - elem['pts'][1] )
                    tmp_ = elem
                    tmp_['pts'][1], tmp_['pts'][-1] = refY, refY2
                    neo_.append( tmp_ )

                respD = dict()
                respD['1'] = ( neo_, line_ ) ## key can be random ..typically it signified line # in the json op, whic in itself is meaningless in the overall scheme of thngs
                print('BRODIE->', respD)
                return respD

def extractUsingFirstPage( firstPgExtractedCells_, firstPgColBounds_, stit_json_, _raw_json, \
                                                    firstPgLastSentinel, firstPgAnchor ):
    ## lets assume that thsi would only be used in case headers are repeated across pages 
    ## if its a headerless table it should be handled by the existin code for headerless applicable to every pg

    if type( _raw_json ) is str:
        with open( _raw_json, 'r' ) as fp: rawJS = json.load( fp )
    elif type( _raw_json ) is list:
        with open( _raw_json[0], 'r' ) as fp: rawJS = json.load( fp )
    elif type( _raw_json ) is dict:
        rawJS = _raw_json

    ## extract "hcd" from firstPgColBounds_
    print('AIM90->', firstPgAnchor)
    hcd , cellExtractionInp, anchor_bkup_ = dict(), dict(), None

    for elem in firstPgColBounds_:
        for colNm, vals in elem.items():
            hcd[ colNm ] = vals[1]['pts']
            cellExtractionInp[ colNm ] = vals

            if colNm == firstPgAnchor: anchor_bkup_ = vals[1]

    potential_ = dict()
    for line_idx, line_ in enumerate( rawJS['lines'] ):
        anchor_elems = []

        for wd_idx, wd in enumerate( line_ ):
            for colNm, colCoOrds in hcd.items():
                ## we are looking for 2 exact matches ..ie xoverlap and fuzz match > 90
                if tblDetMultiPage.xOverlap( colNm, colCoOrds, wd['text'], wd['pts'] , 1500 ) and\
                       ( fuzz.ratio( colNm, wd['text'] ) > 90 or ( len( wd['text'] ) >= 4 and \
                                                                   wd['text'] in colNm ) ):
                           anchor_elems.append( wd )

        if len( anchor_elems ) >= 2:
            print('Potential Anchor ? ',anchor_elems, line_ )
            potential_[ len( anchor_elems ) ] = line_idx

    sorted_potential_ = dict( sorted( potential_.items(), key=lambda x:x[0], reverse=True ) )
    print('Highest match->', sorted_potential_[ list( sorted_potential_.keys() )[0] ], sorted_potential_)

    ## now check if we need to complete names of the col by accessing prev row or next
    anchor_hdr_line_idx_ = sorted_potential_[ list( sorted_potential_.keys() )[0] ]
    hdr_arr_ = [ anchor_hdr_line_idx_ ]

    for len_anch_elem, lineIdx in potential_.items():
        if abs( anchor_hdr_line_idx_ - lineIdx ) == 1: hdr_arr_.append( lineIdx )

    hdr_arr_, hdr_cols_ = sorted( hdr_arr_ ), []
    print('The line nums used to stitch ->', hdr_arr_)
    minY, maxY = 10000, -1

    for elem in hdr_arr_:
        for wd in rawJS['lines'][ elem ]:
            if wd['pts'][1] < minY and wd['pts'][1] > 0: minY = wd['pts'][1]
            if wd['pts'][-1] > maxY: maxY = wd['pts'][-1]

    for key, val in cellExtractionInp.items():
        val[1]['pts'][1] = max( val[1]['pts'][1], minY )

    ## now that we have found the hdr arr, simply replace the y bounds for the col headers and start hunting
    colBounds_local_, hdr_arr_ = dict(), []
    for colNm, colCoOrds in hcd.items():
        ## using max since sometimes the co-ords are [0, 0, 0, 0]
        colBounds_local_[ colNm ] = [ max( minY, colCoOrds[0] ), minY, colCoOrds[2], maxY ] 
        hdr_arr_.append( { 'text': colNm, 'pts': colBounds_local_[ colNm ] } )

    print('Latest COL BOUNDS ->', colBounds_local_)    
    anchor_elem_, final_anch_line_ = findAnchor( rawJS, hdr_arr_ )
    print('Found ANYTHING ??', anchor_elem_, final_anch_line_)
    lastLineFound = findLastRow( firstPgLastSentinel, rawJS )

    ## ensure y1 of anchor bkp isnt 0
    anchor_bkup_['pts'][1] = max( anchor_bkup_['pts'][1], minY )

    if lastLineFound is not None:
        if abs( anchor_elem_['pts'][1] - lastLineFound[0]['pts'][1] ) <= 10: 
            print('Anchor and last line the same .. use hdr col Y2 as upper bound and Y0 of last line')
            tblEnd = [ { 'anchor_col_': anchor_bkup_, 'last_row_anchor_': anchor_elem_ } ]
            print('DADI KHAKHRA->', cellExtractionInp, tblEnd)

            cellContents_ = findCells( [ cellExtractionInp ] , tblEnd, _raw_json, [{}], vertical_bounds_='STRICT' )

            print('DID DADI FIND ANYTHING ?', cellContents_)
            return [ cellContents_ ], [ cellExtractionInp ]

    elif lastLineFound is None and anchor_elem_ is not None:
        ## iterate between hdr and last rw and find the last anchor
        last_anchor_ = None
        for line in rawJS['lines']:
            for wd in line:
                if wd['pts'][1] > maxY and \
                  tblDetMultiPage.xOverlap( wd['text'], wd['pts'], anchor_elem_['text'], anchor_elem_['pts'], 1500 ):
                      last_anchor_ = wd

        if last_anchor_ is not None:

            print('Anchor and last line the same .. use hdr col Y2 as upper bound and Y0 of last line')
            tblEnd = [ { 'anchor_col_': anchor_elem_, 'last_row_anchor_': last_anchor_ } ]
            print('DADI KHAKHRA->', cellExtractionInp, tblEnd)

            cellContents_ = findCells( [ cellExtractionInp ] , tblEnd, _raw_json, [{}], vertical_bounds_='STRICT' )

            print('DID DADI FIND ANYTHING ?', cellContents_)
            return [ cellContents_ ], [ cellExtractionInp ]

    return None, None

def findLastRow( firstPgLastSentinel, rawJS ):

    last_line_ = None

    for lineidx, line in enumerate( rawJS['lines'] ):
        #tblEnding
        if last_line_ is not None: break

        overlap_ctr = 0
        for wd in line:
            for endwd in firstPgLastSentinel:
                if tblDetMultiPage.xOverlap( wd['text'], wd['pts'], endwd['text'], endwd['pts'] ) and\
                    fuzz.ratio( wd['text'], endwd['text'] ) > 90:
                    overlap_ctr += 1
                    break

            if overlap_ctr >= 2 and abs( len( firstPgLastSentinel ) - overlap_ctr ) <=2:
                print( 'Lower Anchor found->', rawJS['lines'][lineidx] )
                last_line_ = lineidx

    if last_line_ is not None:
        return rawJS['lines'][ last_line_ ]

    return None


def lineItemExtraction(master_jpg_list, master_stit_json, master_raw_json, doc_type, debug=False):
    '''
    Entry point to algo
    Input Args: list of jpgs, list of stitched json , list of raw jsons
    Output: Dictionary with 0 indexed page numbers as KEYS and the  cell info as values ..the cell info
            would be a dict with col headers as KEYS and the entity details like values and co-ords
    '''
    starttime_ = time.time()
    response_Master, colBounds_fin_, tblD_mst, vert_mst, hori_mst, output_mst = dict(), None, [], [], [], []
    
    for ctr in range(len(master_jpg_list)):
        print('STARTING with ', master_jpg_list[ ctr ],' in loop for ', master_jpg_list)
        jpg_inp_, stit_json_, raw_json_ = [master_jpg_list[ctr]], [master_stit_json[ctr]], [master_raw_json[ctr]]
            
        output, tblDeets, vert_lines, hori_lines = extract_v2(jpg_inp_, stit_json_, raw_json_)
        print('FIRST APPEARANCE->',tblDeets, output)
        output_mst.append( output )
        tblD_mst.append( tblDeets )
        vert_mst.append( vert_lines )
        hori_mst.append( hori_lines )

    ## check if the # of cols match
    tblhdr_tmp_ = dict()
    print('BARBARIC->', tblD_mst)
    first_pg_of_tbl_ = tblD_mst[0]
    tmpp_ = [ first_pg_of_tbl_ ]

    # now check if all cols are the same
    for ctr in range( 1, len( tblD_mst ) ):
        curr_pg_ = tblD_mst[ ctr ]
        if len( curr_pg_[0][1] ) == 0: continue
        ref_hdr_arr_, curr_hdr_arr_ = first_pg_of_tbl_[0][1][0], curr_pg_[0][1][0]
        
        num_matches_, miny, maxy = [], 10000, -1
        for hdr_elem in curr_hdr_arr_:

            if hdr_elem['pts'][1] < miny: miny = hdr_elem['pts'][1]
            if hdr_elem['pts'][-1] > maxy: maxy = hdr_elem['pts'][-1]
            print('Checking IF->', hdr_elem, ' PART OF ', ref_hdr_arr_)

            for ref_elem in ref_hdr_arr_:
              match_ = False
              for el in hdr_elem['text'].split():
                  if el in ref_elem['text']:
                      match_ = True
                      break
              if match_ and tblDetMultiPage.xOverlap( hdr_elem['text'], hdr_elem['pts'], ref_elem['text'], \
                                                                      ref_elem['pts'], 1500 ):   
                  num_matches_.append( hdr_elem )
                  print('Adding to list coz of matches->', hdr_elem)
        
        if len( num_matches_ ) >= len( curr_hdr_arr_ ):
            print('Pg #',ctr+1, ' has almost same table struct ..normalize ')
            localtemp_ = curr_pg_.copy()
            localref_ln_ = ref_hdr_arr_.copy()
            #for elem in localref_ln_:
            #    elem['pts'] = [ elem['pts'][0], miny, elem['pts'][2], maxy ]

            localtemp_ = [( curr_pg_[0][0], [ localref_ln_ ] )] 
            print('PREV WAS->',curr_pg_[0][1],' UPDATED TO->', [ localref_ln_ ] )
        else:    
            localtemp_ = [( curr_pg_[0][0], curr_pg_[0][1] )] 

        tmpp_.append( localtemp_ )

    print('BARBARIC2->', tmpp_)
    #tblD_mst = tmpp_

    for ctr in range(len(master_jpg_list)):
        print('TBLD2->', tblD_mst[ ctr ][0][1][0] )
        tblhdr_tmp_[ ctr ] = ( tblD_mst[ ctr ][0][1][0] )

    longest_un_ = dict(sorted( tblhdr_tmp_.items(), key=lambda x:len( x[1] ), reverse=True ))
    print( longest_un_ )
    for l,v in longest_un_.items():
        longest_col_hdr_ = v
        break
    neo_tblD_mst_ = dict()

    for ctrkey, val in longest_un_.items():
        currTblHdr = val
        found_, missing, miny1, maxy2 = 0, dict(), 10000, -1

        for innerhdr in longest_col_hdr_:
          missing[ innerhdr['text'] ] = ( False, innerhdr )

          for hdr in currTblHdr:
            if hdr['pts'][1] < miny1: miny1 = hdr['pts'][1]
            if hdr['pts'][-1] > maxy2: maxy2 = hdr['pts'][-1]

            print('MUDHONEY->', hdr['text'] == innerhdr['text'], innerhdr['text'], hdr, innerhdr )
            if hdr['text'] == innerhdr['text'] and \
                  tblDetMultiPage.xOverlap( hdr['text'], hdr['pts'] , innerhdr['text'], innerhdr['pts'], 1000 ):    
                  found_ += 1
                  missing[ innerhdr['text'] ] = ( True, innerhdr )
                  break
       
        print('GOTCHA->', missing)
        if found_ == len( currTblHdr ):
            ## add missing col with X0 and X2 and use top y of the line
            for txt, tup in missing.items():
                if tup[0] is False:
                    print('COL->', tup[1],' Not present in current tbl hdr ..chg y and y2 to ->', miny1, maxy2 )
                    tmp_ = tup[1].copy()
                    tmp_['pts'] = [ tup[1]['pts'][0], miny1, tup[1]['pts'][2], maxy2 ]
                    currTblHdr.append( tmp_ )
           
        sorted_ = sorted( currTblHdr, key=lambda x:x['pts'][0] )  
        neo_tblD_mst_[ ctrkey ] = ( sorted_ ) 


    print('NEO TBL ->', neo_tblD_mst_)
    pg1_deets_, useFirstPgTable, firstPgExtractedCells_, firstPgColBounds_, \
            firstPgLastSentinel, firstPgAnchor, replacedWithFeedback = None ,False, None, None, None, None, False

    for ctr in range(len(master_jpg_list)):
        #print('STARTING with ', master_jpg_list[ ctr ],' in loop for ', master_jpg_list)
        jpg_inp_, stit_json_, raw_json_ = [master_jpg_list[ctr]], [master_stit_json[ctr]], [master_raw_json[ctr]]
            

        try:
          output, tblDeets, vert_lines, hori_lines = output_mst[ ctr ], tblD_mst[ ctr ], vert_mst[ ctr ], \
                                                     hori_mst[ ctr ]
          #output, tblDeets, vert_lines, hori_lines = extract_v2(jpg_inp_, stit_json_, raw_json_)
          print("tblDeets :", tblDeets, jpg_inp_, stit_json_, raw_json_)
          print('STAGE1->', time.time() - starttime_)

          tblDeets[0][1][0] = neo_tblD_mst_[ ctr ] 
          print("tblDeets 2:", tblDeets, jpg_inp_, stit_json_, raw_json_)

          if useFirstPgTable is False:
            extractedCells_, colBounds_, replacedWithFeedback, last_sentinel, feedback_anchor_col_ = \
                                                                   extractLineItems(tblDeets,stit_json_,\
                                                                   raw_json_, vert_lines, hori_lines, doc_type )
          else:
            print('Using first page to extract deets->', raw_json_)
            extractedCells_, colBounds_ = extractUsingFirstPage( firstPgExtractedCells_, \
                                     firstPgColBounds_, stit_json_, raw_json_, firstPgLastSentinel, firstPgAnchor )

            if extractedCells_ is None:
                print('Using continuation didnt work :(')
                extractedCells_, colBounds_, replacedWithFeedback, last_sentinel, feedback_anchor_col_ = \
                                                                        extractLineItems(tblDeets,stit_json_,\
                                                                        raw_json_, vert_lines, hori_lines, doc_type )
              
          if replacedWithFeedback is True:
              useFirstPgTable, firstPgExtractedCells_, firstPgColBounds_, firstPgLastSentinel, firstPgAnchor = True, \
                                                    extractedCells_, colBounds_, last_sentinel, feedback_anchor_col_

          print('Line Item Values Page-> ', ctr + 1, ' Is = ', extractedCells_, colBounds_)

          '''
          BEGIN - HEADERLESS NEXT PAGE CHECK
          '''
          sum_pts_ = 0
          if len( extractedCells_[0][0] ) > 0:
            for k, v in extractedCells_[0][0].items():
                for rowKey, rowDeets in v.items():
                  sum_pts_ += rowDeets['pts'][0] # we can simply sum all the x co-ords and if its non zero we are good else it means that no table was extracted and hence we can check for headerless table

          ## at times there are also FPs detected in the 1st, 2nd pages etc
          if pg1_deets_ is not None and len( extractedCells_[0][0] ) > 0:
              extractedCells_pg0, colHdrs_pg0 = pg1_deets_
              #extract col names
              pg0_cols, currpg_cols, first_row = set(), set(), None

              for k, v in extractedCells_pg0[0][0].items():
                if first_row is None: first_row = v

                for rowKey, rowDeets in v.items():
                    pg0_cols.add( rowKey )

              for k, v in extractedCells_[0][0].items():
                for rowKey, rowDeets in v.items():
                    currpg_cols.add( rowKey )

              num_matches_ = 0

              print('Pg0 cols->', pg0_cols, ' & Curr cols->', currpg_cols)

              for e1 in list( pg0_cols ):
                  if e1 in list( currpg_cols ): num_matches_ += 1

              if num_matches_ <= 2:
                  print('Mostly unmatched col headers..reset curr page col headers to ape first page')
                  sum_pts_ = 0
          
          if sum_pts_ == 0 and pg1_deets_ is not None:
              extractedCells_pg0, colHdrs_pg0 = pg1_deets_
              print('Page #', ctr + 1, ' is prob a continuation..check WITH col hdrs->', colHdrs_pg0)

              pot_hdr_rows_ = checkForHeaderLess( extractedCells_pg0, raw_json_, colHdrs_pg0 )

              if pot_hdr_rows_ is not None:

                  output, tblDeets, vert_lines, hori_lines = extract_v2( jpg_inp_, stit_json_, \
                                                                          raw_json_, pot_hdr_rows_ )

                  print('Headerless TBL DEET extraction->', tblDeets)
                  extractedCells_, colBounds_, _, _, _ = extractLineItems(tblDeets, stit_json_, raw_json_, \
                                                                        vert_lines, hori_lines, doc_type )
                  print('Line Item Values Re-extract-> ', ctr + 1, ' Is = ', extractedCells_, colBounds_)

          '''
          END - HEADERLESS NEXT PAGE CHECK
          '''

          print('STAGE2->', time.time() - starttime_)
          if ctr == 0:
              pg1_deets_ = ( extractedCells_, colBounds_ )

        except:
          response_Master[ctr] = { 'cell_info': [], 'hdr_info': [], 'row_vector': [], 'col_vector': [],\
                                         'table_points': [] }
          print('EXCPN IN extractLineItems->', traceback.format_exc())
          continue

        if colBounds_fin_ is None: colBounds_fin_ = colBounds_

        if len(extractedCells_[0][0]) == 0:
            response_Master[ctr] = { 'cell_info': [], 'hdr_info': [], 'row_vector': [], 'col_vector': [],\
                                         'table_points': [] }
        else:
          try:
            #refineCells(extractedCells_)
            print('PRE HDR->', extractedCells_[0])
            hdr_, row_, col_ = extractAdditionalDetails( extractedCells_[0], colBounds_ )            
            hdr_values_ = list( hdr_.values() )
            colHeaders_ = sorted( hdr_values_, key=lambda x: x['pts'][0] )
            print('The HDR->', colHeaders_, hdr_values_)
            print('ROW VEC->', row_)
            print('COL VEC->', col_)
            print('extractedCells_->', extractedCells_)

            tbltopx0, tbltopx2, tbltopy, tblboty = 10000, -1, 10000, -1

            tbltopy = list( sorted( hdr_values_, key=lambda x:x['pts'][1] ) )[0]['pts'][1]

            for row_ctr, cell_details in extractedCells_[0][0].items():
              row_bottom_ = -1
 
              for colhdr, cellcontents in cell_details.items():
                print('COL->', colhdr, cellcontents)
                if cellcontents['pts'][-1] > tblboty and cellcontents['pts'][2] > 0.3*tbltopx2:
                    tblboty = cellcontents['pts'][-1]
                    print('Updating tblboty->', tblboty)

                if cellcontents['pts'][0] <= tbltopx0 and cellcontents['pts'][0] != 0: 
                    tbltopx0 = cellcontents['pts'][0]   
                if cellcontents['pts'][2] >= tbltopx2: tbltopx2 = cellcontents['pts'][2]   

            for elem in colHeaders_:
                elem['pts'][1] = max( tbltopy, elem['pts'][1] )
                print('ELEM->', elem)

            response_Master[ctr] = { 'cell_info': extractedCells_[0], 'hdr_info': colHeaders_, \
                                     'row_vector': row_, 'col_vector': col_, \
                                      'table_points':[ tbltopx0, tbltopy, tbltopx2, tblboty ],\
                                      'replacedWithFeedback': replacedWithFeedback }
            print( 'AFTER PG#', ctr,' Response->', response_Master)
          except:
            print('Final Populatoin error->', traceback.format_exc())
            response_Master[ctr] = { 'cell_info': [], 'hdr_info': [], 'row_vector': [], 'col_vector': [],\
                                         'table_points': [] }

    print('The final Line Item values->', response_Master, len(response_Master))
    try:
      if len(response_Master[0]) == 0:
          return response_Master
    except:
          return [[]]


    if debug is True:
      try:

        tbltopx0, tbltopx2, tbltopy = 10000, -1, 10000

        for dd in colBounds_fin_:
          for key, val in dd.items():
            if val[1]['pts'][0] < tbltopx0: tbltopx0 = val[1]['pts'][0]
            if val[1]['pts'][2] > tbltopx2: tbltopx2 = val[1]['pts'][2]
            if val[1]['pts'][1] < tbltopy : tbltopy  = val[1]['pts'][1]

        for pg_ctr, infoD in response_Master.items():
        #for pg_ctr, cells_ in response_Master.items():
            cells_ = infoD[ 'cell_info' ]
            img_ = cv2.imread(master_jpg_list[pg_ctr])
            fnm_ = master_jpg_list[pg_ctr].split('/')[-1]

            with open(master_stit_json[pg_ctr], 'r') as fp:
                json_ = json.load(fp)
            rz_wd, rz_ht = json_['width'], json_['height']

            img_ = cv2.resize(img_, (rz_wd, rz_ht), interpolation=cv2.INTER_LINEAR)
            #print("cells_", cells_)
            colBounds_, row_offsets_, \
                               tblbotx0, tblbotx2, tblboty = dict(), [], 10000, -1, -1
            if len(cells_) >= 1:
                for row_ctr, cell_details in cells_[0].items():
                    row_bottom_ = -1
 
                    for colhdr, cellcontents in cell_details.items():
                        print('COL->', colhdr, cellcontents)
                    
                        if cellcontents['pts'][-1] > tblboty: tblboty = cellcontents['pts'][-1]
                        if ( colhdr in colBounds_ and colBounds_[ colhdr ] < cellcontents['pts'][2] ) or\
                           colhdr not in colBounds_:
                          colBounds_[ colhdr ] = cellcontents['pts'][2]

                        if cellcontents['pts'][-1] > row_bottom_: row_bottom_ = cellcontents['pts'][-1]

                    row_offsets_.append( row_bottom_ )

            print('Tbl bounds->', tbltopx0, tbltopx2, tbltopy, tblboty)
            print('COL BOUNDS->', colBounds_)
            print('ROW BOUNDS->', row_offsets_)

            infoD[ 'stitched_ocr' ] = json_

            infoD[ 'tbl_bounds_x_y_x2_y2' ] = [ tbltopx0, tbltopy, tbltopx2, tblboty ] 
            infoD[ 'colBounds_' ] = colBounds_
            infoD[ 'row_offsets_' ] = row_offsets_

            if len( colBounds_ ) > 0 and len( row_offsets_ ) > 0:
              ## draw table bounds
              cv2.rectangle(img_, ( tbltopx0, tbltopy ), ( tbltopx2, tblboty ), (255, 0, 255), 2 )  
              ## draw horizontal lines
              for row_ in row_offsets_:

                cv2.rectangle( img_, ( tbltopx0, row_ ), ( tbltopx2, row_ ), (0, 0, 255), 2 )
              ## draw vertical lines
              for colhdr, xoffset in colBounds_.items():

                cv2.rectangle( img_, ( xoffset, tbltopy ), ( xoffset, tblboty ), (255, 0, 0), 2 )

              cv2.imwrite('IMG_RES/RES_GRID_' + fnm_, img_)

        #print('Final RESPONSE MASTER->', response_Master)
        with open( 'TBL_JSON_MASTER/' + fnm_ + '.json', 'w' ) as fp:
          json.dump( response_Master, fp )

      except:
        print('Debug flag is True and something broke !', traceback.format_exc())

    col_hdr_lens_ = []
    ## prepare empty resp master
    empty_response_Master = dict()
    for ctr in range( len( response_Master ) ):
      empty_response_Master[ctr] = { 'cell_info': [], 'hdr_info': [], 'row_vector': [], 'col_vector': [],\
                                         'table_points': [] }

    try: 

      first_pg_tbl_ = None  
      response_Master = dict( sorted( response_Master.items(), key=lambda x:x[0] ) )

      variance_, existingLen = 0, None
      for pg_ctr, tbl_ in response_Master.items():

        if existingLen is None:  
          col_hdr_lens_.append( len(tbl_['hdr_info']) )
          existingLen = len(tbl_['hdr_info'])

        elif existingLen is not None and len( tbl_['cell_info'] ) > 0 and\
                len( tbl_['cell_info'][0] ) > 0 and len(tbl_['hdr_info']) != existingLen:
          variance_ += 1  

        tbl_['col_vector'] = tbl_['col_vector']


        print( tbl_['hdr_info'] )
        print( tbl_['col_vector'] )
        print('------------------------')
        print( tbl_['cell_info'] )

      if len( col_hdr_lens_ ) > 1 and variance_ > 0:
      #if len( col_hdr_lens_ ) > 1 and np.min( col_hdr_lens_ ) != np.max( col_hdr_lens_ ):
        print('Achtung !! the min and max col lengths are diff ..hence doc has cols of diff lengs->', col_hdr_lens_)
        response_Master = empty_response_Master

    except:  
        print( traceback.format_exc() )
        response_Master = empty_response_Master

    finResp_ = dict()
    for key, val in response_Master.items():

        for dicts_ in val['hdr_info']:
          dicts_['pts'] = list( map( int, dicts_['pts'] ) )

        val['col_vector'] = list( map( int, val['col_vector'] ) )

        if 'table_points' in val and 'hdr_info' in val:
            tbl_pts_ = val['table_points']
            if len( tbl_pts_ ) == 4 and tbl_pts_[-1] != -1 and tbl_pts_[-2] != -1:
                minY0 = 10000
                for elem in val['hdr_info']:
                    if elem['pts'][1] < minY0: minY0 = elem['pts'][1]
                
                if minY0 < tbl_pts_[1]: val['table_points'][1] = minY0

        if ( len( val['cell_info'] ) > 0 and len( val['cell_info'][0] ) == 0 ) or \
                len( val['cell_info'] ) == 0:
                    finResp_[ key ] = val
                    finResp_[ key ]['cell_info'] = [{}]
        else:
            print('GOING IN')
            finResp_[ key ] = val

    return finResp_

if __name__ == '__main__':

    src_folder_raw = '/home/ubuntu/ABHIJEET/INVOICES/REQUORDIT/DEV//ALL_OCR_OUTPUT_ORIGINAL/'
    src_folder_ = '/home/ubuntu/ABHIJEET/INVOICES/REQUORDIT/DEV//ALL_OCR_OUTPUT/'
    img_path_1 = '/home/ubuntu/TBL_DET/UAT_BUGS/data/'
    #img_path_1 = '/home/ubuntu/ABHIJEET/INVOICES/REQUORDIT/DEV//uploads/jpg/'

    import sys , os, time

    ll_ = os.listdir( src_folder_ )
    ctr_ = 0
    fname_ = sys.argv[1]
    pg_nums_ = sys.argv[2].split(',')
    doc_type = sys.argv[3]

    jp, st, raw = {}, {}, {}
    master_jpg_list, master_stit_json, master_raw_json = [], [], []
    start_time_ = time.time()

    for inner in ll_:
      try:

        if 'output' in inner or 'input' in inner or 'global' in inner: continue
        if fname_ not in inner : continue
        print('REL-> fname_, inner == ', fname_, inner)
        idx_ = (inner.split('.json')[0]).split('-')[-1]

        if idx_ in pg_nums_:
          with open( src_folder_+inner, 'r' ) as fp:
            jsn_ = json.load( fp )
          
          print('Checking->', img_path_1 + inner.split('.json')[0], img_path_1 + fname_ )
          if os.path.exists( img_path_1 + inner.split('.json')[0] + '.jpg' ):
            img_fpath = img_path_1 + inner.split('.json')[0] + '.jpg'
          elif os.path.exists( img_path_1 + fname_ + '.jpg' ):
            img_fpath = img_path_1 + fname_ + '.jpg'
          else:
            imm_fnm_arr = inner.split('.json')[0].split('-')
            imm_fnm_ = '-'.join( imm_fnm_arr[:3] ) + '_' + imm_fnm_arr[-1]
            if os.path.exists( img_path_1 + imm_fnm_ + '.jpg' ):
                img_fpath = img_path_1 + imm_fnm_ + '.jpg'
            else:    
                print('IMG ', img_path_1 + imm_fnm_ + '.jpg', ' doesnt exist ..contineu')
                continue

          print("img_path :", img_fpath)
          if '-' in img_fpath.split('/')[-1]:
            jp[ ( img_fpath.split('/')[-1].split('.jpg')[0].split('-')[-1] ) ] = img_fpath
            st[ ( (src_folder_+inner).split('/')[-1].split('.json')[0].split('-')[-1] ) ] = src_folder_+inner
            raw[( (src_folder_raw+inner).split('/')[-1].split('.json')[0].split('-')[-1] )] = src_folder_raw+inner

      except:
        print('Exception for INNER->', inner, ' == ', traceback.format_exc())
        continue

    pg_num_keys_, stkeys, rawkeys = sorted( list( jp.keys() ) ), sorted( list( st.keys() ) ), \
                                      sorted( list( raw.keys() ) )

    for pg_num_ctr in range( len(pg_num_keys_) ):
          master_jpg_list.append( jp[ pg_num_keys_[ pg_num_ctr ] ] )
          master_stit_json.append( st[ stkeys[ pg_num_ctr ] ] )
          master_raw_json.append( raw[ rawkeys[ pg_num_ctr ] ] )

    print( 'JPG LIST->', master_jpg_list, master_stit_json, master_raw_json)

    resp_master_ = lineItemExtraction( master_jpg_list, master_stit_json, master_raw_json, doc_type, debug=True )
    print('Final Rsponse->', resp_master_)
    print('TOtal time->', time.time() - start_time_)

    ctr_ += 1
    #if ctr_ > 10: break
    '''
    resp_master_ = lineItemExtraction(['/home/ubuntu/ABHIJEET/INVOICES/REQUORDIT/DEV/uploads/jpg/TRIPLEA_1.1-0.jpg'],\
                      ['/home/ubuntu/ABHIJEET/INVOICES/REQUORDIT/DEV/ALL_OCR_OUTPUT/TRIPLEA_1.1-0.json'],\
                      ['/home/ubuntu/ABHIJEET/INVOICES/REQUORDIT/DEV/ALL_OCR_OUTPUT_ORIGINAL/TRIPLEA_1.1-0.json'], \
                      debug=True )
    print('Final Rsponse->', resp_master_)
    print('TOtal time->', time.time() - start_time_)
    '''
