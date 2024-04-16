import json
import numpy as np
import re, os
import wiki_textract_api

if True:

    links_ = os.listdir('INIT_JSONS')
    finale_, tmp_ = [] , []
    ## convert json to BM
    for link_ in links_:
      try:  
        main_title_ = link_
        #main_title_ = sys.argv[1]
        with open( 'INIT_JSONS/' + main_title_, 'r' ) as fp:
          js_ = json.load( fp )

        if 'parse' not in js_: continue
        if 'REDIRECT' in ( js_['parse']['wikitext'] ):
            matches = re.findall( r'\[\[(.*?)\]\]',  js_['parse']['wikitext'] )
            if len( matches ) > 0:
                ent_ = matches[0].replace( ' ','_' )
                with open( 'FINAL_JSONS/'+str( ent_ )+'.json', 'w+' ) as fp:
                    json.dump( ( wiki_textract_api.getWiki( str( ent_ ) ) ).json(), fp )
                    print('REDIRECT DUMP->', ent_)
                    continue

        with open( 'FINAL_JSONS/'+str( ent_ )+'.json', 'w+' ) as fp:
            json.dump( js_, fp )
      except:
          continue
