from neo4j import GraphDatabase
import numpy as np
import os, json, sys, traceback
import pandas as pd

class traverseGraph():

    def __init__( self, neo4j_config, dest_dir='' ):
        #self.src_dir = src_dir
        self.init_edge_wt_ = 0.1

        with open( neo4j_config, 'r' ) as fp:
            js_ = json.load( fp )

        self.NEO4J_URI = js_["URI"]
        self.NEO4J_AUTH = ( js_['uname'] , js_['pwd'] )



    def traverse_graph(self, tx, method_name, file_name, mode):
        ## the ">" operator beside global_uses , in the relationshipFilter means 'only look downstream'
        query = '''
        MATCH ( startNode:Method { method_name: "'''+ method_name +'''", file_name: "'''+ file_name +'''" } )
        CALL apoc.path.subgraphNodes(startNode, {
            relationshipFilter: "'''+mode+'''>",
            minLevel: 1
        }) YIELD node
        RETURN node
        '''
        result = tx.run(query, method_name=method_name, file_name=file_name)
        print('Traversal Beginning->', method_name, file_name, query)
        response_ = list()

        for record in result:
            response_.append( dict(record['node']) )

        return response_

    def get_traversal_path(self, tx, method_name, file_name, mode):

        query = '''
        MATCH ( startNode:Method { method_name: "'''+ method_name +'''", file_name: "'''+ file_name +'''" } )
        CALL apoc.path.expand(startNode, "'''+mode+'''>", null, 0, 100) YIELD path
        RETURN path
        '''

        result = tx.run(query, method_name=method_name, file_name=file_name)

        for record in result:
            nodes = record['path'].nodes

            for i in range(len(nodes) - 1):
                src = nodes[i].element_id
                tgt = nodes[i+1].element_id
                src_label = nodes[i]['method_name']
                tgt_label = nodes[i+1]['method_name']

    def call_traversal(self, method, file_, mode, generate_html=False):

        with GraphDatabase.driver( self.NEO4J_URI, auth=self.NEO4J_AUTH ) as driver:
            try:
                with driver.session() as session:
                    mode_usage_ = session.execute_read( self.traverse_graph, method, file_, mode )

                    if generate_html == True:
                        session.execute_read( self.get_traversal_path, method, file_, mode )

                    return mode_usage_
            except:
                print('TRAVERSAL ISSUE->', traceback.format_exc())
                return None

if __name__ == "__main__":

    tg_ = traverseGraph('/datadrive/IKG/NEO4J/config.json')
    print( tg_.call_traversal( "returnEmbed", "/datadrive/IKG/LLM_INTERFACE/SRC_DIR/createJsonFeats.py", "global_uses" ) )
