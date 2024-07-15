import urllib
import numpy as np
import createJsonFeats, json, os
import traceback
import doc_utils
import db_utils
import copy, time
import pandas as pd
from scipy.spatial import distance
from fuzzywuzzy import fuzz

from datetime import datetime
from scipy.spatial import distance
from multiprocessing import Pool
import multiprocessing
import kv_genericPatterns ## use findMetaProperties

with open( 'eod_config.json', 'r' ) as fp:
    config_json_ = json.load( fp )

exclude_columns_     = config_json_["excludeHeaders"]
raw_file_path_       = config_json_["rawFilePath"]
stitched_file_path_  = config_json_["stitchedFilePath"]
signatureMatchThresh = config_json_["signatureMatchThresh"]
numCommonKeys        = config_json_["numCommonKeys"]
contourDistThresh    = config_json_["contourDistThresh"]
exceptionLog         = config_json_["exceptionLog"]
minNumNeighbours     = config_json_["minNumNeighbours"]
minSubStrLen         = config_json_["minSubStrLen"]

## delete this ..only for debug
debug_sign_ = None
norm_x, norm_y = 2550, 3600
fmt_match_threshold_ = 0.85

months = [
    "january", "february", "march", "april", \
    "may", "june", "july", "august", \
    "september", "october", "november", "december"
    ]

months_short = [
    "jan", "feb", "mar", "apr", \
    "may", "june", "july", "aug", \
    "sep", "oct", "nov", "dec"
    ]

with open( config_json_["globalKeyConfig"], 'r' ) as fp:
    global_keys_ = json.load( fp )

exception_fp_ = open( exceptionLog, 'a' )
start_ = time.time()

def getAllFilesWithFname( fnm_ ):
    
    ll_ = os.listdir( raw_file_path_ )
    response_ = []
    for locfile in ll_:
        if fnm_ in locfile:
            response_.append( raw_file_path_ + locfile )

    return response_

def localNeighbourhood( ref_ocr_op, curr_neigh ):
    ## curr_neigh = {'TOP': < contour >, 'LEFT' ... }
    if len( curr_neigh ) > minNumNeighbours: min_match_ = minNumNeighbours
    else: min_match_ = len( curr_neigh )

    match_ctr , exact_match = [], []

    for line in ref_ocr_op:
        for wd in line:
            for dirn, contour in curr_neigh.items():

                if len( wd['text'] ) >= minSubStrLen and len( contour['text'] ) > len( wd['text'] ) \
                    and wd['text'] in contour['text'][ :len( wd['text'] ) ] and \
                    distance.cosine( wd['pts'], contour['pts'] ) < contourDistThresh:

                        print( wd, ' (signature doc) matches REF-> (current one) ', contour )
                        exact_match.append( wd['text'] )

                elif len( contour['text'] ) >= minSubStrLen and len( contour['text'] ) < len( wd['text'] ) \
                    and contour['text'] in wd['text'][ :len( contour['text'] ) ] and \
                    distance.cosine( wd['pts'], contour['pts'] ) < contourDistThresh:

                        print( wd, ' (signature doc) matches REF-> (current one) ', contour )
                        exact_match.append( wd['text'] )

                if doc_utils.match_4( wd['text'], contour['text'] ) and \
                        distance.cosine( wd['pts'], contour['pts'] ) < contourDistThresh:
                        print( wd, ' (signature doc) matches REF-> (current one) ', contour )
                        match_ctr.append( wd['text'] )
                        break

    if len( set( match_ctr ) ) >= min_match_ or len( exact_match ) >= 1: return True

    return False

def findCommonKeys( key_tup1, key_tup2, docID ):

    respObj_ = []

    #print( 'KT1->', key_tup1 )
    #print( 'KT2->', key_tup2 )

    norm_store_ = []

    for str1, norm1 in key_tup1:
        for str2, norm2 in key_tup2:
            if fuzz.ratio( str1, str2 ) > 80 and distance.cosine( norm1, norm2 ) <= contourDistThresh\
                    and norm1 not in list( norm_store_ ):
                respObj_.append( ( str1, norm1, str2, norm2 ) )
                norm_store_.append( norm1 )
                #print('FUZZR->', str1, str2, ' = ', fuzz.ratio( str1, str2 ))

    #print('Total common GKV->', respObj_, len( respObj_ ), docID)
    return len( respObj_ )
        

def checkSignature( fnm, encoded_, key_coord_tup_, docs_used_, doc_type ):
    ## search the db now

    dbRec_ = db_utils.returnBlankDBRec()
    dbRec_['docID'] = fnm
    dbRec_['docSignature'] = encoded_
    dbRec_['tupArr'] = key_coord_tup_
    global debug_sign_

    results_ = db_utils.searchSignature( dbRec_ )['searchRes_']
    matching_recs_, closest_match, self_rec, all_matches = [], None, None, dict()
    #print('DREDD->', docs_used_)
    #print('Whats the hit ?-?', results_)
    highest_match_score_ = 0

    for res_num, res in results_.items():
        
        score_, db_rec_ = res['score'], res['payload']
        ## 3 stage check begins
        print('Evaluating in checkSignature INP->',score_,fnm,' SEARCH_RES->', db_rec_, db_rec_['doc_type'], doc_type)
        if score_ >= signatureMatchThresh and db_rec_['doc_type'] == doc_type:# and \

            print('STAGE1-> score_, highest_match_score_ == ', res_num, score_, highest_match_score_,\
                    findCommonKeys( db_rec_['tupArr'], key_coord_tup_, db_rec_['docID'] ) )
            if findCommonKeys( db_rec_['tupArr'], key_coord_tup_, db_rec_['docID'] ) >= numCommonKeys and \
                    score_ > highest_match_score_:# and db_rec_['docID'] not in docs_used_: ## stage 2 pass

                print('STAGE2 - cleared and adding->', db_rec_['docID'], score_, doc_type, db_rec_['doc_type'])
                all_matches[ score_ ] = db_rec_

        if score_ > highest_match_score_ and \
                findCommonKeys( db_rec_['tupArr'], key_coord_tup_, db_rec_['docID'] ) >= numCommonKeys and\
                db_rec_['doc_type'] == doc_type: 

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

def prepareForIgnoreExceptionUpdate( existing_db_rec, fnm_, keyNm, feedback_local_key_dict,\
                                  feedback_value_, feedback_co_ords, comments, mode ):

    existingRec_ = None
    for elem in existing_db_rec[ mode ]:
        if elem['docID'] == fnm_: 
            existingRec_ = elem
            break

    insertD = dict()
    insertD[ 'config_field_nm' ] = keyNm
    insertD[ 'local_field' ] = feedback_local_key_dict
    insertD[ 'feedback_value' ] = feedback_value_
    insertD[ 'feedback_co_ords' ] = feedback_co_ords
    insertD[ 'comments' ] = comments
    
    if existingRec_ is not None:
        ## now just add to the passed fields array
        if 'passed_fields' in existingRec_:
            existing_fb = existingRec_['passed_fields']
        else:
            existingRec_['passed_fields'] = []
            existing_fb = []

        existing_fb.append( insertD )
        existingRec_['passed_fields'] = existing_fb 

        existing_db_rec[ mode ].append( existingRec_ )
    else:
        masterD = dict()
        masterD[ 'docID' ] = fnm_
        masterD[ 'passed_fields' ] = [ insertD ] ## create new record for this particular file

        existing_db_rec[ mode ].append( masterD )
    ## no need to return anythin since we are modofying DB record itself    

def populateBlankRec( file_, encoded_, key_coord_tup_, rawJson, keyNm, \
        feedback_local_key_dict, feedback_value_, feedback_co_ords ):

    dbRec_ = db_utils.returnBlankDBRec()
    dbRec_['docID'] = (file_.split('/')[-1]).split('.json')[0]
    dbRec_['docSignature'] = encoded_
    dbRec_['tupArr'] = key_coord_tup_
    dbRec_['ocr_op'] = rawJson['lines']
    dbRec_['dimension'] = [ rawJson['height'], rawJson['width'] ]
    dbRec_['feedbackDict'][0]['config_field_nm'] = keyNm
    dbRec_['feedbackDict'][0]['local_neigh_dict'] = feedback_local_key_dict
    dbRec_['feedbackDict'][0]['feedback_value'] = feedback_value_
    dbRec_['feedbackDict'][0]['field_datatype'] = doc_utils.dataType( feedback_value_ )
    dbRec_['feedbackDict'][0]['field_co_ords'] = feedback_co_ords

    return dbRec_

def commonWords( txt1, txt2, fuzzr=None ):

    if txt1 in ['NA', 'N/A', 'NIA'] or txt2 in ['NA', 'N/A', 'NIA']: return False

    smaller_ = txt1 if len( txt1 ) < len( txt2 ) else txt2
    larger_  = txt1 if len( txt1 ) > len( txt2 ) else txt2

    if len( txt1 ) == len( txt2 ):
        smaller_, larger_ = txt1, txt2 

    if fuzzr is not None and fuzzr >= 80: 
        #print('DUE to the high fuzz ratio->', fuzzr, ' we skip the commonality check', txt1, txt2)
        return True

    if ( len( txt1.split() ) == 1 and fuzzr is not None and fuzzr >= 80 ) or \
            ( len( txt2.split() ) == 1 and fuzzr is not None and fuzzr >= 80 ): 
        #print('ALTHOUGHT SIZE 1, high fuzz ration->', txt1, txt2, fuzzr) 
        return True

    '''
    if ( len( txt1.split() ) == 1 and len( txt1 ) >= 8 and txt1 in txt2 ) or\
            ( len( txt2.split() ) == 1 and len( txt2 ) >= 8 and txt2 in txt1 ):
        print('ALTHOUGHT SIZE 1, single big common WD->', txt1, txt2, fuzzr) 
        return True
    '''

    if len( smaller_ ) < 5 or len( txt1.split() ) == 1 or len( txt2.split() ) == 1: return False

    sm_arr_ , large_arr_ = smaller_.split(), larger_.split()

    common_ = []

    for large_wd in large_arr_:
        for small_wd in sm_arr_:
            if small_wd.lower() == large_wd.lower() and len( small_wd ) >= 3:
                common_.append( small_wd )
                #print('Adding to ARR_ = ', small_wd)
                break

    #print('COMMONALITY BETWEEN->', txt1, txt2, ' = ', common_)

    if len( common_ ) > 0.5*len( large_arr_ ) or len( common_ ) >= 2:
        print('COMMON->')
        return True

    return False

def matchedKeys( outer_, inner_dict_ ):

    for key, val in inner_dict_.items():
        if ( 'BOT' in outer_ and 'BOT' in key ) or ( 'TOP' in outer_ and 'TOP' in key ):
            return True
    
    return False

def checkNeighboursAsWell( outerz_, innerz_, deet_euclidean_, locdeet_euclidean_ ):

                match_ = []
                #print('Local NEIGH CHECK->', outerz_, innerz_)
                for key, val in outerz_.items():
                    if key in innerz_ or matchedKeys( key, innerz_ ):
                        tmp_innerz_ = innerz_[ key ]
                        tmp_outerz_ = outerz_[ key ]
                        # now check for fuzz match between txt and x / y overlap
                        fuzzr_ = fuzz.ratio( tmp_innerz_['text'], tmp_outerz_['text'] )
                        #print('HANBULL CHECK->', fuzzr_, tmp_innerz_['text'], tmp_outerz_['text'] )
                        if fuzzr_ > 50 or ( fuzzr_ > 40 and \
                                commonWords( tmp_innerz_['text'], tmp_outerz_['text'] ) ):
                            match_.append( ( tmp_innerz_, locdeet_euclidean_, key ) )
                            #match_.append( (tmp_innerz_, abs( locdeet_euclidean_ - deet_euclidean_ ), key ) )

                if len( match_ ) == 2: return True, match_
                return False, match_

def euclideanOverlap( deets, locdeets, deet_euclidean_, locdeet_euclidean_, rawJs ):
    ##
    dist_thresh_, backup_thresh_ = 0.3, 0.3 ## 15% max variance permitted
    #print('respective Euc distances->', deet_euclidean_, locdeet_euclidean_)
    ht_, wdd_ = rawJs['height'], rawJs['width']

    normdist_ = distance.euclidean( [ deets['pts'][0]/wdd_, deets['pts'][1]/ht_, deets['pts'][2]/wdd_, deets['pts'][3]/ht_ ],\
                                    [ locdeets['pts'][0]/wdd_, locdeets['pts'][1]/ht_, locdeets['pts'][2]/wdd_, locdeets['pts'][3]/ht_ ] )

    #print('euclideanOverlap between->', deets, locdeets, normdist_)

    if abs( deet_euclidean_ - locdeet_euclidean_ )/deet_euclidean_ < dist_thresh_ or \
            normdist_ < backup_thresh_:
        #print('Euclidean distances are within the threshold ')
        return True

    return False

def notAlreadyAssigned( respD, deets ):
    #print('COMING TO CHECK->', deets, respD)
    for key , val in respD.items():
        if val is None: continue
        if val['pts'] == deets['pts']:
            print('YIKES! Already assigned ', deets,' to KEY->', key)
            #return False

    return True   

def topRuledOut( localNeigh, currNeigh_ ):

    if 'TOP' in localNeigh and 'TOP' in currNeigh_:
        atleast_one_common_ = False

        for local_elem in localNeigh['TOP']:
            for curr_elem in currNeigh_['TOP']:
                fz_ratio_ = fuzz.ratio( local_elem[0]['text'].lower(), curr_elem[0]['text'].lower() )
                if fz_ratio_ > 50 and commonWords( local_elem[0]['text'], curr_elem[0]['text'], fz_ratio_ ) is True:
                    #print('BATTLE of TOPSTERS, common->', local_elem, curr_elem)
                    atleast_one_common_ = True

        if atleast_one_common_ is True:
            #print('Found common TOP but need one more piece ..check RT..')
            one_more_ = False
            for key, local_ in localNeigh.items():
                for ikey, curr_ in currNeigh_.items():
                    if key == ikey and len( local_ ) > 0 and len( curr_ ) > 0:
                      local_arr, curr_arr = local_ , curr_
                      for local_elem in local_arr:
                        for curr_elem in curr_arr:  
                          fz_ratio_ = fuzz.ratio( local_elem[0]['text'].lower(), curr_elem[0]['text'].lower() )
                        
                          if fz_ratio_ > 50 and \
                                commonWords( local_elem[0]['text'], curr_elem[0]['text'], fz_ratio_ ) is True:
                            #print('BATTLE of REMNANTS, common->', local_elem, curr_elem)
                            one_more_ = True

            if one_more_ is False:
                #print('Nothing EXCEPT TOP MATCHES .. top RULED OUT')
                return True
        else:
                #print('Nothing INCL TOP MATCHES .. top RULED OUT')
                return True

    else:
                print('TOP NOT PRESENT IN BOTH .. top RULED OUT')
                return True

    return False      

def inTheHood(localNeigh, wd, rawJson, scaling_ht_, scaling_wd_, key_coord_tup_, field_val, field_co_ords, responseD):

    timer_ = time.time()
    currNeigh_ = doc_utils.findNeigh( rawJson, wd['pts'], key_coord_tup_, wd['text'] )
    dontUseLeftOrTop = False

    if 'LEFT' in localNeigh and ( 'LEFT' not in currNeigh_ or \
            ( 'LEFT' in currNeigh_ and len( currNeigh_['LEFT'] ) == 0 ) ):
        print('LEFT is ESSENTIAL ..REJECTING->', wd, ' SINCE IT HAS NO LEFT to match->', field_val, field_co_ords)
        if topRuledOut( localNeigh, currNeigh_ ):
            dontUseLeftOrTop = True

    refDtype, currDtype = doc_utils.dataType( wd['text'] ), doc_utils.dataType( field_val )

    print('Are they common ? ref and current->', wd, field_val, refDtype, currDtype, field_co_ords,\
            '\n',localNeigh,'\n', currNeigh_, scaling_wd_, scaling_ht_, responseD)

    if 'LEFT' in localNeigh and 'LEFT' in currNeigh_:
        print('LEFTISTS-> REF = ', localNeigh['LEFT'], ' and CURR = ', currNeigh_['LEFT'])
        ## check if left neighbours , even one is common
        atleast_one_common_ = False

        for local_elem in localNeigh['LEFT']:
            for curr_elem in currNeigh_['LEFT']:
                fz_ratio_ = fuzz.ratio( local_elem[0]['text'].lower(), curr_elem[0]['text'].lower() )
                if fz_ratio_ > 50 and commonWords( local_elem[0]['text'], curr_elem[0]['text'], fz_ratio_ ) is True:
                    print('BATTLE of LEFTISTS, common->', local_elem, curr_elem)
                    atleast_one_common_ = True

        if atleast_one_common_ is False and topRuledOut( localNeigh, currNeigh_ ):
          print('LEFT is ESSENTIAL ..REJECTING->', wd, ' SINCE IT HAS NO LEFT to match->', field_val, field_co_ords)
          dontUseLeftOrTop = True

    matches_ = dict()
    print('LEFT-TOP check cleared')

    for dirn, deets_arr in localNeigh.items():
      #if matches_ > 1: break
      for lcdeet_ in deets_arr:
        deets, outer_dirn, outer_neigh, deet_euclidean_ = lcdeet_
        if len( deets['text'] ) < 3 or len( deets['text'] ) >= 100 : continue
        if 'BOT' in outer_dirn : continue

        if dontUseLeftOrTop is True and ( 'LEFT' in outer_dirn or 'TOP' in outer_dirn ): continue
        print('OUTER->', deets)

        for locdirn, locdeets_arr in currNeigh_.items():
          for lcd_ in locdeets_arr:  
            locdeets, inner_dirn, inner_neigh, locdeet_euclidean_ = lcd_
            if len( locdeets['text'] ) < 3 or len( locdeets['text'] ) >= 100: continue
            if 'BOT' in inner_dirn : continue
            if dontUseLeftOrTop is True and ( 'LEFT' in inner_dirn or 'TOP' in inner_dirn ): continue

            print('INNER->', locdeets)

            deet_pts_ = [ int( deets['pts'][0]*scaling_wd_ ), int( deets['pts'][1]*scaling_ht_ ),\
                    int( deets['pts'][2]*scaling_wd_ ), int( deets['pts'][3]*scaling_ht_ ) ]
            
            fuzzer_ = fuzz.ratio( deets['text'] , locdeets['text'] )
            outerz_, innerz_ = outer_neigh['NEIGH'], inner_neigh['NEIGH']
            print('Comparing CurrentNeigh 0.0->', locdeets, deets, innerz_, ' RefNeigh->', deet_pts_, outerz_,\
                    outer_dirn, inner_dirn, fuzzer_)

            if fuzzer_ > 50 \
              and commonWords( locdeets['text'], deets['text'], fuzzer_ ) is True:
              ## now check co-ords
              '''
              if ( ( doc_utils.xOverlap( deets['text'], deet_pts_, 'NA', locdeets['pts'] ) and\
                      doc_utils.areaOfOverlap( deet_pts_, locdeets['pts'] ) > 25 ) or \
                    doc_utils.pure_yOverlap( deets['text'], deet_pts_, 'NA', locdeets['pts'] ) )\
                    and ( outer_dirn == inner_dirn \
              '''
              if ( outer_dirn == inner_dirn \
                          or ('BOT' in outer_dirn and 'BOT' in inner_dirn ) \
                          or ('TOP' in outer_dirn and 'TOP' in inner_dirn ) ) and \
                          euclideanOverlap( deets, locdeets, deet_euclidean_, locdeet_euclidean_, rawJson ) and\
                    notAlreadyAssigned( responseD, wd ):

                matches_[ str(locdeets['pts'][0])+'_'+str(locdeets['pts'][1]) ] = \
                        ( locdeets, locdeet_euclidean_, inner_dirn )
                        #( locdeets, abs( locdeet_euclidean_ - deet_euclidean_ ), inner_dirn )
                #print('ADDED->', ( locdeets, locdeet_euclidean_ , inner_dirn ))        
                #print('ADDED->', ( locdeets, abs( locdeet_euclidean_ - deet_euclidean_ ), inner_dirn ))        
                #print('HANCOCK->', locdeets, deets , inner_dirn, doc_utils.dataType( locdeets['text'] ),\
                        #doc_utils.dataType( deets['text'] ))
                ## check for neighbours as well ..if they too match, then double incremennt matches
                neigh_bool, neigh_match_ = checkNeighboursAsWell( outerz_, innerz_, deet_euclidean_, \
                        locdeet_euclidean_ )

                if neigh_bool is True:
                    print('HANBULL-> Neigh match as well!->', matches_)
                    for elem in neigh_match_:
                        if str(elem[0]['pts'][0])+'_'+str(elem[0]['pts'][1]) in matches_: continue

                        matches_[ str(elem[0]['pts'][0])+'_'+str(elem[0]['pts'][1]) ] = elem
                        print('ADDED2->', elem)

              '''
              else:      
                  print('CHECK DIDNT SUCCED ..just check neigh as well')
                  if checkNeighboursAsWell( outerz_, innerz_ ):
                    print('HANCOCKBULL-> Neigh match!')
                    matches_ += 1
              '''

    if len( matches_ ) == 0:
      for dirn, deets_arr in localNeigh.items():
        #if matches_ > 1: break
        for lcdeet_ in deets_arr:
          deets, outer_dirn, outer_neigh, deet_euclidean_ = lcdeet_
          if len( deets['text'] ) < 4 or len( deets['text'] ) >= 100 : continue
          if 'BOT' not in outer_dirn : continue
          print('OUTER->', deets)

          for locdirn, locdeets_arr in currNeigh_.items():
            for lcd_ in locdeets_arr:  
              locdeets, inner_dirn, inner_neigh, locdeet_euclidean_ = lcd_
              if len( locdeets['text'] ) < 4 or len( locdeets['text'] ) >= 100: continue
              if 'BOT' not in inner_dirn : continue

              print('INNER->', locdeets)

              deet_pts_ = [ int( deets['pts'][0]*scaling_wd_ ), int( deets['pts'][1]*scaling_ht_ ),\
                    int( deets['pts'][2]*scaling_wd_ ), int( deets['pts'][3]*scaling_ht_ ) ]
            
              fuzzer_ = fuzz.ratio( deets['text'] , locdeets['text'] )
              outerz_, innerz_ = outer_neigh['NEIGH'], inner_neigh['NEIGH']
              print('Comparing CurrentNeigh 0.0->', locdeets, deets, innerz_, ' RefNeigh->', deet_pts_, outerz_,\
                    outer_dirn, inner_dirn, fuzzer_)

              if fuzzer_ > 50 \
                and commonWords( locdeets['text'], deets['text'], fuzzer_ ) is True:
              ## now check co-ords
                if ( outer_dirn == inner_dirn \
                          or ('BOT' in outer_dirn and 'BOT' in inner_dirn ) \
                          or ('TOP' in outer_dirn and 'TOP' in inner_dirn ) ) and \
                          euclideanOverlap( deets, locdeets, deet_euclidean_, locdeet_euclidean_, rawJson ) and\
                    notAlreadyAssigned( responseD, wd ):

                  matches_[ str(locdeets['pts'][0])+'_'+str(locdeets['pts'][1]) ] = \
                        ( locdeets, abs( locdeet_euclidean_ - deet_euclidean_ ), inner_dirn )
                  #matches_.append( ( locdeets, abs( locdeet_euclidean_ - deet_euclidean_ ), inner_dirn ) )
                  print('HANCOCK->', locdeets, deets , inner_dirn, matches_, doc_utils.dataType( locdeets['text'] ),\
                        doc_utils.dataType( deets['text'] ))
                  print('ADDED->', ( locdeets, abs( locdeet_euclidean_ - deet_euclidean_ ), inner_dirn ))        
                  ## check for neighbours as well ..if they too match, then double incremennt matches
                  neigh_bool, neigh_match_ = checkNeighboursAsWell( outerz_, innerz_, \
                                                                    deet_euclidean_, locdeet_euclidean_ )
                  if neigh_bool is True:
                    print('HANBULL-> Neigh match as well!->', matches_)
                    for elem in neigh_match_:
                        if str(elem[0]['pts'][0])+'_'+str(elem[0]['pts'][1]) in matches_: continue

                        matches_[ str(elem[0]['pts'][0])+'_'+str(elem[0]['pts'][1]) ] = elem
                        print('ADDED2->', elem)        

    print('GOGO->', time.time() - timer_)          
    if len( matches_ ) >= 1: 
        print( 'LOCAL MATCH FOUND->', wd , matches_ )
        return True, list(matches_.values()), dontUseLeftOrTop, currNeigh_

    return False, [], dontUseLeftOrTop, currNeigh_

def similarChar( txt1, txt2 ):

    caps, small, digits = 0, 0, 0
    for char in txt1:
        if ( ord(char) >= 48 and ord(char) <= 57 ) or ( char in ['-', '/' , '$', '.', ',', ' '] ): digits += 1
        if ord(char) >= 65 and ord(char) <= 91: small += 1
        if ord(char) >= 97 and ord(char) <= 122: caps += 1

    caps2, small2, digits2 = 0, 0, 0
    for char in txt2:
        if ( ord(char) >= 48 and ord(char) <= 57 ) or ( char in ['-', '/' , '$', '.', ',', ' '] ): digits2 += 1
        if ord(char) >= 65 and ord(char) <= 91: small2 += 1
        if ord(char) >= 97 and ord(char) <= 122: caps2 += 1

    ## check if caps, small, dig chars are the same
    if caps > 0 and small > 0 and digits == 0 and caps2 > 0 and small2 > 0 and digits2 == 0: return True ## MIXED
    if caps > 0 and digits > 0 and small == 0 and caps2 > 0 and digits2 > 0 and small2 == 0: return True ## ALNUM
    if digits > 0 and small == 0 and digits2 > 0 and small2 == 0: return True ## DIGITS

    print('DINGED->',  txt1, txt2 )
    return False

def acceptableYOffset( pts1, pts2 ):

    print( 'acceptableYOffset INP->',pts1, pts2 )
    if abs( pts1[1] - pts2[1] ) > 400: return False
    elif abs( pts1[1] - pts2[1] ) <= 400: return True

    return True

def leftToRight( field_val, ll_, wdd_, idc_ ):

    txt, pts = wdd_['text'], wdd_['pts']

    for rr in range( idc_-1, -1, -1 ):
        localwd = ll_[ rr ]
        if abs( localwd['pts'][2] - pts[0] ) <= 20:
            txt = localwd['text'] + ' ' + txt
            pts = [ localwd['pts'][0], localwd['pts'][1], pts[2], pts[3] ]

    for rr in range( idc_+1, len(ll_) ):
        localwd = ll_[ rr ]
        if abs( localwd['pts'][0] - pts[2] ) <= 20:
            txt = txt + ' ' + localwd['text']
            pts = [ pts[0], pts[1], localwd['pts'][2], localwd['pts'][3] ]

    if pts == wdd_['pts']: return wdd_

    wdd_['text'], wdd_['pts'] = txt, pts

    return wdd_

def completeMultiLine( value_, field_val, rawJson, threshold=3 ):

    extracted_txt_, extracted_pts_ = value_['text'], value_['pts']
    print('Checking if  completeMultiLine is necessary ->', value_)
    print('Y offsets == ', abs( field_val[1] - field_val[-1] ), abs( extracted_pts_[1] - extracted_pts_[-1] ) )

    if abs( field_val[1] - field_val[-1] ) > threshold*abs( extracted_pts_[1] - extracted_pts_[-1] ):
        print('Looks like theres more to this contour->', extracted_pts_, field_val )
        ## find one contour that xoverlaps with this extracted_pts_ and then complete the left and right
        idx_ = -1
        for idx, line_ in enumerate( rawJson['lines'] ):
            found_ = False
            for wd in line_:
                if abs( wd['pts'][1] - extracted_pts_[1] ) <= 5:
                    found_ = True
                    idx_ = idx

            if found_: break

        print('Found Line IDX from where we look either DOWN or UP->', idx_)
        print( rawJson['lines'][idx_] )

        usedAboveToComplete_ , lookup = False, False

        if abs( field_val[1] - extracted_pts_[1] ) > 2*( abs( field_val[-1] - extracted_pts_[-1] ) ):
            print('We need to be GOING ABOVE')
            lookup = True
        elif abs( field_val[-1] - extracted_pts_[-1] ) > 2*( abs( field_val[1] - extracted_pts_[1] ) ):    
            print('We need to be GOING BELOW')
        elif 2*abs( extracted_pts_[1] - extracted_pts_[-1] ) < ( abs( field_val[1] - field_val[-1] ) ):    
            print('We need to be GOING BELOW')
        else:
            return value_

        if idx_ != -1 and lookup is True:

            for idd_ in range( idx_-1, -1, -1 ):
                ll_, completed_ = rawJson['lines'][idd_], None

                for idc_, wdd_ in enumerate( ll_ ):
                    if abs( wdd_['pts'][-1] - extracted_pts_[1] ) > 20: continue

                    if doc_utils.xOverlap( extracted_txt_, extracted_pts_, wdd_['text'], wdd_['pts'] ):

                      completed_ = leftToRight( field_val, ll_, wdd_, idc_ )

                      if completed_ is not None: break

                if completed_ is not None:
                    print('Found completed before ->', completed_, ' == ', extracted_txt_, extracted_pts_)
                    extracted_txt_ = completed_['text'] +' '+extracted_txt_
                    extracted_pts_ = [ completed_['pts'][0], completed_['pts'][1], extracted_pts_[2],\
                                                                                   extracted_pts_[3] ] 
                    usedAboveToComplete_ = True
                    break

        print('DiD it find anything ABOVE ??->', usedAboveToComplete_) 
        if idx_ != -1 and usedAboveToComplete_ is False:
            ## now look below

            for idd_ in range( idx_+1, min( idx_+5, len( rawJson['lines'] ) ) ):
                ll_, completed_ = rawJson['lines'][idd_], None
                print('GROGGY->', ll_)

                for idc_, wdd_ in enumerate( ll_ ):
                    if abs( wdd_['pts'][1] - extracted_pts_[-1] ) > 20: continue

                    if doc_utils.xOverlap( extracted_txt_, extracted_pts_, wdd_['text'], wdd_['pts'] ):

                      completed_ = leftToRight( field_val, ll_, wdd_, idc_ )

                      if completed_ is not None: break

                if completed_ is not None:
                    print('Found completed before ->', completed_, ' == ', extracted_txt_, extracted_pts_)
                    extracted_txt_ += ' ' + completed_['text']
                    extracted_pts_ = [ extracted_pts_[0], extracted_pts_[1], completed_['pts'][2],\
                                                                                   completed_['pts'][3] ] 

    value_['text'], value_['pts'] = extracted_txt_, extracted_pts_
    return value_

def majorityText( t1, t2 ):
    


    value_['text'], value_['pts'] = extracted_txt_, extracted_pts_
    return value_

def majorityText( t1, t2 ):
    
    numtxt1, numtxt2 = 0, 0

    for char in t1:
        if (ord(char) >= 65 or ord(char) <= 91) or (ord(char) >= 97 or ord(char) <= 122): numtxt1 += 1

    for char in t2:
        if (ord(char) >= 65 or ord(char) <= 91) or (ord(char) >= 97 or ord(char) <= 122): numtxt2 += 1

    #if numtxt1 > 0.7*len(t1) and numtxt2 > 0.7*len(t2): return True

    return False

def findNeighbouringStrips( field_val, field_co_ords, trg_ocr_op_, mode=None ):

    sta_ = time.time()
    inp_, sentinel_idx_ = dict(), None

    if len( field_co_ords ) != 4: return inp_

    for lineidx, line in enumerate( trg_ocr_op_ ):
        for wdix , wd in enumerate( line ):
            #print( 'WTE->', wd, field_co_ords, line )
            if mode is not None and ( wd['pts'] == field_co_ords or\
              ( abs( wd['pts'][1] - field_co_ords[1] ) <= 10 ) ) and sentinel_idx_ is None:
              sentinel_idx_ = lineidx
              print('FOr REF field_val = ', field_val, field_co_ords, ' Sentinel Line = ', trg_ocr_op_[ sentinel_idx_ ], sentinel_idx_ )

            elif mode is None and wd['pts'] == field_co_ords:    
              sentinel_idx_ = lineidx
              print('FOr LOCAL field_val = ', field_val, field_co_ords, ' Sentinel Line = ', trg_ocr_op_[ sentinel_idx_ ] )

            if doc_utils.dataType( wd['text'] ) not in ['ALNUM','DIGIT'] and \
              doc_utils.xOverlap( field_val, field_co_ords, wd['text'], wd['pts'] ):

                if 'VERTICAL' in inp_:
                  ll_ = inp_['VERTICAL']
                else:
                  ll_ = list()

                ll_.append( wd['text'] )    
                inp_['VERTICAL'] = ll_
                ## now check if left and right of this is also non alnum and non digit and add to other key
                ##LEFT
                if wdix > 0 and doc_utils.dataType( line[ wdix-1 ]['text'] ) not in ['ALNUM','DIGIT']:

                  if 'VERTICAL_LEFT' in inp_:
                    ll_ = inp_['VERTICAL_LEFT']
                  else:
                    ll_ = list()

                  ll_.append( line[ wdix-1 ]['text'] )    
                  inp_['VERTICAL_LEFT'] = ll_
                ##RT
                if wdix < len( line )-1 and doc_utils.dataType( line[ wdix+1 ]['text'] ) not in ['ALNUM','DIGIT']:

                  if 'VERTICAL_RT' in inp_:
                    ll_ = inp_['VERTICAL_RT']
                  else:
                    ll_ = list()

                  ll_.append( line[ wdix+1 ]['text'] )    
                  inp_['VERTICAL_RT'] = ll_

    tmp_ = inp_.copy()
    inp_ = dict()

    for kk, vv in tmp_.items():
        #print('MC-KAGAN->', vv)
        inp_[ kk ] = ' '.join( vv )

    if sentinel_idx_ is not None and sentinel_idx_ > 0 and sentinel_idx_ <= len( trg_ocr_op_ )-1:
        ## check text from line above and below
        txt_above, txt_below, txt_same = '', '', ''

        for wd in trg_ocr_op_[ sentinel_idx_ - 1 ]: 
            if doc_utils.dataType( wd['text'] ) not in ['ALNUM','DIGIT']:
              txt_above += ' ' + wd['text']

        if sentinel_idx_ < len( trg_ocr_op_ )-1: 
          for wd in trg_ocr_op_[ sentinel_idx_ + 1 ]: 
            if doc_utils.dataType( wd['text'] ) not in ['ALNUM','DIGIT']:
              txt_below += ' ' + wd['text']
        ## add same line content as well

        for wd in trg_ocr_op_[ sentinel_idx_ ]: 
            #if doc_utils.dataType( wd['text'] ) not in ['ALNUM','DIGIT']:
            if wd['pts'][2] < field_co_ords[0]:
              txt_same += ' ' + wd['text']

        inp_['HORIZONTAL_ABOVE'] = txt_above
        inp_['HORIZONTAL_BELOW'] = txt_below
        inp_['HORIZONTAL_SAME'] = txt_same

    return inp_

def common_seq( ref_, curr_ ):

    ## find words that are common ( meaning exact match and also in sequence )
    ref_arr_, curr_arr_ = ref_.split(), curr_.split()
    ref_idx, curr_idx, last_, common = 0, 0, [], []
    st_time_ = time.time()

    shorter_ = len(ref_arr_) if len(ref_arr_) < len( curr_arr_ ) else len( curr_arr_ )

    while ref_idx <= len( ref_arr_ ) - 1:
        ref_wd_ = ref_arr_[ ref_idx ]
        try:
          curr_idx = curr_arr_.index( ref_wd_ ) 
        except:
          curr_idx = -1 
          ## check in loop using fuzz score
          for idxx, ii in enumerate( (curr_arr_) ):
              if fuzz.ratio( ii, ref_wd_ ) > 80:
                  curr_idx = idxx
          #print('Exception while reading ?', ref_wd_)
          pass
        
        #if curr_idx != -1:
        #    print('No exception with this->', ref_wd_, curr_idx, last_)

        if curr_idx != -1 and curr_idx not in last_: 
            common.append( (ref_wd_, curr_idx) )
            last_.append( curr_idx )

        ref_idx += 1    

    #print('Common WDS->', ref_,'\n', curr_ ,'\n',common, '\n', \
    #        len( common ), len( ref_arr_ ), len( curr_arr_ ), len( common ) >= 0.5*( shorter_ )) 

    if len( common ) >= 0.5*( shorter_ ) or ( len( common ) >= 0.3*( shorter_ ) and \
                                              len( common ) >= 10 ): 
        return True

    return False

def alnumTxtDiff( local, ref ):
    ## though we are ok with matching ALL_CAPS and ALNUM, there should be a bare min threshold
    ## to seperate out stuff like "ABCD" and "A33HJKK2" 
    numt_loc , numt_ref = 0, 0

    for char in local:
        if ord(char) >= 48 and ord(char) <= 57: numt_loc += 1

    for char in ref:
        if ord(char) >= 48 and ord(char) <= 57: numt_ref += 1

    ## the last "and" condn is to ensure stuff like ADDRESS doesnt end up as FN ..since the address comparison
    ## isn't straightfwd ..u check a word like PRESTIGE in PRESTIGE IVY 5004345 ..so though the word is an overlap
    ## and a part of the addr, the "ref" has > 3 numbers and the local has 0 ..will get rejected ..so u ensure
    ## u DONT do this comparison for ADDR which typically has > 3 contours
    if numt_ref >= 3 and numt_loc == 0 and len( ref.split() ) <= 3: return None

    return 'OK'

def stitchNearby( text, lineIdx, line_ ):

    tmp_ = text[:]

    for idx in range( lineIdx, len(line_)-1 ):
        curr, next_ = line_[idx], line_[idx+1]
        if abs( curr['pts'][2] - next_['pts'][0] ) <= 5:
            tmp_ += ' ' + next_['text']
        else:
            break

    if text != tmp_:
        print('Returnin from stitchNearby..', tmp_)

    return tmp_        

def completeIT( value_, stored_potential_, field_val ):

    #print( stored_potential_ ) 
    line_, line_idx = stored_potential_[3], stored_potential_[4]

    for idx in range( line_idx-1, -1, -1 ):
        if abs( line_[idx]['pts'][2] - value_['pts'][0] ) <= 10:
            value_['text'] = line_[idx]['text'] + ' ' + value_['text']
            value_['pts'] = [ line_[idx]['pts'][0], line_[idx]['pts'][1], value_['pts'][2], value_['pts'][3] ]

    for idx in range( line_idx+1, len( line_ ) ):
        if abs( line_[idx]['pts'][0] - value_['pts'][2] ) <= 10:
            value_['text'] += ' ' + line_[idx]['text']
            value_['pts'] = [ value_['pts'][0], value_['pts'][1], line_[idx]['pts'][2], line_[idx]['pts'][3] ]

    ## if field is date and has been formatted differently do shit here
    fdtype_ = doc_utils.dataType( field_val )
    print('UKD-> fdtype_, field_val, monthInValue = ', value_['text'] , fdtype_, len( field_val.split('/') ), \
         len( field_val.split('-') ), monthInValue( value_['text'] ) if value_ is not None else None,\
         doc_utils.dataType( value_['text'] ) )

    #NOTE-> CHANGES MADE FOR IMPROVING DATE ACC - 20th March 2024 ( date of code change :P )
    if fdtype_ == 'DATE' and ( len( field_val.split('/') ) == 3 or len( field_val.split('-') ) == 3 ) and\
            monthInValue( value_['text'] )[0] is True if value_ is not None else False:
                print('Formatting diff ->', field_val, value_['text'])
                mnth_idx_ = monthInValue( value_['text'] )[1] + 1
                mnth_nm = months[ monthInValue( value_['text'] )[1] ]
                if mnth_nm in value_['text'].lower():
                  tmpIdx = value_['text'].lower().index( mnth_nm )
                else:
                    mnth_nm = months_short[ monthInValue( value_['text'] )[1] ]
                    tmpIdx = value_['text'].lower().index( mnth_nm )

                dt_ = None

                for dt_idx in range(31, -1, -1):
                    if str( dt_idx ) in value_['text'][:tmpIdx]:
                        dt_ = dt_idx
                        break
                if dt_ is None:
                    ## prev line was checking for format 18th Mar 2024 .. we also need to check for Mar 18, 2024
                    for dt_idx in range(1, 31):
                        if dt_idx < 10: tmp_ = '0' + str( dt_idx )
                        else: tmp_ = str( dt_idx ) 
                        
                        cy_ = str( datetime.now().year )
                        sentinel_ = len(value_['text'])-4 if cy_ in value_['text'][-5:] else\
                                    len(value_['text'])-2

                        if tmp_ in value_['text'][ tmpIdx: sentinel_ ]:
                            dt_ = dt_idx
                            break

                print('did we find the DATE ??', dt_)
                if '/' in field_val: 
                    delim = '/'
                    dt_arr_ = field_val.split('/')
                elif '-' in field_val: 
                    delim = '-'
                    dt_arr_ = field_val.split('-')
                else: 
                    delim = ' '
                    dt_arr_ = field_val.split(' ')

                if dt_ is not None:
                    mnth_ = str( mnth_idx_ ) if mnth_idx_ >= 10 else '0' + str( mnth_idx_ )
                    neo_dt_ = mnth_ + delim + str( dt_ ) + delim + str(dt_arr_[-1])
                    print('Changing ', value_['text'],' TO ', neo_dt_)
                    value_['text'] = neo_dt_

    elif fdtype_ == 'DATE' and ( len( field_val.split('/') ) == 3 or len( field_val.split('-') ) == 3 ) and\
            value_ is not None and doc_utils.dataType( value_['text'] ) == 'DATE':
                ## need to ensure its in the DD/MM/YYYY format
                ##CASE1-> YYYY-/MM-/DD
                try:
                  if str( datetime.now().year ) in value_['text'][:4]:
                    if '-' in value_['text']: arr_ = value_['text'].split('-')
                    if '/' in value_['text']: arr_ = value_['text'].split('/')
                    if '0' not in arr_[1] and int( arr_[1] ) < 10: arr_[1] = '0'+arr_[1]
                    if '0' not in arr_[-1] and int( arr_[-1] ) < 10: arr_[-1] = '0'+arr_[-1]

                    value_['text'] = arr_[1] + '/' + arr_[-1] + '/' + arr_[0]

                  else:

                    if '-' in value_['text']: arr_ = value_['text'].split('-')
                    if '/' in value_['text']: arr_ = value_['text'].split('/')
                    if '0' not in arr_[1] and int( arr_[1] ) < 10: arr_[1] = '0'+arr_[1]
                    if '0' not in arr_[-1] and int( arr_[-1] ) < 10: arr_[-1] = '0'+arr_[-1]
                    if '0' not in arr_[0] and int( arr_[0] ) < 10: arr_[0] = '0'+arr_[0]

                    cy_ = str( datetime.now().year )
                    if cy_[-2:] == arr_[-1]:
                        arr_[-1] = '20' + arr_[-1]

                    value_['text'] = '/'.join( arr_ )

                except:
                  print('EXCPN->', traceback.format_exc())  
                  pass

    #NOTE-> CHANGES MADE FOR IMPROVING DATE ACC - 20th March 2024 ( date of code change :P )

def isCommon( potential_tuple, direction ):

    localNeigh, currNeigh = potential_tuple[-2], potential_tuple[-1]
    loc_arr, curr_arr = [], []

    if direction in localNeigh:
        for elem in localNeigh[ direction ]:
            loc_arr.append( elem[0]['text'] )

    if direction in currNeigh:
        for elem in currNeigh[ direction ]:
            curr_arr.append( elem[0]['text'] )

    if len( loc_arr ) > 0 and len( curr_arr ) > 0:
        matched_ = []
        for idx, loc in enumerate( loc_arr ):
            for idx2, loc2 in enumerate( curr_arr ):
                if fuzz.ratio( loc, loc2 ) >= 80 and len( loc ) >= 5 and len( loc2 ) >= 5:
                    matched_.append( loc )
        
        print('Number matched in DIRN->', direction, set( matched_ ) )
        if len( matched_ ) > 0: return True

    return False    

def notNumeric( txt ):

    num_ = 0
    for char in txt:
        if ( ord(char) >= 48 and ord(char) <= 57 ) or char in [ '-','.','$',',' ]: num_ += 1

    '''
    if num_ == len( txt ):
        print('BPGUS->', txt )
        return False
    '''

    return True

def findValue( ref_ht, ref_wd, field_val, field_co_ords, field_datatype, localNeigh, rawJson, scaling_ht_, scaling_wd_, key_coord_tup_, responseD, field_name_, trg_ocr_op_, fpath ):


    input_all_neigh_ = findNeighbouringStrips( field_val, field_co_ords, trg_ocr_op_, mode='APPROX' )
    print('ENTERING findValue->', [ field_name_ ], [ field_val ] , field_co_ords, input_all_neigh_ )

    norm_ref_ = [ field_co_ords[0]/ref_wd, field_co_ords[1]/ref_ht, field_co_ords[2]/ref_wd, field_co_ords[3]/ref_ht ]

    curr_ht, curr_wd, matched_doc_id_ = rawJson['height'], rawJson['width'], None

    left_neigh_, fnm_res_ = None, fpath.split('/')[-1]
    # neigh_path_save_ = '/home/ubuntu/DOC_SIGNATURE/NEIGH/' + fnm_res_ + '.txt'
    neigh_path_save_ = os.getcwd() + '/NEIGH/' + fnm_res_ + '.txt'
    ## check if Left Neigh present ..if present in the REF and not in CURR WD, then ignore
    ## only if left neigh is NOT prsent in REF OR present in both REF and CURR WD should u go through the rest 
    if 'LEFT' in localNeigh:
        left_neigh_ = localNeigh['LEFT']

    sentinels_ = dict()
    for key, val in localNeigh.items():
        if len( val ) > 0 and ( 'TOP' in key or 'BOT' in key or 'RIGHT' in key or 'LEFT' in key ): 
            sentinels_[ key ] = val[0]

    print('SENTINELS->', sentinels_)    

    alt_timer_ = time.time()
    top, bot, topidx, botidx, all_items_, matched_by_1_wd = None, None, 0, len( rawJson['lines'] ) - 1, [], False

    ## in some instances special chars mess the extraction ..for ex PO.No 12312 ..so best to reframe
    ## the raw json itself
    for line_ in rawJson['lines']:
        mark = dict()

        print('GOIN IN->', line_)
        for idx, wd in enumerate( line_ ):

            if '.' in wd['text'] and len( wd['text'].split('.') ) == 2 and \
                    len( wd['text'].split('.')[-1].replace(' ','') ) > 2:
                arr_ = wd['text'].split('.')

                if len( arr_[1] ) == 0 or doc_utils.dataType( arr_[0] ) == 'TEXT': continue
                wd['text'] = arr_[0]

                mark[ idx ] = { 'text': arr_[1].strip(), 'pts': wd['pts'], 'ids': wd['ids'] }

            elif ':' in wd['text'] and len( wd['text'].split(':') ) == 2:
                arr_ = wd['text'].split(':')

                if len( arr_[1] ) == 0 or doc_utils.dataType( arr_[0] ) == 'TEXT': continue
                wd['text'] = arr_[0]

                mark[ idx ] = { 'text': arr_[1].strip(), 'pts': wd['pts'], 'ids': wd['ids'] }

        if mark is not None and len( mark ) > 0:
         
            insert_cnt_ = 1

            for idx_, val in mark.items():
              print('Trying to insert ', val , ' in ', idx_ + insert_cnt_ )  
              line_.insert( idx_ + insert_cnt_, val )
              insert_cnt_ += 1

            print( 'NEW LINE->', line_ )


    for key, val in sentinels_.items():
        #if top is not None: continue
        kw_ = val[0]['text'].replace(',','').replace('-','').replace(':','').replace('.','').replace('.','')
        print('Prigozhin->', key, kw_, val[0]['pts'] )

        for idx, line_ in enumerate( rawJson['lines'] ):

          for wd in line_:
            locTxt = wd['text'].replace(',','').replace('-','').replace(':','').replace('.','').replace('.','')  
            fuzzer_ = fuzz.ratio( locTxt , kw_ )

            if ( fuzzer_ > 50 ) and commonWords( locTxt , kw_, fuzzer_ ) is True and\
                    ( acceptableYOffset( val[0]['pts'], wd['pts'] ) is True ):
              #( fuzzer_ > 40 and commonWords( locdeets['text'], deets['text'] ) is True )
              if 'TOP' in key and top is None: 
                top, topidx = line_, idx
                print( 'ZAZZY TOP->', top, topidx, [locTxt], [kw_] )
                if bot is None:
                    print('Fake bottom->', bot)
                    bot = None
                break
              if 'BOT' in key and bot is None: 
                bot, botidx = line_, idx
                print('ZAZZY BOT->', bot, botidx, [locTxt], [kw_])
                break

    if top is None and bot is not None:
        ## take top 3 lines
        print('DISS-1')
        for idd in range( max( 0, botidx-25 ), min( botidx+10, len( rawJson['lines'] ) ) ):
            all_items_.append( rawJson['lines'][idd] )

    elif top is not None and ( bot is None or botidx == 0 ):
        ## take below 3 lines
        print('DISS-2')
        for idd in range( max( 0, topidx-5 ), min( topidx+20, len( rawJson['lines'] ) ) ):
            all_items_.append( rawJson['lines'][idd] )

    elif top is not None and bot is not None:
        ## take lines in between
        print('DISS-3')
        for idd in range( max( 0, topidx-5 ), min( botidx+15 , len(rawJson['lines']) ) ):
            all_items_.append( rawJson['lines'][idd] )

    elif top is None and bot is None:
        print('DISS-4')
        all_items_ = rawJson['lines']

    print( 'LOCAL SENTINELS->', field_val, field_co_ords, top, bot, topidx, botidx, all_items_, \
                                      time.time()-alt_timer_ ) 
    print('TIMER 3.1->', time.time() - start_, field_val)

    ## now iterate over the raw jsn and assemble the newvalue !!
    value_ = None
    print( 'PRE->', field_co_ords, scaling_ht_, scaling_wd_ )

    field_co_ords = [ int( scaling_wd_*field_co_ords[0] ), int( scaling_ht_*field_co_ords[1] ),\
            int( scaling_wd_*field_co_ords[2] ), int( scaling_ht_*field_co_ords[3] ) ]

    print( 'PRE2->', field_co_ords, scaling_ht_, scaling_wd_ )
    store_line_, findTime, found_val_ = None, time.time(), False
    
    max_match_ = dict()

    if len( all_items_ ) > 0: ref_arr_ = all_items_
    else: ref_arr_ = rawJson['lines']

    #ref_arr_ = rawJson['lines']

    for line_ in ref_arr_:
        if found_val_: break

        for lineIdx , wd in enumerate( line_ ):
            #if abs( field_co_ords[1] - wd['pts'][1] ) > 200: continue ## to avoid FPs
            #if abs( field_co_ords[0] - wd['pts'][0] ) > 400: continue ## to avoid FPs
            stitched_cnt_ = doc_utils.stitchEmUp( lineIdx, line_, field_val, field_co_ords )

            print('CHECKING->', wd, stitched_cnt_, \
                    field_val, field_co_ords, doc_utils.dataType( wd['text'] ), doc_utils.dataType( field_val ))

            if len( wd['text'] ) < 4 and doc_utils.dataType( wd['text'] ) == 'TEXT': continue
            if len( wd['text'] ) == 1: continue
            '''
            print( wd, field_co_ords, doc_utils.xOverlap( wd['text'], wd['pts'], 'NA', field_co_ords ),\
                    doc_utils.pure_yOverlap( wd['text'], wd['pts'], 'NA', field_co_ords ),\
                    doc_utils.dataType( wd['text'] ), field_datatype, \
                    inTheHood( localNeigh, wd, rawJson )
                    )
            '''
            loc_datatype = doc_utils.dataType( stitchNearby( wd['text'], lineIdx, line_ ) )
            if stitched_cnt_ is not None:
                loc_datatype = doc_utils.dataType( stitched_cnt_['text'] )
                print('Extra FITTINGS->', loc_datatype, stitched_cnt_)

            field_datatype = doc_utils.dataType( field_val )

            if ( doc_utils.xOverlap( wd['text'], wd['pts'], 'NA', field_co_ords ) or \
                 doc_utils.pure_yOverlap( wd['text'], wd['pts'], 'NA', field_co_ords ) or \
                 ( doc_utils.dataType( wd['text'] ) == field_datatype and \
                   field_datatype in [ 'DIGIT', 'ALNUM' ,'DATE' ] )\
               ) and\
               ( loc_datatype == field_datatype or \
                      ( loc_datatype in ['ALNUM', 'DIGIT', 'ALL_CAPS', 'DATE'] and \
                                 field_datatype in ['ALNUM', 'DIGIT','ALL_CAPS', 'DATE'] ) or \
                      majorityText( wd['text'], field_val )
                      )\
                and len( wd['text'] ) > 0 and alnumTxtDiff( wd['text'], field_val ) == 'OK':

                        print('SUBTIMER 3.101->', time.time() - start_, field_val)

                        bool_, match_val, dontUseLeftOrTop, currNeigh = inTheHood( localNeigh, wd, rawJson, scaling_ht_, \
                                                   scaling_wd_, key_coord_tup_, field_val, field_co_ords, responseD )

                        print('SUBTIMER 3.102->', time.time() - start_, field_val, bool_)

                        if bool_ is False: continue
                        if ( wd['pts'][0] < field_co_ords[0] and wd['pts'][2] < field_co_ords[2] and\
                                abs( wd['pts'][2] - field_co_ords[0] ) > 600 ) or\
                           ( wd['pts'][0] > field_co_ords[0] and wd['pts'][2] > field_co_ords[2] and\
                                abs( wd['pts'][0] - field_co_ords[2] ) > 600 ):
                                    print('PUNTING OUT', wd['pts'][0] > field_co_ords[0], \
                                            abs( wd['pts'][0] - field_co_ords[2] ))
                                    continue

                        spot_diff_ = 1000

                        if value_ is not None and wd['pts'][1] < value_['pts'][1]:
                            spot_diff_ = abs( wd['pts'][-1] - value_['pts'][1] )
                        elif value_ is not None and wd['pts'][1] > value_['pts'][1]:
                            spot_diff_ = abs( wd['pts'][1] - value_['pts'][-1] )

                        '''
                        if ( value_ is None ) or \
                          ( value_ is not None and \
                                    ( doc_utils.pure_yOverlap( value_['text'], value_['pts'], \
                                              wd['text'], wd['pts'] ) is False or spot_diff_ <= 20 ) ):
                        '''
                        if True:

                            value_ = wd
                            print('ASSIGNING to value_->', value_)
                            store_line_ = line_
                        
                        '''
                        elif value_ is not None and doc_utils.pure_yOverlap( value_['text'], value_['pts'],\
                                wd['text'], wd['pts'] ) and abs( wd['pts'][-1] - value_['pts'][1] ) >= 20\
                                and abs( wd['pts'][1] - value_['pts'][-1] ) >= 20:
                            value_['text'] += ' ' + wd['text']
                            value_['pts'][-2:] = [ wd['pts'][2], wd['pts'][3] ]
                            print('ASSIGNING to value_->', value_)
                        '''

                        print('CLOSING->', value_, len( match_val ), match_val)

                        max_match_[ value_['text'] +'_'+ str( value_['pts'][1] ) ] = \
                             ( len( match_val ) , match_val, value_, line_, lineIdx, rawJson, localNeigh, currNeigh )
                        #found_val_ = True
                        #break

    print( 'MATCH DICTS->', field_val, field_co_ords, max_match_, time.time()-alt_timer_ )
    print('TIMER 3.10->', time.time() - start_, field_val)
    ## send em to the big bad wolfie
    first_bucket, seconds_, localNeighArr_ = dict(), max_match_, dict()

    for key, potential_value in max_match_.items():
      try:  

          legit_value_, locNeigh_ = bigBadWolf( potential_value[2], input_all_neigh_, rawJson['lines'] )

          if legit_value_ is True:
            first_bucket[ key ] = potential_value
            localNeighArr_[key] = ( locNeigh_ )

      except:  

          for val_key, vals in max_match_.items():
            first = False
            for elem in vals[1]: # match_val array
                if 'LEFT' in elem[-1] or 'TOP' in elem[-1] or 'RIGHT' in elem[-1]:
                    first = True
                    break

            if first:
                first_bucket[ val_key ] = vals
            else:
                seconds_[ val_key ] = vals

    print('TIMER 3.101->', time.time() - start_, field_val)
    ## seperate into dicts that have BOTTOM vs LEFT/TOP as the matches ..first preference given to TOP & LT
    min_dist_, ref_, min_dist_2, md2_dirn, ref_lines_, closestLeftie, maxFuzzer = 10000, None, 10000, \
                                                                                   None, None, None, -1

    if len( first_bucket ) > 0:
        max_match_ = first_bucket
        print('Only going through FIRST BUCKET->', first_bucket, value_)

        max_fuzz_, min_cosine_dist, max_format_match = 0, 1000, 0

        ## Lets check the format similarity first
        #NOTE-> CHANGES MADE FOR IMPROVING SUB TOTAL ACC - 20th March 2024 ( date of code change :P )
        try:
          
          masterDict_ = dict()  
          for potential_key, potential_value in max_match_.items():
            
            score_ = format_match_( potential_value, field_val, field_co_ords, rawJson['lines'], input_all_neigh_, field_name_ )
            ## add one more sim score ..if horizontal same is present in local neigh, get cosine sim with field name
            try:
              if potential_key in localNeighArr_ and 'HORIZONTAL_SAME' in localNeighArr_[ potential_key ]:
                field_name_emb, neigh_emb = createJsonFeats.returnEmbed( field_name_ ),\
                                createJsonFeats.returnEmbed( localNeighArr_[ potential_key ]['HORIZONTAL_SAME'] )
                dist_d_ = distance.cosine( field_name_emb, neigh_emb )
                print('COS-DIST->', field_name_, localNeighArr_[ potential_key ]['HORIZONTAL_SAME'], dist_d_)

                if dist_d_ <= 0.2:
                    print('BOOSTING SCORE')
                    score_ += 0.1
              
            except:
                print('FMT_MATCH_EXCPN->', traceback.format_exc())
                pass

            if score_ >= fmt_match_threshold_ : 
                masterDict_[ score_ ] = potential_value
       
          if len( masterDict_ ) > 1:
                sorted_ = dict( sorted( masterDict_.items(), key=lambda x:x[0], reverse=True ) )
                print('MD HOUSER->', sorted_)
                score_keys_ = list( sorted_.keys() )

                #if abs( score_keys_[0] - score_keys_[1] ) <= 0.02:
                if True:
                    ## need to check LEFT and TOP of both with field
                    found_ = None
                    for key in score_keys_:
                        pv = sorted_[ key ]
                        if isCommon( pv, 'LEFT' ) and key > 0.90: # Left labels are more common hence focus on left dirn first
                            found_ = key
                            break
                    print('HUZZAH >> Found LEFT MATCH ->', found_ )
                    if found_ is None:    
                        for key in score_keys_:
                            pv = sorted_[ key ]
                            if isCommon( pv, 'TOP' ) and key > 0.90: # TOP labels are next most common 
                                found = key
                                break

                    if found_ is not None:
                        print( found_, ' is the chosen KEY ', sorted_[ found_ ])
                        stored_potential_ = sorted_[ found_ ]
                        max_format_match = found_
                        value_ = stored_potential_[2]
                    else:
                        print('Using default rank 1->')
                        stored_potential_ = sorted_[ score_keys_[0] ]
                        max_format_match = score_keys_[0]
                        value_ = stored_potential_[2]

       
          elif len( masterDict_ ) > 0:
          #elif len( masterDict_ ) > 0 and notNumeric( field_val ):
                stored_potential_ = masterDict_[ list( masterDict_.keys() )[0] ]
                max_format_match = list( masterDict_.keys() )[0]
                value_ = stored_potential_[2]
            
        except:
            max_format_match = 0
            print('DUMPSTER-FIRE', traceback.format_exc())
            pass
        #NOTE-> CHANGES MADE FOR IMPROVING SUB TOTAL ACC - 20th March 2024 ( date of code change :P )
        
        if max_format_match != 0 and max_format_match >= fmt_match_threshold_ and notNumeric( field_val ):
            print('RETURN BEST FMT MATCH->', value_, ' SCORE->', max_format_match)
            completeIT( value_, stored_potential_, field_val )
            return value_, 0.9
            ''' 
            store_line_ = potential_value[3]
            value_ = potential_value[2]
            min_cosine_dist = 0
            ''' 

        if True:    
            print('GOING FR KILL->', value_, field_val)
            for potential_key, potential_value in max_match_.items():
                tmp_value_ = potential_value[2]
                overall_fuzz_score_ = 0
                op_neigh_strips_ = findNeighbouringStrips( tmp_value_['text'], tmp_value_['pts'], rawJson['lines'] )

                for direction_key, strip_text in input_all_neigh_.items():
                    for local_dirn, local_strip in op_neigh_strips_.items():

                        if direction_key == local_dirn:
                            lfz = fuzz.ratio( strip_text, local_strip )
                            if lfz < 50: 
                                continue
                            print('Fr DIRN-> outer, inner ', direction_key, [ strip_text ],[ local_strip ], ' Fuzz ratio = ', lfz)
                            overall_fuzz_score_ += lfz
                            break

                if doc_utils.dataType( potential_value[2]['text'] ) == 'DIGIT' and \
                        doc_utils.dataType( field_val ) == 'DIGIT':
                    inp_ = potential_value[2]['text'].replace(',','')
                    field_val = field_val.replace(',','')
                else:
                    inp_ = potential_value[2]['text']
                    field_val = field_val.replace(',','')

                cosine_dist_ = distance.cosine( kv_genericPatterns.findMetaProperties( inp_ ),\
                                       kv_genericPatterns.findMetaProperties( field_val ) )

                print('For Contour->', tmp_value_,' overall fuzz ratio are ->', overall_fuzz_score_,\
                                                                           cosine_dist_, min_cosine_dist, max_fuzz_)

                if overall_fuzz_score_ > maxFuzzer:
                    maxFuzzer = overall_fuzz_score_

                if overall_fuzz_score_ == max_fuzz_:
                    print('Need tie breaker .. check TOP or LEFT')

                if overall_fuzz_score_ >= max_fuzz_ and \
                       ( \
                         ( max_fuzz_ > 0 and overall_fuzz_score_ > 0 and ( overall_fuzz_score_/max_fuzz_ ) > 1.5 ) ): 
                           ## if the curr fuzz score is 50% or so greater
                    max_fuzz_ = overall_fuzz_score_
                    store_line_ = potential_value[3]
                    value_ = potential_value[2]
                    min_cosine_dist = cosine_dist_
                    print('Assigned 1 ', value_,' as the top match with score->', overall_fuzz_score_)


    else:
        print('NO CONTENTS IN FIRST BUCKET..BEST OF THE WORST->', seconds_)
        max_match_ = seconds_

        overall_fuzz_score_, max_fuzz_, min_cosine_dist = 0, -1, 1000

        max_fuzz_, min_cosine_dist, max_format_match = 0, 1000, 0

        ## Lets check the format similarity first
        try:
          orig = dict()  
          for potential_key, potential_value in max_match_.items():
            score_ = format_match_( potential_value, field_val, field_co_ords, rawJson['lines'], input_all_neigh_, field_name_ )

            if score_ > max_format_match and score_ >= fmt_match_threshold_: 
                max_format_match = score_
                value_ = potential_value[2]
                orig[ potential_key ] = potential_value
        
        except:
            print('DUMPSTER-FIRE')
            max_format_match = 0
            pass

        if max_format_match != 0 and max_format_match >= fmt_match_threshold_ and notNumeric( field_val ):
            print('RETURN BEST FMT MATCH->', value_, ' SCORE->', max_format_match)
            return value_, 0.9
            '''
            store_line_ = potential_value[3]
            value_ = potential_value[2]
            min_cosine_dist = 0
            '''

        if True:

            for potential_key, potential_value in max_match_.items():
                tmp_value_ = potential_value[2]
                overall_fuzz_score_ = 0
                op_neigh_strips_ = findNeighbouringStrips( tmp_value_['text'], tmp_value_['pts'], rawJson['lines'] )

                for direction_key, strip_text in input_all_neigh_.items():
                    for local_dirn, local_strip in op_neigh_strips_.items():

                        if direction_key == local_dirn:
                            lfz = fuzz.ratio( strip_text, local_strip )
                            if lfz < 50: continue
                            print('Fr DIRN-> outer, inner ', direction_key, [ strip_text ],[ local_strip ], ' Fuzz ratio = ', lfz)
                            overall_fuzz_score_ += lfz
                            break

                if doc_utils.dataType( potential_value[2]['text'] ) == 'DIGIT' and \
                        doc_utils.dataType( field_val ) == 'DIGIT':
                    inp_ = potential_value[2]['text'].replace(',','')
                    field_val = field_val.replace(',','')
                else:
                    inp_ = potential_value[2]['text']
                    field_val = field_val.replace(',','')

                cosine_dist_ = distance.cosine( kv_genericPatterns.findMetaProperties( inp_ ),\
                                       kv_genericPatterns.findMetaProperties( field_val ) )

                print('For Contour->', tmp_value_,' overall fuzz ratio are ->', overall_fuzz_score_,\
                                                                           cosine_dist_, min_cosine_dist, max_fuzz_)

                if overall_fuzz_score_ >= maxFuzzer:
                    maxFuzzer = overall_fuzz_score_

                if overall_fuzz_score_ >= max_fuzz_ and \
                        ( cosine_dist_ < min_cosine_dist or abs( cosine_dist_ - min_cosine_dist ) <= 0.05 ):
                    max_fuzz_ = overall_fuzz_score_
                    store_line_ = potential_value[3]
                    value_ = potential_value[2]
                    min_cosine_dist = cosine_dist_
                    print('Assigned 2 ', value_,' as the top match with score->', overall_fuzz_score_)

    print('TIMER 3.11->', time.time() - start_, field_val, value_)

    if store_line_ is not None:
      print('CHECKING LINE->', store_line_)  
      # find idx
      idx_ = 0
      for idd, elm in enumerate( store_line_ ):
          if elm['pts'] == value_['pts']:
              idx_ = idd
              break
      
      # back check
      resp_, maxXoffset, maxWidth = value_.copy(), 15, ( field_co_ords[2] - field_co_ords[0] )*3
      for idd in range( idx_-1, -1, -1 ):
          if resp_['pts'][0] - store_line_[ idd ]['pts'][2] <= maxXoffset \
                  and ( resp_['pts'][2] - store_line_[ idd ]['pts'][0] ) < maxWidth:
              resp_['text'] = store_line_[ idd ]['text'] + ' ' + resp_['text']
              resp_['pts'] = [ store_line_[ idd ]['pts'][0], store_line_[ idd ]['pts'][1],\
                               resp_['pts'][2], resp_['pts'][3] ]

      ## fwd check        
      if idx_+1 < len(store_line_):
        for idd in range( idx_+1, len(store_line_) ):
          print('In FWD check->', store_line_[ idd ], resp_, maxWidth)  
          if store_line_[ idd ]['pts'][0] - resp_['pts'][2] <= maxXoffset \
                  and ( store_line_[ idd ]['pts'][2] - resp_['pts'][0] ) < maxWidth:
              resp_['text'] = resp_['text'] + ' ' + store_line_[ idd ]['text'] 
              resp_['pts'] = [ \
                               resp_['pts'][0], resp_['pts'][1], store_line_[ idd ]['pts'][2],\
                               store_line_[ idd ]['pts'][3] ]

    result_str_ = 'BEGIN LOG FOR '+fnm_res_+'\nFor Field Val = '+str( field_val )+' , '+str( field_co_ords )

    if value_ is not None:
      value_ = completeMultiLine( value_, field_co_ords, rawJson )

      result_str_ += '\nFound Extracted Val = '+value_['text']+' , '+str(value_['pts'])

    ## if field is date and has been formatted differently do shit here
    fdtype_ = doc_utils.dataType( field_val )
    print('UKD-> fdtype_, field_val, monthInValue = ', fdtype_, value_, len( field_val.split('/') ), \
         len( field_val.split('-') ), monthInValue( value_['text'] ) if value_ is not None else None )

    if fdtype_ == 'DATE' and ( len( field_val.split('/') ) == 3 or len( field_val.split('-') ) == 3 ) and\
            monthInValue( value_['text'] )[0] is True if value_ is not None else False:
                print('Formatting diff ->', field_val, value_['text'])
                mnth_idx_ = monthInValue( value_['text'] )[1] + 1
                mnth_nm = months[ monthInValue( value_['text'] )[1] ]
                if mnth_nm in value_['text'].lower():
                  tmpIdx = value_['text'].lower().index( mnth_nm )
                else:
                    mnth_nm = months_short[ monthInValue( value_['text'] )[1] ]
                    tmpIdx = value_['text'].lower().index( mnth_nm )
                dt_ = None

                for dt_idx in range(31, -1, -1):
                    if str( dt_idx ) in value_['text'][:tmpIdx]:
                        dt_ = dt_idx
                        break
                if dt_ is None:
                    ## prev line was checking for format 18th Mar 2024 .. we also need to check for Mar 18, 2024
                    for dt_idx in range(1, 31):
                        if dt_idx < 10: tmp_ = '0' + str( dt_idx )
                        else: tmp_ = str( dt_idx ) 
                        
                        cy_ = str( datetime.now().year )
                        sentinel_ = len(value_['text'])-4 if cy_ in value_['text'][-5:] else\
                                    len(value_['text'])-2

                        if tmp_ in value_['text'][ tmpIdx: sentinel_ ]:
                            dt_ = dt_idx
                            break

                if '/' in field_val: 
                    delim = '/'
                    dt_arr_ = field_val.split('/')
                elif '-' in field_val: 
                    delim = '-'
                    dt_arr_ = field_val.split('-')
                else: 
                    delim = ' '
                    dt_arr_ = field_val.split(' ')

                if dt_ is not None:
                    mnth_ = str( mnth_idx_ ) if mnth_idx_ >= 10 else '0' + str( mnth_idx_ )
                    neo_dt_ = mnth_ + delim + str( dt_ ) + delim + str(dt_arr_[-1])
                    print('Changing ', value_['text'],' TO ', neo_dt_)
                    value_['text'] = neo_dt_

    elif fdtype_ == 'DATE' and ( len( field_val.split('/') ) == 3 or len( field_val.split('-') ) == 3 ) and\
            value_ is not None and doc_utils.dataType( value_['text'] ) == 'DATE':
                ## need to ensure its in the DD/MM/YYYY format
                ##CASE1-> YYYY-/MM-/DD
                try:
                  if str( datetime.now().year ) in value_['text'][:4]:
                    if '-' in value_['text']: arr_ = value_['text'].split('-')
                    if '/' in value_['text']: arr_ = value_['text'].split('/')
                    if '0' not in arr_[1] and int( arr_[1] ) < 10: arr_[1] = '0'+arr_[1]
                    if '0' not in arr_[-1] and int( arr_[-1] ) < 10: arr_[-1] = '0'+arr_[-1]

                    value_['text'] = arr_[1] + '/' + arr_[-1] + '/' + arr_[0]

                  else:

                    if '-' in value_['text']: arr_ = value_['text'].split('-')
                    if '/' in value_['text']: arr_ = value_['text'].split('/')
                    if '0' not in arr_[1] and int( arr_[1] ) < 10: arr_[1] = '0'+arr_[1]
                    if '0' not in arr_[-1] and int( arr_[-1] ) < 10: arr_[-1] = '0'+arr_[-1]
                    if '0' not in arr_[0] and int( arr_[0] ) < 10: arr_[0] = '0'+arr_[0]

                    cy_ = str( datetime.now().year )
                    if cy_[-2:] == arr_[-1]:
                        arr_[-1] = '20' + arr_[-1]

                    value_['text'] = '/'.join( arr_ )

                except:
                  print('EXCPN->', traceback.format_exc())  
                  pass


    total_matches_, op_neigh_strips_ = 0, []

    print('TIMER 3.12->', time.time() - start_, field_val, value_)

    if value_ is not None and len( value_['pts'] ) == 4:
      op_neigh_strips_ = findNeighbouringStrips( value_['text'], value_['pts'], rawJson['lines'] )
      # input_all_neigh_

      for key, val in input_all_neigh_.items():
          if key in op_neigh_strips_:
              #print('For KEY->', key, ' FUZZ MATCH ->', fuzz.ratio( val, op_neigh_strips_[key] ))
              fuzzr_ = fuzz.ratio( val, op_neigh_strips_[key] )
              result_str_ += '\n**************************'
              result_str_ += '\nKEY = ' + key
              result_str_ += '\nREFERENCE = '+val
              result_str_ += '\nCURRENT = '+op_neigh_strips_[key]
              result_str_ += '\nFUZZ RATIO = '+str( fuzzr_ )
              ## find common words in sequence
              common_wds_bool_ = common_seq( val, op_neigh_strips_[key] )
              if fuzzr_ >= 60 and common_wds_bool_ is True:
                  overall_match_ = True
                  total_matches_ += 1
              else:    
                  print('EITHER fuzzr->', fuzzr_, ' Or common_wds_bool_ ->', common_wds_bool_)
                  overall_match_ = False

              result_str_ += '\nMATCH = '+str( overall_match_ )

    result_str_ += '\nEND LOG\n'
    #confidence_score_ = (1 - min_cosine_dist)*100
    if len( op_neigh_strips_ ) == 0:
        return None, 0

    print('TIMER 3.2->', time.time() - start_, field_val)
    denominator_ = max( len( input_all_neigh_ ), len( op_neigh_strips_ ) )
    confidence_score_ = (total_matches_/denominator_)
    ## since total_matches is pretty robust, we give it 50% weight
    ## cosine similarity & max_fuzz_/maxFuzzer get 25% each    
    final_confidence_score_ = 0.5*( confidence_score_ ) + 0.25*( 1 - min_cosine_dist ) \
                             + ( 0.25*( max_fuzz_/maxFuzzer ) if maxFuzzer > 0 else 0 )
    print( 'RETURNING FINAL2->', final_confidence_score_*100, value_, result_str_, time.time() - alt_timer_ )
    print('DOG BONE-> value_, confidence_score_, min_cosine_dist, max_fuzz_, maxFuzzer, field_val, field_name_ = ', \
            value_, confidence_score_, min_cosine_dist, max_fuzz_, maxFuzzer, field_val, field_name_)

    tmp_fp_ = open( neigh_path_save_, 'a' )
    tmp_fp_.write( result_str_ )
    tmp_fp_.close()

    return value_, final_confidence_score_

def returnFeatVec( txt , txt_vec_ ):

    numcaps, numdigs, first_cap_idx, first_dig_idx, special_hyphen, special_slash, special_ = 0, 0, 0, 0, 0, 0, 0
    special_D = dict()
    for idx, char in enumerate( txt ):
        if ord( char ) >= 65 and ord( char ) <= 97: 
            numcaps += 1
            if first_cap_idx == 0: first_cap_idx = idx

        if ord( char ) >= 48 and ord( char ) <= 57: 
            numdigs += 1
            if first_dig_idx == 0: first_dig_idx = idx

        if char in [ '.', ',', '$', '/', ':' , ';' , '-', '_', '%' ] and idx <= len( txt ) - 1 and\
                idx >= 0: 
            
            if '/' == char: special_slash += 1         
            elif '-' == char: special_hyphen += 1         
            else: special_ += 1    

            if char in special_D:
                special_D[ char ] += 1
            else:
                special_D[ char ] = 1

    print( txt ,' ==  2 things-> numdigs, special_, len( txt ), len( special_D.keys() ), list( special_D.keys() )',\
            numdigs, special_, len( txt ), len( special_D.keys() ), list( special_D.keys() ) )

    #NOTE-> CHANGES MADE FOR IMPROVING TOT INV AMOUNT ACC - 20th March 2024 ( date of code change :P )
    if numdigs + special_ == len( txt ) and ( list( special_D.keys() ) == [','] or \
            list( special_D.keys() ) == [',','.'] or list( special_D.keys() ) == ['.'] or\
            list( special_D.keys() ) == ['$',',','.'] or list( special_D.keys() ) == ['$','.'] ):
        special_ = 0 ## sometimes agents enter 4,56,000 as 456000 and when the post processing happens the best match fails because the OCR gives it as it were and it fails
    elif numdigs + numcaps + special_ == len( txt ) and txt[0] == 'S' and numcaps == 1 and \
            ( list( special_D.keys() ) == ['S',',','.'] or list( special_D.keys() ) == ['S','.'] or\
                list( special_D.keys() ) == ['.'] or list( special_D.keys() ) == [',','.'] ) :
        special_ = 0

    #END-> CHANGES MADE FOR IMPROVING TOT INV AMOUNT ACC - 20th March 2024 ( date of code change :P )

    txt_vec_.append( numcaps ); txt_vec_.append( numdigs );

    if first_cap_idx < len( txt ) - 2:
        txt_vec_.append( first_cap_idx ); 
    else:    
        txt_vec_.append( 0 ); 

    txt_vec_.append( first_dig_idx ); 
    txt_vec_.append( special_*100 )   ; txt_vec_.append( special_slash*100 ); txt_vec_.append( special_hyphen*100 )

    if special_ > 0 or special_slash > 0 or special_hyphen > 0:
        most_freq_special_ = list( dict( sorted( special_D.items(), key=lambda x:x[1], reverse=True ) ).keys() )[0]
        txt_vec_.append( most_freq_special_ )

    return txt_vec_

def bigBadWolf( potential_value, field_neigh_, trg_ocr_op_ ):

    same_dist_, above_dist_ = 100, 100 # simple init values

    input_all_neigh_ = findNeighbouringStrips( potential_value['text'], potential_value['pts'], trg_ocr_op_, mode='APPROX' )
    print('SENT EMBD START-> potential_value, input_all_neigh_ ->', potential_value, input_all_neigh_, field_neigh_)

    ## if 'HORIZONTAL_ABOVE' or 'HORIZONTAL_SAME' have min cosine dist, we know for a fact this is the best
    if 'HORIZONTAL_SAME' in input_all_neigh_ and 'HORIZONTAL_SAME' in field_neigh_ and \
            ( len( field_neigh_['HORIZONTAL_SAME'] ) > 0 or len( input_all_neigh_['HORIZONTAL_SAME'] ) > 0 ):
        ref_emb, curr_emb = createJsonFeats.returnEmbed( field_neigh_['HORIZONTAL_SAME'] ),\
                            createJsonFeats.returnEmbed( input_all_neigh_['HORIZONTAL_SAME'] )

        same_dist_ = distance.cosine( ref_emb, curr_emb )
        print( 'HOR SAME COS DIST ->', same_dist_ )

    if 'HORIZONTAL_ABOVE' in input_all_neigh_ and 'HORIZONTAL_ABOVE' in field_neigh_ and \
            ( len( field_neigh_['HORIZONTAL_ABOVE'] ) > 0 or len( input_all_neigh_['HORIZONTAL_ABOVE'] ) > 0 ):
        ref_emb, curr_emb = createJsonFeats.returnEmbed( field_neigh_['HORIZONTAL_ABOVE'] ),\
                            createJsonFeats.returnEmbed( input_all_neigh_['HORIZONTAL_ABOVE'] )

        above_dist_ = distance.cosine( ref_emb, curr_emb )
        print( 'HOR ABOVE COS DIST ->', above_dist_ )

    if ( ( same_dist_ <= 0.4 and above_dist_ <= 0.4 ) or ( same_dist_ <= 0.1 ) ) or\
            ( same_dist_ == 100 and above_dist_ <= 0.1 ) or\
            not( 'HORIZONTAL_SAME' in field_neigh_ ):# or ( above_dist_ <= 0.1 ):
        print('CONSIDER->', potential_value )
        return True, input_all_neigh_

    return False, input_all_neigh_

def format_match_( potential_tuple, field_val, field_co_ords, trg_ocr_op_, field_neigh_, field_name_ ):

    # potential_tuple = ( len( match_val ) , match_val, value_, line_, lineIdx )
    num_matches_, _, potential_value, line_, wdIdx , rawJson, _, _ = potential_tuple
    ## analyze structure of value .. like # of caps, num of digits , first index of cap , first index of dig
    ## once this vector is ready, do a cosine distance

    ## check if selected value has neighbours that are in the range of the feedback co-ords
    tmp_ = potential_value

    if field_co_ords[2] - field_co_ords[0] > 2*( tmp_['pts'][2] - tmp_['pts'][0] ):
        print('CHECKING NEIGH IN format_match_')
        for loc in range( wdIdx+1, len( line_ ) ):
           if ( ( line_[loc]['pts'][2] - line_[loc]['pts'][0] ) + \
                    ( tmp_['pts'][2] - tmp_['pts'][0] ) < field_co_ords[2] - field_co_ords[0] ) and\
                    line_[loc]['pts'][0] - tmp_['pts'][2] <= 50:
                        tmp_['text'] += ' ' + line_[loc]['text']
                        pts_, neo_ = tmp_['pts'], line_[loc]['pts']
                        tmp_['pts'] = [ pts_[0], pts_[1], neo_[2], neo_[3] ]
                        print('NEO POT VAL->', tmp_)

    tmp_ = completeMultiLine( tmp_, field_co_ords, rawJson, threshold=2 ) 

    txt, pts, max_len, boost = tmp_['text'].replace(' ',''), potential_value['pts'], 6, 0.25

    ## new check to separate out stuff like Subtotal:1,345
    if len( txt.split(':') ) == 2 and doc_utils.dataType( txt.split(':')[0] ) == 'TEXT':
        txt = txt.split(':')[-1]

    # dont bother comparing words with diff "lengths" although other feats are the same
    if len( txt ) > 3*len( field_val ) or len( field_val ) > 3*len( txt ) : 
        print('TEXT SIM FAIL->', potential_value, field_val, ' LEN DIFF')
        return 0

    txt_vec_, field_vec_ = returnFeatVec( txt, [ len(txt) ] ), returnFeatVec( field_val, [ len(field_val) ] )

    #NOTE-> CHANGES MADE FOR IMPROVING DATE ACC - 20th March 2024 ( date of code change :P )
    ## if the only special chars are "-", "/" and the CY is present in the string
    cy, cy_part = str( datetime.now().year ), str( datetime.now().year )[-2:] 
    if ( txt_vec_[-1] in [ '-', '/' ] and field_vec_[-1] in [ '-', '/' ] and \
            ( cy in txt or cy_part in txt ) and ( cy in field_val or cy_part in field_val ) ) or\
            ( cy in txt and cy in field_val ):
                print('Most likely both DATES!!')
                ## curtail both vectors
                txt_vec_, field_vec_ = txt_vec_[ :max_len], field_vec_[ :max_len]
                ## now the last values are going to be the same and both will be compared as dates

    #NOTE-> CHANGES MADE FOR IMPROVING DATE ACC - 20th March 2024 ( date of code change :P )
    special_txt_, special_field_vec_ = None, None

    if len( txt_vec_ ) > max_len:
        special_txt_ = txt_vec_[-1]
        txt_vec_ = txt_vec_[ :max_len]

    if len( field_vec_ ) > max_len:
        special_field_vec_ = field_vec_[-1]
        field_vec_ = field_vec_[ :max_len]

    '''
    # dont bother comparing words with diff special chars although other feats are the same
    if special_txt_ is not None and special_field_vec_ is not None and special_field_vec_ != special_txt_:
        print('TEXT SIM FAIL->', potential_value, field_val, ' SPECIAL CHAR DIFF ->', special_txt_, \
                                 special_field_vec_, txt_vec_, field_vec_ )
        return 0
    '''
    cosine_dist_ = distance.cosine( txt_vec_, field_vec_ )
    text_sim_ = ( 1 - cosine_dist_ )

    ## now calculate x and y distances separately instead of taking euclidean distance
    ## also since we want lower distance to have a positive impact on the overall score add a - ( minus ) 
    dist_sim_ = -1*( abs( field_co_ords[0]/norm_x - pts[0]/norm_x ) + \
                     abs( field_co_ords[1]/norm_y - pts[1]/norm_y ) )

    dist_sim_2 = -1*( abs( field_co_ords[0]/norm_x - pts[0]/norm_x ) + \
                     abs( field_co_ords[2]/norm_x - pts[2]/norm_x ) )

    print('Text Sim->', text_sim_, txt_vec_, txt, field_vec_, field_val, distance.euclidean( txt_vec_, field_vec_ ), \
            ' Dist Sim ->', dist_sim_, ' TOtal score->', text_sim_ + dist_sim_*0.4, text_sim_ + dist_sim_2*0.4, field_co_ords, pts )

    if num_matches_ >= 3 or ( text_sim_ == 1 and len( txt ) == len( field_val ) and txt_vec_ == field_vec_ ):
        print('Giving it an additional boost->')
        return ( text_sim_ + (dist_sim_*0.4) + boost )

    return max( ( text_sim_ + (dist_sim_*0.4) ), ( text_sim_ + (dist_sim_2*0.4) ) )

def monthInValue( txt ):

    for idx, elem in enumerate( months ):
        if elem in txt.lower(): return True, idx

    for idx, elem in enumerate( months_short ):
        for inner in txt.lower().split():
            if inner == elem: return True, idx
        for inner in txt.lower().split('-'):
            if inner == elem: return True, idx
        for inner in txt.lower().split('/'):
            if inner == elem: return True, idx

    return False,None    

def distanceFromNearestLeft( tup, localNeigh ):

    contour_, dist_, dirn_ = tup
    if dirn_ != 'LEFT': return None, None

    for fb_dirn_, fb_deets_ in localNeigh.items():
        if fb_dirn_ == 'LEFT':
          sorted_ = sorted( fb_deets_ , key=lambda x:x[-1] )
          closest_left_ = sorted_[0]

          print('Closest LEFT to feedback is ->', closest_left_,' and current tuple is ', tup,\
                  ' and DIST ->', closest_left_[0]['pts'][0] - contour_['pts'][0])

          return closest_left_[0]['pts'][0] - contour_['pts'][0], closest_left_[0]

    return None, None  

def contains_no_small( txt_ ):

    if len( txt_.split() ) <= 1: return True

    arr_ = txt_.split()
    for wd in arr_:
        if doc_utils.dataType( wd ) == 'TEXT': return False

    return True    

def month( txt ):
    if txt.lower() in [ 'jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec' ]:
        return True

def smallDiff( ref_val_, orig_ai_val_ ):

    if len( ref_val_ ) != len( orig_ai_val_ ): return False, None

    differ_D = dict()

    for idx, char in enumerate( ref_val_ ):

        if char != orig_ai_val_[ idx ]:
            differ_D[ idx ] = ( char, orig_ai_val_[ idx ] )

    print('Ok, looks like diffs->', differ_D )
    if len( differ_D ) > 2: return False, None

    return True, differ_D

def post_processing_text_( val_, ref_val_, orig_ai_val_ ):

    resp_text_ = val_['text']
    print('NOT COMING IN HERE->', val_, ref_val_, orig_ai_val_ )

    ## if ref val is 1234 and extracted val is Invoice No 1234
    if contains_no_small( ref_val_ ) and contains_no_small( resp_text_ ) is False:
      arr_ = val_['text'].split()
      not_num_ = []
      for elem in arr_:
          if doc_utils.dataType( elem ) != 'TEXT' or \
                  ( doc_utils.dataType( elem ) == 'TEXT' and month( elem ) ): not_num_.append( elem )

      if len( not_num_ ) > 1: ## to handle cases like "Ashdul :" ..here it will delete Ashdul and send out : ..meaningless
        resp_text_ = ' '.join( not_num_ )

    ## if ref val is 123445 and extracted is 1 34 234
    if len( resp_text_.split() ) > 1:
        all_num, cnt = False, 0
        tmp_arr_ = resp_text_.split()

        for elem in tmp_arr_:
            if doc_utils.dataType( elem ) == 'DIGIT': cnt += 1

        if cnt == len( resp_text_.split() ):
            print('CULPIRIT->', resp_text_, ref_val_)
            resp_text_ = resp_text_.replace(' ','')

    ## 2 more checks 
    '''
    - IF feedback_val is a substring of ai_val ,
	find the extra part of the string
	ensure its NOT DIGIT
	and see if its present in the current response ..if YES remove
    - IF feedback_val is not a substring of ai_val,
	AND the length of both are same , find out the index of chars where there's difference and as long as # of chars diff <= 2
        and the different char in ai_val in [ 0<->O, 7<->/, S<->8, 1<->I ]
    
    ref_val_, orig_ai_val_
    '''
    try:
      diff_status, diff_d = smallDiff( ref_val_, orig_ai_val_ )
        
      if orig_ai_val_ != 'NA' and ref_val_ in orig_ai_val_ and orig_ai_val_.index( ref_val_ ) > 0 and\
             orig_ai_val_.index( ref_val_ ) < len( orig_ai_val_ ) - 1:

        print('Feedback value was a substring of the original AI val ..some more cleanup now ')
        extra_str_ = orig_ai_val_[ : orig_ai_val_.index( ref_val_ ) ]
        print('Additional STR extracted by AI->', extra_str_ )

        if extra_str_ in resp_text_ and resp_text_.index( extra_str_ ) == 0:
            print('Additional STR present in current response as well !')
            resp_text_ = resp_text_.replace( extra_str_, '' )

      ## 2nd check
      elif orig_ai_val_ != 'NA' and ref_val_ not in orig_ai_val_ and diff_status is True:
          
          for diff_idx_, tup in diff_d.items():
              ref, orig = tup

              if orig == '0' and ref == 'O' and resp_text_[ diff_idx_ ] == '0': \
                      resp_text_ = resp_text_[ :diff_idx_ ] + 'O' + resp_text_[ diff_idx_+1: ]
              if orig == '7' and ref == '/' and resp_text_[ diff_idx_ ] == '7': \
                      resp_text_ = resp_text_[ :diff_idx_ ] + '/' + resp_text_[ diff_idx_+1: ]
              if orig == 'S' and ref == '8' and resp_text_[ diff_idx_ ] == 'S': \
                      resp_text_ = resp_text_[ :diff_idx_ ] + '8' + resp_text_[ diff_idx_+1: ]
              if orig == '1' and ref == 'I' and resp_text_[ diff_idx_ ] == '1': \
                      resp_text_ = resp_text_[ :diff_idx_ ] + 'I' + resp_text_[ diff_idx_+1: ]

              if orig == 'O' and ref == '0' and resp_text_[ diff_idx_ ] == 'O': \
                      resp_text_ = resp_text_[ :diff_idx_ ] + '0' + resp_text_[ diff_idx_+1: ]
              if orig == '/' and ref == '7' and resp_text_[ diff_idx_ ] == '/': \
                      resp_text_ = resp_text_[ :diff_idx_ ] + '7' + resp_text_[ diff_idx_+1: ]
              if orig == '8' and ref == 'S' and resp_text_[ diff_idx_ ] == '8': \
                      resp_text_ = resp_text_[ :diff_idx_ ] + 'S' + resp_text_[ diff_idx_+1: ]
              if orig == 'I' and ref == '1' and resp_text_[ diff_idx_ ] == 'I': \
                      resp_text_ = resp_text_[ :diff_idx_ ] + '1' + resp_text_[ diff_idx_+1: ]

          print( 'WERE SOME CHAR REPLACEMENTS MADE ? ', resp_text_ )

    except:
        print('HUMPTY DUMPTY HAD A FALL IN THE NEW CODE->', traceback.format_exc())
        pass

    return resp_text_ 

def parallelFindVal( field_tup, best_match_doc_name_, match_score_ ):

    ref_ht, ref_wd, field_dict, rawJson, scaling_ht_, scaling_wd_, \
       key_coord_tup_, responseD, trg_ocr_op_, fpath, pgNum, docID = field_tup

    if ( field_dict['field_co_ords'] is not None and len( field_dict['field_co_ords'] ) != 4 ) or\
            len( field_dict['feedback_value'] ) == 0: 

      print('SCOOBY DOO->', field_dict['feedback_value'], field_dict['field_co_ords'])          
      return ( field_dict['config_field_nm'],  None )

    value_, final_confidence_score_ = findValue( ref_ht, ref_wd, field_dict['feedback_value'], \
              field_dict['field_co_ords'], \
              field_dict['field_datatype'], field_dict['local_neigh_dict'], rawJson,\
              scaling_ht_, scaling_wd_, key_coord_tup_ , responseD, field_dict['config_field_nm'],trg_ocr_op_, fpath )

    print('Time taken for findValue->', time.time() - start_)
    print('Adding CONF SCORE for ->', value_, final_confidence_score_ )

    if value_ is not None:
      value_['confidence_score_'] = final_confidence_score_
      value_['replacedWithFeedback_'] = True
      value_['pgNum'] = pgNum
      value_['docID'] = docID
      value_['Matching_Doc'] = best_match_doc_name_.split('/')[-1]
      value_['Matching_Score'] = match_score_

      ## check for needless spaces if the value is completely numeric ..also ensure
      ## any word with small case is destroyed
      '''  
      ##NOTE - DELETE ..ONLY FOR TESTING
      field_dict['feedback_value'] = '1NV-38O0521'
      '''  

      try:
        print('GOING IN->', value_ )  
        value_['text'] = post_processing_text_( value_, field_dict['feedback_value'], field_dict['orig_ai_val_'] )
        print('FINAL FINAL->', value_ )  
      except:
          print('Issue with post_processing_text_ ->', traceback.format_exc())
          pass

    return ( field_dict['config_field_nm'],  value_ )

def cleanAmt( text ):

    final_ = ''
    if text in [ '', 'NA', ' ' ]: return 0.0

    for char in text:
        if ( ord( char ) >= 48 and ord( char ) <= 57 ) or char in ['.']: final_ += char

    return float( final_ )

def searchAndApplyExistingFeedback( raw_arr_, stitched_arr_, doc_type ):

    tmp_arr_, docs_used_ = [], []
    
    for idx in range( len( raw_arr_ ) ):
        tmp_arr_.append( searchAndApplyExistingFeedbackIndividual( raw_arr_[ idx ] , stitched_arr_[ idx ], docs_used_, idx, doc_type ) )

    print('DODUS->', tmp_arr_)
    finale_ = dict()

    ## IN CASE OF MULTI PAGER FIND WHICH PAGE HAS MAX amt and use that
    total_page_idx_ = 0 # by default look in page # 1
    if len( tmp_arr_ ) > 1:
        max_amt = -1
        for pg_idx, res_dict in enumerate( tmp_arr_ ):
            try:
                for key, val in res_dict.items():
                    if 'Total Invoice Amount' in key and cleanAmt( val['text'] ) > max_amt:
                        print('AMOUNT FINAL-> prev max->', max_amt)
                        max_amt = cleanAmt( val['text'] )
                        print('AMOUNT FINAL-> curr max->', max_amt, ' PG IDX->', pg_idx)
                        total_page_idx_ = pg_idx
            except:
                print( 'PASS123->', traceback.format_exc() )
                continue

    for pgidx, elem in enumerate( tmp_arr_ ):
      for k, v in elem.items():
          if( k not in finale_ or ( k in finale_ and finale_[ k ]['text'] == 'NA' ) ) and\
                  k not in [ 'Total Invoice Amount', 'Invoice Sub Total' ]:
              finale_[ k ] = v

          if k in [ 'Total Invoice Amount', 'Invoice Sub Total' ] and total_page_idx_ == pgidx:
              finale_[ k ] = v


    return finale_

def searchAndApplyExistingFeedbackIndividual( file_path_, stitched_file_path_, docs_used_, pg_num, doc_type ):
    ## create signature and send global key valuepairs
    key_applied_, matched_doc_id_ = False, None
    start_ = time.time()

    if True: # laziness ..copy pasted code ..didnt want to indent

            with open( file_path_, 'r' ) as fp:
            #with open( file_path_ + locFnm, 'r' ) as fp:
                rawJson = json.load( fp )
            
            file_ = file_path_

            encoded_, key_coord_tup_ = createJsonFeats.returnJsonFeat( \
                                                                        stitched_file_path_, file_path_)
            print('TIMER1->', time.time() - start_, key_coord_tup_)
            ## now search to see if this record already exists
            match_rec_arr_ = checkSignature( file_, encoded_, key_coord_tup_, docs_used_, doc_type )
            print('Total num of competitors->', len(match_rec_arr_) if match_rec_arr_ is not None else 0,\
                    time.time() - start_)
            print('TIMER2->', time.time() - start_, key_coord_tup_)
               
            response_, best_match_doc_name_, match_score_ = dict(), None, None
            if match_rec_arr_ is not None:
                for score, match_rec_ in match_rec_arr_.items():   

                  found_fb_key_ = False
                  key_applied_ = True
                  best_match_doc_name_, match_score_ = match_rec_['docName'], score
                  matched_doc_id_ = match_rec_['docID']

                  if True:
                      ## apply the feedback 
                      feedback_, trg_ocr_op_ = match_rec_['feedbackDict'], match_rec_['ocr_op']
                      print('GOBU->', feedback_)
                      ref_ht, ref_wd = match_rec_['dimension']
                      scaling_ht_, scaling_wd_ = rawJson['height']/ref_ht, rawJson['width']/ref_wd
                      
                      pool_inp_, val_store_ = [], dict()
                      for field_dict in feedback_: ## multi thread the heck outta this
                          '''
                          ## NOTE REMOVE ..just test
                          if 'orig_ai_val_' not in field_dict:
                            field_dict[ 'orig_ai_val_' ] = 'INV-3800521'
                          '''

                          if 'orig_ai_val_' not in field_dict:
                            field_dict[ 'orig_ai_val_' ] = 'NA'

                          print('Looking for local representative of field->', field_dict, time.time() - start_,\
                              field_dict['feedback_value'], field_dict['orig_ai_val_'], field_dict['field_co_ords'] )

                          pool_inp_.append( [ ref_ht, ref_wd, field_dict, rawJson, scaling_ht_, \
                              scaling_wd_, key_coord_tup_, val_store_, trg_ocr_op_, file_path_, pg_num, \
                              match_rec_[ 'docID' ] ] )

                      
                      print('TIMER3->', time.time() - start_)
                      stt_ = time.time()

                      #with Pool( multiprocessing.cpu_count() ) as p:
                      #    val_results_ = p.map( parallelFindVal, pool_inp_ ) 
                      val_results_ = []
                      for elem in pool_inp_:
                          elem[-5] = val_store_
                          print('POOL-> co-ords = ', elem[2]['feedback_value'], elem[2]['field_co_ords'])
                          resp_tmp_ = parallelFindVal( elem, best_match_doc_name_, match_score_ )
                          val_results_.append( resp_tmp_ )
                          val_store_[ resp_tmp_[0] ] = resp_tmp_[1]

                      print('TIMER4->', time.time() - start_, response_)    

                      for idx, value_D in enumerate( val_results_ ):
                          
                          config_fnm_, value_ = value_D
                          print( 'Did it find anything ??', value_, time.time() - start_, response_ )
                          if 'backup_' in config_fnm_:
                              print('Couldnt find using original ..using backup->', config_fnm_)
                              nm_ = config_fnm_.split( 'backup_' )[-1]
                          else:    
                              nm_ = config_fnm_
                          
                          if nm_ not in response_:
                              response_[ nm_ ] = {'text' : 'NA', 'pts' : [0,0,0,0]} if value_ is None else value_

                  docs_used_.append( match_rec_['docID'] )            

            print('Total time taken->', time.time() - start_, response_ )

            #response_[ 'pg_num_' ] = pg_num
            #response_[ 'time_taken' ] = time.time() - start_

            #response_['Matching_Doc'] = best_match_doc_name_.split('/')[-1]
            #response_['Matching_Score'] = match_score_

            return response_

    exception_fp_.close()        

if __name__ == "__main__":
    import sys
    import merge

    stitched_file_path_ = "/home/ubuntu/ABHIJEET/INVOICES/REQUORDIT/DEV/ALL_OCR_OUTPUT/"
    rawFilePath = "/home/ubuntu/ABHIJEET/INVOICES/REQUORDIT/DEV/ALL_OCR_OUTPUT_ORIGINAL/"

    '''
    with open('unit_test','r') as fp:
        ll_ = fp.readlines()

    for elem in ll_:
        fnm_ = elem.strip('\n')
        resp_ = searchAndApplyExistingFeedback( [ rawFilePath + fnm_ ], [ stitched_file_path_ + fnm_ ],\
                                                'Invoices Custom' )
        with open( 'WITH_CHANGE/'+fnm_, 'w+' ) as fp:
            json.dump( resp_, fp )

    #def searchAndApplyExistingFeedback( file_path_, stitched_file_path_ ):
    raw_arr_ = [sys.argv[1]]
    fnn_ = sys.argv[1].split('/')[-1].split('.')[0]
    #stitched_arr_ = [sys.argv[2]]

    with open( raw_arr_[0], 'r' ) as fp:
        temp_js = json.load( fp )

    new_js_ = temp_js.copy()

    new_js_['lines'] = merge.merge_close_texts( temp_js['lines'] )

    with open( './TMP/'+fnn_+'.json', 'w+' ) as fp:
        json.dump( new_js_, fp )

    stitched_arr_ = [ './TMP/'+fnn_+'.json' ]
    '''

    '''
    with open('test','r') as fp:
        ll_ = fp.readlines()

    for elem in ll_:
      try:  

        fnm = elem.strip('\n').split('.pdf')[0]+'-0.json'
        raw_arr_ = [ "/datadrive/ROHITH/S3_TASK/ALL_DATA_V3/raw/"+fnm ]
        stitched_arr_ = [ "/datadrive/ROHITH/S3_TASK/ALL_DATA_V3/output/"+fnm ]
        resp_ = searchAndApplyExistingFeedback( raw_arr_, stitched_arr_, 'Invoices Custom' )

        with open('TEST_RES/'+fnm, 'a' ) as fp:
            json.dump( resp_, fp )

      except:
          print('EXCPN->', elem)
          continue

    raw_arr_ = ["/datadrive/ROHITH/S3_TASK/ALL_DATA_V3/raw/"+sys.argv[1]+"-0.json", \
                "/datadrive/ROHITH/S3_TASK/ALL_DATA_V3/raw/"+sys.argv[1]+"-1.json", \
                "/datadrive/ROHITH/S3_TASK/ALL_DATA_V3/raw/"+sys.argv[1]+"-2.json"]

    stitched_arr_ = ["/datadrive/ROHITH/S3_TASK/ALL_DATA_V3/output/"+sys.argv[1]+"-0.json", \
                "/datadrive/ROHITH/S3_TASK/ALL_DATA_V3/output/"+sys.argv[1]+"-1.json", \
                "/datadrive/ROHITH/S3_TASK/ALL_DATA_V3/output/"+sys.argv[1]+"-2.json"]

    '''    


    raw_arr_ = ["/datadrive/ROHITH/S3_TASK/ALL_DATA_V3/raw/"+sys.argv[1]+".json"]
    stitched_arr_ = ["/datadrive/ROHITH/S3_TASK/ALL_DATA_V3/output/"+sys.argv[1]+".json"]
    print( 'All feedback applied fr ', searchAndApplyExistingFeedback( raw_arr_, stitched_arr_, 'Invoices Custom' ) )

