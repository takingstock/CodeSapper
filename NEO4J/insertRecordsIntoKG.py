import json, traceback
import createJsonFeats
from neo4j import GraphDatabase

with open('config.json', 'r' ) as fp:
    js_ = json.load( fp )

URI = js_["URI"]
AUTH = ( js_['uname'] , js_['pwd'] )

def chunk( tokenizer, child_context, seqlen=256, overlap_window=40 ):
    '''
    seqlen -> max size of tokenized vec ( depending on LM used )
    overlap_window -> how many words from the prior passage need to be used 
                       default 40 since we expect a chunk to have about 200 words and this is 20% ..lil lol 
    '''

    emb_arr_, chunk_sent_arr_ = [], []

    inp_para = child_context.split()
    tokenized_input = tokenizer( child_context, return_tensors="pt" )
    print( 'SEQ LEN->', len( tokenized_input['input_ids'][0] ) )

    if len( tokenized_input['input_ids'][0] ) > seqlen:
        scale_ = ( len( tokenized_input['input_ids'][0] ) + overlap_window )/seqlen
        rounded_ = round( ( len( tokenized_input['input_ids'][0] ) + overlap_window )/seqlen )
        ## the idea is to divvy the sentence into overlapping chunks 
        ## so if num chunks is 2 then parts of the first chunk will also show up in the 2nd ..just that
        ## we need to ensure we dont lose any part of 
        if scale_ < rounded_:
            iters_ = rounded_
        elif scale_ >= rounded_:
            iters_ = rounded_ + 1

        chunk_arr_, adjusted_seq_len = [], int( seqlen*0.8 ) ## since the seqlen is the token length, we CANT use that to split the actual text since typical words are shorter than tokens 
        ## if scale_ is 4.5, then rounded will be 4 and hence we go with 4+1 and vice versa
        for idx in range( iters_ - 1 ):
            if idx == 0:
                chunk_ = ' '.join( inp_para[ idx*adjusted_seq_len: (idx+1)*adjusted_seq_len ] )
            else:
                chunk_ = inp_para[ (idx-1)*adjusted_seq_len: idx*adjusted_seq_len ][ -1*overlap_window: ] + \
                        inp_para[ idx*adjusted_seq_len: (idx+1)*adjusted_seq_len ]

                chunk_ = ' '.join( chunk_ )

            chunk_arr_.append( chunk_ )

        ## for the last idx
        lastidx_ = iters_ - 1
        chunk_last_ =  inp_para[ (lastidx_-1)*adjusted_seq_len: lastidx_*adjusted_seq_len ][ -1*overlap_window: ] + \
                 inp_para[ lastidx_*adjusted_seq_len:  ]

        chunk_arr_.append( ' '.join( chunk_last_ ) )

        for ch in chunk_arr_:
            emb_arr_.append( createJsonFeats.returnEmbed( ch ) )
            chunk_sent_arr_.append( ch )

    else:
        emb_arr_.append( createJsonFeats.returnEmbed( child_context ) )
        chunk_sent_arr_.append( child_context )

    return emb_arr_, chunk_sent_arr_

def insertRecord( tokenizer, parent, child_context, relation_context, child_entity ):

    with GraphDatabase.driver(URI, auth=AUTH) as driver:
      try:  
        parent, child_para_, relation, child = parent, child_context, relation_context, child_entity

        relation_emb = createJsonFeats.returnEmbed( parent + ' ' + relation )
        parent_title_embd, child_title_embd = createJsonFeats.returnEmbed( parent ), \
                                              createJsonFeats.returnEmbed( child )

        emb_arr_, ch_arr_ = chunk( tokenizer, child_para_ )
        print('Total # of chunks->', len( emb_arr_ ) )

        with driver.session() as session:

            for cnt, child_embd in enumerate( emb_arr_ ): ## child name can simply be child1, child2 etc based on num of chunks
                if cnt == 0:
                    child_bear_ = child
                else:
                    child_bear_ = child +' - '+ str( cnt )

                qry_ = ''' MERGE (  parent:Parent { title:"'''+ parent +'''" } )\
                WITH parent  \
                        CALL db.create.setNodeVectorProperty( parent, 'title_embedding',\
                        apoc.convert.fromJsonList( "'''+ str( parent_title_embd ) +'''" ) )
                MERGE(   child:Child { title:"'''+ child_bear_ +'''", \
                                    context:"'''+ parent +" "+ ch_arr_[cnt] +'''" } )\
                WITH child, parent \
                        CALL db.create.setNodeVectorProperty( child, 'embedding', \
                        apoc.convert.fromJsonList( "'''+ str( child_embd ) +'''" ) ) \
                        CALL db.create.setNodeVectorProperty( child, 'title_embedding', \
                        apoc.convert.fromJsonList( "'''+ str( child_title_embd ) +'''" ) ) \
                MERGE( parent )-[ relation:FIRST_LEVEL_CONNECT { property: "'''+ parent +' '+relation \
                        +'''" } ]->( child ) \
                WITH child, parent, relation CALL db.create.setRelationshipVectorProperty( relation, 'embedding',\
                        apoc.convert.fromJsonList( "'''+ str( relation_emb ) +'''" ) )'''


                print('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
                result = session.run( qry_ )
                print('RAN QRY and inserterd P, R, C ->', '\n',{'P': parent}, {'R': relation }, {'C': child_bear_}  )

      except: 
          print('EXCPN->', traceback.format_exc())
          pass

