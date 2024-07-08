import json, sys, math, cv2, os, time
import numpy as np
time_keeper_ = []

def iou_( item1, item2 ):
  ## vertical area of overlap between 2 contours ..useful to find
  ## to contours one BELOW the other
  item1_x1, item1_x2, item2_x1, item2_x2 = item1['pts'][0], item1['pts'][2],\
                                      item2['pts'][0], item2['pts'][2]

  if ( item1_x1 >= item2_x1 and item1_x2 <= item2_x2 ) or\
    ( item2_x1 >= item1_x1 and item2_x2 <= item1_x2 ): return 100

  if  item1_x1 >= item2_x1 and item1_x2 > item2_x2 and item2_x2 - item1_x1 > 0:
      return (item2_x2 - item1_x1)/min( ( item1_x2 - item1_x1 ), ( item2_x2 - item2_x1 ) )

  if  item2_x1 >= item1_x1 and item2_x2 > item1_x2 and item1_x2 - item2_x1 > 0:
      return (item1_x2 - item2_x1)/min( ( item1_x2 - item1_x1 ), ( item2_x2 - item2_x1 ) )

  return 0

def containsDigit( chars ):
	for ch in chars:
		if ord(ch) >= 48 and ord(ch) <= 57: return True
	return False

def presentInWorldEmbed( wd_, emb_ , child=False):
    ctt = 0
    start_ = time.time()
    ## if we are trying to find a child contour (in a top-bottom pair)
    ## we need to ensure that if the KEY (top contour) IS present 
    ## in word embedding the lower pair gets some liniency 
    if child:
        for ch in wd_:
            if ord(ch) >= 97 and ord(ch) <= 122: ctt += 1
            if '.' == ch or ',' == ch or ' ' == ch or '(' == ch or ')' == ch: ctt += 1

        if len(wd_)/2 <= ctt:
            return False

    ctt = 0
    ## if its in FULL CAPS , ignore embed check since it USUALLY means a VALUE
    for ch in wd_:
        if ord(ch) >= 65 and ord(ch) <= 90: ctt += 1
        if '.' == ch or ',' == ch or ' ' == ch or '(' == ch or ')' == ch: ctt += 1

    if abs( len(wd_) - ctt ) <= 1 and False:
        return False

    arr_ = wd_.lower().split()
    dig_ctr, present_miss = 0, 0
    for inn_ in arr_:
        if containsDigit( inn_ ): dig_ctr += 1
        ret = emb_.get( inn_.lower() , 'NA' )
        if ret != 'NA': present_miss += 1

    if dig_ctr > 0: return False	
    elif dig_ctr == 0 and present_miss > 0: return True	

    time_keeper_.append( time.time() - start_ )

    return False

def verticalBetween( pts , pts_next, vlines ):
	
	for x_off, (y_beg, y_end) in vlines.items():
		if x_off > pts['pts'][2] and x_off < pts_next['pts'][0] and\
		y_beg < pts['pts'][1] and y_end > pts['pts'][-1] and y_end - y_beg > 100 and\
        ":" not in pts["text"] and "-" not in pts["text"]:
			print('Found vertical line between ->', pts , pts_next, x_off, (y_beg, y_end) )
			return True
	return False

def notAdded( curr_cell, LtoRKVPairs ):
	
	for elem in LtoRKVPairs:
		if curr_cell == elem[0] or curr_cell == elem[1]: return False

	return True

def numOrAlphaNum( txt_ ):
    special_chars = [ '_', '-' ]
    alph, dig, spc = 0, 0, 0
    for char in txt_:
        if (ord(char) >=48 and ord(char) <= 57): dig += 1
        if (ord(char) >=65 and ord(char) <= 90): alph += 1
        if (ord(char) in [45, 95]): spc += 1
            
    if abs( alph+dig ) >= len(txt_)/2 and (((dig == 1 and "0" not in txt_) or dig > 1) or spc >= 1): return True
    return False

def returnLtoRKVPairs( finalLineArr_, rescaled_vline, h_scaling, w_scaling, emb_ ):
    '''
    the idea here is to start pairing contours from LEFT TO RIGHT and form KV pairs for pairs where
    the intra pair distance is lower than pair-RIGHT or pair-LEFT
    '''
    LtoRKVPairs = list()
    margin_off_err = 20
    vertical_moe = 50
    maxIntraPairDistance = -1

    for line_ctr in range(len(finalLineArr_)):
        line_ = finalLineArr_[ line_ctr ]
        if len(line_) > 2:
            for cell_ctr in range(len(line_)-2):
                curr_cell, next_cell, nn_cell  = line_[ cell_ctr ], line_[ cell_ctr+1 ],\
                                    line_[ cell_ctr+2 ]
                intra_pair_dist = next_cell['pts'][0] - curr_cell['pts'][2]
                inter_pair_dist = nn_cell['pts'][0] - next_cell['pts'][2]	
                curr_text, next_text, nn_text = curr_cell.get("text"), next_cell.get("text"), nn_cell.get("text")

                vertical_between_pair = verticalBetween( curr_cell, next_cell, rescaled_vline )

                ## at times the intra pair distance between contour 1& 2 is greater than
                ## distance between 2 & 3 BUT its actually a diff contour since theres a 
                ## vertical line between 2 & 3 ..thats what we are checking in the condition
                ## ( intra_pair_dist > inter_pair_dist and vertical_between_pair2 )
                vertical_between_pair2 = verticalBetween( next_cell, nn_cell, rescaled_vline )

                print('KOALA1->', curr_cell, next_cell, nn_cell)
                print('BEAR-> 22 :',intra_pair_dist, inter_pair_dist, vertical_between_pair,\
                    vertical_between_pair2, presentInWorldEmbed( curr_cell['text'], emb_ ),\
                    notAdded( curr_cell, LtoRKVPairs ) )
                print('If 2nd val in pair is ALPHNUM/ NUM then override distance..value =',\
                    numOrAlphaNum( next_cell['text'] ),' For txt ', next_cell['text'] )				

                if ( ( intra_pair_dist < inter_pair_dist and \
                    abs( inter_pair_dist - intra_pair_dist ) > margin_off_err ) or\
                    abs( inter_pair_dist - intra_pair_dist ) <= margin_off_err or\
                    ( intra_pair_dist > inter_pair_dist and vertical_between_pair2 ) or\
                    numOrAlphaNum( next_cell['text'] ) ) and\
                    ( vertical_between_pair is False or \
                    ( vertical_between_pair is True and cell_ctr == 0 ) ):#  and\
                    ## the above condn basically checks for the first pair from L to R
                    ## even if there's a vertical line, its still a pair	
                    print('--------------------------')
                    print('Marking ',curr_cell['text'],' & ',next_cell['text'],' as neighbours')
                    ## KEYS CANT have digits in em ..so the below is to cover for ocr fails
                    ## where DOJ is misread as D0J impacting fuzz matches
                    if '0' in curr_cell['text']:
                        curr_cell['text'] = curr_cell['text'].replace('0','O')

                    LtoRKVPairs.append( (curr_cell, next_cell) )

                    if intra_pair_dist > maxIntraPairDistance:
                        maxIntraPairDistance = intra_pair_dist	
            ## now do the KV pair check for the last 2 since the above range
            ## cuts off at Length - 2
            prev_cell, curr_cell, last_cell = line_[len(line_)-3], line_[len(line_)-2],\
                                line_[len(line_)-1]
            intra_pair_dist = last_cell['pts'][0] - curr_cell['pts'][2]
            inter_pair_dist = curr_cell['pts'][0] - prev_cell['pts'][2]	

            vertical_between_pair = verticalBetween( curr_cell, last_cell, rescaled_vline )
            vertical_between_pair2 = verticalBetween( prev_cell, curr_cell, rescaled_vline )

            print('KOALA2->',prev_cell, curr_cell, last_cell)
            print('BEAR->',intra_pair_dist, inter_pair_dist, vertical_between_pair,\
                presentInWorldEmbed( curr_cell['text'], emb_ ), 
                  ((presentInWorldEmbed( curr_cell['text'], emb_ ) or 
                    presentInWorldEmbed( curr_cell['text'].lower(), emb_ ))
                     and 
                     (not presentInWorldEmbed( last_cell['text'], emb_ ))))
            print("Last Word Embed :", curr_cell['text'], len(emb_), presentInWorldEmbed( curr_cell['text'], emb_ ))
            print('If 2nd val in pair is ALPHNUM/ NUM then override distance..value =',\
                    numOrAlphaNum( last_cell['text'] ),' For txt ', last_cell['text'] )				
            ## the BELOW is for the last 2 contours since the prior loop goes till len - 2
            if ( ( intra_pair_dist < inter_pair_dist and \
                abs( inter_pair_dist - intra_pair_dist ) > margin_off_err ) or\
                abs( inter_pair_dist - intra_pair_dist ) <= margin_off_err or\
                ( intra_pair_dist > inter_pair_dist and vertical_between_pair2 ) or\
                numOrAlphaNum( last_cell['text'] ) )and\
                (vertical_between_pair is False or
                 (
                     (
                         presentInWorldEmbed( curr_cell['text'], emb_ ) or 
                         presentInWorldEmbed( curr_cell['text'].lower(), emb_ )
                     )
                     and 
                     (
                         not presentInWorldEmbed( last_cell['text'], emb_ )
                     )
                 )
                ):# and\
                #notAdded( curr_cell, LtoRKVPairs ):# and presentInWorldEmbed( curr_cell['text'] ) \
                #and not presentInWorldEmbed( next_cell['text'] ):
                    print('--------------------------')
                    print('Marking ',curr_cell['text'],' & ',last_cell['text'],' as neighbours')
                    ## KEYS CANT have digits in em ..so the below is to cover for ocr fails
                    ## where DOJ is misread as D0J impacting fuzz matches
                    if '0' in curr_cell['text']:
                        curr_cell['text'] = curr_cell['text'].replace('0','O')
                    LtoRKVPairs.append( (curr_cell, last_cell) )
                    print("LtoRKVPairs here :", LtoRKVPairs)
                    print( curr_cell['pts'][:2],' ; ', curr_cell['pts'][2:] )

                    if intra_pair_dist > maxIntraPairDistance:
                        maxIntraPairDistance = intra_pair_dist	
        elif len(line_) == 2:
                ## some lines have only 2 contours	
                intra_pair_dist = line_[-1]['pts'][0] - line_[0]['pts'][2]
                print('KOALA3->', line_)
                print('BEAR->',intra_pair_dist, maxIntraPairDistance,\
                    presentInWorldEmbed( line_[0]['text'], emb_ ))
                if ( intra_pair_dist <= maxIntraPairDistance or\
                    abs( intra_pair_dist - maxIntraPairDistance ) < margin_off_err ) or \
                    (maxIntraPairDistance == -1 and intra_pair_dist <= 50) or \
                    presentInWorldEmbed( line_[0]['text'], emb_ ) or\
                    numOrAlphaNum( line_[-1]['text'] ):# and\
                    #presentInWorldEmbed( line_[0]['text'] ) and\
                    #not presentInWorldEmbed( line_[-1]['text'] ):
                    print('--------------------------')
                    print('Marking ',line_[0]['text'],' & ',line_[-1]['text'],' as neighbours')
                    ## KEYS CANT have digits in em ..so the below is to cover for ocr fails
                    ## where DOJ is misread as D0J impacting fuzz matches
                    if '0' in line_[0]['text']:
                        line_[0]['text'] = line_[0]['text'].replace('0','O')
                    LtoRKVPairs.append( ( line_[0], line_[-1] ) )
                    curr_cell, next_cell = line_[0], line_[-1]

                    if intra_pair_dist > maxIntraPairDistance:
                        maxIntraPairDistance = intra_pair_dist	

    print('TIME TAKEN FOR EMBED SRCH->', sum( time_keeper_))					
    return LtoRKVPairs

def findColumnChild( cells_, line_ ):

    for _cell in line_:
        print("IOU here :", cells_["text"], _cell["text"], iou_( _cell, cells_ ))
        if iou_( _cell, cells_ ) > 0.75:
            return True, _cell

    return False, None

def isNotValue( txt, left_to_right_key_values_ ):
	for elem in left_to_right_key_values_:
		if elem[1]['text'] == txt: return False
	return True

def findBox( parent_, rescaled_vline, rescaled_hline ):
	## there should be EITHER 2 vertical lines to 200 offset (x)
	## of 2 hori lines 300 offset (y) or all 4..else return Fail
	## useful to see if we NEED to apply TOP BOTTOM pairing for a certain KEY
	numBounds = 0
	maxdist_bound_lr, maxdist_bound_td = 200, 200
	print('Box bounds for ',parent_)
	for x_off, (y_beg, y_end) in rescaled_vline.items():
		if x_off < parent_['pts'][0] and parent_['pts'][0] - x_off <= maxdist_bound_lr and\
		y_beg < parent_['pts'][1] and y_end > parent_['pts'][3]:
			numBounds += 1
			print('Left bound ', x_off, (y_beg, y_end) )
			break

	for x_off, (y_beg, y_end) in rescaled_vline.items():
		if x_off > parent_['pts'][2] and x_off - parent_['pts'][2] <= maxdist_bound_lr and\
		y_beg < parent_['pts'][1] and y_end > parent_['pts'][3]:
			print('Righ bound ', x_off, (y_beg, y_end) )
			numBounds += 1
			break

	for y_off, (x_beg, x_end) in rescaled_hline.items():
		if y_off < parent_['pts'][1] and parent_['pts'][1] - y_off <= maxdist_bound_td and\
		x_beg <  parent_['pts'][0] and x_end > parent_['pts'][2]:
			numBounds += 1
			print('Top Bound ', y_off, (x_beg, x_end) )
			break

	for y_off, (x_beg, x_end) in rescaled_hline.items():
		if y_off > parent_['pts'][3] and y_off - parent_['pts'][3] <= maxdist_bound_td and\
		x_beg <  parent_['pts'][0] and x_end > parent_['pts'][2]:	
			numBounds += 1
			print('Bottom Bound ', y_off, (x_beg, x_end) )
			break

	print('NUMBOUNDS FOR ',parent_,' = ',numBounds)	
	if numBounds >= 3: return True
	return False

def returnColKVPairs( finalLineArr_, left_to_right_key_values_, h_scaling, w_scaling, \
                        rescaled_vline, rescaled_hline, emb_ ):

    colPairs = []

    for line_ctr in range( len(finalLineArr_)-3 ):
        for cells_ in ( finalLineArr_[line_ctr] ):
            child_ = None	
            for local_ctr in range( line_ctr+1, line_ctr+3 ):
                print("Upper findColumnChild :", cells_, finalLineArr_[ local_ctr ])
                iou_found, child_ = findColumnChild( cells_, finalLineArr_[ local_ctr ] )
                if iou_found:
                    if child_["text"] != None:
                        if presentInWorldEmbed(child_["text"], emb_):
                            iou_found, child_ = False, None
                            continue
                    print("iou_found for :", cells_, finalLineArr_[ local_ctr ])
                    break

            ## if chiild found, then check if there is a vertical box around the "parent"
            ## which is cells_ in this case
            if child_ is not None:
                if findBox( cells_, rescaled_vline, rescaled_hline ) is False and\
                    numOrAlphaNum( child_['text'] ) is False :
                    print('No box found around bozo22->',child_)
                    child_ = None

            if child_ is not None:
                print('Exploring relations between->', cells_,\
                    child_ )
                print( presentInWorldEmbed( cells_['text'], emb_ ), \
                    presentInWorldEmbed( child_['text'] , emb_, True ), \
                    isNotValue( cells_['text'], left_to_right_key_values_ ), \
                    numOrAlphaNum( cells_['text'] ), \
                    cells_['text'])
            else:
                print('Child not found FOR->', cells_)

            if child_ is not None and \
                ( presentInWorldEmbed( cells_['text'], emb_ ) or\
                numOrAlphaNum( child_['text'] )  )and \
                not presentInWorldEmbed( child_['text'] , emb_, True ) and\
                not numOrAlphaNum( cells_['text'] ):# and\
                #isNotValue( cells_['text'], left_to_right_key_values_ ):	
                match_entry_, match_child_ = None, None
                for pair_ in left_to_right_key_values_:
                    if cells_ == pair_[0]:
                        match_entry_ = pair_
                        break
                    if child_ == pair_[0]:
                        match_child_ = pair_[0]
                        break
                if match_entry_ is not None:
                    alt_ = match_entry_[1]['text']		
                    if ( presentInWorldEmbed( alt_, emb_ ) or\
                         numOrAlphaNum( child_['text'] ) ):
                        print('xxxxxxxxxxxxxxxxxxxMarking->', cells_['text'],' & ',\
                            child_['text'],' as TOP BOTTOM PAIR')
                        ## KEYS CANT have digits in em ..so the below is to cover for ocr fails
                        ## where DOJ is misread as D0J impacting fuzz matches
                        if '0' in cells_['text']:
                            cells_['text'] = cells_['text'].replace('0','O')
                        colPairs.append( (cells_, child_) )
                        curr_cell, next_cell = cells_, child_
                        #left_to_right_key_values_.remove( match_entry_ )

                else:
                    print('xxxxxxxxxxxxxxxxxxxxxMarking->', cells_['text'],' & ',\
                            child_['text'],' as TOP BOTTOM PAIR')
                    ## KEYS CANT have digits in em ..so the below is to cover for ocr fails
                    ## where DOJ is misread as D0J impacting fuzz matches
                    if '0' in cells_['text']:
                        cells_['text'] = cells_['text'].replace('0','O')
                    colPairs.append( (cells_, child_) )
                    curr_cell, next_cell = cells_, child_

    print('TIME TAKEN FOR EMBED SRCH->', sum( time_keeper_))					

    return colPairs	

