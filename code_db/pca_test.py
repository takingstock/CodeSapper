import numpy as np
from sklearn.decomposition import PCA
X = np.array([  [1, 1, 1], \
                [2, 1, 2], \
                [10, 1, 2], \
                [21, 1, 2], \
                [30, 1, 2] \
            ])

pca = PCA()
pca.fit(X)
import time
start_ = time.time()
print(pca.explained_variance_ratio_)
print(pca.n_components_)

print(pca.components_)
print( time.time() - start_ )
