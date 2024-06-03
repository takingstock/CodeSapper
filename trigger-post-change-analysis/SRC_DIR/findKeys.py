import json, sys, random, cv2, traceback
import numpy as np
from scipy.spatial import distance
from sklearn.cluster import KMeans
from collections import Counter

total_feats_ = 11

def xOverlap( val, pts, ref_val, ref_pts, dist_=150 ):
    ## check if anything above or below
    #print( abs( pts[-1] - ref_pts[1] ), pts[0] >= ref_pts[0] and pts[2] <= ref_pts[2], pts, ref_pts )
    if abs( pts[-1] - ref_pts[1] ) <= dist_ or abs( pts[1] - ref_pts[-1] ) <= dist_:
        if ( pts[0] >= ref_pts[0] and pts[2] <= ref_pts[2] ) or \
           ( ref_pts[0] >= pts[0] and ref_pts[2] <= pts[2] ) or \
           ( pts[0] >= ref_pts[0] and pts[0] <= ref_pts[2] ) or \
           ( ref_pts[0] >= pts[0] and ref_pts[0] <= pts[2] ) or \
           ( ref_pts[0] < pts[0] and ref_pts[2] > pts[0] and ref_pts[2] <= pts[2] and ( abs( abs( ref_pts[0] + ref_pts[2] )/2 - ( abs( pts[0] + pts[2] ) )/2 ) )/( min( abs( ref_pts[0] - ref_pts[2]), abs( pts[0] - pts[2] )  )  ) < 0.8 )            or\
           ( pts[0] < ref_pts[0] and pts[2] > ref_pts[0] and pts[2] <= ref_pts[2] and ( abs( abs( ref_pts[0] + ref_pts[2] )/2 - ( abs( pts[0] + pts[2] ) )/2 ) )/( min( abs( ref_pts[0] - ref_pts[2]), abs( pts[0] - pts[2] )  )  ) < 0.8 ):
             #print( val, pts, ' X OVERLAPS with ', ref_val, ref_pts, abs( ref_pts[0] + ref_pts[2]), abs( pts[0] + pts[2] ), abs( ref_pts[0] + ref_pts[2] )/2,  abs( pts[0] + pts[2] )/2, abs( abs( ref_pts[0] + ref_pts[2] )/2 - ( abs( pts[0] + pts[2] ) )/2 )  )
             return True
    return False

def allNum( wd_, mode='NA' ):
  digs, special, illegal, digs2 =0, 0, 0, 0

  arr_ = wd_.split()
  ## fir conjoined DATE 31/12/2003 instead of just 21/12/2004
  if len( arr_ ) > 1 and len( arr_[-1] ) >= 3 and mode == 'NA':
    chk = arr_[-1]
    for char in chk:
      if ord(char) >= 48 and ord(char) <= 57: digs += 1
      if ord(char) >= 65 and ord(char) <= 90: digs2 += 1
      if ord(char) >= 97 and ord(char) <= 122: illegal += 1
      if char in [',','.','$','S','-','/']: special += 1
    if ( digs+digs2+special == len( chk ) and digs >= 1 ) or ( digs >= 4 and illegal <= 4 ): 
      #print('01')
      return True

  digs, special, illegal, digs2 =0, 0, 0, 0
  for char in wd_:
    if ord(char) >= 48 and ord(char) <= 57: digs += 1
    if ord(char) >= 65 and ord(char) <= 90: digs2 += 1
    if char in [',','.','$','S','-','/']: special += 1
    if ord(char) >= 97 and ord(char) <= 122: illegal += 1

  if ( digs+digs2+special == len( wd_ ) and digs >= 2 ) or ( digs >= 4 and illegal <= 4 ):
      #print('02')
      return True
  if mode == 'SPIKE' and ( digs >= 1 or digs+digs2+special == len( wd_ ) ):
      print('03')
      return True

  return False

def euclid( refpts, pts, json_ ):

    ht, wd = json_['height'], json_['width']
    ref_ = [ refpts[0]/wd, refpts[1]/ht, refpts[2]/wd, refpts[3]/ht ]
    pts_ = [ pts[0]/wd, pts[1]/ht, pts[2]/wd, pts[3]/ht ]

    return distance.euclidean( refpts, pts )

def findValFeats( refwd ):

    txt = refwd['text']
    if ':' in txt:
      txt = txt.split(':')[-1]

    numValFeats = 7
    returnFeats = np.zeros(( numValFeats ))

    if len( txt.split() ) < 1: return returnFeats

    if allNum( txt.split()[-1] ) and len( txt.split()[-1] ) >= 4 and not\
      ( ',' in txt or 'box' in txt.lower() ) and not allNum( txt.replace(' ','') ):
      txt = txt.split()[-1]

    digs, caps, small, special, begcaps = 0, 0, 0, 0, 0
    for char in txt:
      if ord(char) >= 48 and ord(char) <= 57: digs += 1
      if ord(char) >= 65 and ord(char) <= 90: caps += 1
      if ord(char) >= 97 and ord(char) <= 122: small += 1
      if char in [',','.','$','S','-','/',' ']: special += 1

    lenwds_ = []
    for wd in txt.split():
      if ord( wd[0] ) >= 65 and ord( wd[0] ) <= 90: begcaps += 1
      lenwds_.append( len(wd) )

    returnFeats[0] = digs
    returnFeats[1] = caps
    returnFeats[2] = small
    returnFeats[3] = len( txt.split() )
    returnFeats[4] = begcaps
    returnFeats[5] = len( txt )
    returnFeats[6] = np.median( lenwds_ )

    return returnFeats

def findWdFeats( refwd ):

    #print('GUAGING->', refwd)
    txt = refwd
    if ':' in txt and len( txt.split(':')[-1] ) > 1:
      txt = txt.split(':')[0]

    returnFeats = np.zeros((6))
    #returnFeats = np.zeros((total_feats_))

    if len( txt.split() ) < 1: return returnFeats
    #if len( txt.split() ) < 1: return returnFeats.tolist() + np.zeros((4)).tolist()

    if allNum( txt.split()[-1] ) and len( txt.split()[-1] ) >= 4 and not\
      ( ',' in txt or 'box' in txt.lower() ):
      txt = txt.split()[-1]

    digs, caps, small, special, begcaps = 0, 0, 0, 0, 0
    for char in txt:
      if ord(char) >= 48 and ord(char) <= 57: digs += 1
      if ord(char) >= 65 and ord(char) <= 90: caps += 1
      if ord(char) >= 97 and ord(char) <= 122: small += 1
      if char in [',','.','$','S','-','/',' ']: special += 1

    lenwds_ = []
    for wd in txt.split():
      if ord( wd[0] ) >= 65 and ord( wd[0] ) <= 90: begcaps += 1
      lenwds_.append( len(wd) )      

    returnFeats[0] = digs
    returnFeats[1] = min( caps, len( txt.split() ) ) if caps > 0 else caps ## dont want to diff KEYs that are in all caps
    returnFeats[2] = small
    returnFeats[3] = len( txt.split() )
    returnFeats[4] = begcaps
    returnFeats[5] = np.median( lenwds_ )

    print('MACADEMIA NUTS ->', txt,' returnFeats ',returnFeats, ' LEN = ', len(returnFeats)) 
    return returnFeats 

def findRaw( ids, json_raw ):

    txtarr, ptsarr = [], []
    consti_ = []

    for id_ in ids:
      for line in json_raw['lines']:
        for wdctr in range( len(line) ):
          wd = line[ wdctr ]
          if wd['id'] == id_:
            consti_.append( wd )

    txt_, pts_ = '', []
    for ctr in range( len(consti_) ):
      wd_ = consti_[ ctr ]
      #print('CHURNING->', wd_, txt_, pts_, ctr, consti_)
      if ctr < len( consti_ ) - 1:
        if abs( wd_['pts'][2] - consti_[ ctr + 1 ]['pts'][0] ) < 30 and len( pts_ ) == 0:
          wdpts = consti_[ ctr + 1 ]['pts']
          txt_, pts_ = wd_['text']+' '+ consti_[ ctr + 1 ]['text'], \
                       [ wd_['pts'][0], wd_['pts'][1], wdpts[2], wdpts[3] ]   
        elif abs( wd_['pts'][2] - consti_[ ctr + 1 ]['pts'][0] ) >= 30 and len( pts_ ) == 0:

          txt_, pts_ = wd_['text'], wd_['pts']  
        elif abs( wd_['pts'][2] - consti_[ ctr + 1 ]['pts'][0] ) < 30 and len( pts_ ) > 0\
          and wd_['text'] not in txt_:

          txt_ += ' ' + wd_['text']
          pts_ = [ pts_[0], pts_[1], wd_['pts'][2], wd_['pts'][3] ] 
        elif abs( wd_['pts'][2] - consti_[ ctr + 1 ]['pts'][0] ) < 30 and len( pts_ ) > 0\
          and wd_['text'] in txt_ and consti_[ ctr + 1 ]['text'] not in txt_:

          txt_ += ' ' + consti_[ ctr + 1 ]['text']
          pts_ = [ pts_[0], pts_[1], consti_[ ctr + 1 ]['pts'][2], consti_[ ctr + 1 ]['pts'][3] ] 
        elif abs( wd_['pts'][2] - consti_[ ctr + 1 ]['pts'][0] ) >= 30 and len( pts_ ) > 0:

          txtarr.append( txt_ )
          ptsarr.append( pts_ )
          txt_, pts_ = '', []
          #txt_, pts_ = wd_['text'], wd_['pts']  

      elif ctr >= len( consti_ ) - 1 and len( pts_ ) > 0 and wd_['text'] not in txt_:

          txt_ += ' ' + wd_['text']
          pts_ = [ pts_[0], pts_[1], wd_['pts'][2], wd_['pts'][3] ] 

      elif ctr >= len( consti_ ) - 1 and len( pts_ ) == 0:

          txt_, pts_ = wd_['text'], wd_['pts']  

    if len( pts_ ) > 0:
          txtarr.append( txt_ )
          ptsarr.append( pts_ )
     
    return txtarr, ptsarr 

def featNum( txt ):

    digs, caps, small, special = 0, 0, 0, 0
    for char in txt:
      if ord(char) >= 48 and ord(char) <= 57: digs += 1
      if ord(char) >= 65 and ord(char) <= 90: caps += 1
      if ord(char) >= 97 and ord(char) <= 122: small += 1
      if char in [',','.','$','-','/',' ',":"]: special += 1

    if '.0' in txt and digs == 1 and caps > 0 and special > 0: digs = 0
    #print( 'DESPO->', txt, ' digs, caps, special, small = ',digs, caps, special, small)
    if digs+special == len(txt) and digs > 0: return 1 # num
    if digs+caps+special == len(txt) and digs > 0 and not ( digs == 1 and '0' in txt and caps >=3 ): return 2 # alnum
    if digs+caps+special+small == len(txt) and digs > 0 and caps > 0 and not ( digs == 1 and '0' in txt and caps >= 3 ): return 2
    if digs+caps+special+small == len(txt) and digs >=4 : return 2
    if caps+special+small == len(txt) and digs == 0 and small > 0: return 3 # mixed str
    if special+small == len(txt) and digs == 0 and small > 0: return 4 # small cap
    if special+caps == len(txt) and digs == 0: return 5 # large cap

    return 3 # default val

def findNeighBour( ref_wd_ctr, lctr, json_, ref_txt, ref_pts ):

    ## look right 
    curr_wd = {'text': ref_txt, 'pts': ref_pts}

    for rt_wd_ctr in range( ref_wd_ctr, len( json_['lines'][lctr]) ):
      rt_wd = json_['lines'][lctr][rt_wd_ctr]

      if curr_wd['pts'][0] < rt_wd['pts'][0] and len( rt_wd['text'] ) > 1:

        currtype, nexttype = featNum( curr_wd['text'] ), featNum( rt_wd['text'] )  
        print( 'CHECKOUT-> curr_wd, rt_wd ', curr_wd, rt_wd, currtype, nexttype )
        if currtype in [ 3,5 ] and nexttype in [ 1, 2, 5 ] and currtype != nexttype:
          #print('RT NEIGH IS DIFF!!')
          return ( True, nexttype, rt_wd, findValFeats( rt_wd  ) )

        break

    ## in cases like Date: June 17, 2022 which come as one word ?
    if ':' in curr_wd['text'] and allNum( curr_wd['text'].split(':')[-1] ):
      #print('POSSIBLE MONSIEUR->', curr_wd['text'])
      
      neokey_ = curr_wd['text'].split(':')[0]
      neowd_ = { 'text': curr_wd['text'].split(':')[-1], 'pts': curr_wd['pts'] }
      currtype, nexttype = featNum( neokey_ ), featNum( neowd_['text'] ) 

      if currtype in [ 3,5 ] and nexttype in [ 1, 2, 5 ] and currtype != nexttype:
          #print('RT SPLIT NEIGH IS DIFF!!')
          return ( True, nexttype, neowd_, findValFeats( neowd_  ), neokey_ )


    if len( curr_wd['text'].split() ) > 1:
            tmp_arr_ = curr_wd['text'].split()
            #print('POSSIBLE MONSIEUR->', curr_wd['text'], len( tmp_arr_[-1] ), allNum( tmp_arr_[-1] ) )
            if len( tmp_arr_[-1] ) >= 3 and allNum( tmp_arr_[-1] ):
              txt1 = tmp_arr_[-1] 
              lt_neigh = ' '.join( tmp_arr_[:-1] )
      
              neokey_ = lt_neigh
              neowd_ = { 'text': tmp_arr_[-1], 'pts': curr_wd['pts'] }
              currtype, nexttype = featNum( neokey_ ), featNum( neowd_['text'] ) 

              if currtype in [ 3,5 ] and nexttype in [ 1, 2, 5 ] and currtype != nexttype:
                #print('RT SPLIT NEIGH IS DIFF!!')
                return ( True, nexttype, neowd_, findValFeats( neowd_  ), neokey_ )

    ## look below
    unsuitable_x_overlap = False
    for ctr in range( min( lctr + 1, len( json_['lines'] )-1 ), min( lctr + 4, len( json_['lines'] )-1 ) ):
      curr_line ,line_ = json_['lines'][lctr], json_['lines'][ctr]
      #print('ARRGHH BOTTOM FEEDERS!->', curr_line, line_)
      anyXfound_ = False
      for wd in curr_line:
        for nxtlinewd in line_:
          if wd['pts'] == curr_wd['pts']: continue 
          if xOverlap( nxtlinewd['text'], nxtlinewd['pts'], wd['text'], wd['pts'] ): 
            anyXfound_ = True
            #print('anyXfound_ is TRUE !! ', nxtlinewd, wd)
       
      for nxtlinewd in line_:
        if xOverlap( nxtlinewd['text'], nxtlinewd['pts'], curr_wd['text'], curr_wd['pts'] ):
          currtype, nexttype = featNum( curr_wd['text'] ), featNum( nxtlinewd['text'] )

          #print('CHECKOUT-> curr_wd, bot_wd ', curr_wd, nxtlinewd, currtype, nexttype )
          if currtype in [ 3,5 ] and nexttype in [ 1, 2, 5 ] and currtype != nexttype:
            #print('BOTTOM NEIGH IS DIFF!!')
            return ( True, nexttype, nxtlinewd, findValFeats( nxtlinewd ) )
          else:
            unsuitable_x_overlap = True

      ## if no xoverlap found in next line DONT assume we need to move to next + 1 .. sometimes the value below
      ## the key is absent and we SHOULD NOT pick value from next+1 ..hence we check if the next line has ANY
      ## content that xOVERLAPS with the current line ..if so then we break
      if unsuitable_x_overlap: 
      #if anyXfound_:
        #print('Nothing found TO THE RT or BELOW ->', ref_wd_ctr)
        return False, None 
          
    return False, None

def findValNeighBour( ref_wd_ctr, lctr, json_ ):

    ## look left
    
    curr_wd = json_['lines'][lctr][ref_wd_ctr]

    for lt_wd_ctr in range( max( 0, ref_wd_ctr-1 ), -1, -1 ):
      lt_wd = json_['lines'][lctr][lt_wd_ctr]
      #print('LEFT NEIGH FOR->', curr_wd)

      if curr_wd['pts'][0] > lt_wd['pts'][0] and len( lt_wd['text'] ) > 1:

        currtype, nexttype = featNum( curr_wd['text'] ), featNum( lt_wd['text'] )  
        print( 'CHECKOUT-> curr_wd, lt_wd ', curr_wd, lt_wd, currtype, nexttype )
        if currtype in [ 1,2 ] and nexttype in [ 3, 5 ] and currtype != nexttype:
          print('LT NEIGH IS DIFF!!')
          return ( True, nexttype, lt_wd, findValFeats( lt_wd  ) )

        break

    ## look above
    unsuitable_x_overlap = False
    for ctr in range( max( lctr - 1 , 0 ), max( lctr - 4, 0 ), -1 ):
      curr_line ,line_ = json_['lines'][lctr], json_['lines'][ctr]
      print('ARRGHH TOP FEEDERS!->', curr_line, line_)
      anyXfound_ = False
      for wd in curr_line:
        for nxtlinewd in line_:
          if wd['pts'] == curr_wd['pts']: continue 
          if xOverlap( nxtlinewd['text'], nxtlinewd['pts'], wd['text'], wd['pts'] ): 
            anyXfound_ = True
            print('anyXfound_ is TRUE !! ', nxtlinewd, wd)
       
      for nxtlinewd in line_:
        if xOverlap( nxtlinewd['text'], nxtlinewd['pts'], curr_wd['text'], curr_wd['pts'] ):
          currtype, nexttype = featNum( curr_wd['text'] ), featNum( nxtlinewd['text'] )

          print('CHECKOUT-> curr_wd, bot_wd ', curr_wd, nxtlinewd, currtype, nexttype )
          if currtype in [ 1,2 ] and nexttype in [ 3, 5 ] and currtype != nexttype:
            print('BOTTOM NEIGH IS DIFF!!')
            return ( True, nexttype, nxtlinewd, findValFeats( nxtlinewd ) )
          else:
            unsuitable_x_overlap = True

      ## if no xoverlap found in next line DONT assume we need to move to next + 1 .. sometimes the value below
      ## the key is absent and we SHOULD NOT pick value from next+1 ..hence we check if the next line has ANY
      ## content that xOVERLAPS with the current line ..if so then we break
      if unsuitable_x_overlap: 
      #if anyXfound_:
        print('Nothing found TO THE RT or BELOW ->', ref_wd_ctr)
        return False, None 
          
    return False, None

def neighContours( txt_, pts_, json_, conj_lt=None, conj_rt=None ):
    ## 3 neigh in either dirn
    upper_neigh, lower_neigh, left_neigh, rt_neigh = 3, 3, 3, 3

    x_vertical, y_horizontal = np.zeros((6, ( upper_neigh + lower_neigh ))), np.zeros((6, ( left_neigh + rt_neigh )))
    #TOP
    xover_upper, xover_lower, yover_prev, yover_next = dict() ,dict(), dict(), dict()
    print('NEIGHH->', txt_, pts_, conj_lt, conj_rt)

    for linectr in range( len( json_['lines'] ) ):
      line_ = json_['lines'][linectr]
      
      for wdctr in range( len(line_) ):
        txt1, pts1 = line_[ wdctr ]['text'], line_[ wdctr ]['pts']
        if xOverlap( txt1, pts1, 'NA', pts_, dist_=1000 ) and pts1[1] < pts_[1] and abs( pts1[1] - pts_[1]) > 10: 
          xover_upper[ pts1[1] ] = ( txt1, pts1 )
        elif xOverlap( txt1, pts1, 'NA', pts_, dist_=1000 ) and pts1[1] > pts_[1] and abs( pts1[1] - pts_[1]) > 10: 
          xover_lower[ pts1[1] ] = ( txt1, pts1 )
        elif abs( pts_[1] - pts1[1] ) < 20 and pts1[0] > pts_[2] and abs( pts1[0] - pts_[2] ) <= 900: 
          yover_next[ pts1[0] ] = ( txt1, pts1 )
          print('Adding HOR_NEXT->', ( txt1, pts1 ))
        elif abs( pts_[1] - pts1[1] ) < 20 and pts1[2] < pts_[0] and abs( pts1[2] - pts_[0] ) <= 900: 
          yover_prev[ pts1[0] ] = ( txt1, pts1 )
          print('Adding HOR_PREV->', ( txt1, pts1 ))

    if len( xover_upper ) > 0:
      rev_ = sorted( list( xover_upper.keys() ), reverse=True )
      for ctr in range( min( upper_neigh, len(rev_) ) ):
        x_vertical[ ctr ] = findWdFeats( xover_upper[ rev_[ctr] ][0] ).tolist()  

    if len( xover_lower ) > 0:
      rev_ = sorted( list( xover_lower.keys() ) )
      for ctr in range( min( lower_neigh, len(rev_) ) ):
        x_vertical[ ctr+lower_neigh ] = findWdFeats( xover_lower[ rev_[ctr] ][0] ).tolist()  

    if len( yover_prev ) > 0:
      rev_ = sorted( list( yover_prev.keys() ), reverse=True )
      for ctr in range( min( left_neigh, len(rev_) ) ):
        y_horizontal[ ctr ] = findWdFeats( yover_prev[ rev_[ctr] ][0] ).tolist()  
        print('ANACONDA-LT-HOR->', ctr, y_horizontal[ ctr ])

    if len( yover_next ) > 0:
      rev_ = sorted( list( yover_next.keys() ) )
      for ctr in range( min( rt_neigh, len(rev_) ) ):
        y_horizontal[ ctr+rt_neigh ] = findWdFeats( yover_next[ rev_[ctr] ][0] ).tolist()  
        print('ANACONDA-RT-HOR->', ctr, y_horizontal[ ctr+rt_neigh ])

    return x_vertical.tolist(), y_horizontal.tolist()

def neighContours_old( txt_, pts_, json_, conj_lt=None, conj_rt=None ):

    xover_upper, xover_lower, yover_prev, yover_next = dict() ,dict(), dict(), dict()
    print('NEIGHH->', txt_, pts_, conj_lt, conj_rt)

    for linectr in range( len( json_['lines'] ) ):
      line_ = json_['lines'][linectr]
      
      for wdctr in range( len(line_) ):
        txt1, pts1 = line_[ wdctr ]['text'], line_[ wdctr ]['pts']
        if xOverlap( txt1, pts1, 'NA', pts_, dist_=1500 ) and pts1[1] < pts_[1] and abs( pts1[1] - pts_[1]) > 10: 
          xover_upper[ pts1[1] ] = ( txt1, pts1 )
        elif xOverlap( txt1, pts1, 'NA', pts_, dist_=1500 ) and pts1[1] > pts_[1] and abs( pts1[1] - pts_[1]) > 10: 
          xover_lower[ pts1[1] ] = ( txt1, pts1 )
        elif abs( pts_[1] - pts1[1] ) <= 10 and pts1[0] > pts_[2] and abs( pts1[0] - pts_[2] ) <= 700: 
          yover_next[ pts1[0] ] = ( txt1, pts1 )
        elif abs( pts_[1] - pts1[1] ) <= 10 and pts1[2] < pts_[0] and abs( pts1[2] - pts_[0] ) <= 700: 
          yover_prev[ pts1[0] ] = ( txt1, pts1 )

    #findWdFeats
    respFeat_ = np.zeros((6*4)) 
    if len( xover_upper ) > 0:
      key_ = sorted( list( xover_upper.keys() ) )[-1]
      print('Nearest TOP X->', xover_upper[ key_ ], txt_, pts_ ) 
      respFeat_[0:6] = findWdFeats( xover_upper[ key_ ][0] ).tolist()

    if len( xover_lower ) > 0:
      key_ = sorted( list( xover_lower.keys() ) )[0]
      print('Nearest BOTTOM X->', xover_lower[ key_ ], txt_, pts_ ) 
      respFeat_[6:12] = findWdFeats( xover_lower[ key_ ][0] ).tolist()

    if len( yover_next ) > 0:
      key_ = sorted( list( yover_next.keys() ) )[0]
      print('Nearest RT Y->', yover_next[ key_ ], txt_, pts_ ) 
      if conj_rt is None:
        respFeat_[12:18] = findWdFeats( yover_next[ key_ ][0] ).tolist()
      else:
        respFeat_[12:18] = findWdFeats( conj_rt ).tolist()

    if len( yover_prev ) > 0:
      key_ = sorted( list( yover_prev.keys() ) )[-1]
      print('Nearest LT Y->', yover_prev[ key_ ], txt_, pts_ ) 
      if conj_lt is None:
        respFeat_[18:24] = findWdFeats( yover_prev[ key_ ][0] ).tolist()
      else:
        respFeat_[12:18] = findWdFeats( conj_lt ).tolist()

    return respFeat_.tolist()

def isNum( txt ):
    for char in txt:
        if ord(char) >= 48 and ord(char) <= 57: return True
    return False    

def processNeighbours( json_, json_raw, fileNm ):

    neighDict_txt, neighDict_num, medstore = dict(), dict(), []
    contour_arr_, pts_arr_, conjoined_neigh_ = [], [], []
    ht_, wd_ = json_['height'], json_['width']

    for linectr in range( len( json_['lines'] ) ):
      line_ = json_['lines'][linectr]
      print( 'TWIN->', line_, json_raw['lines'][linectr] )
      for wdctr in range( len(line_) ):
        #print( wdctr )
        txt1, pts1 = line_[ wdctr ]['text'], line_[ wdctr ]['pts']
        print( 'Before RAW->', txt1, pts1, line_[ wdctr ]['ids'] )
        txtarr, ptsarr = findRaw( line_[ wdctr ]['ids'], json_raw )
        print('POST RAW->', txtarr, ptsarr)
        fullText_ = txt1 
        #if True:
        #if allNum( txt ):
        for ctr in range( len(txtarr) ):

          pts_arr_.append( ptsarr[ ctr ] )
          _tmp = txtarr[ ctr ]
          if len( _tmp ) > 2 and len( _tmp.split()[0] ) <= 2 : 
            _tmp = _tmp[2:].strip()
            txt1 = txt1[2:].strip() 

          contour_arr_.append( ( _tmp, txt1 ) )
          txt1 , pts1, typeOfNeighbour = _tmp, ptsarr[ ctr ], \
                                         findNeighBour( wdctr , linectr, json_, _tmp, ptsarr[ ctr ] )

          rt_neigh, lt_neigh = None, None

          if len( txt1.split() ) > 1:
            tmp_arr_ = txt1.split()
            if len( tmp_arr_[0] ) <= 2:
              tmp_arr_ = tmp_arr_[1:]
             
            #if len( tmp_arr_[0] ) >= 3 and allNum( tmp_arr_[0] ):
            #  txt1 = tmp_arr_[0] 
            #  rt_neigh = ' '.join( tmp_arr_[1:] )
            #elif len( tmp_arr_[-1] ) >= 3 and allNum( tmp_arr_[-1] ):
            if len( tmp_arr_[-1] ) >= 3 and allNum( tmp_arr_[-1] ):
              txt1 = tmp_arr_[-1] 
              lt_neigh = ' '.join( tmp_arr_[:-1] )
              print('CONJOINED LEFT->', txt1)
            elif ':' in txt1 and len( txt1.split(':') ) > 1 and allNum( ''.join( txt1.split(':')[1:] ) ):
              lt_neigh = ' '.join( tmp_arr_[:-1] )
              print('CONJOINED LEFT->', txt1)

          conjoined_neigh_.append( (lt_neigh, rt_neigh) )

          if allNum( txt1 ):
            typeOfNeighForVal = findValNeighBour( wdctr , linectr, json_)
          else:
            typeOfNeighForVal = (False, None )

          print('BOJI->', txt1, typeOfNeighbour, typeOfNeighForVal )
          ## in case of Date: 12-Jan-2023 ..meaning conjoined key values, replace KEY text
          if len( typeOfNeighbour ) == 5:
            txt1 = typeOfNeighbour[-1]
            print('REPLACING txt1 with split text->', txt1)

          if ( allNum( txt1 ) and typeOfNeighForVal[0] is False ) or len( txt1 ) <= 3 or len( txt1.split() ) >= 8 \
              or ( typeOfNeighbour[0] is False and typeOfNeighForVal[0] is False ) or ',' in txt1: 
              print('IS / HAS NUM / typeOfNeighbour False ..IGNORE ->', txt1, allNum( txt1 ),\
                     typeOfNeighForVal[0], len( txt1.split() ) )
              continue
          resp_ = findWdFeats( txt1 )
          ##now add the "VALUE" feat as well .. this way we ll cluster K and V
          medstore.append( len( resp_ ) )
         
          if len( typeOfNeighForVal ) == 2: 
            if len( typeOfNeighbour ) == 4:
              valContour = typeOfNeighbour[-2]
              tmpTxt = valContour['text']

              if len( tmpTxt.split() ) >= 2 and allNum( tmpTxt.split()[0] ) \
                                            and not allNum( ' '.join( tmpTxt.split()[1:] ) ):
                print('IS / HAS NUM / typeOfNeighbour False ..IGNORE ->', tmpTxt, allNum( tmpTxt ),\
                     typeOfNeighForVal[0], len( tmpTxt.split() ) )
                continue

              kvresp_ = resp_.tolist() + typeOfNeighbour[-1].tolist()
            elif len( typeOfNeighbour ) == 5:
              valContour = typeOfNeighbour[-3]
              tmpTxt = valContour['text']

              if len( tmpTxt.split() ) >= 2 and allNum( tmpTxt.split()[0] ) \
                                            and not allNum( ' '.join( tmpTxt.split()[1:] ) ):
                print('IS / HAS NUM / typeOfNeighbour False ..IGNORE ->', tmpTxt, allNum( tmpTxt ),\
                     typeOfNeighForVal[0], len( tmpTxt.split() ) )
                continue

              kvresp_ = resp_.tolist() + typeOfNeighbour[-2].tolist()
     
            kvtext_ = txt1 + '--' + valContour['text']
            kvpts_  = ( pts1, valContour['pts'] )
            kvtxt_arr = ( txt1, valContour['text'] )

          elif len( typeOfNeighForVal ) > 2: 
            #try:
              print('INCOMING->', typeOfNeighForVal, resp_ )
              if len( typeOfNeighForVal ) == 4:
                valContour = typeOfNeighForVal[-2]

                if len( valContour['text'] ) >= 3 and allNum( valContour['text'].split()[0] ) and not\
                  allNum( ' '.join( valContour['text'].split()[1:] ) ):
                  print('MOVE MOVE')
                  continue

                kvresp_ = resp_.tolist() + typeOfNeighForVal[-1].tolist()
              elif len( typeOfNeighForVal ) == 5:
                valContour = typeOfNeighForVal[-3]

                if len( valContour['text'] ) >= 3 and allNum( valContour['text'].split()[0] ) and not\
                  allNum( ' '.join( valContour['text'].split()[1:] ) ):
                  print('MOVE MOVE')
                  continue

                kvresp_ = resp_.tolist() + typeOfNeighForVal[-2].tolist()
     
              kvtext_ = valContour['text'] + '--' + txt1
              kvpts_  = ( valContour['pts'], pts1 )
              kvtxt_arr = ( txt1, valContour['text'] )

            #except:
            #  print('Somme issue->')

          if kvtext_ in neighDict_num:
            neighDict_num[ kvtext_+'_0' ] = ( kvresp_, kvpts_, kvtxt_arr )
          else: 
            neighDict_num[ kvtext_ ] = ( kvresp_, kvpts_, kvtxt_arr )

          print('PUZZLE->', kvtext_, ( kvresp_, kvpts_ ))
 

    print('MEDICI->', np.median( np.asarray( medstore ) ) )
    cluster_input_txt, simple_input, cluster_input_num = dict(), dict(), dict()

    ## create input for XFORMER
    finalInp_ = []
    for ctr in range( len(contour_arr_) ):#, pts_arr_
      if len( contour_arr_[ ctr ][0] ) == 0: continue
      conjoined_lt, conjoined_rt = conjoined_neigh_[ ctr ]

      ( cont_, fullTxt ), pts_, (neigh_vert, neigh_hor) = contour_arr_[ ctr ], pts_arr_[ ctr ], \
                          neighContours( contour_arr_[ ctr ],pts_arr_[ ctr ], json_, conjoined_lt, conjoined_rt )
      marked_ = False
      #print('Getting PUTIN->',cont_)  
      for key, ( _, ptsarr, txtarr ) in neighDict_num.items():
        keypts, valpts = ptsarr
        keytxt, valtxt = txtarr
        #print('BUTLER->', keypts, valpts, keytxt, valtxt)
        if pts_ == keypts and abs( valpts[1] - keypts[1] ) < 20 and \
          ( valpts[0] > keypts[0] or ( valpts == keypts and keytxt != valtxt ) ) and \
          not( ':' in cont_ and len( cont_.split(':')[-1] ) >= 2 ):
          pts_ = [ pts_[0]/wd_, pts_[1]/ht_, pts_[2]/wd_, pts_[3]/ht_ ] 
          print('MADNESS->', cont_, len( cont_.split(':')[-1] ))
          finalInp_.append( ( cont_, pts_, 'KEY-VALUE-RIGHT', neigh_vert, neigh_hor ) )
          marked_ = True

        elif pts_ == keypts and xOverlap( 'NA', valpts, 'NA', keypts ) and conjoined_lt is None\
          and not( ':' in cont_ and len( cont_.split(':') ) >= 2 ) :
          pts_ = [ pts_[0]/wd_, pts_[1]/ht_, pts_[2]/wd_, pts_[3]/ht_ ] 
          finalInp_.append( ( cont_, pts_, 'KEY-VALUE-BELOW', neigh_vert, neigh_hor ) )
          marked_ = True

        elif pts_ == valpts and abs( valpts[1] - keypts[1] ) < 20 and valpts[0] > keypts[0]:
          pts_ = [ pts_[0]/wd_, pts_[1]/ht_, pts_[2]/wd_, pts_[3]/ht_ ] 
          finalInp_.append( ( cont_, pts_, 'VALUE-KEY-LEFT', neigh_vert, neigh_hor ) )
          marked_ = True

        elif pts_ == valpts and xOverlap( 'NA', valpts, 'NA', keypts ) and \
          not( ':' in cont_ and len( cont_.split(':')[-1] ) >= 2 ):
          pts_ = [ pts_[0]/wd_, pts_[1]/ht_, pts_[2]/wd_, pts_[3]/ht_ ] 
          finalInp_.append( ( cont_, pts_, 'VALUE-KEY-TOP', neigh_vert, neigh_hor ) )
          marked_ = True

      if marked_ is False: 
          pts_ = [ pts_[0]/wd_, pts_[1]/ht_, pts_[2]/wd_, pts_[3]/ht_ ] 
          ## check if words like "Invoice 123123" slipped away
          txt_ = fullTxt
          #print('PRE_->', txt_.split(':'), txt_.split(), allNum( txt_.split()[-1] ), allNum( txt_.split()[0] ),\
          #                               neigh_hor )
          #print('PREQUALIFIER->', len( txt_.split(':')[-1] ) > 1, allNum( txt_.split(':')[-1], 'SPIKE' ),\
          #                        len( txt_.split(':')[0] ), allNum( txt_.split(':')[0] ) )

          if ( ( ':' in txt_ and len( txt_.split(':')[-1] ) > 1 and allNum( txt_.split(':')[-1], 'SPIKE' )\
            and len( txt_.split(':')[0] ) >= 3 and not allNum( txt_.split(':')[0] ) ) or \
            ( len( txt_.split() ) > 1 and len( txt_.split()[-1] ) >= 3 and allNum( txt_.split()[-1], 'SPIKE' )\
            and len( txt_.split()[0] ) >= 3 and not allNum( txt_.split()[0] ) ) ) and len( txt_.split() ) <= 5:
            if ':' in txt_:
                keyTxt, valTxt = ' '.join( txt_.split(':')[:-1] ), txt_.split(':')[-1] 
            else:
                keyTxt, valTxt = ' '.join( txt_.split()[:-1] ), txt_.split()[-1] 

            keypts, valpts = [ pts_[0], pts_[1], \
                                      pts_[0] + ( pts_[2] - pts_[0] )*( len(keyTxt)/ len(keyTxt+valTxt) ), pts_[3] ],\
                                 [ pts_[0] + ( pts_[2] - pts_[0] )*( len(keyTxt)/ len(keyTxt+valTxt) ), pts_[1],\
                                   pts_[2], pts_[3] ]
            keyF, valF = findWdFeats( keyTxt ), findWdFeats( valTxt )
            ## for KEY, neigh_hor 4th elem must be mod and for VAL neigh_hor 3rd element
            neo_hor = [ neigh_hor[0], neigh_hor[1], neigh_hor[2], valF.tolist(), neigh_hor[4], neigh_hor[5] ]
            finalInp_.append( ( keyTxt, keypts, 'KEY-VALUE-RIGHT', neigh_vert, neo_hor ) )

            neo_hor1 = [ neigh_hor[0], neigh_hor[1], keyF.tolist(), neigh_hor[3], neigh_hor[4], neigh_hor[5] ]
            finalInp_.append( ( valTxt, valpts, 'VALUE-KEY-LEFT', neigh_vert, neo_hor1 ) )

            print('BOOMER->', finalInp_[-2], finalInp_[-1] )
         
          elif len( txt_.split() ) >= 2 and len( txt_.split()[0] ) >= 3 and allNum( txt_.split()[0] ) and\
            not allNum( ' '.join( txt_.split()[1:] ), 'CHECK' ):
            valTxt, keyTxt = txt_.split()[0], ' '.join( txt_.split()[1:] )

            valpts, keypts = [ pts_[0], pts_[1], \
                                      pts_[0] + ( pts_[2] - pts_[0] )*( len(valTxt)/ len(keyTxt+valTxt) ), pts_[3] ],\
                                 [ pts_[0] + ( pts_[2] - pts_[0] )*( len(valTxt)/ len(keyTxt+valTxt) ), pts_[1],\
                                   pts_[2], pts_[3] ]

            keyF, valF = findWdFeats( keyTxt ), findWdFeats( valTxt )
            ## for KEY, neigh_hor 4th elem must be mod and for VAL neigh_hor 3rd element
            #neo_hor = [ neigh_hor[0], neigh_hor[1], valF.tolist(), neigh_hor[3], neigh_hor[4], neigh_hor[5] ]
            finalInp_.append( ( keyTxt, keypts, 'KEY-VALUE-RIGHT', neigh_vert, neigh_hor ) )

            #neo_hor1 = [ neigh_hor[0], neigh_hor[1], neigh_hor[2], keyF.tolist(), neigh_hor[4], neigh_hor[5] ]
            #neo_hor1 = neo_hor 
            finalInp_.append( ( valTxt, valpts, 'VALUE-KEY-LEFT', neigh_vert, neigh_hor ) )

            print('BOOMER VAL FIRST->', finalInp_[-2], finalInp_[-1] )
          
          else:
            #print('CYCLOPS->', txt_.split(), len( txt_.split()[0] ) >= 3 , allNum( txt_.split()[0] )\
            #  , allNum( ' '.join( txt_.split()[1:] ), 'CHECK' ) )
            finalInp_.append( ( cont_, pts_, 'IRR-NA', neigh_vert, neigh_hor ) )

    print('TRENCH WARFARE', finalInp_)
    resInp_ = []

    for elem in finalInp_:
      if elem[2] == 'IRR-NA':
        changed_ = False

        for inner in finalInp_:
          if inner[1][0] > elem[1][2] and abs( elem[1][1] - inner[1][1] ) <= 0.004 and \
            abs( elem[1][-1] - inner[1][-1] ) <= 0.004 and inner[2] == 'VALUE-KEY-LEFT':
            elem = ( elem[0], elem[1], 'KEY-VALUE-RIGHT', elem[3], elem[4] )
            print('Changed->', elem )
            changed_ = True
            elem[4][3] = findWdFeats( inner[0] ).tolist()
            resInp_.append( elem )
            break

        if changed_ is False: resInp_.append( elem )

      else:
        if elem[2] == 'VALUE-KEY-LEFT':
          hor_ = elem[-1]
          if np.sum( np.asarray( hor_[2] ) ) == 0:
            for local_ in finalInp_:
              if local_[1][2] < elem[1][0] and abs( elem[1][1] - local_[1][1] ) <= 0.004 and \
                abs( elem[1][-1] - local_[1][-1] ) <= 0.004:
                hor_[2] = findWdFeats( local_[0] ).tolist()            

        elif elem[2] == 'KEY-VALUE-RIGHT':
          hor_ = elem[-1]
          if np.sum( np.asarray( hor_[3] ) ) == 0:
            for local_ in finalInp_:
              if local_[1][0] > elem[1][2] and abs( elem[1][1] - local_[1][1] ) <= 0.004 and \
                abs( elem[1][-1] - local_[1][-1] ) <= 0.004:
                hor_[3] = findWdFeats( local_[0] ).tolist()            

        resInp_.append( elem )

    #print('EFFING RESULT->', resInp_[0])
    key_tuples_ = []
    for elem in resInp_:
        if ( 'KEY' in elem[2][:4] or 'IRR' in elem[2][:4] ) and isNum( elem[0] ) is False:
            print( elem[0] )
            print( elem[1] )
            key_tuples_.append( ( elem[0],  elem[1] ) )

    return key_tuples_        

    #cv2.imwrite( './RES/contoured_'+fileNm, imgFile_ )  

if __name__ == '__main__':
   
    src_0 = '/home/ubuntu/ROHITH/S3_TASK/S3_DOWNLOADS_NEW/output/home/ubuntu/ABHIJEET/INVOICES/REQUORDIT/DEV/ALL_OCR_OUTPUT/'
    src_raw = '/home/ubuntu/ROHITH/S3_TASK/S3_DOWNLOADS_NEW/raw/home/ubuntu/ABHIJEET/INVOICES/REQUORDIT/DEV/ALL_OCR_OUTPUT_ORIGINAL/'
 
    fnm_ = sys.argv[1]
    folder_ = sys.argv[2]

    import os
    ll = os.listdir( src_0 )
    if folder_ != 'NA':
      img_list_ = os.listdir( folder_ )
    else:
      img_list_ = [ fnm_+'.jpg' ] 

    #for fnm in img_list_:
    for fnm in ll:
      if 'output' in fnm or 'input' in fnm or 'global' in fnm: continue

      ''' 
      for fileNm in img_list_: 
        if '.jpg' not in fileNm: continue
        fnm_ = fileNm.split('.jpg')[0] 
        if fnm_ in fnm:
          print('PROCESSING-> IMG ', fileNm, ' JSON ',fnm) 
      ''' 
      if fnm_ not in fnm: continue
      print('PROCESSING->', src_0 + fnm)
      if True:
        try:
          with open( src_raw + fnm, 'r' ) as fp:
            json_raw = json.load( fp )

          with open( src_0 + fnm, 'r' ) as fp:
            json_ = json.load( fp )
          
          #imgFile_ = cv2.imread( './safe/' + fileNm )
          processNeighbours( json_, json_raw, fnm ) 
          #processNeighbours( json_, json_raw, imgFile_, fileNm ) 
        except:
          print('FAILED for ->', fnm, traceback.format_exc())

