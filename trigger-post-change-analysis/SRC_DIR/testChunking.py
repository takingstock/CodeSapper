import numpy as np
import json, sys, os

def chunking_test(a, b):
    x = a*b
    y = call_func( a, b )
    zz = x**2
    y = zz*x
    abc = 123
    def_ = 456
    final_ = call_def( y )
    ghi = final_

    for st_, nm_ in common_wds_1:
        locdist_ = []
        for st_1, nm_1 in common_wds_1:
            locdist_.append( distance.euclidean( nm_, nm_1 ) )

        distm1.append( locdist_ )
    
    ffg_ = ghi
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
    return ffg_
