import re, json, sys
from fuzzywuzzy import fuzz
import nltk_nlp
from scipy.spatial import distance
import urllib.request
import json, db_utils
import time
import wiki_textract_api
import traceback

url_encode = 'http://0.0.0.0:5200/encodeSentence'

with open( 'config.json', 'r' ) as fp:
    config_json_ = json.load( fp )

config_pronouns_ = config_json_[ "pronouns" ]                                                         
distance_thresh, cosine_dist_thresh, min_repetition_count_threshold_  =  \
                                      config_json_["distance_thresh"], config_json_["cosine_dist_thresh"], \
                                                             config_json_["min_repetition_count_threshold_"] 

import wikipediaapi
# Create a Wikipedia API object
wiki_wiki = wikipediaapi.Wikipedia(language='en', user_agent='vikBOT/vikram.murthy@gmail.com')

def getBackLinks( main_title, page_title, finale_ ):

    # Retrieve the page object
    page = wiki_wiki.page(page_title)

    # Check if the page exists
    if page.exists():
        # Get the number of incoming links
        num_incoming_links = len(page.backlinks)
        print("Number of incoming links to the page '{}': {}".format(page_title, num_incoming_links))
        finale_.append( { 'main_title': main_title, 'page_title': page_title, 'num_links': num_incoming_links } )
    else:
        print("Page '{}' does not exist.".format(page_title))

def returnPhraseEmbedding( phrase ):

    data = json.dumps( { 'sentence': phrase } ).encode('utf-8')

    _request = urllib.request.Request( config_json_['url_encode'], data=data, method='POST', \
                                                      headers={'Content-Type': 'application/json'} )
    response = urllib.request.urlopen( _request )
    string = response.read().decode('utf-8')
    json_obj = json.loads(string)

    return ( json_obj['encoded_'] )


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

def remove_text_between_curly_braces_sentence(input_text):
    # Define a regular expression pattern to match text between curly braces
    pattern = re.compile(r'\{.*?\}|\<.*?\>')

    # Use sub() method to replace the matched pattern with an empty string
    result_text = re.sub(pattern, '', input_text).replace( '{', '' ).replace( '}', '' ).replace( '(', '' ).\
                                                  replace( ')', '' ).replace(';','')

    result_text = result_text.replace('|', ' ')
    return result_text.strip()

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

def coRefResolution( curr_idx_, lines_, line_, nnp_D ):
    ## we need to resolve for his/her/she/he/they for starters
    ## simple rule .. just look to all prev lines and find the nearest NNP
    for wdidx, wd in enumerate( line_.split() ):
        # reverse sort nnp_D key ( index going 4,3,2 ..]
        srtD = dict( sorted( nnp_D.items(), key=lambda x:x[0], reverse=True ) )
        srtD_keys_ = list( srtD.keys() )

        if wd.lower() in config_pronouns_:
            
            for kk in srtD_keys_:
              if kk <= curr_idx_: # so if curr idx is 5 and reverse sorted key is 3, it implies presence of the person's name in htis line
                nnp_list_ = nnp_D[ kk ]
                ## now if the pronoun list has more than 1 name then we need to find the last one in the line ?
                ## if the sentence is "Megan and Sally went shopping. She has been wanting to." ..she, educated guess
                ## would be Sally , since its the closest ( though typically the sentence would have THEY instead of 
                ## a gendered pronoun
                ref_line_, ref_nnp_, ref_idx_ = lines_[ kk ], None, -1
                if len( nnp_list_ ) > 1:
                  print('DRUMPF->', nnp_list_)

                  for nnp_, _ in nnp_list_:
                      print('MIKE->', nnp_, ref_line_ )
                      if nnp_ in ref_line_:
                          nnp_idx_ = ref_line_.index( nnp_ )
                          print('DUMDUM=>', nnp_idx_)
                          if nnp_idx_ > ref_idx_: 

                              if kk == curr_idx_ and wdidx < nnp_idx_: continue

                              ref_nnp_ = nnp_
                              ref_idx_ = nnp_idx_

                  if ref_nnp_ is not None: return ref_nnp_, wdidx        

                elif len( nnp_list_ ) == 1: return nnp_list_[0], wdidx
        '''        
        elif wd.lower() in [ 'they' ]:
            
            for kk in srtD_keys_:
              if kk < curr_idx_: # so if curr idx is 5 and reverse sorted key is 3, it implies presence of the person's name in htis line
                nnp_list_ = nnp_D[ kk ]
                return ','.join( nnp_list_ ), wdidx ## send a comma separated string of all NNPs , since its a collective pronoun
        '''        
    return None, None        

def findRepetitivePhrases( phrases_of_interest_, neo_line_, title, backup_thresh=None ):
    print('DUMM->', phrases_of_interest_)
    potential_entities_ = dict()

    for phrase, sent_idx in phrases_of_interest_:
            ignore_ = False 
            for sub_title in title.split():
                if sub_title in phrase and len( phrase.split() ) <= 2:
                    print('IGNORE->', phrase )
                    ignore_ = True
                    break
            if ignore_: continue

            if phrase in potential_entities_:
                ll_ = potential_entities_[ phrase ]
            else:
                ll_ = list()

            ll_.append( sent_idx )
            potential_entities_[ phrase ] = ll_

    ## now find blue monkeys that have the most mentions ..if not found then check the potential entities
    repetition_cnt_ = dict()
    neo_phr_, ignore_, embeddings_ = dict(), list(), dict()

    for phrase, idx_arr in potential_entities_.items():
        embeddings_[ phrase ] = returnPhraseEmbedding( phrase.lower() )

    for phrase, idx_arr in potential_entities_.items():
        if phrase in ignore_ : continue
        found_dupe_ = False

        for phr, idx_arr2 in potential_entities_.items():
            if phrase == phr: continue

            _emb, phr_emb = embeddings_[ phrase ], embeddings_[ phr ]
            #print( 'GOOGOO->', distance.cosine( _emb, phr_emb ), cosine_dist_thresh,'||',phrase,'||',phr )
            dist_ = distance.cosine( _emb, phr_emb )
            if phr in phrase or dist_ <= cosine_dist_thresh:
                #print('ADDING ->', phr, phrase, idx_arr, idx_arr2, set( idx_arr + idx_arr2 ) )
                if phrase in neo_phr_:
                    neo_phr_[ phrase ] = list( set( neo_phr_[ phrase ] + idx_arr2 ) )
                else:
                    neo_phr_[ phrase ] = list( set( idx_arr + idx_arr2 ) )
                ignore_.append( phr )

                found_dupe_ = True

            elif backup_thresh is not None and dist_ <= backup_thresh:
                if phrase in neo_phr_:
                    neo_phr_[ phrase ] = list( set( neo_phr_[ phrase ] + idx_arr2 ) )
                else:
                    neo_phr_[ phrase ] = list( set( idx_arr + idx_arr2 ) )
                ignore_.append( phr )

                found_dupe_ = True

        if found_dupe_ is False:
            neo_phr_[ phrase ] = idx_arr
    
    potential_entities_ = neo_phr_

    repetition_cnt_ = { key: ( len( val ), val ) for key, val in potential_entities_.items() }

    print('REP COUNT for phrases_of_interest_->', phrases_of_interest_, repetition_cnt_ )

    if len( repetition_cnt_ ) > 0:
        dd_ = dict( sorted( repetition_cnt_.items(), key=lambda x:x[1][0], reverse=True ) )
        sorted_keyL = list( dd_.keys() )

        if dd_[ sorted_keyL[0] ][0] >= min_repetition_count_threshold_:
            ## find the first occ of the phrase ..that becomes the line
            ## idea is to find the longest line ..since it gives the most context
            topLn = ''
            for line_idx in dd_[ sorted_keyL[0] ][1]:
                if len( neo_line_[line_idx].split() ) > len( topLn.split() ):
                    topLn = neo_line_[line_idx]

            ## ensure the entity doesnt carry title of doc in the string ..
            ## fr eg if title == Einstein and the entuty is "Einstein studied in ETH" .. the Einstein the 
            ## entity needs to be removed since its the OBJECT node and Einstein is the subj node ..capice ?
            title_idx = None
            for sub_title in title.split():
                if sub_title in sorted_keyL[0].split():
                    title_idx = sorted_keyL[0].split().index( sub_title )
                    break
            if title_idx is not None:
                tmp_arr_ = sorted_keyL[0].split()
                entity_ = ' '.join( tmp_arr_[:title_idx] ) + ' '.join( tmp_arr_[ title_idx+1: ] )
            else:
                entity_ = sorted_keyL[0]

            print('Via NORMAL-> Most common ->', entity_, topLn)
            new_ent_arr_ = []
            '''
            if entity_ not in topLn:
                ## this can happen due to backup_thresh where the top entity remains something else
                ## but topLn changes
                for phr, _ in phrases_of_interest_:
                    if phr in topLn: new_ent_arr_.append( phr )
            
            '''
            entArr = new_ent_arr_ if len( new_ent_arr_ ) > 0 else [ entity_ ]
            ## check if topLn also has BM ..if so then pass BM as entity instead
            bm_arr_ = []

            if backup_thresh is not None:
                matches = re.findall(r'\[\[(.*?)\]\]', topLn)
                if len( matches ) > 0:
                    for match in matches: bm_arr_.append( match )

            if len( bm_arr_ ) > 0: entArr = bm_arr_
            return topLn, entArr ## since it expects response in array format

    return None, None    

def extractEntity( title, paragraph, header ):

    ## since its here, no direct mention of header was found
    ## start going line by line and figure out nltk pos's
    ## collect all blue monkey's first
    lines_, distance_thresh, cosine_dist_thresh, min_repetition_count_threshold_  =  paragraph.split('.'),\
                                      config_json_["distance_thresh"], config_json_["cosine_dist_thresh"], \
                                                             config_json_["min_repetition_count_threshold_"] 

    blue_monkeys_, potential_entities_, nnp_D = dict(), dict(), dict()
    header_emb_ = returnPhraseEmbedding( header.lower() )

    ## co-ref resolution
    neo_line_ = []
    for idx, line_ in enumerate( lines_ ):
        print('WHAT LINE ?', [ line_ ] )
        matches = re.findall(r'\[\[(.*?)\]\]', line_)
        if len( matches ) > 0:
            for match in matches: blue_monkeys_[ match ] = idx

        str_ = line_.replace('[','').replace(']','')
        NNPs_ = nltk_nlp.returnOnlyProperNouns( str_, title )
        print('RETURNED NNP LIST->', NNPs_, nnp_D)
        nnp_D [ idx ] = NNPs_

        if idx > 0:
            coref_resolved_, wdidx = coRefResolution( idx, lines_, str_, nnp_D )
            print('GOGO->', line_) 
            if coref_resolved_ != None:
              try:  
                print('Resolved CO-REF !!->', coref_resolved_ )
                tmp_arr_ = str_.split()
                tmp_arr_[ wdidx ] = coref_resolved_
                neo_line_.append( ' '.join( tmp_arr_ ) )
              except:
                pass  
            else:
                neo_line_.append( str_ )
        else:
            neo_line_.append( str_ )

    #print('Before COREF->', lines_)
    #print('Post COREF->', neo_line_)
    
    lines_ = neo_line_

    for idx, line_ in enumerate( lines_ ):
        closest_ = (  None, 100  )

        ## also find potential phrases 
        ## now replace all [ and ] for nltk to take over
        str_ = line_.replace('[','').replace(']','')
        phrases_of_interest_ = nltk_nlp.returnPhrasesOfInterest( str_, title )
        print('GHOULISH->', idx, phrases_of_interest_, str_ )
        for elem in phrases_of_interest_:
            if elem in potential_entities_:
                ll_ = potential_entities_[ elem ]
            else:
                ll_ = list()

            ll_.append( idx )
            potential_entities_[ elem ] = ll_

    ## now find blue monkeys that have the most mentions ..if not found then check the potential entities
    repetition_cnt_ = dict()
    #exit()
    
    print('DONKEY->', blue_monkeys_, potential_entities_)
    ## at times NLTK screws up and breaks the same sequence of NNPs into 2 separate NNPs
    ## for e.g. in one sentence it picks up "Heinrich Hertz" as a PERSON but in the next line
    ## the same phrase gets picked as "Heinrich" and "Hertz"
    ## lets clean this up
    neo_phr_, ignore_ = dict(), list()

    for phrase_tup, idx_arr in potential_entities_.items():
        if phrase_tup in ignore_ : continue
        found_dupe_ = False

        for phr_tup, idx_arr2 in potential_entities_.items():
            if phrase_tup == phr_tup: continue
            phrase, phr = phrase_tup[0], phr_tup[0]

            _emb, phr_emb = returnPhraseEmbedding(phrase.lower()), returnPhraseEmbedding(phr.lower())

            if phr in phrase or distance.cosine( _emb, phr_emb ) <= cosine_dist_thresh:
                #print('ADDING ->', phr, phrase, idx_arr, idx_arr2, set( idx_arr + idx_arr2 ) )
                if phrase in neo_phr_:
                    neo_phr_[ phrase ] = list( set( neo_phr_[ phrase ] + idx_arr2 ) )
                else:    
                    neo_phr_[ phrase ] = list( set( idx_arr + idx_arr2 ) )
                ignore_.append( phr )

                found_dupe_ = True

        if found_dupe_ is False:
            neo_phr_[ phrase_tup[0] ] = idx_arr

    print('DONKEY2->', blue_monkeys_, neo_phr_)
    potential_entities_ = neo_phr_

    for bm, lineidx in blue_monkeys_.items():
        for phrases , phr_line_idx_ in potential_entities_.items():

            bm_emb, phr_emb = returnPhraseEmbedding( bm.lower() ), returnPhraseEmbedding( phrases.lower() )
            if distance.cosine( bm_emb, phr_emb ) <= cosine_dist_thresh:
                if bm not in repetition_cnt_: repetition_cnt_[ bm ] = 1
                if bm in repetition_cnt_: repetition_cnt_[ bm ] += 1

    ## now check if any of the BMs have > 1 and then pick the ones that have greater than "min_repetition_count_threshold_"
    '''
    for key, val in repetition_cnt_.items():
        if val >= min_repetition_count_threshold_:
            print('MAIDEZ->', key, val, lines_[ blue_monkeys_[ key ] ] )
    '''

    if len( repetition_cnt_ ) > 0:
        dd_ = dict( sorted( repetition_cnt_.items(), key=lambda x:x[1], reverse=True ) )
        sorted_keyL = list( dd_.keys() )
        if dd_[ sorted_keyL[0] ] >= min_repetition_count_threshold_:
            print('Via Blue Monkey-> Most common ->', sorted_keyL[0]) 
            return None, sorted_keyL[0]

    repetition_cnt_ = { key: len( val ) for key, val in potential_entities_.items() }

    print( repetition_cnt_ )

    if len( repetition_cnt_ ) > 0:
        dd_ = dict( sorted( repetition_cnt_.items(), key=lambda x:x[1], reverse=True ) )
        sorted_keyL = list( dd_.keys() )
        if dd_[ sorted_keyL[0] ] >= min_repetition_count_threshold_:
            print('Via NORMAL-> Most common ->', sorted_keyL[0]) 
            return None, sorted_keyL[0]
    '''
    for key, val in repetition_cnt_.items():
        if val >= min_repetition_count_threshold_:
            print('MAIDEZ->', key, val )
    '''

    return None, None

def extractEntityWithoutHeader( paragraph ):

    ## here we will take a dumb approach .. we only have the blue monkeys to point to important aspects of the paragraph. Even amongst them we will take a simple approach and pick the first occurance in the first / last line
    first_line_, last_line_ = paragraph.split('.')[0], paragraph.split('.')[-1]

    potential_entities_first_ = re.findall( r'\[\[(.*?)\]\]', first_line_)
    potential_entities_second_ = re.findall( r'\[\[(.*?)\]\]', last_line_)

    if len( potential_entities_first_ ) > 0: return first_line_, potential_entities_first_[0]
    ## last ditch attempt, last line of paragraph
    if len( potential_entities_second_ ) > 0: return last_line_, potential_entities_second_[0]

    return None, None


def findEntityRelation( title, dict_ ):

    start_ = False 
    import time
    for paragraph, header in dict_.items():
      try:  
        if header != 'NA':
            entity = 'NA'

            pattern = r'\b19\d{2}:'
            matches = re.findall(pattern, paragraph)

            pattern = r'\b18\d{2}:'
            matches2 = re.findall(pattern, paragraph)

            if len( matches ) > 0 and len( paragraph.split() ) <= 20:
                print('GOIN THRU->', paragraph )

            elif len( matches2 ) > 0 and len( paragraph.split() ) <= 20:
                print('GOIN THRU->', paragraph )
           
            else:
                continue

            time.sleep(1)
            with open('RESULT1.txt', 'a') as fp:
                matches = re.findall(r'\[\[(.*?)\]\]', paragraph)
                if len( matches ) > 0:
                  
                  for mtch in matches:   
                    ent_ = ( mtch.split(',')[0] ).replace(' ','_')

                    #fp.write( '---------------------------------\n' )
                    #fp.write( str( paragraph ) + '$$$ IMPORTANT ENTITY = ' + str( ent_ ) + '\n' ) 

                    ## get page content
                    with open( 'INIT_JSONS/'+str( ent_ )+'.json', 'w+' ) as fp:
                        json.dump( ( wiki_textract_api.getWiki( str( ent_ ) ) ).json(), fp )

                    print('DUMPED-> ... ', 'INIT_JSONS/'+str( ent_ )+'.json')    

      except:
          print('DINGED->', paragraph)
          print( traceback.format_exc() )
          continue


if __name__ == "__main__":

    '''
    #result = remove_text_between_curly_braces( sys.argv[1] )
    result = remove_text_between_curly_braces_sentence( sys.argv[1] )

    #findEntityRelation( 'NA', sys.argv[1] )
    extractEntity( 'Albert Einstein', result, 'NA' )
    '''
    if True: 
        main_title_ = sys.argv[1]
        with open( main_title_, 'r' ) as fp:
          js_ = json.load( fp )

        result = remove_text_between_curly_braces( js_['parse']['wikitext'] )

        print("Original Title:")
        print( js_['parse']['title'])
        #print( result )
        holder_ = []

        findEntityRelation( js_['parse']['title'], result )

