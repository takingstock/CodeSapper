import numpy as np
import os, json, sys, traceback
import pandas as pd 
from neo4j import GraphDatabase

class generateGraph():

    def __init__( self, src_dir, neo4j_config, dest_dir='' ):
        self.src_dir = src_dir
        self.init_edge_wt_ = 0.1

        with open( neo4j_config, 'r' ) as fp:
            js_ = json.load( fp )

        self.NEO4J_URI = js_["URI"]
        self.NEO4J_AUTH = ( js_['uname'] , js_['pwd'] )


    def createNodes( self, fnm, method_deets ):
        '''
        cypher query to create the node
        '''

        qry_ = '''
        CREATE (  m:Method {
        file_name: "'''+ fnm +'''",
        method_name: "'''+ method_deets["method_name"] +'''",
        method_begin_snippet: "'''+ method_deets["method_begin"] +'''",
        method_end_snippet: "'''+ method_deets["method_end"] +'''",
        method_begin_ln: "'''+ str( method_deets["range"][0] ) +'''",
        method_end_ln: "'''+ str( method_deets["range"][1] ) +'''",
        method_importance_: 0.1
        } )
        '''
        return qry_

    def createRelations(self, relation_properties_):
        '''
        cypher query to create the node
        '''
        print('DOJO->', relation_properties_)
        qry_ = '''
        MATCH (a:Method {method_name: "'''+ relation_properties_["from_method"] +'''", 
                          file_name: "'''+ relation_properties_["from_fnm"] +'''" })
        MATCH (b:Method {method_name: "'''+ relation_properties_["to_method"] +'''", 
                          file_name: "'''+ relation_properties_["to_fnm"] +'''"})
        CREATE (a)-[r: '''+ relation_properties_["connection_type"]+''' {
            code_snippet: "'''+ relation_properties_["code_snippet"]+'''",
            relation_weight: 0.1
        }]->(b)
        '''
        return qry_

    def returnEdgeData( self, fnm, file_contents_, mode, idx ):

        tempD_ = dict()
        tempD_['from_method'] = file_contents_["method_name"]
        tempD_['from_fnm'] = fnm

        usage_instance = file_contents_[mode][idx]

        tempD_['to_method'] = usage_instance["method_nm"]
        tempD_['to_fnm'] = usage_instance["file_path"]
        tempD_["connection_type"] = mode
        tempD_["code_snippet"] = '\n'.join( usage_instance["usage"] )
        tempD_["default_weight"] = self.init_edge_wt_

        return tempD_

    def verify_relationship_types( self, tx):
        result = tx.run("CALL db.relationshipTypes()")
        return [record["relationshipType"] for record in result]

    def preProcess(self, fileNm):
        '''
        expected json format ONLY 
        '''
        if '.json' not in fileNm: return None

        with open( self.src_dir + fileNm, 'r' ) as fp:
            method_summary_ = json.load( fp )
        
        nodeList_ , edgeList_ = [], []

        for fnm, file_contents_ in method_summary_.items():
          for fc in file_contents_:
            node_insertion_cypher_ = self.createNodes( fnm, fc )
            print('NODE CYPHER->', node_insertion_cypher_, fnm )
            nodeList_.append( node_insertion_cypher_ )
            ## process connections
            if "local_uses" in fc:
                for idx, usage_ in enumerate( fc[ "local_uses" ] ):
                    edge_data_ = self.returnEdgeData( fnm, fc, "local_uses", idx )
                    edge_insertion_cypher_ = self.createRelations( edge_data_ )
                    print('LOCAL EDGE CYPHER->', edge_insertion_cypher_ )
                    edgeList_.append( edge_insertion_cypher_ )

            if "global_uses" in fc:
                for idx, usage_ in enumerate( fc[ "global_uses" ] ):
                    edge_data_ = self.returnEdgeData( fnm, fc, "global_uses", idx )
                    edge_insertion_cypher_ = self.createRelations( edge_data_ )
                    print('LOCAL EDGE CYPHER->', edge_insertion_cypher_ )
                    edgeList_.append( edge_insertion_cypher_ )

        return nodeList_ , edgeList_

    def execCypher(self, nodeList_, edgeList_ ):

        with GraphDatabase.driver( self.NEO4J_URI, auth=self.NEO4J_AUTH ) as driver:
          try:
              with driver.session() as session:

                  for node_insertion_cypher_ in nodeList_:
                    result = session.run( node_insertion_cypher_ )
                    print('NODE INSERTION RES->', result)

                  for edge_insertion_cypher_ in edgeList_:
                    result = session.run( edge_insertion_cypher_ )
                    print('EDGE INSERTION RES->', result)

          except:
              print('CYPHER INSERTION ERR->', traceback.format_exc())

    def create_graph_projection(self, tx):
        tx.run("""
        CALL gds.graph.project(
            'methodGraph',
            'Method',
            {
                global_uses: {
                    type: 'global_uses',
                    orientation: 'NATURAL',
                    properties: 'relation_weight'
                }
            }
        )
        """)

    def run_pagerank_query(self, tx):
        query = """
        CALL gds.pageRank.stream('methodGraph')
        YIELD nodeId, score
        RETURN gds.util.asNode(nodeId).method_name AS method_name, score
        ORDER BY score DESC
        LIMIT 10
        """
        result = tx.run(query)
        print('PG RANK RES->', result)
        for idx, rec in enumerate( result ):
          print(idx+1,'.', rec)

    def update_pagerank_scores(self, tx):
        query = """
        CALL gds.pageRank.stream('methodGraph')
        YIELD nodeId, score
        WITH gds.util.asNode(nodeId) AS node, score
        SET node.method_importance_ = score
        RETURN node.method_name AS method_name, node.method_importance_ AS pageRankScore
        """
        result = tx.run(query)
        print('PG RANK RES->', result)
        for idx, rec in enumerate( result ):
          print(idx+1,'.', rec)


    def calculatePageRank( self ):

        with GraphDatabase.driver( self.NEO4J_URI, auth=self.NEO4J_AUTH ) as driver:
          try:
              with driver.session() as session:
                  try:
                    session.execute_write( self.create_graph_projection )
                  except:
                      print('PROJECTION WRITE ERR->', traceback.format_exc())

                  session.execute_read( self.run_pagerank_query )
                  session.execute_write( self.update_pagerank_scores )

          except:
              print('CYPHER EXEC ERR->', traceback.format_exc())

if __name__ == "__main__":

    gg_ = generateGraph( src_dir='./data/', neo4j_config='./config.json' )
    #nodeList_ , edgeList_ = gg_.preProcess( 'METHODS.json' )
    #gg_.execCypher( nodeList_ , edgeList_ )
    gg_.calculatePageRank()
