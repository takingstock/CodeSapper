from qdrant_client import models, QdrantClient
from qdrant_client.models import PointStruct
import ast

from django.shortcuts import render
from django.core import serializers
from django.http import HttpResponse, JsonResponse
from sentence_transformers import SentenceTransformer
import json, traceback
import numpy as np
from django.core.cache import cache

with open('config.json', 'r' ) as fp:
    config_json_ = json.load( fp )

encoder = SentenceTransformer( config_json_['sentenceEncoderModel'] )
'''
print('Even before coming here ??')
qdrant = QdrantClient( path=config_json_['dbPath'] )
#qdrant = QdrantClient( ":memory:" )

qdrant.recreate_collection(
        collection_name=config_json_['dbName'],
        vectors_config=models.VectorParams(
                size=encoder.get_sentence_embedding_dimension(), # Vector size is defined by used model
                distance=models.Distance.COSINE
        )
    )

cache.set( 'qdrantConn', qdrant, -1 )
'''

def encodeSentence(request):

  try:

    if request.method == 'POST':
        sentence = request.POST.get('sentence')
        return JsonResponse( { 'encodedDoc': encoder.encode( sentence ).tolist() } )
    else:
        return JsonResponse( { 'encodedDoc': [] } )

  except:
      print( 'Exception in encodeSentence->', traceback.format_exc())
      return JsonResponse( { 'encodedDoc': [] } )

def dbInsert(request):  

  try:

    if request.method == 'POST':
        dbRec_ = ast.literal_eval( request.POST['dbRec_'] )

        qconn_ = cache.get( 'qdrantConn' )

        qconn_.upsert(
          collection_name=config_json_['dbName'],
          points=[
                PointStruct(
                        id=idx,
                        vector=doc["docSignature"],
                        payload=doc
                        ) for idx, doc in enumerate([ dbRec_ ]) ## NOTE: this is stupid ! we need to find a way to insert one record at a time instead of cloaking it as an array and using the example given on the github page
               ]
        )
        return JsonResponse( { 'dbInsert': True } )
    else:
        return JsonResponse( { 'dbInsert': False } )

  except:
      print( 'Exception in dbInsert->', traceback.format_exc())
      return JsonResponse( { 'dbInsert': False } )


def dbSearch(request):  

  try:

    if request.method == 'POST':
        dbRec_ = ast.literal_eval( request.POST['dbRec_'] )

        hits = qdrant.search(
          collection_name=config_json_['dbName'],
          query_vector=dbRec_["docSignature"],
          limit=5 # Return 5 closest points
        )

        #print( hits )
        response_master = dict()
        for elem in hits:
            response_ = dict()
            response_['score'] = elem.score
            response_['payload'] = elem.payload

            response_master[ elem.id ] = response_

        return JsonResponse( { 'searchRes_': response_master } )
    else:
        return JsonResponse( { 'searchRes_': [] } )

  except:
      print( 'Exception in dbSearch->', traceback.format_exc())
      return JsonResponse( { 'searchRes_': [] } )

def dbUpdate(request):  
  ## since we are using "upsert" the same call as dbInsert will work ..just making it separate so that we can include more processing in the future, if need be
  try:

    if request.method == 'POST':
        dbRec_ = ast.literal_eval( request.POST['dbRec_'] )

        qdrant.upsert(
          collection_name=config_json_['dbName'],
          points=[
                PointStruct(
                        id=idx,
                        vector=doc["docSignature"],
                        payload=doc
                        ) for idx, doc in enumerate([ dbRec_ ]) ## NOTE: this is stupid ! we need to find a way to insert one record at a time instead of cloaking it as an array and using the example given on the github page
               ]
        )
        return JsonResponse( { 'dbInsert': True } )
    else:
        return JsonResponse( { 'dbInsert': False } )

  except:
      print( 'Exception in dbUpdate->', traceback.format_exc())
      return JsonResponse( { 'dbUpdate': False } )
