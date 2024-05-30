import createJsonFeats # returnEmbed
import os, json, sys, traceback, db_utils
from rank_bm25 import BM25Okapi
import numpy as np
from scipy.spatial import distance

txt = sys.argv[1]

emb_ = createJsonFeats.returnEmbed( txt )

res_ = db_utils.searchSignature( {'docSignature': emb_} )
corpus_ = dict()

def pos( res_ ):
  if 'searchRes_' in res_:
    act_ = res_[ 'searchRes_' ]
    print( act_ )
    tokenized_hdr_info_ , tokenized_sample_summary_, tokenized_dates_, title = [], [], [], []
    hdr_info_D = dict()

    for res_nm, resD in act_.items():
        if 'payload' in resD and 'summary' in resD[ 'payload' ]:
            corpus_[ ( resD[ 'payload' ][ 'summary' ] ) ] = resD[ 'score' ]

            tokenized_hdr_info_.append( resD[ 'payload' ][ 'hdr_info' ] )
            tokenized_sample_summary_.append( 'sample' )
            tokenized_dates_.append( resD[ 'payload' ][ 'date_range' ] )
            title.append( resD[ 'payload' ]['file_name'] )

            hdr_info_D[ ( resD[ 'payload' ][ 'summary' ] ) ] = createJsonFeats.returnEmbed( resD['payload']['hdr_info'] )

    top_by_vector_score_ = dict( sorted( corpus_.items(), key=lambda x:x[1], reverse=True ) )
    for idx, key in enumerate( list( top_by_vector_score_.keys() )[:10] ):
        print('-----------------------------------------')
        cos_dist_ = distance.cosine( emb_, hdr_info_D[ key ] )
        print('Rank ',idx+1,' CONTEXT->', key, ' SCORE->', top_by_vector_score_[key], ' HDR DISTANCE->', cos_dist_ )
        print('-----------------------------------------')

    tokenized_corpus = [doc.split(" ") for doc in list( corpus_.keys() )]
    bm25_summary_, bm25_hdr_info_, bm25_sample_summary_, bm25_dates_, title = \
            BM25Okapi(tokenized_corpus), BM25Okapi( tokenized_hdr_info_ ), \
            BM25Okapi( tokenized_sample_summary_ ), BM25Okapi( tokenized_dates_ ), BM25Okapi( title )

    tokenized_query = txt.split(" ")
    bm25_score_summary_  = bm25_summary_.get_scores(tokenized_query)
    bm25_score_hdr_  = bm25_hdr_info_.get_scores(tokenized_query)
    bm25_score_sample_  = bm25_sample_summary_.get_scores(tokenized_query)
    bm25_score_dt_  = bm25_dates_.get_scores(tokenized_query)
    score_title_  = title.get_scores(tokenized_query)

    enum_doc_scores_ = list( enumerate( bm25_score_summary_ ) )
    sorted_doc_score_ = sorted( enum_doc_scores_, key=lambda x:x[1] , reverse=True )

    enum_doc_scores_ = list( enumerate( bm25_score_hdr_ ) )
    sorted_doc_score_1 = sorted( enum_doc_scores_, key=lambda x:x[1] , reverse=True )

    enum_doc_scores_ = list( enumerate( bm25_score_sample_ ) )
    sorted_doc_score_2 = sorted( enum_doc_scores_, key=lambda x:x[1] , reverse=True )

    enum_doc_scores_ = list( enumerate( bm25_score_dt_ ) )
    sorted_doc_score_3 = sorted( enum_doc_scores_, key=lambda x:x[1] , reverse=True )

    enum_doc_scores_ = list( enumerate( score_title_ ) )
    sorted_doc_score_4 = sorted( enum_doc_scores_, key=lambda x:x[1] , reverse=True )

    for keyid, keys in enumerate( list( corpus_.keys() ) ):
        print('--------', keyid, np.asarray( sorted_doc_score_ )[:3, :1])    
        if [keyid] not in np.asarray( sorted_doc_score_ )[:3, :1]: continue

        print( 'BM25 Summary :: Text: ', keys, ' Vector score: ', corpus_[ keys ],\
                ' BM25 : ', bm25_score_summary_[keyid] )

    for keyid, keys in enumerate( list( corpus_.keys() ) ):
        print('--------', keyid, np.asarray( sorted_doc_score_1 )[:3, :1])    
        if [keyid] not in np.asarray( sorted_doc_score_1 )[:3, :1]: continue

        print( 'BM25 HDR :: Text: ', keys, ' Vector score: ', corpus_[ keys ],\
                ' BM25 : ', bm25_score_hdr_[keyid] )

    for keyid, keys in enumerate( list( corpus_.keys() ) ):
        print('--------', keyid, np.asarray( sorted_doc_score_2 )[:3, :1])    
        if [keyid] not in np.asarray( sorted_doc_score_2 )[:3, :1]: continue

        print( 'BM25 Sample :: Text: ', keys, ' Vector score: ', corpus_[ keys ],\
                ' BM25 : ', bm25_score_sample_[keyid] )

    for keyid, keys in enumerate( list( corpus_.keys() ) ):
        print('--------', keyid, np.asarray( sorted_doc_score_3 )[:3, :1])    
        if [keyid] not in np.asarray( sorted_doc_score_3 )[:3, :1]: continue

        print( 'BM25 Date :: Text: ', keys, ' Vector score: ', corpus_[ keys ],\
                ' BM25 : ', bm25_score_dt_[keyid] )

    for keyid, keys in enumerate( list( corpus_.keys() ) ):
        print('--------', keyid, np.asarray( sorted_doc_score_4 )[:3, :1])    
        if [keyid] not in np.asarray( sorted_doc_score_4 )[:3, :1]: continue

        print( 'BM25 Date :: Text: ', keys, ' Vector score: ', corpus_[ keys ],\
                ' BM25 : ', score_title_[keyid] )

    return 123
