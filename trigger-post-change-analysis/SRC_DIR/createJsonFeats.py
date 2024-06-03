import json
import numpy as np
import findKeys
from scipy.spatial import distance
from scipy.linalg import eig
import urllib.request

import sys, os

# Disable
def blockPrint():
    sys.stdout = open(os.devnull, 'w')

# Restore
def enablePrint():
    sys.stdout = sys.__stdout__


#from sentence_transformers import SentenceTransformer

#encoder = SentenceTransformer('all-MiniLM-L6-v2')

#url_encode = 'http://20.235.122.20:5000/encodeSentence'
url_encode = 'http://0.0.0.0:5200/encodeSentence'

#def testCodeQl():
#    return None

def returnEmbed( sent ):

    rec_ = { 'sentence': sent }

    data = json.dumps( rec_ ).encode('utf-8')
    _request = urllib.request.Request( url_encode, data=data, method='POST', \
                                        headers={'Content-Type': 'application/json'} )

    response = urllib.request.urlopen( _request )
    string = response.read().decode('utf-8')
    json_obj = json.loads(string)
    
    return json_obj['encoded_'], True

def returnJsonFeat( src_0, src_raw ):

    with open( src_0, 'r' ) as fp:
    #with open( src_0 + file_, 'r' ) as fp:
        json_ = json.load( fp )

    with open( src_raw, 'r' ) as fp:
    #with open( src_raw + file_, 'r' ) as fp:
        json_raw = json.load( fp )

    blockPrint()    

    ## dummy
    file_ = ''

    key_tuple_ = findKeys.processNeighbours( json_, json_raw, file_ )    

    enablePrint()

    doc_str_, dist_matrix_, xymatrix = '', [], []

    for str_, norm_coords in key_tuple_:
        doc_str_ += ' ' + str_

    #print( doc_str_ )
    #print( np.asarray( dist_matrix_ ).shape, dist_matrix_[0] )
    #return doc_str_, xymatrix
    rec_ = { 'sentence': doc_str_ }

    data = json.dumps( rec_ ).encode('utf-8')
    _request = urllib.request.Request( url_encode, data=data, method='POST', headers={'Content-Type': 'application/json'} )
    response = urllib.request.urlopen( _request )
    string = response.read().decode('utf-8')
    json_obj = json.loads(string)
    
    return json_obj['encoded_'], key_tuple_
    #return doc_str_, dist_matrix_

if __name__ == '__main__':

    import sys
    from scipy import linalg


    '''
    fnm_, fnm2 = sys.argv[1], sys.argv[2]

    doc_str_, key_tup1 = returnJsonFeat( fnm_ )

    doc_str_2, key_tup2 = returnJsonFeat( fnm2 )

    print( 'Euclide->', distance.cosine( doc_str_, doc_str_2 ) )
    common_wds_1, common_wds_2, distm1, distm2 = [], [], [], []

    for str1, norm1 in key_tup1:
        for str2, norm2 in key_tup2:
            if str1 == str2:# and distance.cosine( norm1, norm2 ) <= 0.01:
                common_wds_1.append( (str1, norm1) )
                common_wds_2.append( (str2, norm2) )

    for st_, nm_ in common_wds_1:
        locdist_ = []
        for st_1, nm_1 in common_wds_1:
            locdist_.append( distance.euclidean( nm_, nm_1 ) )

        distm1.append( locdist_ )    

    for st_, nm_ in common_wds_2:
        locdist_ = []
        for st_1, nm_1 in common_wds_2:
            locdist_.append( distance.euclidean( nm_, nm_1 ) )

        distm2.append( locdist_ )  

    ## now calc prime eigenvectors    
    eigenvalues1, eigenvectors1 = eig( distm1 )
    idx = np.argsort(eigenvalues1)[::-1]
    print( eigenvalues1[idx][:5] )
    print( eigenvectors1[:, idx][:, :1] )

    eigenvalues2, eigenvectors2 = eig( distm2 )
    idx = np.argsort(eigenvalues2)[::-1]
    print( eigenvalues2[idx][:5] )
    print( eigenvectors2[:, idx][:, :1] )

    print( distance.cosine( eigenvectors1[:, idx][:, 0], eigenvectors2[:, idx][:, 0] ) )
    print( distance.cosine( eigenvalues1, eigenvalues2 ) )
    '''

