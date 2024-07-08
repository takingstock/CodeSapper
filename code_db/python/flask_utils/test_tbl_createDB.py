from qdrant_client import models, QdrantClient
from qdrant_client.models import PointStruct
import json

from sentence_transformers import SentenceTransformer

with open( 'tbl_config.json', 'r' ) as fp:
  config_json_ = json.load( fp )

encoder = SentenceTransformer( config_json_['sentenceEncoderModel'] )

qdrant = QdrantClient( "http://localhost:6333" )

qdrant.recreate_collection(
  collection_name='testTbl',
  vectors_config=models.VectorParams(
  size=encoder.get_sentence_embedding_dimension(), # Vector size is defined by used model
  distance=models.Distance.COSINE
  )
)

