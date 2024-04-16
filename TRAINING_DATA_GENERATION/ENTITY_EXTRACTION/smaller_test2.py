from scipy.spatial import distance
import urllib.request
import json, db_utils, re
import nltk_nlp
import parse_wiki_debug

from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

url_encode = 'http://0.0.0.0:5200/encodeSentence'
import sys

def returnEnc( sentence ):

        data = json.dumps( { 'sentence': sentence } ).encode('utf-8')

        _request = urllib.request.Request( url_encode, data=data, method='POST', headers={'Content-Type': 'application/json'} )
        response = urllib.request.urlopen( _request )
        string = response.read().decode('utf-8')
        json_obj = json.loads(string)

        return json_obj['encoded_']

def returnPhraseDistance( input_arr_, title="NA" ):
    vec , backup, enc_ = [], [], []

    for ph, idx in input_arr_:
      if len( ph.strip().split() ) <=1: continue  # singular phrases not allowed 
      s = ph.replace('[','').replace(']','')
      enc_.append( returnEnc( s ) )

    cos_dist_ = 1 - cosine_similarity( enc_ )
    upper_triangle_indices = np.triu_indices(cos_dist_.shape[0], k=1)
    print( cos_dist_.shape )

    condn1 = ( cos_dist_ > 0 ) & ( cos_dist_ <= 0.45 )
    condn2 = ( cos_dist_ > 0 ) & ( cos_dist_ > 0.45 ) & ( cos_dist_ <= 0.55 )

    filtered_indices, filtered_indices_bkup = \
            np.argwhere( condn1 ) , \
            np.argwhere( condn2 ) 
    #      vec.append( { 'outer': outer_sent_idx_, 's': s, 'inner': inner_sent_idx_, 'si': si, 'dist_': dist_ } )
    #filtered_indices = [ (i, j) for i,j in filtered_indices if i < j ]
    print('filtered_indices->', filtered_indices)
    existing_ = []
    for arr_ in filtered_indices:
        vec.append( { 'outer': input_arr_[ arr_[0] ][1], 's': input_arr_[ arr_[0] ][0],\
                      'inner': input_arr_[ arr_[1] ][1], 'si': input_arr_[ arr_[1] ][0], \
                      'dist_': cos_dist_[ arr_[0] ][ arr_[1] ] } )
    print( vec )    
    print('filtered_indices_bkp ->', filtered_indices_bkup)
    for arr_ in filtered_indices_bkup:
        backup.append( { 'outer': input_arr_[ arr_[0] ][1], 's': input_arr_[ arr_[0] ][0],\
                      'inner': input_arr_[ arr_[1] ][1], 'si': input_arr_[ arr_[1] ][0], \
                      'dist_': cos_dist_[ arr_[0] ][ arr_[1] ] } )

    return vec, backup    

def returnPhraseDistance_old( input_arr_, title="NA" ):
    vec = []

    backup = []

    for outer_phrase_, outer_sent_idx_ in input_arr_:
      avg = 0  

      if len( outer_phrase_.strip().split() ) <=1: continue  # singular phrases not allowed 
      if title.lower() in outer_phrase_.lower(): 
          s = outer_phrase_.lower().replace( title.lower(), '' )
      else:
          s = outer_phrase_.lower()

      s = s.replace('[','').replace(']','')

      for inner_phrase_, inner_sent_idx_ in input_arr_:
        if len( inner_phrase_.strip().split() ) <=1: continue  
        if title.lower() in inner_phrase_.lower():
          si = inner_phrase_.lower().replace( title.lower(), '' )
        else:
          si = inner_phrase_.lower()

        si = si.replace('[','').replace(']','')

        r1, r2 = returnEnc( s ), returnEnc( si )

        dist_ = distance.cosine( r1, r2 )

        if dist_ < 0.45 and dist_ > 0:
        #if True:
          vec.append( { 'outer': outer_sent_idx_, 's': s, 'inner': inner_sent_idx_, 'si': si, 'dist_': dist_ } )
          #print('Distance between ->', s, ' & ', si, ' == ', dist_, vec)

        elif dist_ < 0.55 and dist_ > 0:
          backup.append( { 'outer': outer_sent_idx_, 's': s, 'inner': inner_sent_idx_, 'si': si, 'dist_': dist_ } )
      #print('Overall distance-> for line =>', s, ' ==== ', avg )

    if len( vec ) == 0:
        print('BACKUP->', backup )

    print('RETURNING-----------------')
    print( vec )
    return vec, backup    

def ignorePhrases( s, si, title ):

    sarr , si_arr = s.split(), si.split()
    r1, r2 = [ 1 if wd.lower() not in title.lower() else 0 for wd in sarr ],\
             [ 1 if wd.lower() not in title.lower() else 0 for wd in si_arr ]

    if ( len(r1) == 2 and sum(r1) == 1 ) or ( len(r2) == 2 and sum(r2) == 1 ):
        ## meaning the phrase has only 2 words, 1 of which is the title of the document ..
        print( 'One of these phrases was too short and also had the title !!', s, '||' , si, '||' ,title )
        return True

    ## also check if the oly other word is "the" , "but", "and"
    remaining_sarr, remaining_si_arr = [], []

    for elem in sarr:
        if elem in [ 'the', 'but', 'and' ]: continue
        remaining_sarr.append( elem )

    for elem in si_arr:
        if elem in [ 'the', 'but', 'and' ]: continue
        remaining_si_arr.append( elem )
   
    if len( remaining_sarr ) <=1 or len( remaining_si_arr ) <=1:
        print( 'One of these phrases was too short and also had the title !!', s, '||' , si, '||' ,title )
        return True

    return False

def commonWords( bm_w, ref_w ):
    ## check if the first word of bm appears anywehere in ref //simple
    if len( bm_w.split()[0] ) >=5 and bm_w.split()[0].lower() in ref_w.lower(): return True
    if len( bm_w.split()[-1] ) >=5 and bm_w.split()[-1].lower() in ref_w.lower(): return True

    return False

def resolveCoRef_BM( inp_dict_, raw_sentence_arr_, title, phrases_of_interest_ ):

    relevant_idx_ = list( inp_dict_.keys() )
    print('RELEVANT INDICES->', relevant_idx_, raw_sentence_arr_)
    blue_monkeys_, nnp_D, neo_line_ = dict(), dict(), list()

    for idx, line_ in enumerate( raw_sentence_arr_ ):
        matches = re.findall(r'\[\[(.*?)\]\]', line_)
        if len( matches ) > 0:
            for match in matches: blue_monkeys_[ match ] = [ idx ] ## need arrays since more than 1 line can have same BM ..as u will see below

    for idx, line_ in enumerate( raw_sentence_arr_ ):

        str_ = line_.replace('[','').replace(']','')

        if idx not in relevant_idx_:
            neo_line_.append( str_ )
            continue

        #print('WHAT LINE ?', [ line_ ] )

        NNPs_ = nltk_nlp.returnOnlyProperNouns( str_, title )
        print('RETURNED NNP LIST->', NNPs_, nnp_D)
        nnp_D [ idx ] = NNPs_

        ## check if any blue monkeys reference in this line
        ## basically in any para, once the BM is introduced, the same term can be repeated in diff lines
        ## just that it wont be a BM ..capice ? 
        for key in list( blue_monkeys_.keys() ):
            if key.lower() in line_.lower() and idx not in blue_monkeys_[ key ]:
                #print('BM ->', key, ' found in UNREFERENCED LINE->', line_ )
                blue_monkeys_[ key ].append( idx )

        ## 2nd pass to find nearmatches
        for bm, idx_arr in blue_monkeys_.items():
            if idx not in idx_arr:

                for phr_oi, sent_idx in phrases_of_interest_:
                    if sent_idx == idx and commonWords( bm, phr_oi ):
                        print('BM ->', key, ' found in UNREFERENCED LINE->', line_ )
                        blue_monkeys_[ bm ].append( idx )
                        break

        if idx > 0:
            coref_resolved_, wdidx = parse_wiki_debug.coRefResolution( idx, raw_sentence_arr_, str_, nnp_D )
            print('GOGO->', line_, nnp_D)
            '''
            if coref_resolved_ != None:
                print('Resolved CO-REF !!->', coref_resolved_ )
                tmp_arr_ = str_.split()
                tmp_arr_[ wdidx ] = coref_resolved_[0]
                neo_line_.append( ' '.join( tmp_arr_ ) )
            else:
                print('NO Resolved CO-REF !!->', coref_resolved_ )
                neo_line_.append( str_ )
            '''
            if True:
                print('NO Resolved CO-REF !!->', coref_resolved_ )
                neo_line_.append( str_ )
        else:
            neo_line_.append( str_ )

    return neo_line_, blue_monkeys_
   
def findTopByBM( relevant_dict_arr, neo_line_, blue_monkeys_, mode ):

  top_idx, top_bm_ = -100, []

  #print('ENtering findTopByBM =>', neo_line_)

  if mode == 'TOP':
      ## then we only need to go through the 'outer' of the array since that index has proven
      ## that it has more than 1 "followers" ..we can take the 0th element since all outers will be the same in TOP
      outer_idx = relevant_dict_arr[0]['outer'] if len( relevant_dict_arr ) >=1 else -1
      outer_bms, inner_bms = [], []

      for bm, idx_list in blue_monkeys_.items():
        if outer_idx in idx_list: outer_bms.append( bm )

      if len( outer_bms ) == 0: return top_idx, top_bm_

      return neo_line_[ outer_idx ], ( outer_bms )

  ## if mode != 'TOP'
  common_ = []

  for relevant_dict_ in relevant_dict_arr:

    outer_idx, inner_idx = relevant_dict_['outer'], relevant_dict_['inner']
    outer_bms, inner_bms = [], []

    for bm, idx_list in blue_monkeys_.items():
        if outer_idx in idx_list: outer_bms.append( bm )
        if inner_idx in idx_list: inner_bms.append( bm )

    #print( 'RD-> outer_idx, inner_idx, blue_monkeys_, outer_bms, inner_bms = ', \
    #                                  outer_idx, inner_idx, blue_monkeys_, outer_bms, inner_bms )

    if len( outer_bms ) > len( inner_bms ) and len( outer_bms ) > len( top_bm_ ):
        print('Most IMP line->', neo_line_[ outer_idx ])
        print('Contained the BMs == ', outer_bms )
        top_idx, top_bm_ = neo_line_[ outer_idx ], ( outer_bms )

    if len( inner_bms ) > len( outer_bms ) and len( inner_bms ) > len( top_bm_ ):
        print('Most IMP line->', neo_line_[ inner_idx ])
        print('Contained the BMs == ', inner_bms )
        top_idx, top_bm_ = neo_line_[ inner_idx ], ( inner_bms )

  return top_idx, top_bm_

def stage2SrchBM( blue_monkeys_, neo_line_ , phrases_of_interest_ ):

    topln, ent_arr, entD = None, list(), dict()
    sorted_bm = dict( sorted( blue_monkeys_.items(), key=lambda x: len(x[1]), reverse=True ) )
    topKey = list( sorted_bm.keys() )[0]

    if len( sorted_bm[ topKey ] ) > 1:
        topln =neo_line_[ sorted_bm[ topKey ][0] ] # first index in the index array since thats where it was first encountered
        ent_arr.append( topKey )

        ## now check if there are otehr ENTs in the topln
        for bm , bm_presence_idx_arr_ in blue_monkeys_.items():
            if bm != topKey and sorted_bm[ topKey ][0] in bm_presence_idx_arr_:
                ## we are checking if the entity is other than the one already chosen in the line above
                ## and if the line idx chosen for topln , is present in other bm ( since bm dict is key-> bm val-> array of indices where its present )
                neo_ = None

                if len( bm.split() ) == 1:
                    ## check phrases if there's a more complete desc of the entity
                    for phrase , _ in phrases_of_interest_:
                        if bm.lower() in phrase.lower():
                            neo_ = phrase
                            break

                if neo_ != None: ent_arr.append( neo_.replace('[','').replace(']','') )
                else: ent_arr.append( bm )

    print( 'TOP LN->', topln )
    print( 'ENT ARR->', ent_arr )

    return topln, ent_arr

def findEntities( vec, title, input_arr_, phrases_of_interest_ ):

    ## first find the ranking of top sentences in the vector
    ranking_ = dict()
    
    for dict_ in vec:
        print( dict_ )
        ## we dont want matching phrases from the same line ..the idea is to find matching phrases from other lines
        ## the sentence with most "incoming" / "outgoing" matches is ideally the most imp sentence ..ala page rank
        if dict_['outer'] == dict_['inner']: continue 

        ## now also cleanup phrases like "<title>+<random word>" they are just noisy
        ## for e.g. phrase like "Einstein expounded"  &  "Einstein replied" are useless matches without the title
        ## of the article ( which in this case was Einstein )
        if ignorePhrases( dict_['s'], dict_['si'], title ) is True: continue

        if dict_['outer']  in ranking_:
            ll_ = ranking_[ dict_['outer'] ]
        else:
            ll_ = list()

        ll_.append( dict_ )

        ranking_[ dict_['outer'] ] = ll_

    if len( ranking_ ) == 0:
        print('WHAAAA ')
        ## none of the phrases seem to be related to each ..just find the most popular phrase
        topLn, entities = \
              parse_wiki_debug.findRepetitivePhrases( phrases_of_interest_, input_arr_, title, backup_thresh=0.55 )
        print('None of the phrases are related :( .. topLn, entities = ', topLn, entities)
        return topLn, entities

    ranked_ = dict( sorted( ranking_.items(), key=lambda x: len( x[1] ), reverse=True ) )

    top_sentence_, top_key_, runner_up_key_ = ranked_[ list( ranked_.keys() )[0] ], list( ranked_.keys() )[0],\
                                     list( ranked_.keys() )[1] if len( ranked_ ) > 1 else list( ranked_.keys() )[0]

    neo_line_, blue_monkeys_ = resolveCoRef_BM( ranked_, input_arr_, title, phrases_of_interest_ )

    #print('MIKE TEST-> COREFed LINE->', neo_line_)
    print('MIKE TEST-> blue_monkeys_->', blue_monkeys_)

    ## remove dupes / substrings from blue_monkeys_
    new_monkeys_ = dict()
    for k,v in blue_monkeys_.items():
        found = False
        for k2,v2 in blue_monkeys_.items():
            if k2 != k and k in k2:
                print('DUPE->', k2, v2)
                found = True
                break
        
        if found is False:
            new_monkeys_[ k ] = v
   
    blue_monkeys_ = new_monkeys_
    print('MIKE TEST-> blue_monkeys_->', blue_monkeys_)
    ## if the top sentence has a count > 1 then we are good to go with the next steps
    ## else we have to stick to some rather default options
    if len( ranked_[ top_key_ ] ) > 1 and len( ranked_ ) > 2 and\
             len( ranked_[ top_key_ ] ) > len ( ranked_[runner_up_key_] ):
        print('Huzzah ..most important ->', top_key_, ranked_[ top_key_ ])
        ## from the phrase pair find the top sentence
        topLn, entities = findTopByBM( ranked_[ top_key_ ], neo_line_, blue_monkeys_, mode='TOP' )

        if topLn == -100 or entities == -100:
            print('STAGE2 search ..most IMP')
            if len( blue_monkeys_ ) > 0:
                topLn, entities = stage2SrchBM( blue_monkeys_, neo_line_, phrases_of_interest_ )
           
            if topLn in [ None, -100 ]:
                ## last DITCH ..just search for phrases that were repeated the most 
                topLn, entities = parse_wiki_debug.findRepetitivePhrases( phrases_of_interest_, neo_line_, title, backup_thresh=0.55 )
                print('IN LAST DITCH SEARCH-> topLn, entities = ', topLn, entities )
                return topLn, entities
            else:    
                print('IN STAGE2 SEARCH-> topLn, entities = ', topLn, entities )
                return topLn, entities

        else:
                print('IN BM SEARCH-> topLn, entities = ', topLn, entities )
                return topLn, entities
    else:   
        ## top keys have same count ..in this case, best to just go through all the phrases to decide winner
        print('NO Huzzah ..most important ->', top_key_, ranked_[ top_key_ ])

        ## go through all the relevant indices and find out which one has the most BMs
        top_ , topSent_ = [], None

        for relevant_idx in list( ranked_.keys() ):
            topLine_, numBMs = findTopByBM( ranked_[ relevant_idx ], neo_line_, blue_monkeys_, mode='ALL' )

            if len(numBMs) > len(top_):
                print('-----------------------------')
                print('Replacing -> ', top_, topSent_, ' To -> ', (numBMs), topLine_)
                top_, topSent_ = (numBMs), topLine_

        if topSent_ == None: ## no BMs found in any of the phrases 
            ## now we have no choice but to go through the phrases and find the sub phrase thats repeated across
            ## all phrases, the highest REP count wins 
            print('STAGE2 search')
            ## this can happen even if the num BMs found in all phrases is common
            if len( blue_monkeys_ ) > 0:
                topLn, entities = stage2SrchBM( blue_monkeys_, neo_line_, phrases_of_interest_ )

                if topLn == None:
                  ## last DITCH ..just search for phrases that were repeated the most 
                  topLn, entities = parse_wiki_debug.findRepetitivePhrases( phrases_of_interest_, neo_line_, title, backup_thresh=0.55 )
                  print('IN LAST DITCH SEARCH-> topLn, entities = ', topLn, entities )
                
                  return topLn, entities
           
            elif len( blue_monkeys_ ) == 0:
                ## last DITCH ..just search for phrases that were repeated the most 
                topLn, entities = parse_wiki_debug.findRepetitivePhrases( phrases_of_interest_, neo_line_, title, backup_thresh=0.55 )
                print('IN LAST DITCH SEARCH-> topLn, entities = ', topLn, entities )
                return topLn, entities

            elif topLn != None:    
                print('IN STAGE2 SEARCH-> topLn, entities = ', topLn, entities )
                return topLn, entities

        else:
            print('Done with the PARA .. main sentence->', topSent_, top_)
            return topSent_, top_

    return None, None

if __name__ == '__main__':

  returnPhraseDistance( sys.argv[1], title="NA" )
