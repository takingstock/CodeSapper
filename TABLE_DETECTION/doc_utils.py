import numpy as np
from datetime import datetime
import Levenshtein
import json, sys, math, time
from scipy.spatial import distance
from fuzzywuzzy import fuzz
import random, traceback
from scipy.spatial import distance

fuzz_threshold_ = 50 # bare min match criteria
month_dict_ = { 'Jan':'01', 'Feb':'02', 'Mar':'03', 'Apr':'04', 'May':'05', 'Jun':'06', 'Jul':'07', 'Ju1':'07',\
        'Aug':'08', 'Sep':'09', 'Oct':'10', 'Nov':'11', 'Dec':'12' }

def xOverlapBetter( pts, ref_pts, dist_=1500 ):
    ## check if anything above or below

    #print( abs( pts[-1] - ref_pts[1] ), pts[0] >= ref_pts[0] and pts[2] <= ref_pts[2], pts, ref_pts )
    if abs( pts[-1] - ref_pts[1] ) <= dist_ or abs( pts[1] - ref_pts[-1] ) <= dist_:
        if ( pts[0] >= ref_pts[0] and pts[2] <= ref_pts[2] ) or \
           ( ref_pts[0] >= pts[0] and ref_pts[2] <= pts[2] ) or \
           ( pts[0] >= ref_pts[0] and pts[0] <= ref_pts[2] ) or \
           ( ref_pts[0] >= pts[0] and ref_pts[0] <= pts[2] ) or \
           ( ref_pts[0] < pts[0] and ref_pts[2] > pts[0] and ref_pts[2] <= pts[2] and ( abs( abs( ref_pts[0] + ref_pts[2] )/2 - ( abs( pts[0] + pts[2] ) )/2 ) )/( min( abs( ref_pts[0] - ref_pts[2]), abs( pts[0] - pts[2] )  )  ) < 0.8 )            or\
           ( pts[0] < ref_pts[0] and pts[2] > ref_pts[0] and pts[2] <= ref_pts[2] and ( abs( abs( ref_pts[0] + ref_pts[2] )/2 - ( abs( pts[0] + pts[2] ) )/2 ) )/( min( abs( ref_pts[0] - ref_pts[2]), abs( pts[0] - pts[2] )  )  ) < 0.8 ):
             return True
    return False

def xOverlap( val, pts, ref_val, ref_pts, dist_=1500 ):
    ## check if anything above or below
    #print( abs( pts[-1] - ref_pts[1] ), pts[0] >= ref_pts[0] and pts[2] <= ref_pts[2], pts, ref_pts )
    if abs( pts[-1] - ref_pts[1] ) <= dist_ or abs( pts[1] - ref_pts[-1] ) <= dist_:
        if ( pts[0] >= ref_pts[0] and pts[2] <= ref_pts[2] ) or \
           ( ref_pts[0] >= pts[0] and ref_pts[2] <= pts[2] ) or \
           ( pts[0] >= ref_pts[0] and pts[0] <= ref_pts[2] ) or \
           ( ref_pts[0] >= pts[0] and ref_pts[0] <= pts[2] ) or \
           ( ref_pts[0] < pts[0] and ref_pts[2] > pts[0] and ref_pts[2] <= pts[2] and ( abs( abs( ref_pts[0] + ref_pts[2] )/2 - ( abs( pts[0] + pts[2] ) )/2 ) )/( min( abs( ref_pts[0] - ref_pts[2]), abs( pts[0] - pts[2] )  )  ) < 0.8 )            or\
           ( pts[0] < ref_pts[0] and pts[2] > ref_pts[0] and pts[2] <= ref_pts[2] and ( abs( abs( ref_pts[0] + ref_pts[2] )/2 - ( abs( pts[0] + pts[2] ) )/2 ) )/( min( abs( ref_pts[0] - ref_pts[2]), abs( pts[0] - pts[2] )  )  ) < 0.8 ):
             return True
    return False

def yOverlap( val, pts, ref_val, ref_pts, dist_=200 ):
    ## check if anything above or below
    #print('ENTERING yOverlap->', val, pts, ref_val, ref_pts )
    if len( val ) < 1: return False
    if pts == ref_pts: return False
    if ( abs( pts[1] - ref_pts[1] ) <= 20 or ( pts[1] > ref_pts[1] and pts[1] < ref_pts[-1] ) or\
             ( ref_pts[1] > pts[1] and ref_pts[1] < pts[-1] ) ) and pts[0] > ref_pts[0] and\
             abs( pts[-1] - ref_pts[1] ) >= 15 and abs( pts[1] - ref_pts[-1] ) >= 15 \
             and ( pts[0] - ref_pts[2] ) <= dist_:
             return True
    return False

def pure_yOverlap( val, pts, ref_val, ref_pts, dist_=200 ):

    if len( val ) < 1: return False
    if ( abs( pts[1] - ref_pts[1] ) <= 20 or ( pts[1] > ref_pts[1] and pts[1] < ref_pts[-1] ) or\
            ( ref_pts[1] > pts[1] and ref_pts[1] < pts[-1] ) ):
             return True
    return False

def dataType( txt_ ):

    numsmall, numcaps, numdigs, special = 0, 0, 0, 0
    p2_cy_, prev_cy_, cy_ = str(datetime.now().year - 2), str(datetime.now().year - 1), str(datetime.now().year)
    #if len( txt_ ) > 4: print('TIKTOK->', txt_[-4:], prev_cy_)

    #NOTE-> CHANGES MADE FOR IMPROVING DATE ACC - 20th March 2024 ( date of code change :P )
    try:
      if ( cy_ in txt_[-4:] or cy_[-2:] in txt_[-2:] or prev_cy_ in txt_[-4:] or p2_cy_ in txt_[-4:] or\
            ( len( txt_.split('/') ) == 3 and int( txt_[-2:] ) >= 22 ) or \
            ( len( txt_.split('-') ) == 3 and int( txt_[-2:] ) >= 22 ) or \
            ( len( txt_.split('-') ) == 3 and int( txt_[:4] ) >= 22 ) or \
            ( len( txt_.split('/') ) == 3 and int( txt_[:4] ) >= 22 )
            ) and not \
            ( ( ',' in txt_ or '.' in txt_  ) and len( txt_.split() ) <= 2 ): 
                return 'DATE'
    #NOTE-> CHANGES MADE FOR IMPROVING DATE ACC - 20th March 2024 ( date of code change :P )
       
    except:
        #print('in dataType EXCPN->', traceback.format_exc())
        pass

    for char in txt_:
        if ord(char) >= 48 and ord(char) <= 57: numdigs += 1
        elif ord(char) >= 65 and ord(char) <= 90: numcaps += 1
        elif ord(char) >= 97 and ord(char) <= 122: numsmall += 1
        else: special += 1 ## all special chars go into this bucket


    if numsmall == 0 and numcaps + numdigs + special == len( txt_ ) and numcaps > 1 and numdigs > 0.25*numcaps: return 'ALNUM'
    elif numsmall == 0 and numcaps + numdigs + special == len( txt_ ) and numcaps > 1 and numdigs < 0.25*numcaps: return 'ALL_CAPS'
    elif numcaps + numsmall + special == len( txt_ ) and numsmall > 1 and numsmall < 0.25*numcaps: return 'ALL_CAPS'

    if numsmall == 0 and numdigs + special + numcaps == len( txt_ ) and numcaps <= 1: return 'DIGIT'
    if numsmall > 0 and special > 0 and numcaps >= 1 and numdigs >= 2 and numdigs > 0.5*len(txt_): return 'DIGIT'
    if numsmall > 0 and numsmall+numdigs+special == len( txt_ ) and numdigs >= 2 \
            and numdigs > 0.5*len(txt_): return 'DIGIT'
    if numcaps > 1 and numdigs > 1 and numsmall <= 1: return 'ALNUM'
    if numdigs > 1 and numsmall > 1 and numdigs + numcaps > numsmall: return 'ALNUM'
    if numcaps + special == len( txt_ ): return 'ALL_CAPS'
    if ( numsmall > 1 or numdigs == 0 or ( numcaps + special == len( txt_ ) ) ) and len( txt_ ) >= 3: return 'TEXT'
    return 'NA'

def match_2(string, full_text):
    if (string.lower() in full_text.lower() and ((len(full_text) - len(string)) < 2 or True)):
        return True
    else:
        string = string[:].lower()
        full_text = full_text[:].lower()
        to_reach = len(string)
        for i in range(len(full_text) - 1):
            right = 0
            s = full_text[i]
            if (s == string[0]):
                right = right + 1
                # j = i + 1
                # while((right < to_reach - 1) and flag):
                for j in range(i + 1, min(len(string), len(full_text))):
                    # print(full_text[j])
                    if (full_text[j] == string[j - i]):
                        right = right + 1
                        # print("r :", right)
                    if (right >= math.ceil(to_reach * 0.902)):
                        return True
        return False

def match_3(string, full_text):
    if (string == None or string == "" or full_text == "" or len(string) <= 3 or len(full_text) <= 3):
        # print("1st Condition")
        return False
    elif (match_2(string, full_text)):
        # print("2nd Condition")
        return True
    else:
        # print("3rd Condition")
        # list1 = list(string)
        for i in range(len(full_text)):
            s = full_text[:i] + full_text[i+1:]
            if match_2(string, s):
                print("3rd Condition v1 :", string, s)
                return True
            else:
                pass
        return False

def match_4(str1, str2):
    # My Fuzz
    # print("my fuzz str1 str2 : ", str1, str2)
    if (min(len(str1), len(str2)))  / (max(len(str1), len(str2))) < 0.8:
        return False
    elif (len(str1.split()) > len(str2.split())):
        return False
    else:
        pass
    return (match_3(str1, str2) or match_3(str2, str1))

def backupContourSearch( line_, feedback_value_, fb_co_ords, ht_, wd_ ):
    ## 3-4 cases to be handled
    ## a) where say, po and job number are conjoined 9000840-ABS123 
    ## b) additional chars come into the contour ..PO# 123123 / POH 12312312 / InvNO . 123123132
    ## c) handling date misses ... for e.g. when feedback is 6/7/2023 and ocr only has 6/7/23
    ## d) date miss ..for e.g. ocr = 06Jul, 23 and feedback == 07/06/2023
    ## e) additional spaces, - , . , comma etc messing with op
    ## f) 1 char diff between feedback and ocr

    random_heuristic_thresh_, CY = 5, datetime.now().year

    for wd_ctr in range( len(line_) ):
      wd_txt, wd_pts, wd_ = line_[ wd_ctr ]['text'], line_[ wd_ctr ]['pts'], line_[ wd_ctr ]

      wd_txt = wd_txt.replace(' ','').replace(',','').replace('-','')
      fb_txt = feedback_value_.replace(' ','').replace(',','').replace('-','')

      if str(CY) not in fb_txt and str(CY)[-2:] in fb_txt and len( fb_txt.split('/') ) >= 3:
          fb_txt = fb_txt.replace( str(CY)[-2:], str(CY) )

      print('Going to chcek ->', wd_txt, dataType( wd_txt ), fb_txt ,fb_txt in wd_txt)

      if dataType( wd_txt ) not in [ 'ALNUM', 'DIGIT' ]: continue # and str(CY) not in wd_txt: continue
      #print('Leven-> ', fb_txt, wd_txt , Levenshtein.distance( fb_txt, wd_txt ) )  

      '''
      print('In backupContourSearch-> wd_txt, fb_txt = ', wd_txt, fb_txt, str(CY) in fb_txt[-4:],\
              len( fb_txt.split('/') ) == 3, len( wd_txt.split('/') ) == 3, \
              len( wd_txt ) > 4 and ( str(CY) in wd_txt ) )
      '''

      if ( fb_txt in wd_txt and len(fb_txt) >= random_heuristic_thresh_ ) or fb_txt == wd_txt\
              or ( wd_txt in fb_txt and len( wd_txt ) >= random_heuristic_thresh_ ): ## covers a) , b), e)
          print('Found in backupContourSearch 1->', fb_txt, wd_txt)
          return wd_

      if len( fb_txt ) == len( wd_txt ) and Levenshtein.distance( fb_txt, wd_txt ) <= 1: ## cvers f)
          print('Found in backupContourSearch 2->', fb_txt, wd_txt)
          return wd_

      try: 
        if len( fb_txt ) > 4 and str(CY) in fb_txt[-4:] and len( fb_txt.split('/') ) == 3 and\
              len( wd_txt.split('/') ) == 3 and \
              int(''.join( fb_txt.split('/')[:2] )) == int(''.join( wd_txt.split('/')[:2] )): ## cover c)

          print('Found in backupContourSearch 3->', fb_txt, wd_txt)
          return wd_
      except:
          pass

      print('JRE->', wd_txt, str(CY)[-2:], fb_txt[-2:] )
      if wd_txt == str(CY) and wd_ctr > 0:
          wd_txt = line_[ wd_ctr-1 ]['text']+wd_txt

      if len( fb_txt ) > 4 and ( str(CY) in fb_txt[-4:] or str(CY)[-2:] in fb_txt[-2:] ) \
              and len( fb_txt.split('/') ) == 3 and \
              len( wd_txt ) > 4 and ( str(CY) in wd_txt or str(CY)[-2:] in wd_txt ): ## cver d)
                  ## iterate through wd_text to see if it has a "month" in it
                  print('Coming into DT check !', wd_txt)
                  for idx, month in enumerate( list( month_dict_.keys() ) ):
                      if month.lower() in wd_txt.lower() and int( month_dict_[ month ] ) == int( fb_txt.split('/')[0] ): ## idx is 0 based hence increment by 1 and then check with the first part of date ..for US dates, month comes first
                        print('Found in backupContourSearch 4->', fb_txt, wd_txt)
                        return wd_
   
    return None

def findCoOrds( line_, feedback_value_, fb_co_ords, ht_, wd_ ):

    partial_, part_wd_ctr, nonNormCoOrds = None, None, None

    if fb_co_ords is not None and len( fb_co_ords ) == 4:
        nonNormCoOrds = [ int( fb_co_ords[0]*wd_ ), int( fb_co_ords[1]*ht_ ), int( fb_co_ords[2]*wd_ ),\
            int( fb_co_ords[3]*ht_ ) ]

        return nonNormCoOrds, None

    for wd_ctr in range( len(line_) ):
      wd_txt, wd_pts = line_[ wd_ctr ]['text'], line_[ wd_ctr ]['pts']
      #print('Find findCoOrds->', feedback_value_, wd_txt, match_4( feedback_value_, wd_txt ) )

      if feedback_value_ == wd_txt or match_4( feedback_value_, wd_txt ): return wd_pts, wd_ctr

      ## maybe feedback val is a part of the raw json
      if len(wd_txt) >= 3 and len( wd_txt ) < len( feedback_value_ ) and wd_txt in feedback_value_[: len(wd_txt)+1]\
              and partial_ is None:
          partial_ = line_[ wd_ctr ]
          part_wd_ctr = wd_ctr

      elif len(wd_txt) >= 3 and len( wd_txt ) > len( feedback_value_ ) and \
              feedback_value_ in wd_txt[: len(feedback_value_)+1] and \
              abs( len( wd_txt ) - len( feedback_value_ ) ) < 3\
              and partial_ is None:
          partial_ = line_[ wd_ctr ]
          part_wd_ctr = wd_ctr

      elif len(wd_txt) > 3 and \
              feedback_value_[1:] in wd_txt and \
              abs( len( wd_txt ) - len( feedback_value_ ) ) <= 3\
              and partial_ is None:
          partial_ = line_[ wd_ctr ]
          part_wd_ctr = wd_ctr

      elif len(wd_txt) > 1 and wd_txt in feedback_value_ and partial_ is not None:
          partial_['text'] += ' ' + wd_txt
          partial_['pts'] = [ partial_['pts'][0], partial_['pts'][1], wd_pts[2], wd_pts[3] ]

    if partial_ is None:
        ## backup extraction 
        #print('Calling backupContourSearch->', line_)
        partial_ = backupContourSearch( line_, feedback_value_, fb_co_ords, ht_, wd_ )

    return partial_['pts'] if partial_ is not None else partial_, part_wd_ctr      

def allCaps( txt ):

    special_ = [ ',','.',':', ' ' ]
    ncaps = 0
    for tt in txt:
        if ( ord( tt ) >= 65 and ord( tt ) <= 90 ) or tt in special_: ncaps += 1

    if ncaps == len( txt ): return True
    return False

def findNeigh_bkp( json_raw, co_ords_, key_coords_ ):
              ## use Y c-rds and euclidean distances to find nearest 8 values
              distance_dict_, resultD, numNeigh = dict(), dict(), 12
              height, wdth = int(json_raw['height']), int(json_raw['width'])

              for text_, norm_pts_ in key_coords_:
                      if dataType( text_ ) != 'TEXT' or allCaps( text_ ): continue

                      refined_local, refined_ref = [ norm_pts_[0]*wdth, norm_pts_[1]*height ],\
                                                   [ co_ords_[0], co_ords_[1] ]
                      euclid_ = distance.euclidean( refined_local, refined_ref )

                      distance_dict_[ euclid_ ] = { 'text': text_, \
                              'pts': [ int(norm_pts_[0]*wdth), int(norm_pts_[1]*height), \
                                       int(norm_pts_[2]*wdth), int(norm_pts_[3]*height) ] }

              dkeys_ = sorted( list( distance_dict_.keys() ) )
              ## pick nearest 8 keys
              for elem in dkeys_[ : min( len( dkeys_ )-1, 8 ) ]:
                  resultD[ elem ] = distance_dict_[ elem ]

              print('TOP 8 KEYS->', resultD)
              return resultD    
             
def otherLineNeigh( _line_, co_ords_ ):      

    lt, rt = None, None
    for wd_ in _line_:

        if wd_['pts'][2] < co_ords_[0]:
            if dataType( wd_['text'] ) != 'TEXT': continue
            if lt is None:
                lt = wd_
            else:
                if lt['pts'][2] < wd_['pts'][0]: lt = wd_

        elif wd_['pts'][0] > co_ords_[2]:
            if dataType( wd_['text'] ) != 'TEXT': continue
            if rt is None:
                rt = wd_
            else:
                if rt['pts'][2] < wd_['pts'][0]: rt = wd_

    print('LT and RT ..PREV/NEXT=>', lt, rt)
    return lt, rt

def findNearestTopBottom( ref_wd_, key_co_ords, json_raw ):
              tp, bot, return_ = dict(), dict(), dict()

              for idx, line_ in enumerate( json_raw['lines'] ):
                  prev_ = None
                  for wd_ in line_:
                      
                      if dataType( wd_['text'] ) != 'TEXT' or allCaps( wd_['text'] ): 
                          #print('DOGHOUSE->', wd_)
                          continue
                      if len( wd_['text'] ) < 4: continue
                      refined_local = [ wd_['pts'][0], wd_['pts'][1] ]
                      refined_ref   = [ ref_wd_['pts'][0], ref_wd_['pts'][1] ]

                      if wd_['pts'][-1] < ref_wd_['pts'][1] and key_co_ords[1] != wd_['pts'][1]:

                          euclid_ = distance.euclidean( refined_local, refined_ref )
                          tp[ euclid_ ] = wd_

                      elif wd_['pts'][1] > ref_wd_['pts'][-1] and key_co_ords[1] != wd_['pts'][1]:

                          euclid_ = distance.euclidean( refined_local, refined_ref )
                          bot[ euclid_ ] = wd_
              
              tp_srtd_, bot_srtd_ = None, None

              if len( tp ) > 0:
                  tp_srtd_ = sorted( list(tp.keys()) )

              if len( bot ) > 0:
                  bot_srtd_ = sorted( list(bot.keys()) )

              if tp_srtd_ is not None: return_[ 'TOP' ] = tp[ tp_srtd_[0] ]    
              if bot_srtd_ is not None: return_[ 'BOTTOM' ] = bot[ bot_srtd_[0] ]    

              return return_

def normDist( c1, c2, raw_json_ ):

    ht, wdth = raw_json_['height'], raw_json_['width']

    normc1 = [ c1[0]/wdth, c1[1]/ht, c1[2]/wdth, c1[3]/ht ]
    normc2 = [ c2[0]/wdth, c2[1]/ht, c2[2]/wdth, c2[3]/ht ]

    return distance.euclidean( normc1, normc2 )

def completeCnt( wdidx, line_, dirn ):
    ## dirn = [ LEFT, RIGHT , BOTH ] ..only expand in this dirn
    text_ , pts_ = line_[wdidx]['text'], line_[wdidx]['pts']

    if dirn == 'BOTH':

        ## look back
        for idx_ in range( wdidx-1, -1, -1 ):
            if abs( line_[idx_]['pts'][2] - pts_[0] ) <= 20:
                text_ = line_[idx_]['text'] +' '+text_
                pts_ = [ line_[idx_]['pts'][0], line_[idx_]['pts'][1], pts_[2], pts_[3] ]

        ## look fwd
        for idx_ in range( wdidx+1, len(line_) ):
            if abs( line_[idx_]['pts'][0] - pts_[2] ) <= 20:
                text_ = text_ + ' ' + line_[idx_]['text'] 
                pts_ = [ pts_[0], pts_[1], line_[idx_]['pts'][2], line_[idx_]['pts'][3] ]

    if dirn == 'LEFT':

        ## look back
        for idx_ in range( wdidx-1, -1, -1 ):
            if abs( line_[idx_]['pts'][2] - pts_[0] ) <= 20:
                text_ = line_[idx_]['text'] +' '+text_
                pts_ = [ line_[idx_]['pts'][0], line_[idx_]['pts'][1], pts_[2], pts_[3] ]

    if dirn == 'RIGHT':

        ## look fwd
        for idx_ in range( wdidx+1, len(line_) ):
            if abs( line_[idx_]['pts'][0] - pts_[2] ) <= 20:
                text_ = text_ + ' ' + line_[idx_]['text'] 
                pts_ = [ pts_[0], pts_[1], line_[idx_]['pts'][2], line_[idx_]['pts'][3] ]

    return { 'text': text_, 'pts': pts_ }

def overlapY( pt1, pt2 ):

    if ( pt1[1] > pt2[1] and pt1[1] < pt2[-1] ):
        pt2ht_ = pt2[-1] - pt2[1]
        print('HAMILTON->', pt2ht_, ( pt1[1] - pt2[1] ), ( pt2[-1] - pt1[1] ))
        if ( pt1[1] - pt2[1] )/pt2ht_ > 0.5 : return False

        return True

    elif ( pt2[1] > pt1[1] and pt2[1] < pt1[-1] ):
        pt2ht_ = pt1[-1] - pt1[1]
        print( 'HAMILTON->', pt2ht_, ( pt2[1] - pt1[1] ), ( pt1[-1] - pt2[1] ) )
        if abs( pt1[1] - pt2[1] )/pt2ht_ > 0.5 : return False

        return True

    else:
        return False

def findNeigh( json_raw, co_ords_, key_coords_, feedback_value_ ):
              ## use Y c-rds and euclidean distances to find nearest 8 values
              distance_dict_top, distance_dict_bottom, distance_dict_left, distance_dict_rt, resultD, numNeigh = \
                                            dict(), dict(), dict(), dict(), dict(), 12
              toplt, toprt, botlt, botrt, start_time_ = None, None, None, None, time.time()

              for idx, line_ in enumerate( json_raw['lines'] ):
                  prev_ = None
                  for wdidx, wd_ in enumerate( line_ ):
                      
                      if dataType( wd_['text'] ) not in [ 'TEXT', 'ALNUM', 'ALL_CAPS' ] : #continue
                          #print('DOGHOUSE->', wd_, dataType( wd_['text'] ))
                          continue
                      if len( wd_['text'] ) < 4 and dataType( wd_['text'] ) == 'TEXT': 
                          #print('DOGHOUSE2->', wd_)
                          continue

                      refined_local, refined_ref = [ wd_['pts'][0], wd_['pts'][1] ],\
                                                   [ co_ords_[0], co_ords_[1] ]
                      
                      #print('DODO->', wd_ , co_ords_, xOverlap( wd_['text'], wd_['pts'], 'NA', co_ords_ ) )

                      if ( wd_['pts'][1] < co_ords_[1] and abs( wd_['pts'][1] - co_ords_[1] ) > 15 ) and\
                              xOverlap( wd_['text'], wd_['pts'], 'NA', co_ords_ ) and \
                              abs( wd_['pts'][1] - co_ords_[1] ) <= 500:
                         
                          print('1->', wd_)        
                          new_cnt_ = completeCnt( wdidx, line_, 'BOTH' )         
                          distance_dict_top[ abs( wd_['pts'][1] - co_ords_[1] ) ] = \
                                                 ( new_cnt_, 'TOP', normDist( wd_['pts'], co_ords_, json_raw ) )

                      elif ( wd_['pts'][1] > co_ords_[1] and abs( wd_['pts'][1] - co_ords_[1] ) > 15 ) and\
                              xOverlap( wd_['text'], wd_['pts'], 'NA', co_ords_ ) and \
                              wd_['pts'][-1] > co_ords_[-1]:
                          print('1.1->', wd_)        
                          distance_dict_bottom[ abs( wd_['pts'][1] - co_ords_[1] ) ] = \
                                  ( wd_, 'BOTTOM', normDist( wd_['pts'], co_ords_, json_raw ) )

                      elif ( abs( wd_['pts'][1] - co_ords_[1] ) <= 10 or \
                              overlapY( co_ords_, wd_['pts'] ) ) and\
                              ( wd_['pts'][2] < co_ords_[0] or \
                              ( wd_['pts'][0] >= co_ords_[0] and wd_['pts'][2] < co_ords_[2] and\
                                 wd_['text'] not in feedback_value_ )):    

                          print('1.2->', wd_)        
                          new_cnt_ = completeCnt( wdidx, line_, 'LEFT' )         
                          distance_dict_left[ abs( wd_['pts'][2] - co_ords_[0] ) ] = \
                                  ( new_cnt_, 'LEFT', normDist( wd_['pts'], co_ords_, json_raw ) )

                      elif abs( wd_['pts'][1] - co_ords_[1] ) <= 10 and wd_['pts'][0] > co_ords_[2]:    
                          print('1.3->', wd_)        
                          distance_dict_rt[ abs( wd_['pts'][0] - co_ords_[2] ) ] = \
                                  ( wd_, 'RIGHT', normDist( wd_['pts'], co_ords_, json_raw ) )

                      if abs( wd_['pts'][1] - co_ords_[1] ) <= 10 and idx > 0 and idx < len(json_raw['lines']) - 1:
                          ## now go above and find left and rt
                          prev_line_ = json_raw['lines'][ idx-1 ]
                          toplt, toprt = otherLineNeigh( prev_line_, co_ords_ )
                          ## now go below and find left and rt
                          next_line_ = json_raw['lines'][ idx+1 ]
                          botlt, botrt = otherLineNeigh( next_line_, co_ords_ )

                      prev_ = wd_    

              print(' FINDNEIGH0.5 TIME->', time.time() - start_time_ )
              print( 'TOP D->', distance_dict_top, distance_dict_left )
              dkeys_ = sorted( list( distance_dict_top.keys() ) )
              resultD[ 'TOP' ] = []
              for sortedkey_ in dkeys_[ : min( 3, len(dkeys_) ) ]:
                  resultD[ 'TOP' ].append( distance_dict_top[ sortedkey_ ] )

              if len( resultD[ 'TOP' ] ) == 0 and len( distance_dict_top ) > 0 and len( distance_dict_top ) < 3: 
                  resultD[ 'TOP' ].append( distance_dict_top[ dkeys_[0] ] )    

              dkeys_ = sorted( list( distance_dict_bottom.keys() ) )
              resultD[ 'BOTTOM' ] = []
              for sortedkey_ in dkeys_[ : min( 3, len(dkeys_) ) ]:
                  resultD[ 'BOTTOM' ].append( distance_dict_bottom[ sortedkey_ ] )

              if len( resultD[ 'BOTTOM' ] ) == 0 and len( distance_dict_bottom ) > 0 and len( distance_dict_bottom ) < 3: 
                  resultD[ 'BOTTOM' ].append( distance_dict_bottom[ dkeys_[0] ] )    

              dkeys_ = sorted( list( distance_dict_left.keys() ) )
              resultD[ 'LEFT' ] = []
              for sortedkey_ in dkeys_[ : min( 3, len(dkeys_) ) ]:
                  resultD[ 'LEFT' ].append( distance_dict_left[ sortedkey_ ] )

              if len( resultD[ 'LEFT' ] ) == 0 and len( distance_dict_left ) > 0 and len( distance_dict_left ) < 3: 
                  resultD[ 'LEFT' ].append( distance_dict_left[ dkeys_[0] ] )    

              dkeys_ = sorted( list( distance_dict_rt.keys() ) )
              resultD[ 'RIGHT' ] = []
              for sortedkey_ in dkeys_[ : min( 3, len(dkeys_) ) ]:
                  resultD[ 'RIGHT' ].append( distance_dict_rt[ sortedkey_ ] )

              if len( resultD[ 'RIGHT' ] ) == 0 and len( distance_dict_rt ) > 0 and len( distance_dict_rt ) < 3: 
                  resultD[ 'RIGHT' ].append( distance_dict_rt[ dkeys_[0] ] )    

              resultD['TOP-LT'] = [ ( toplt, 'TOP-LT', normDist( toplt['pts'], co_ords_, json_raw ) ) ] \
                                       if toplt is not None else []    
              resultD['TOP-RT'] = [ ( toprt, 'TOP-RT', normDist( toprt['pts'], co_ords_, json_raw ) ) ] \
                                       if toprt is not None else []    
              resultD['BOT-LT'] = [ ( botlt, 'BOT-LT', normDist( botlt['pts'], co_ords_, json_raw ) ) ] \
                                       if botlt is not None else []    
              resultD['BOT-RT'] = [ ( botrt, 'BOT-RT', normDist( botrt['pts'], co_ords_, json_raw ) ) ] \
                                       if botrt is not None else []    

              ## if LEFT and RT found ..actually even IF NOT found, find TOP LT, TOP RT, BOT LT and BOT RT
              ## basically take the prev word/s and next word/s and break at first occ of valid TOP and BOT 
              print(' FINDNEIGH0.75 TIME->', time.time() - start_time_ )
              finalResultD = dict()
              for dirn, result_arr_ in resultD.items():
                  tmpRes_ = []
                  for tuple_ in result_arr_:
                      '''
                      res = findNearestTopBottom( tuple_[0], co_ords_, json_raw )
                      locres_ = dict()
                      for key, val in res.items():
                          locres_[ key ] = val

                      '''
                      new_tup_ = ( tuple_[0], tuple_[1], { 'NEIGH': {} }, tuple_[2] )    
                      #new_tup_ = ( tuple_[0], tuple_[1], { 'NEIGH': locres_ }, tuple_[2] )    
                      tmpRes_.append( new_tup_ )
                  
                  finalResultD[ dirn ] = tmpRes_

              print( 'LOCAL NEIGH->', json_raw['path'], '\n', finalResultD )
              print(' FINDNEIGH TIME->', time.time() - start_time_ )

              return finalResultD

def findNeigh_old( json_raw, co_ords_ ):
              ## use Y c-rds and euclidean distances to find nearest TOP, BOTTOM, LEFT
              distance_dict_, resultD = dict(), dict()

              for line_ in json_raw['lines']:
                  for wd_ in line_:
                      
                      if dataType( wd_['text'] ) not in [ 'TEXT', 'ALNUM' ] : continue
                      if len( wd_['text'] ) < 4: continue

                      refined_local, refined_ref = [ wd_['pts'][0], wd_['pts'][1] ],\
                                                   [ co_ords_[0], co_ords_[1] ]

                      #euclid_ = distance.euclidean( wd_['pts'], co_ords_ )
                      euclid_ = distance.euclidean( refined_local, refined_ref )
                      #NOTE-> euclidean distance is a disaster ..euclid should have been murdered
                      x_dist, top_y_dist, bot_y_dist = abs( wd_['pts'][2] - co_ords_[0] ), \
                              abs( wd_['pts'][1] - co_ords_[1] ), abs( co_ords_[1] - wd_['pts'][1] )

                      if wd_['pts'][1] < co_ords_[1] and xOverlap( wd_['text'], wd_['pts'], 'NA', co_ords_ ):
                      #if wd_['pts'][-1] < co_ords_[1]:
                          #distance_dict_[ euclid_ ] = ( wd_, 'TOP' )
                          distance_dict_[ top_y_dist ] = ( wd_, 'TOP' )

                      if wd_['pts'][1] > co_ords_[1] and xOverlap( wd_['text'], wd_['pts'], 'NA', co_ords_ ):
                      #if wd_['pts'][1] > co_ords_[-1]:
                          #distance_dict_[ euclid_ ] = ( wd_, 'BOTTOM' )
                          distance_dict_[ bot_y_dist ] = ( wd_, 'BOTTOM' )

                      if pure_yOverlap( wd_['text'], wd_['pts'], 'NA', co_ords_ ) and wd_['pts'][0] < co_ords_[0]:    
                          #distance_dict_[ euclid_ ] = ( wd_, 'LEFT' )
                          distance_dict_[ x_dist ] = ( wd_, 'LEFT' )

              dkeys_ = sorted( list( distance_dict_.keys() ) )
              for sortedkey_ in dkeys_:

                if distance_dict_[ sortedkey_ ][1] == 'TOP' and 'TOP' not in resultD:
                    resultD['TOP'] = distance_dict_[ sortedkey_ ][0]

                if distance_dict_[ sortedkey_ ][1] == 'BOTTOM' and 'BOTTOM' not in resultD:
                    resultD['BOTTOM'] = distance_dict_[ sortedkey_ ][0]

                if distance_dict_[ sortedkey_ ][1] == 'LEFT' and 'LEFT' not in resultD:
                    resultD['LEFT'] = distance_dict_[ sortedkey_ ][0]

              print('LOCAL NEIGH->', json_raw['path'], '\n', resultD, distance_dict_)

              return resultD

def stitchEmUp( idx, line, feedback_value_, feedback_co_ords_ ):
    
    curr_, changed_ = line[idx].copy() , False

    for loc in range( idx-1, -1, -1 ):
        prev = line[ max( 0, loc ) ]

        if prev['pts'][2] <= curr_['pts'][0] and abs( curr_['pts'][0] - prev['pts'][2] ) <= 5:
            curr_['text'] = prev['text'] + ' ' + curr_['text']
            curr_['pts'] = [ prev['pts'][0], prev['pts'][1], curr_['pts'][2], curr_['pts'][3] ]
            changed_ = True
        else:
            break

    for loc in range( idx+1, len( line ) ):
        nxt = line[ min( loc, len( line )-1 ) ]

        if curr_['pts'][2] <= nxt['pts'][0] and abs( nxt['pts'][0] - curr_['pts'][2] ) <= 5:
            curr_['text'] = curr_['text'] + ' ' + nxt['text']
            curr_['pts'] = [ curr_['pts'][0], curr_['pts'][1], nxt['pts'][2], nxt['pts'][3] ]
            changed_ = True
        else:
            break

    if changed_: 
        print('Returning Stitched->', curr_)
        return curr_

    ## check if the feedback co-ords is a rather large one
    if len( line[idx]['text'] )*3 < len( feedback_value_ ) and idx < len( line ) - 1 and \
            line[idx]['text'] in feedback_value_[ : len( line[idx]['text'] )+2 ]:

                curr_len, feedback_len = line[idx]['pts'][2] - line[idx]['pts'][0],\
                                         feedback_co_ords_[2] - feedback_co_ords_[0]

                print('The DIFF IS LARGE->', curr_len, ' DD ', feedback_len)

                for loc in range( idx+1, len( line ) ):
                    nxt = line[ min( loc, len( line )-1 ) ]
                    if ( curr_['pts'][2] - curr_['pts'][0] ) + ( nxt['pts'][2] - nxt['pts'][0] ) < feedback_len:
                        print( 'ADDING NOW LARGER CONTOUR ->', nxt, ' To ->', curr_ )
                        curr_['text'] = curr_['text'] + ' ' + nxt['text']
                        curr_['pts'] = [ curr_['pts'][0], curr_['pts'][1], nxt['pts'][2], nxt['pts'][3] ]
                        changed_ = True

    if changed_: 
        print('Returning Stitched->', curr_)
        return curr_

    return None
        

def getLocalKey( localConfig, json_raw, feedback_value_, feedback_co_ords_=None, key_coords_=None ):
    ## the 2nd arg can be null since the frontend might send either the value input by the user
    ## or value + co-ord ..it depends on how the user interacts with the sytems
    resultD, backupD = dict(), dict()

    field_type_ = dataType( feedback_value_ )

    if True:

        for linectr in range( len( json_raw['lines'] ) ):
            line_, co_ords_ = json_raw['lines'][linectr], None
            ht_, wd_ = json_raw['height'], json_raw['width']

            if feedback_co_ords_ is None or len( feedback_co_ords_ ) != 4:
                co_ords_, wdctr = findCoOrds( line_, feedback_value_, feedback_co_ords_, ht_, wd_ )
            else: 
                for wdidx, wd in enumerate( line_ ):

                    print('DODI->', [wd] , [feedback_value_], feedback_co_ords_)
                    stitched_ = stitchEmUp( wdidx, line_, feedback_value_, feedback_co_ords_ )

                    if wd['text'] == feedback_value_:
                        stitched_ = wd

                    if xOverlap( wd['text'], wd['pts'], feedback_value_, feedback_co_ords_ ) and\
                      ( abs( wd['pts'][1] - feedback_co_ords_[1] ) <= 30 or \
                        abs( wd['pts'][-1] - feedback_co_ords_[-1] ) <= 30 ) and\
                      ( fuzz.ratio( wd['text'], feedback_value_ ) >= fuzz_threshold_ or \
                      ( stitched_ is not None and \
                                  ( fuzz.ratio( stitched_['text'], feedback_value_ ) >= fuzz_threshold_ \
                                    or ( stitched_['text'] in feedback_value_ ) ) ) ):
                      
                      print('QUINN->', wd, stitched_, feedback_value_, feedback_co_ords_ )          

                      if stitched_ is None:
                         co_ords_ = wd['pts']
                      elif stitched_ is not None and ( fuzz.ratio( stitched_, feedback_value_ ) >= fuzz_threshold_\
                              or ( stitched_['text'] in feedback_value_ ) ):  
                         co_ords_ = stitched_['pts']
                         break

            if co_ords_ is not None and co_ords_ != [] and len( co_ords_ ) == 4:
              ## find the potential keys  -- this one is for any KEYS above / below the value
              print('Huzzah !! found co_ords_ ..need to find parent->', line_, co_ords_, \
                      'for valeu->', feedback_value_, feedback_co_ords_)
              resultD = findNeigh( json_raw, co_ords_, key_coords_, feedback_value_ )
              print('NEIGH == ', resultD)
              return co_ords_, resultD          

    print( 'Post munging->', resultD )
    ## if its here , first check if its a date ..dates will not be found if they have been formatted diff in fb
    if field_type_ == 'DATE':
        print('Date check')

        if '/' in feedback_value_:
            dt_arr_ = feedback_value_.split('/')
        elif '-' in feedback_value_:
            dt_arr_ = feedback_value_.split('-')
        else:
            dt_arr_ = []

        if len( dt_arr_ ) > 0:
          ## find potential candidate for YEAR ..once u have them use day and month and finalize
          ## also u need to try both YY and YYYY versions ..stupidshit
          yy_potential_, yyyy_potential_ = potentialDates( json_raw['lines'], dt_arr_[-1], 'YY', json_raw ),\
                                           potentialDates( json_raw['lines'], dt_arr_[-1], 'YYYY', json_raw )

          filtered_ = filterCandidates( yy_potential_, yyyy_potential_, dt_arr_ )                                 

          if filtered_ is not None:
              print('Finding NEIGH fr ->', filtered_)
              resultD = findNeigh( json_raw, filtered_['pts'], key_coords_, feedback_value_ )
              return filtered_['pts'], resultD          

    return None, None

def filterCandidates( arr1, arr2, dt_arr_ ):

    if len( arr1 ) > 0:
        for idx, pot_ in enumerate( arr1 ):
          print('GOIN THRU->', pot_ , dt_arr_ )  

          if dt_arr_[0] in pot_['text']:
              ## now check if the last elem is matching ..in this case its dt_arr_[1] 
              if ( dt_arr_[1] in pot_['text'] ) or monthMatch( dt_arr_[1], pot_['text'] ):
                  print('Found complete date match!->', pot_ )
                  return pot_
          elif dt_arr_[1] in pot_['text'] or monthMatch( dt_arr_[1], pot_['text'] ):
              ## now check if the last elem is matching ..in this case its dt_arr_[1] 
              if ( dt_arr_[0] in pot_['text'] ) or monthMatch( dt_arr_[0], pot_['text'] ):
                  print('Found complete date match!->', pot_ )
                  return pot_

    if len( arr2 ) > 0:
        for idx, pot_ in enumerate( arr2 ):
          print('GOIN THRU->', pot_ , dt_arr_ )  

          if dt_arr_[0] in pot_['text']:
              ## now check if the last elem is matching ..in this case its dt_arr_[1] 
              if ( dt_arr_[1] in pot_['text'] ) or monthMatch( dt_arr_[1], pot_['text'] ):
                  print('Found complete date match!->', pot_ )
                  return pot_
          elif dt_arr_[1] in pot_['text'] or monthMatch( dt_arr_[1], pot_['text'] ):
              ## now check if the last elem is matching ..in this case its dt_arr_[1] 
              if ( dt_arr_[0] in pot_['text'] ):
                  print('Found complete date match!->', pot_ )
                  return pot_

def monthMatch( txt, contour_text ):

    months = [
    "january", "february", "march", "april", \
    "may", "june", "july", "august", \
    "september", "october", "november", "december"
    ]

    for idx, mnth in enumerate( months ):
        if ( mnth in txt.lower() and mnth in contour_text.lower() ) or\
                ( mnth in txt.lower() and str(idx+1) in contour_text.lower() ) or \
                ( mnth in contour_text.lower() and str(idx+1) in txt.lower() ):
                    print('Mnth Matches ! txt, contour_text ->', txt, contour_text)
                    return True
    return False            

def potentialDates( lines_, yr_ , mode, json_raw ):

    resp_arr_ = []

    if len( mode ) == 2 and len( yr_ ) >= 2:
        print('Looking for YY ')
        lookout_for_ = yr_[-2:]

        for linectr in range( len( lines_ ) ):
            line_, co_ords_ = lines_[linectr], None
            ht_, wd_ = json_raw['height'], json_raw['width']

            ## look for contour that has lookout_for_ in the last 2 chars
            found_idx_ = None
            for idx, word in enumerate( line_ ):
                if word['text'][-2:] == lookout_for_:
                    print('Potential CNT ->', word)
                    
                    if idx > 0 and abs( line_[ idx-1 ]['pts'][2] - word['pts'][0] ) <= 5:

                        resp_arr_.append( { 'text': line_[ idx-1 ]['text'] + word['text'] ,\
                                'pts': [ line_[ idx-1 ]['pts'][0], line_[ idx-1 ]['pts'][1],\
                                         line_[ idx-1 ]['pts'][2], line_[ idx-1 ]['pts'][3] ]
                               } )
                    else:

                        resp_arr_.append( word )

    elif len( mode ) == 4 and len( yr_ ) >= 4:
        print('Looking for YYYY ')
        lookout_for_ = yr_[-4:]

        for linectr in range( len( lines_ ) ):
            line_, co_ords_ = lines_[linectr], None
            ht_, wd_ = json_raw['height'], json_raw['width']

            ## look for contour that has lookout_for_ in the last 2 chars
            found_idx_ = None
            for idx, word in enumerate( line_ ):
                if len( word['text'] ) < 4: continue

                if word['text'][-4:] == lookout_for_:
                    print('Potential CNT ->', word)
                    
                    if idx > 0 and abs( line_[ idx-1 ]['pts'][2] - word['pts'][0] ) <= 5:

                        resp_arr_.append( { 'text': line_[ idx-1 ]['text'] + word['text'] ,\
                                'pts': [ line_[ idx-1 ]['pts'][0], line_[ idx-1 ]['pts'][1],\
                                         line_[ idx-1 ]['pts'][2], line_[ idx-1 ]['pts'][3] ]
                               } )
                    else:

                        resp_arr_.append( word )

    return resp_arr_

def areaOfOverlap( ref1, ref2 ):

    if ref1[2] < ref2[2]:
        refx2 = ref1[2]
        refx1 = ref2[0]
    else:    
        refx2 = ref2[2]
        refx1 = ref1[0]

    smaller_ = ref1[2] - ref1[0] if ref1[2] - ref1[0] < ref2[2] - ref2[0] else ref2[2] - ref2[0]
    print('Area of Overlap->', int( (( refx2 - refx1 )/smaller_)*100 ) )
    return (( refx2 - refx1 )/smaller_)*100 

if __name__ == '__main__':

    print( dataType('5 6') )
    #getLocalKey( localConfig, json_raw, feedback_value_, feedback_co_ords_=None )
    '''
    with open( 'locConfig.json', 'r' ) as fp:
        localConfig = json.load( fp )

    src_folder_ = "/home/ubuntu/ROHITH/S3_TASK/S3_DOWNLOADS_NEW/raw/home/ubuntu/ABHIJEET/INVOICES/REQUORDIT/DEV/ALL_OCR_OUTPUT_ORIGINAL/"

    with open( src_folder_ + sys.argv[1] ) as fp:
        rawJson = json.load( fp )

    print('Read json->', src_folder_ + sys.argv[1])    

    feedback_value_, feedback_co_ords_ = sys.argv[2], None

    print( 'Result->', getLocalKey( localConfig, rawJson, feedback_value_, feedback_co_ords_ ) )
    '''
