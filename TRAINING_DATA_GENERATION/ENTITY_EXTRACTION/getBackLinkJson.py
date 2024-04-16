import json, traceback
import numpy as np
import wiki_textract_api

with open('Sorted_links.json', 'r' ) as fp:
    js_ = json.load( fp )

for key, arr_ in js_.items():
    kk = key.replace(' ','_' )
    if len( arr_ ) < 8: continue

    try:
        with open( 'INIT_JSONS/'+ kk +'.json', 'w+' ) as fp:
            json.dump( ( wiki_textract_api.getWiki( kk ) ).json(), fp )

        print('DUMPED->', kk)    
    except:
        print('LET GO ->', kk, traceback.format_exc()) 

