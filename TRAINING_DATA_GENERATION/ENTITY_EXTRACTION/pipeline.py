import nltk_nlp
import smaller_test2 
from transformers import AutoTokenizer
import sys, re, json
import numpy as np

pattern = r'\[\[([^\[\]]+\.[^\[\]]+)\]\]'
tokenizer = AutoTokenizer.from_pretrained("bert-base-uncased")

def relateHdrPara( paragraphs_arr_ ):

    hdr_dict_ = dict()

    for idx, para in enumerate( paragraphs_arr_ ):
        found = False
        if len( para ) < 1: continue

        for inneridx in range( idx-1, -1, -1 ):
            loc_ = paragraphs_arr_[ inneridx ]
            if '==' in loc_ or '===' in loc_ or '====' in loc_:
                found = True
                hdr_dict_[ para ] = loc_
                #print('Found HDR->', loc_, ' :: For Para----------\n', para)
                break

        if found is False:
            hdr_dict_[ para ] = 'NA'
            #print( 'Found HDR-> NOT_AVAIL :: For Para----------\n', para)

    return hdr_dict_

def remove_text_between_curly_braces(input_text):
    # Define a regular expression pattern to match text between curly braces
    pattern = re.compile(r'\{.*?\}|\<.*?\>')

    # Use sub() method to replace the matched pattern with an empty string
    result_text = re.sub(pattern, '', input_text).replace( '{', '' ).replace( '}', '' ).replace( '(', '' ).\
                                                  replace( ')', '' ).replace(';','')

    result_text = result_text.replace('|', ' ')
    res_ = result_text.strip()
    #return res_
    try:
      final_text_ = res_[ res_.index( "''" ): res_.index( "See also" ) ]
    except:
        final_text_ = res_
        pass
    ## now find all headers and their index in the string
    ## NOTE 1. frst id all paragraphs
    paragraphs_ = final_text_.split('\n')
    hdrDict_ = relateHdrPara( paragraphs_ )

    return hdrDict_

# Define a function to remove periods within square brackets
def remove_periods(match):
    return match.group(1).replace('.', '')

def returnEdgeAndEntities( paragraph, title ):
    phrases_of_interest_ = nltk_nlp.returnPhrasesOfInterest( paragraph, debug=True, title='NA' )
    #print( phrases_of_interest_ )
    # Replace periods within square brackets using the defined function
    output_string = re.sub( pattern, remove_periods, paragraph )
    inp_arr_ = output_string.split('.')
    response_, backup_response_ = smaller_test2.returnPhraseDistance( phrases_of_interest_, title='WIKIPEDIA' )
    edge_label_, entity_arr_ = smaller_test2.findEntities( response_, title , inp_arr_, phrases_of_interest_ )

    return edge_label_, entity_arr_

def getNext( idx, result_, title, final_D ):

    if idx not in result_: return None

    edge_, entity_arr_ = returnEdgeAndEntities( para_, title )

    if edge_ is not None:
      final_D[idx] = dict()
      final_D[idx]['Main_Node'] = title
      final_D[idx]['Child_Node'] = entity_arr_
      final_D[idx]['Edge_Label'] = edge_
      final_D[idx]['Context'] = para_
      return final_D[idx]
      
    return None 

def pipeline( file_ ):

    with open( file_, 'r' ) as fp:
      js_ = json.load( fp )

    result = remove_text_between_curly_braces( js_['parse']['wikitext'] )

    if 'REDIRECT' in result: 
        return None

    token_stats_ = []

    final_D = dict() ## 'Main_Node': < title >, 'Child_Node': < entity from entity_arr >, 'Edge_Label': < label >,
                     ## 'Context': < entire paragaph >   
    print("Original Title:")
    print( js_['parse']['title'])
    #print( result )
    title = js_['parse']['title']
    last_idx_inserted_ = -1

    import time

    for para_idx, para in enumerate( result ):
        if ( 'File:' in para or '==' in para or 'image' in para or 'caption' in para ): continue
        if len( para.split() ) <= 10: continue
        if para_idx in final_D: continue ## coz we are also calculating next entry into graph which 
                                         ## doesnt exist ! so once we calculate, do NOT repeat

        start_time_for_loop_ = time.time()
        para_taken_care_of_ = False

        edge_, entity_arr_ = returnEdgeAndEntities( para, title )
        print('XXXXXXXGETTING IN para_idx->', para_idx, ' AND edge_, entity_arr_ = ', edge_, entity_arr_)
        print('STG1 TIME->', time.time() - start_time_for_loop_)

        if edge_ in [ None, -100 ]:
            ## need to add this to the prev and the next para
            ## sadly will need to rerun returnEdgeAndEntities and check if the edge_ has changed 
            ## if either OR both CHANGE update the contents of the json
            if para_idx > 0 and para_idx < len( result ) - 1 and last_idx_inserted_ != -1:
                ## the prev entry in teh graph could be 1/2 indices away , so its best to just get the last idx

                prev_graph_entry_, next_graph_entry_ = final_D[ last_idx_inserted_ ], \
                                                    getNext( para_idx + 1, result, title, final_D )

                prev_edge, prev_context = prev_graph_entry_['Edge_Label'], prev_graph_entry_['Context']
                ## add curr context to prev context
                _context = prev_context + para

                tmp_edge_, tmp_entity_arr_ = returnEdgeAndEntities( _context, title )

                if tmp_edge_ != prev_edge and tmp_entity_arr_ is not None and len( tmp_entity_arr_ ) > 0:
                    print('Difference in edge label ! PREV->', prev_edge, ' UPDATED->', tmp_edge_)
                    ## update the prior edge and add entity list
                    prev_graph_entry_['Edge_Label'] = tmp_edge_
                    prev_graph_entry_['Child_Node'] += tmp_entity_arr_
                    prev_graph_entry_['Child_Node'] = list( set( prev_graph_entry_['Child_Node'] ) )

                elif tmp_edge_ == prev_edge and tmp_entity_arr_ is not None and len( tmp_entity_arr_ ) > 0:
                    print('Difference in edge label ! PREV->', prev_edge, ' UPDATED->', tmp_edge_)
                    ## update the prior edge and add entity list
                    prev_graph_entry_['Child_Node'] += tmp_entity_arr_
                    prev_graph_entry_['Child_Node'] = list( set( prev_graph_entry_['Child_Node'] ) )
                
                prev_graph_entry_['Context'] = _context
                prev_graph_entry_['Context_Tokens'] = len( tokenizer.tokenize( _context ) )
                token_stats_.append( prev_graph_entry_['Context_Tokens'] )

                with open( 'FINAL_JSONS/tmp_Graph_Entries_'+title+'.json', 'a' ) as fp:
                    json.dump( prev_graph_entry_, fp )
                
                para_taken_care_of_ = True

                if next_graph_entry_ is not None:

                    nxt_edge, nxt_context = next_graph_entry_['Edge_Label'], next_graph_entry_['Context']
                    _context_next = para + nxt_context
                    tmp_edge_, tmp_entity_arr_ = returnEdgeAndEntities( _context_next, title )

                    if tmp_edge_ != nxt_edge and tmp_entity_arr_ is not None and len( tmp_entity_arr_ ) > 0:
                        print('Difference in edge label ! NEXT->', nxt_edge, ' UPDATED->', tmp_edge_)
                        ## update the prior edge and add entity list
                        next_graph_entry_['Edge_Label'] = tmp_edge_
                        next_graph_entry_['Child_Node'] += tmp_entity_arr_
                        next_graph_entry_['Child_Node'] = list( set( next_graph_entry_['Child_Node'] ) )

                    elif tmp_edge_ == nxt_edge and tmp_entity_arr_ is not None and len( tmp_entity_arr_ ) > 0:
                        print('Difference in edge label ! PREV->', nxt_edge, ' UPDATED->', tmp_edge_)
                        ## update the prior edge and add entity list
                        next_graph_entry_['Child_Node'] += tmp_entity_arr_
                        next_graph_entry_['Child_Node'] = list( set( next_graph_entry_['Child_Node'] ) )
                    
                    next_graph_entry_['Context'] = _context_next
                    next_graph_entry_['Context_Tokens'] = len( tokenizer.tokenize( _context_next ) )
                    token_stats_.append( next_graph_entry_['Context_Tokens'] )

                    with open( 'FINAL_JSONS/tmp_Graph_Entries_'+title+'.json', 'a' ) as fp:
                        json.dump( next_graph_entry_, fp )

        else: ## for the IF condn < edge_ in [ None, -100 ] >
            ## add this to the json
            final_D[para_idx] = dict()
            final_D[para_idx]['Main_Node'] = title
            final_D[para_idx]['Child_Node'] = entity_arr_
            final_D[para_idx]['Edge_Label'] = edge_
            final_D[para_idx]['Context'] = para
            final_D[para_idx]['Context_Tokens'] = len( tokenizer.tokenize( para ) )
            last_idx_inserted_ = para_idx
            para_taken_care_of_ = True

            token_stats_.append( final_D[para_idx]['Context_Tokens'] )

            with open( 'FINAL_JSONS/tmp_Graph_Entries_'+title+'.json', 'a' ) as fp:
                json.dump( final_D[para_idx], fp )

        print('XXXXXXXGETTING OUT para_idx->', para_idx, ' AND edge_, entity_arr_ = ', edge_, entity_arr_)
        print('STG2 TIME->', time.time() - start_time_for_loop_)

        if para_taken_care_of_ is False:
            with open( 'FINAL_JSONS/Fails.json', 'a' ) as fp:
                json.dump( { 'Sentence': para, 'EdgeAndEnt': str(edge_)+str(entity_arr_) }, fp )

    with open( 'FINAL_JSONS/Graph_Entries_'+title+'.json', 'w+' ) as fp:
        json.dump( final_D, fp )

    #pp_ = np.asarray( token_stats_ )
    #print('SOME STATS-> Mean, first Q, median, 3rd Q->', np.mean( token_stats_ ), np.percentile( token_stats_, 25 ),\
    #                           np.percentile( token_stats_, 50 ), np.percentile( token_stats_, 75 ) )

if __name__ == '__main__':
    
    import os
    ll_ = os.listdir( 'INIT_JSONS' )

    for file_ in ll_:
        pipeline( 'INIT_JSONS/' + file_ )
