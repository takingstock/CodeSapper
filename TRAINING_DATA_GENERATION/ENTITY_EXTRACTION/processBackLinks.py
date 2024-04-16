import json, sys
import numpy as np

dd_ = dict()

import wikipediaapi
# Create a Wikipedia API object
wiki_wiki = wikipediaapi.Wikipedia(language='en', user_agent='vikBOT/vikram.murthy@gmail.com')

def getBackLinks( page_title ):

    # Retrieve the page object
    page = wiki_wiki.page(page_title)

    # Check if the page exists
    if page.exists():
        # Get the number of incoming links
        num_incoming_links = len(page.backlinks)
        print("Number of incoming links to the page '{}': {}".format(page_title, num_incoming_links))
        return num_incoming_links
    else:
        print("Page '{}' does not exist.".format(page_title))
        return 0

def findMostCommonBM( js_ ):

    for dd in js_:
        if 'na' == dd['object'].lower(): continue
        if dd['object'] in dd_:
            ll_ = dd_[ dd['object'] ]
        else:
            ll_ = list()

        ll_.append( dd['subject'] )
        dd_[ dd['object'] ] = ll_

    srtd_ = dict( sorted( dd_.items(), key=lambda x:len(x[1]), reverse=True ) )

    arr_len_ = np.asarray( [ len(x) for k, x in srtd_.items() ] )

    single_elem_arr_ = [ x for k,x in srtd_.items() if len(x) == 1 ]

    print( 'Median and quartiles->', np.median( arr_len_ ), np.percentile( arr_len_, 25 ),\
            np.percentile( arr_len_, 50 ), np.percentile( arr_len_, 75 ), np.percentile( arr_len_, 90 ),\
            np.percentile( arr_len_, 99 ) )

    print( 'Total, num of single links ->', len( srtd_ ), len( single_elem_arr_ ) )

    with open('Sorted_links.json', 'a') as fp:
        json.dump( srtd_, fp )

    '''
    fin_ll_, backlink_ctr = [], []
    for key, val in srtd_.items():
        if len( val ) >= 8: ## 8 is the size of the 98th percentil of the above sample
            kk_ = key.replace(' ','_' )
            fin_ll_.append( kk_ )
            backlink_ctr.append( getBackLinks( kk_ ) )

    print('BABA->', len( fin_ll_ ), np.median( np.asarray( backlink_ctr ) ) )        

    with open('AdditionalJSON.json', 'a' ) as fp:
        json.dump( fin_ll_, fp )
    '''

if __name__ == '__main__':
    with open( sys.argv[1], 'r' ) as fp:
        js_ = json.load( fp )

    findMostCommonBM( js_ )    
