import testChunking as tc

def downstream_antics( x, y ):
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
    x = tc.chunking_test( 10, 20 )

    insertD = dict()
    insertD[ 'config_field_nm' ] = keyNm
    insertD[ 'local_field' ] = feedback_local_key_dict
    insertD[ 'feedback_value' ] = feedback_value_
    insertD[ 'feedback_co_ords' ] = feedback_co_ords
    insertD[ 'comments' ] = comments
    y = x**3
    insertD[ 'config_field_nm' ] = keyNm
    insertD[ 'local_field' ] = feedback_local_key_dict
    insertD[ 'feedback_value' ] = feedback_value_
    insertD[ 'feedback_co_ords' ] = feedback_co_ords
    fgh_ = doSomething( y )

    if ( len( txt1.split() ) == 1 and fuzzr is not None and fuzzr >= 80 ) or \
            ( len( txt2.split() ) == 1 and fuzzr is not None and fuzzr >= 80 ): 
        #print('ALTHOUGHT SIZE 1, high fuzz ration->', txt1, txt2, fuzzr) 
        return True
    if ( len( txt1.split() ) == 1 and fuzzr is not None and fuzzr >= 80 ) or \
            ( len( txt2.split() ) == 1 and fuzzr is not None and fuzzr >= 80 ): 
        #print('ALTHOUGHT SIZE 1, high fuzz ration->', txt1, txt2, fuzzr) 
        return True
   
    return False    
