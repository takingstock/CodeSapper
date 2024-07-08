import numpy as np
import cv2

def iou( pts1, pts2 ):
        if ( pts1[0] > pts2[0] and pts2[2] < pts1[2] and \
			( pts2[2] > pts1[0] ) ):
                print('IOU1')
                return ( abs( pts2[2] - pts1[0] )/( min( pts1[2] - pts1[0], pts2[2] - pts2[0] ) ) )
        if ( pts2[0] > pts1[0] and pts2[2] > pts1[2] and pts2[0] < pts1[2] ):
                print('IOU2.1')
                return ( abs( pts2[0] - pts1[2] )/( min( pts1[2] - pts1[0], pts2[2] - pts2[0] ) ) )
        if ( pts1[0] >= pts2[0] and pts1[2] <= pts2[2] ) :
                print('IOU2')
                return 1
        if ( pts2[0] >= pts1[0] and pts2[2] <= pts1[2] ):
                print('IOU3')
                return 1
        if ( pts2[0] > pts1[0] and pts1[2] > pts2[2] and pts2[0] < pts1[2] ):
                print('IOU4')
                return ( abs( pts2[0] - pts1[2] )/( min( pts1[2] - pts1[0], pts2[2] - pts2[0] ) ) )
        return 0

def isNumericalorAlpha( txt ):
        if len( txt ) <= 1 or txt in ['',' ']: return False
        dig, alph = 0, 0
        txt = txt.replace(' ','')
        for char in txt:
                if ( ord(char) >= 48 and ord(char) <= 57 ) or \
                        '.' == char or ',' == char or '$' == char:# or \
                        #( ord(char) >= 65 and ord(char) <= 90 ):
                        if ord(char) >= 48 and ord(char) <= 57: dig += 1
                        if ord(char) >= 65 and ord(char) <= 90: alph += 1
                        continue
                else:
                        return False

        if dig < 1 : return False
        if '.' in txt:
          arr_ = txt.split('.')
          #if len(arr_[-1]) > 2: return False ## basically to avoid DATE being caught here
          ## since mostly numbers will have only 2 digits after decimal 
        #if dig < 1 or not ( ',' in txt or '.' in txt ) : return False

        return True

def merge( master_ ):
        neo_master_, THRESH = [], 20
        for line_ctr in range(len(master_)):
                line_ = master_[ line_ctr ]
                neo_line_, tmp_, prev_x2 = [], [], None
                for elem_ctr in range(len(line_)):
                        pts_ , txt_ = line_[ elem_ctr ]['pts'], line_[ elem_ctr ]['text']
                        #if prev_x2 is not None and pts_[0] - prev_x2 <= THRESH:
                        #       tmp_.append( line_[ elem_ctr ] )
                        #elif prev_x2 is not None and pts_[0] - prev_x2 > THRESH and len( tmp_ ) > 0:
                        if prev_x2 is not None and pts_[0] - prev_x2 > THRESH and len( tmp_ ) > 0:
                                co_ords_ = [ tmp_[0]['pts'][0], tmp_[0]['pts'][1],\
                                                tmp_[-1]['pts'][2], tmp_[-1]['pts'][3] ]
                                txt_loc = ''
                                for tt in tmp_:
                                        txt_loc += ' '+tt['text']
                                neo_line_.append( {'pts': co_ords_, 'text': txt_loc.strip() } )
                                tmp_ = []
                        #       tmp_.append( line_[ elem_ctr ] )
                        #else:
                        #       tmp_.append( line_[ elem_ctr ] )
                        if line_[ elem_ctr ]['text'] in [ '', ' ' ]: continue
                        tmp_.append( line_[ elem_ctr ] )
                        prev_x2 = pts_[2]

                if len( tmp_ ) > 0:
                        co_ords_ = [ tmp_[0]['pts'][0], tmp_[0]['pts'][1],\
                                                tmp_[-1]['pts'][2], tmp_[-1]['pts'][3] ]
                        txt_loc = ''
                        for tt in tmp_:
                                txt_loc += ' '+tt['text']
                        neo_line_.append( {'pts': co_ords_, 'text': txt_loc.strip() } )

                neo_master_.append( neo_line_ )
                #print('INCOMING->', line_)
                #print('OUTGOING->', neo_line_)
        return neo_master_

def inSync( line1, line2 ):

        if len(line1) > len(line2) : big, small = line1, line2
        elif len(line2) >= len(line1) : big, small = line2, line1
        sync_ctr = 0
        print('SYNC CHECK FOR big, small', big, small)
        small_, big_, already_seen_ = [], [], []
        for elem_big in big:
                for elem_small in small:
                        if iou( elem_small['pts'], elem_big['pts'] ) > 0.5 and \
                           elem_small['text'] not in already_seen_ and \
                           elem_big['text'] not in already_seen_:
                                print('SYNC CHIKAPPA elem_small, elem_big', elem_small, elem_big)
                                sync_ctr += 1
                                small_.append( elem_small )
                                big_.append( elem_big ) 
                                already_seen_.append( elem_small['text'] )
                                already_seen_.append( elem_big['text'] )

        broken_ = False
        for ctr in range(len(small_)):
            if ctr+1 >= len(small_): 
              broken_ = True
              break
            print('LEN->small_, big_,', len(small_), len(big_), ctr )		
            sm1, sm2, big1, big2 = small_[ctr], small_[ctr+1], big_[ctr], big_[ctr+1]
            smdiff, bigdiff = sm2['pts'][0] - sm1['pts'][2], big2['pts'][0] - big1['pts'][2]
            smdiff2, bigdiff2 = sm2['pts'][2] - sm1['pts'][2], big2['pts'][2] - big1['pts'][2]
            print('ROMANCHAK-> sm1, sm2, big1, big2, smdiff, bigdiff, smdiff2, bigdiff2 ', \
                              sm1, sm2, big1, big2, smdiff, bigdiff, smdiff2, bigdiff2 )
            if ( smdiff > bigdiff and ( bigdiff )/smdiff < 0.5 ) and\
                ( smdiff2 > bigdiff2  and ( bigdiff2 )/smdiff2 < 0.5 ) :
              print('FP1')
              sync_ctr -= 1 	  
            elif ( smdiff < bigdiff and ( smdiff)/bigdiff < 0.5 ) and \
                 ( smdiff2 < bigdiff2  and smdiff2/bigdiff2 < 0.5 ):
              print('FP2')
              sync_ctr -= 1 	  
       
        if broken_ is True and len(small_) > 2:
            sm1, sm2, big1, big2 = small_[-2], small_[-1], big_[-2], big_[-1]
            smdiff, bigdiff = sm2['pts'][0] - sm1['pts'][2], big2['pts'][0] - big1['pts'][2]
            print('ROMANCHAK-> sm1, sm2, big1, big2, smdiff, bigdiff', sm1, sm2, big1, big2, smdiff, bigdiff )
            if smdiff > bigdiff and ( bigdiff )/smdiff < 0.5:
              print('FP1')
              sync_ctr -= 1 	  
            elif smdiff < bigdiff and ( smdiff)/bigdiff < 0.5:
              print('FP2')
              sync_ctr -= 1 	  
        print('FINALY SYNC COUNTER->', sync_ctr, len(line1), len( line2 ) )
        if sync_ctr >= 2 and len(line1) >= 2 and len( line2 ) >= 2: return True
        #if abs( sync_ctr - len(small) ) <= 1: return True
        return False

def returnContenders( master_, wd_, ht_ ):

        contenders_, contender_line_, contender_idx, final_matrix_ = [], [], [], []
        for line_ctr in range(len(master_)):
                ## wd_ratio_ is an indicator to the algo to look in some half of the document
                ## so a value of 0.5 would mean, look in the 2nd half of the document (as per x axis / width )
                ## same is the case for ht ratio ..since we want only RIGHT MOST NUMBERS   
                length_, proximity_, wd_ratio_, ht_ratio_ = 0, 0, 0.5, 0.2
                line_ = master_[ line_ctr ]
                found_ = False
                num_digs, dig_lens = 0, 0
                for ele_ctr in range(len(line_)):
                        ##ccheck in 2nd half
                        txt_ = line_[ele_ctr]['text']
                        ## ignore any numbers you get in the first x% of doc since it MIGHT be pin codes!    
                        if line_[ele_ctr]['pts'][1] < ht_*ht_ratio_: continue
                        if line_[ele_ctr]['pts'][0] >= (wd_)*wd_ratio_ : print( line_[ele_ctr] )
	
                        if isNumericalorAlpha( txt_ ) and line_[ele_ctr]['pts'][0] >= (wd_)*wd_ratio_ \
                                and found_ is False:
                                contenders_.append( line_[ele_ctr] )
                                found_ = True
                if found_:
                        contender_line_.append( line_ )
                        contender_idx.append( line_ctr )
                        #retArr[ line_ctr ] += ( num_digs*num_dig_scaling + dig_len_scaling*dig_lens )
        ## 2nd pass to KEEP only right most NUM values
        right_most_x0, rt_most = -1, None
        for elem in contenders_:
          if elem['pts'][0] > right_most_x0: 
            right_most_x0 = elem['pts'][0]
            rt_most = elem

        print( 'RT_MOST->', rt_most, contenders_, contender_idx )
        neo_contender_idx, neo_contender_line_ = [], []
        ## sometimes the right most elem in a line ISNT the rightmost in the document
        ## so some of them might be just 10% more than the threshold of 50-60% of width
        ## while the rest of the RT MOST are at like 80% of the doc width..the below loop removes duds
        for ctr in range(len(contenders_)):
          testi_ = contender_line_[ctr][-1]
          if testi_['pts'][2] < right_most_x0 and \
            ( right_most_x0 - testi_['pts'][2] ) > 20: ## 20 is just a random heuristic number
            print('REMOVING CONTENDER->', contender_line_[ctr], contender_idx[ctr], ctr, len(contender_idx),\
                                               len(contender_line_) )
          else:
            neo_contender_idx.append( contender_idx[ctr] )
            neo_contender_line_.append( contender_line_[ctr] ) 

        print( 'CONTENDERS->', neo_contender_idx, neo_contender_line_ )
        return neo_contender_idx, neo_contender_line_

def containsNumericalorAlpha( txt ):
	num_digs = 0
	num_sp = 0
	for char in txt:
		if ord(char) >= 48 and ord(char) <= 57: num_digs += 1
		if ( char == '.' or char == ',' or char == '(' or char == ')' or char == '-' or char == '%' )\
                               and num_digs > 0 : 
			num_sp += 1

	print( 'BS-> txt, num_digs, num_sp->', txt, num_digs, num_sp )
	if num_digs > num_sp: num_digs += num_sp
	if num_digs <= len(txt)/2 and num_digs <= 2: return False
	else:
		return True

def findHdr( ref_line_ctr, master_ ):
	## the reference line would be one of the contenders with max # of elements in the line
	## now we move UP till we find 
	## A) row / line that has > x/2 IOU match with ref line , where x == total num of elements in the ref line 
	## B) the entire row has NO digits
	## C) also check the prev line for the same condn ..if match then stop there 
	## D) IF NONE found then the first line in contenders becomes the header row 

	potential_hdr_row = []
	for ctr in range( ref_line_ctr, -1, -1 ):
		if len(potential_hdr_row) > 4: break
		curr_line = master_[ ctr ]
		sync_ = inSync( curr_line, master_[ ref_line_ctr ] )
		if sync_ is True:
			line_contains_num = False
			for elem in curr_line:
				if containsNumericalorAlpha( elem['text'] ):
					line_contains_num = True
					print('HDR_LINE CONTAINS NUM->', curr_line)
					break
			if line_contains_num is True: continue
			potential_hdr_row.append( curr_line )

	umuamua = dict()
	for elem in potential_hdr_row:
		if len(elem) in umuamua: continue
		umuamua[ len(elem) ] = elem
	
	keyll = sorted(list(umuamua.keys()), reverse=True)
	neo_row = []
	for kk in keyll: neo_row.append( umuamua[ kk ] )
	## if 2 consequent rows (for e.g. 2 part headers, present, combine
	## for now check just row # 0 and row # 1
	if len(neo_row) >= 2:
		line0, line1 = neo_row[0][0]['pts'], neo_row[1][0]['pts']
		if line0[1] > line1[1] and ( abs( line0[1] - line1[1] ) <= 20 or \
                        abs( line1[-1] - line0[1] ) <= 20 ):
			print('FLIP ORDER OF 0th and 1th :P')
			tmp_ = neo_row[1]
			neo_row[1] = neo_row[0]
			neo_row[0] = tmp_	
	#return potential_hdr_row
	print( 'HDR ROW/S->', neo_row )
	return neo_row

def findSiblingsBelow( _idx, master_ ):

	ref_line_ = master_[_idx]
	for ctr in range( _idx+1, len(master_) ):
		curr_line_ = master_[ ctr ]
		if len( curr_line_ ) != len( ref_line_ ):
			continue
		## now check for all elems IOU match 
		match_ctr = 0
		for inner_ in range(len( ref_line_ )):
			if iou( ref_line_[inner_]['pts'], curr_line_[inner_]['pts'] ) > 0.5:
				match_ctr += 1
		print('SIBLING HUNT; curr_line_, ref_line_, ', curr_line_, ref_line_, match_ctr)
		if match_ctr == len( ref_line_ ):
			print('Found Sibling below ref_line_ ',ref_line_, curr_line_)
			ref_line_ = curr_line_
	return ref_line_ 

def detectTable( master_, wd_, ht_, img_file_ ):
	'''
	input -> 
	master_ : list of all "lines" returned by OCR
	returns ->
	array containing top left x & y and bottom rt x & y	
	'''
	cont_idx_, cont_lines_ = returnContenders( master_, wd_, ht_ )
	ref_line_ = -1
	if len( cont_idx_ ) == 0: return [0, 0, 0, 0]	
	cont_dict_ = dict()
	
	'''
	Contenders are a list of RIGHT Most "contours" that are purely NUMERIC since our assumption
	is that a TABLE is used to represent multiple NUMERIC values. Once we get a list of all such 
	contours, we parse the LINE that these belong to , in order to find the longest "row"
	This row is then used to hunt for the header row , since the assumption is that the header 
	row should have the best IOU for each element of this "longest" row ..capice ?
	'''
	for ctr in range(len(cont_idx_)):
		line_ = master_[ cont_idx_[ctr] ]
		cont_dict_[ len(line_) ] = cont_idx_[ctr]

	key_ll_1 = sorted( list( cont_dict_.keys() )  ,reverse=True)
	ref_line_ = cont_dict_[ key_ll_1[0] ]

	print('Longest Contender->', master_[ ref_line_ ], cont_dict_ )
	hdr_row_ = findHdr( ref_line_, master_ )
	last_row_ = master_[ cont_idx_[-1] ]
	## now find any rows BELOW last_row tgat have 100% IOU match with last_row_
	last_row_ = findSiblingsBelow( cont_idx_[-1], master_ )	

	print('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
	print('HEADER->', hdr_row_)	
	print('FOOTER->', last_row_)	
	if len(hdr_row_) > 0:
		x0, y0, x2, y2 = drawContour( hdr_row_[0], last_row_, img_file_, wd_, ht_, cont_idx_[-1], master_ )
	else:
		x0, y0, x2, y2 = 0, 0, 0, 0
	return [ x0, y0, x2, y2 ]

def drawContour( hdr_row, last_row, img_file_, wd_, ht_, last_row_ctr, master_ ):

	top_left_y = hdr_row[0]['pts'][1]
	bot_y = last_row[-1]['pts'][3]
	
	top_left_x, bot_x = hdr_row[0]['pts'][0], last_row[-1]['pts'][2]
	for ctr in range(last_row_ctr):
		curr_line = master_[ctr]
		for ele in curr_line:
			if ele['pts'][0] < top_left_x: top_left_x = ele['pts'][0]
			if ele['pts'][2] > bot_x: bot_x = ele['pts'][2]
		
	print('CVIING->', img_file_ )  
	##safety
	arr_ = img_file_.split('.jpg')
	img_file_ = arr_[0]+'.jpg'
	try:
		img = cv2.imread( './MEDI/'+img_file_ )
		act_ht, act_wd, _ = img.shape	
		x_scale, y_scale = act_wd/wd_, act_ht/ht_
		print( x_scale, y_scale )
		cv2.rectangle(img, ( int(top_left_x*x_scale),  int(top_left_y*y_scale) ), \
						( int(bot_x*x_scale),  int(bot_y*y_scale) ), (0,0,255), 3)
		cv2.imwrite( './CONTOURS/'+img_file_, img )
	except:
		print('TROUBLE locating image->', img_file_)
	
	return top_left_x, top_left_y, bot_x, bot_y

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
        # for j in range(len(line)):
        #     item = line[j]["text"]
        #     pts1 = line[j]["pts"]  
        pts1 = line[0]["pts"]
        pts2 = all_lines[min(i + 1, length_all - 1)][0]["pts"]
        pts_bool = pts2[1] > pts[3]
        if header:
            print("111111111111111111111111111111111111111111111111111111111111122")
            if (pts1[3] > pts[1]):
                rel_lines.append(line)
                header = False
                found = True
        elif (footer and pts_bool):
            print("2222222222222222222222222222222222222222222222222222222222222233")
            rel_lines.append(line)
            footer = False
            found = False
            return rel_lines
        elif found:
            print("33333333333333333333333333333333333333333333333333333333333333344")
            rel_lines.append(line)
        else:
            pass
    return rel_lines

import json, os

def get_table_output(image_path, ocr_orig_file, flag = 0):
    # ll_ = os.listdir( './TEST/' )
    # ll_ = [image_path]
    ll_ = [ocr_orig_file]
    fname = ll_[0]
    # for fname in ll_:
    #fname = 'Tosh-0'
    #with open('TEST/'+fname+'_data.json', 'r') as fp:
    print('PROCESSING->',fname)

    #if 'NEO' not in fname: continue
    #if '_med' not in fname: continue
    #if '8026_230' in fname and 'json' in fname:
    if 'json' in fname :
      with open(fname, 'r') as fp:
          js_ = json.load( fp )

      ht = js_["height"]
      wd = js_["width"]
            
      master = merge( js_['lines'] )
      if len( fname.split('_') ) > 2: 
        img_name = fname.split('_')[1]+'_'+fname.split('_')[2]
      else:
        img_name = fname.split('_')[0]
      print( detectTable( master, js_['width'], js_['height'], img_name ) )
      table_coords = detectTable( master, js_['width'], js_['height'], img_name )
      if (flag == 2):
        table_coords = [85,
                        1416,
                        2419,
                        # 1700]
                        1973]
      elif (flag == 1):
        table_coords = [
                133,
                735,
                2367,
                1022
            ]
      elif (flag == 101):
        table_coords = [
                200,
                1820,
                2340,
                2410
            ]
      elif (flag == 102):
        table_coords = [
                200,
                1750,
                2340,
                2300
            ]
      elif (flag == 103):
        table_coords = [
                200,
                1730,
                2340,
                2290
            ]
      else:
        pass
      # table_coords = [218, 1311, 1567, 1520]
      # table_coords = [152, 856, 2280, 2948]
      # table_coords = [127, 890, 1645, 1756]
    
      get_rel_lines = get_relevant_lines(table_coords, js_["lines"], True)
      return [get_rel_lines, ht, wd, image_path, table_coords]
      
if __name__ == '__main__':
        import json, os
        ll_ = os.listdir( './TEST/' )
        for fname in ll_:
          #fname = 'Tosh-0'
          #with open('TEST/'+fname+'_data.json', 'r') as fp:
          print('PROCESSING->',fname)

          #if 'NEO' not in fname: continue
          #if '_med' not in fname: continue
          #if '8026_230' in fname and 'json' in fname:
          if 'json' in fname :
            with open('./TEST/'+fname, 'r') as fp:
                js_ = json.load( fp )

            master = merge( js_['lines'] )
            if len( fname.split('_') ) > 2: 
              img_name = fname.split('_')[1]+'_'+fname.split('_')[2]
            else:
              img_name = fname.split('_')[0]
            print( detectTable( master, js_['width'], js_['height'], img_name ) )
