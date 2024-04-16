import os, json, sys
import numpy as np
from scipy.spatial import distance
import doc_utils

vector_max_len_, distance_thresh_, counter_norm_scale_ = 10, 0.2, 10

block_size, num_lines_, max_contours_per_line , num_feats_, inter_word_thresh_ = 5, 10, 10, 7, 20

def returnBlankBlock():
    return np.zeros( ( num_lines_, max_contours_per_line , num_feats_ ) )

dIdx = {'ALNUM': 1, 
'ALL_CAPS': 2,
'DIGIT': 3,
'TEXT': 4,
'NA': 5,
'DATE': 6 }

def stitchEmUp( raw_jsn_ ):

    final_ = []    
    for ln in raw_jsn_:
        neo_wd_, ln_arr_ = None, []
        for wdidx, wd in enumerate( ln ):
            curr, next = wd, ln[ min( wdidx+1, len(ln)-1 ) ]
            if curr != next:
                if abs( curr['pts'][2] - next['pts'][0] ) <= inter_word_thresh_:
                    if neo_wd_ is None:
                        neo_wd_ = curr.copy()
                        neo_wd_['text'] += ' ' + next['text']
                        neo_wd_['pts'] = [ neo_wd_['pts'][0], neo_wd_['pts'][1], next['pts'][2], next['pts'][3] ]

                    else:
                        neo_wd_['text'] += ' ' + next['text']
                        neo_wd_['pts'] = [ neo_wd_['pts'][0], neo_wd_['pts'][1], next['pts'][2], next['pts'][3] ]
                else:
                    if neo_wd_ is not None and len( neo_wd_['text'] ) > 0:
                        ln_arr_.append( neo_wd_ )
                        neo_wd_ = None
                    elif len( curr['text'] ) > 0:
                        ln_arr_.append( curr )

            elif curr == next:
                ## last contour ..simpyadd
                    if neo_wd_ is not None and len( neo_wd_['text'] ) > 0:
                        ln_arr_.append( neo_wd_ )
                        neo_wd_ = None
                    elif len( curr['text'] ) > 0:
                        ln_arr_.append( curr )

        #print('PRE->', ln)
        #print('POST->', ln_arr_ )
        if len( ln_arr_ ) == 0: continue

        final_.append( ln_arr_ )

    return final_

def checkAlign( wdidx, bloc_line_, idx, raw_jsn_, dirn_, ht=100 ):
   
    if ( dirn_ == 'PREV' and idx == 0 ) or ( dirn_ == 'NEXT' and idx == block_size -1 ): return 0, 0

    if dirn_ == 'PREV':
        prev_ln, ln = raw_jsn_[ idx - 1 ], raw_jsn_[ idx ]

        for pi, p in enumerate( prev_ln ):
            for ci, c in enumerate( ln ):
                if doc_utils.xOverlapBetter( c['pts'], p['pts'] ):
                    dist_ = abs( p['pts'][-1] - c['pts'][1] )/ht
                    dtt_ = dIdx[ doc_utils.dataType( p['text'] ) ] / len( dIdx )

                    return dist_, dtt_

    if dirn_ == 'NEXT':
        next_ln, ln = raw_jsn_[ idx + 1 ], raw_jsn_[ idx ]

        for pi, p in enumerate( next_ln ):
            for ci, c in enumerate( ln ):
                if doc_utils.xOverlapBetter( c['pts'], p['pts'] ):
                    dist_ = abs( p['pts'][1] - c['pts'][-1] )/ht
                    dtt_ = dIdx[ doc_utils.dataType( p['text'] ) ] / len( dIdx )

                    return dist_, dtt_

    return 0, 0

def getFeatVec( ln_idx, raw_jsn_, width, height, block_ ):
    ## now choose a block

    intra_dtypes, intra_distances_ = np.zeros( vector_max_len_ ), np.zeros( vector_max_len_*2 )
    block_lines_ = raw_jsn_[ ln_idx: ln_idx + block_size ]

    ## now in the block start extracting all deets
    for idx, bloc_line_ in enumerate( block_lines_ ):
        ## avg distance between all contours - normalized by wdth
        dist_ = []
        for wdidx, wd in enumerate( bloc_line_ ):
            cu, ne = wd, bloc_line_[ min( wdidx + 1, len( bloc_line_ ) - 1 ) ]
            dist_.append( abs( cu['pts'][2] - ne['pts'][0] ) )

        avg_dist_ = np.median( np.asarray( dist_ ) )/width

        ## dtypes
        ## create a feature vect of size  max_contours_per_line , num_feats_
        wd_feat_vec_ = np.zeros( ( max_contours_per_line, num_feats_ ) )

        for wdidx, wd_ in enumerate( bloc_line_ ): 
            dtype_ = dIdx[doc_utils.dataType( wd['text'] )]/len( dIdx )
            len_ = len( wd_['text'].split() )/counter_norm_scale_
            ## check prev line for alignment 
            prev_len_aligned_dist_, prev_align_dtype_ = checkAlign(wdidx,bloc_line_,idx, block_lines_, 'PREV')
            next_len_aligned_dist_, next_align_dtype_ = checkAlign(wdidx,bloc_line_,idx, block_lines_, 'NEXT')

            block_[ idx ][ wdidx ] = ( dtype_, avg_dist_, len_, prev_len_aligned_dist_, prev_align_dtype_,\
                                            next_len_aligned_dist_, next_align_dtype_ )



def generateTrgData( raw_jsn_, fpath ):
  
    final_json_, file_data_ = stitchEmUp( raw_jsn_['lines'] ), []
    for lineIdx, line in enumerate( final_json_ ):
        if lineIdx > len( final_json_ ) - block_size: break
        
        block_ = returnBlankBlock()
        getFeatVec( lineIdx, final_json_, raw_jsn_['width'] , raw_jsn_['height'], block_ )

        file_data_.append( block_.tolist() )
        print('--------------------------------------------')
        print('For Line->', line)
        print( block_.tolist() )
        if lineIdx > 1:
            prior_, curr_ = np.asarray( file_data_[-2] ), np.asarray( block_.tolist() )
            print('Distance to prior line ->', distance.cosine( prior_.flatten(), curr_.flatten() ) )

    return file_data_    

if __name__ == '__main__':
    with open( "/datadrive/ROHITH/S3_TASK/ALL_DATA_V3/raw/"+sys.argv[1], 'r' ) as fp:
        raw_jsn_ = json.load( fp )

    generateTrgData( raw_jsn_, "/datadrive/ROHITH/S3_TASK/ALL_DATA_V3/raw/"+sys.argv[1] )    

