from flask import Flask, request, jsonify
import traceback, random
from qdrant_client import models, QdrantClient
import json
from qdrant_client.models import PointStruct

from sentence_transformers import SentenceTransformer

app = Flask('encode')

with open('tbl_config.json', 'r' ) as fp:
  config_json_ = json.load( fp )

encoder = SentenceTransformer( config_json_['sentenceEncoderModel'] )
print('Entering INIT2')
qdrant = QdrantClient( "http://localhost:6333" )

@app.route('/encodeSentence', methods=['POST'])
def encodeSentence():
  try:  
    dbRec_ = request.get_json()  # Get the JSON payload from the request
    encoded_ = encoder.encode( dbRec_['sentence'] ).tolist()

    response = { 'encoded_': encoded_ }
  except: 
      print( traceback.format_exc())
      response = { 'encoded_': [] }

  return jsonify(response)

def convert( input_ ):
    cc_ = 0
    print( 'INCOMING->', input_)
    for char in input_:
        cc_ += (ord( char ))

    print( 'PROCESSED->', cc_)
    return int(cc_)  

@app.route('/dbInsert', methods=['POST'])
def dbInsert():
  try:  
    dbRec_ = request.get_json()  # Get the JSON payload from the request
    id_ = ( dbRec_['docID'] )

    qdrant.upsert(
          collection_name='testTbl',
          points=[
                PointStruct(
                        id=id_,
                        vector=doc["docSignature"],
                        payload=doc
                        ) for idx, doc in enumerate([ dbRec_ ]) ## NOTE: this is stupid ! we need to find a way to insert one record at a time instead of cloaking it as an array and using the example given on the github page
               ]
        )
    

    with open('storeSignature.txt','a') as fp:
        fp.write( str( dbRec_ ) + '\n' )

    # Create the JSON response
    response = { 'dbInsert': True }
    print('Insert Respinse->', response, id_ )
  except: 
      print( traceback.format_exc())
      response = { 'dbInsert': False }
      print('Insert Respinse->', response)

  return jsonify(response)

@app.route('/dbSearch', methods=['POST'])
def dbSearch():
  try:  
    dbRec_ = request.get_json()  # Get the JSON payload from the request

    hits = qdrant.search(
          collection_name='testTbl',
          query_vector=dbRec_["docSignature"],
          limit=config_json_["topN"] # Return top N closest points
    )

    response_master = dict()
    for elem in hits:
      response_ = dict()
      response_['score'] = elem.score
      response_['payload'] = elem.payload

      response_master[ elem.id ] = response_
    

    # Create the JSON response
    response = { 'searchRes_': response_master }
  except: 
      print( traceback.format_exc() )
      response = { 'searchRes_': {} }

  return jsonify(response)

@app.route('/dbUpdate', methods=['POST'])
def dbUpdate():
  try:  
    dbRec_ = request.get_json()  # Get the JSON payload from the request

    id_ = ( dbRec_['docID'] )
    #id_ = ( int( arr_[0] )*100 ) + ( int( arr_[1] )*10 ) + int( arr_[-1] )

    qdrant.upsert(
          collection_name='testTbl',
          points=[
                PointStruct(
                        id=id_,
                        vector=doc["docSignature"],
                        payload=doc
                        ) for idx, doc in enumerate([ dbRec_ ]) ## NOTE: this is stupid ! we need to find a way to insert one record at a time instead of cloaking it as an array and using the example given on the github page
               ]
        )
    

    with open('storeSignature.txt','a') as fp:
        fp.write( str( dbRec_ ) + '\n' )

    # Create the JSON response
    response = { 'dbUpdate': True }
  except: 
      print( traceback.format_exc())
      response = { 'dbUpdate': False }

  return jsonify(response)

if __name__ == '__main__':
    #app.run()
    app.run( host='0.0.0.0', port=5300 )

