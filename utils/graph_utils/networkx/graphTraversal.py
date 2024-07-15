import networkx as nx
import json, os, traceback
import pickle, boto3

class traverseGraph():

    def __init__( self ):
        
        self.graph_ = nx.DiGraph()
        self.bucket_name_ = os.getenv('NETWORKX_S3')
        self.s3_client = boto3.client('s3')
        self.pickle_name_ = 'graph_store.pickle'
        self.matching_nodes = []
        self.readFromS3()

    def readFromS3( self ):

        # Download the serialized graph from S3
        try:
            response = self.s3_client.get_object(Bucket=self.bucket_name_, Key=self.pickle_name_)
            graph_data = response['Body'].read()

            # Deserialize the graph using pickle
            self.graph_ = pickle.loads(graph_data)
            #print( self.graph_.number_of_nodes(), self.graph_.number_of_edges() )

            #print("Graph loaded from S3")

        except Exception as e:
            print(f"An error occurred: {e}")

    def traverse_graph( self, method_name, file_name, mode ):
        # Iterate over edges
        for u, v, edge_data in self.graph_.edges(data=True):
            # Check if edge matches criteria
            if edge_data.get("usage_type") == mode:
                # Check if source node (u) matches method name and target node (v) matches file name
                print('TG1->', self.graph_.nodes[u].get("method_name"),' ? ', method_name,\
                        ' :: ', self.graph_.nodes[u].get("file_path"), ' ?? ', file_name )

                if self.graph_.nodes[u].get("method_name") == method_name and \
                        self.graph_.nodes[u].get("file_path") == file_name and \
                        v not in self.matching_nodes:

                    self.matching_nodes.append( self.graph_.nodes[v] )

        return self.matching_nodes

if __name__ == '__main__':
    localGraph = traverseGraph()
    #localGraph.readFromS3()
    localGraph.traverse_graph( "detectTable", "/datadrive/IKG/code_db/python/tblDetMultiPage.py", "global" )
    print( localGraph.matching_nodes )
