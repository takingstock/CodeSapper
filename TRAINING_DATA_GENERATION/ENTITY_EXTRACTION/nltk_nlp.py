import nltk, sys
from nltk import Tree
from nltk import pos_tag, ne_chunk
from nltk.tree import Tree

from fuzzywuzzy import fuzz

nltk.download('maxent_ne_chunker')
nltk.download('words')

sentence = sys.argv[1]
# Tokenize and part-of-speech tagging

def returnOnlyProperNouns( sentence, title, debug=False ):

    sentence = sentence.replace("'",'').replace("`",'') 
    sent_arr_ = sentence.split('.')
    phrases_ = []

    for sent_idx_, sent_ in enumerate( sent_arr_ ):
        tokens = nltk.word_tokenize( sent_ )
        tagged_tokens = pos_tag(tokens)

        # Perform named entity chunking
        chunked_tokens = ne_chunk(tagged_tokens)

        phr_ = ''
        #print('----------------', sentence)
        if debug is True:
          #print( chunked_tokens )
          for elem in chunked_tokens.leaves():
              print( elem )

        for idx, elem in enumerate( chunked_tokens.leaves() ):
            if idx >= len( chunked_tokens ) - 1: break
            curr, next = chunked_tokens.leaves()[ idx ], chunked_tokens.leaves()[ idx + 1 ]

            if True:
              child, tag, child2, tag2 = curr[0], curr[1], next[0], next[1]
            
              if ( tag == 'NNP' ) and\
                      ( tag2 == 'NNP' ):

                  if phr_ == '':
                      phr_ = child + ' ' + child2
                  elif child not in phr_:
                      phr_ += ' ' + child
                  elif child2 not in phr_:
                      phr_ += ' ' + child2

              else:
                  #print('Potential SUBJ-> not considered for PHRASE->', phr_ )
                  if len( phr_ ) > 0:
                    #if not( phr_.lower().strip() in title.lower() or title.lower() in phr_.lower().strip() ):  
                      print( 'INSERTION->', phr_, title )
                      phrases_.append( ( phr_, sent_idx_ ) )
                      phr_ = '' 

        if len( phr_ ) > 0:
            #if not( phr_.lower().strip() in title.lower() or title.lower() in phr_.lower().strip() ):  
              print( 'INSERTION->', phr_, title )
              phrases_.append( ( phr_, sent_idx_ ) )
              phr_ = '' 
    
    return phrases_

def returnPhrasesOfInterest( sentence, title, debug=False ):

    sentence = sentence.replace("'",'').replace("`",'') 
    sent_arr_ = sentence.split('.')
    phrases_ = []

    for sent_idx_, sent_ in enumerate( sent_arr_ ):
        tokens = nltk.word_tokenize( sent_ )
        tagged_tokens = pos_tag(tokens)

        # Perform named entity chunking
        chunked_tokens = ne_chunk(tagged_tokens)

        phr_, pos_tags_ = '', ''
        #print('----------------', sentence)
        '''
        if debug is True:
          #print( chunked_tokens )
          for elem in chunked_tokens.leaves():
              print( elem )
        '''
        for idx, elem in enumerate( chunked_tokens.leaves() ):
            if idx >= len( chunked_tokens ) - 1: break
            curr, next = chunked_tokens.leaves()[ idx ], chunked_tokens.leaves()[ idx + 1 ]

            if True:
              child, tag, child2, tag2 = curr[0], curr[1], next[0], next[1]
            
              if ( tag in ['JJ', 'FW', 'CC', 'IN', 'DT', 'DWT'] or 'VB' in tag[:2] or 'NN' in tag[:2] ) and\
                      ( tag2 in ['JJ', 'FW', 'CC', 'IN', 'DT', 'DWT'] or 'VB' in tag2[:2] or 'NN' in tag2[:2] ):

                  if phr_ == '':
                      phr_ = child + ' ' + child2
                      pos_tags_ = tag + tag2
                  elif child not in phr_:
                      phr_ += ' ' + child
                      pos_tags_ += tag
                  elif child2 not in phr_:
                      phr_ += ' ' + child2
                      pos_tags_ += tag2
              else:
                  #print('Potential SUBJ-> not considered for PHRASE->', phr_ )
                  if len( phr_ ) > 0 and 'NN' in pos_tags_: ##NOTE-> NN in pos_tags_ maybe breaking change
                    #if not( phr_.lower().strip() in title.lower() or title.lower() in phr_.lower().strip() ):  
                      #print( 'INSERTION->', phr_, title )
                      phrases_.append( ( phr_, sent_idx_ ) )
                      phr_, pos_tags_ = '' , ''

        if len( phr_ ) > 0:
            #if not( phr_.lower().strip() in title.lower() or title.lower() in phr_.lower().strip() ):  
              #print( 'INSERTION->', phr_, title )
              phrases_.append( ( phr_, sent_idx_ ) )
              phr_ = '' 
    
    return phrases_

if __name__ == "__main__":

    print( returnPhrasesOfInterest( sentence, title=sys.argv[2], debug=True ) )
    #print( returnOnlyProperNouns( sentence ) )
