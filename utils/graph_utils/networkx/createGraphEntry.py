import networkx as nx
import json, os, traceback
import pickle, boto3

class generateGraph():

    def __init__( self ):
        
        self.graph_ = nx.DiGraph()
        self.bucket_name_ = os.getenv('NETWORKX_S3')
        self.s3_client = boto3.client('s3')
        self.pickle_name_ = 'graph_store.pickle'
        self.default_edge_wt = 0.1 ## if we intend to use algo's like pagerank then we can use this attribute to mark importance of the edges / relations

    def createNodes( self, fnm, all_methods_data_arr, file_level_api_calls_ ):
        try:
            for data in all_methods_data_arr:
                if "inter_service_api_call" not in data:
                    data[ "inter_service_api_call" ] = 'NA'
                ## create key
                key_ = fnm+'::'+data["method_name"]

                try:
                    self.graph_.nodes[ key_ ]
                    ## if the above works then the key already exists ..so continue
                    continue
                except:
                    pass
                    #print('Key doesnt exist ..continue addition!')

                self.graph_.add_node( 
                                       key_, 
                                       file_path=fnm if './' in fnm else ( './' + fnm ),\
                                       method_name=data["method_name"], \
                                       method_begin=data["method_begin"], \
                                       method_end=data["method_end"],\
                                       api_end_point=data["api_end_point"],\
                                       range=data["range"],\
                                       method_level_api_call_=data[ "inter_service_api_call" ],\
                                       file_level_api_calls_=file_level_api_calls_
                                    )
                #print('Added graph_node->', fnm, data["method_name"])
                ## file_level_api_calls_ are API calls whose source couldn't be traced within the codebase
                ## meaning they are 99% outside of the codebase
        except:
            print('EXCPN::NODE_ADDITION::', traceback.format_exc())
                                  

    def createEdges( self, fnm_, method_data_arr_ ):
        ## iterate through the entire graph input file and add edges
        try:
            for data_ in method_data_arr_:

                if 'global_uses' in data_ and len( data_['global_uses'] ) > 0:
                    print('EDGE_ADDITION->', fnm_, data_["method_name"], data_['global_uses'])

                for local_uses in data_['local_uses']:
                    ## find the parent node ( parent == node whose local_use is being mapped here
                    parent_fnm, parent_method = fnm_, data_["method_name"]
                    parent_key = parent_fnm+'::'+parent_method

                    graph_entry_parent_ = self.graph_.nodes[ parent_key ]

                    child_key = local_uses['file_path']+'::'+local_uses['method_nm']
                    graph_entry_child_ = self.graph_.nodes[ child_key ]

                    ## now that we have both nodes create edge
                    edge_property_ = { 'usage_type': 'local',\
                                       'method_nm': local_uses['method_nm'],\
                                       'method_usage_snippet': local_uses["usage"],\
                                       'weight': self.default_edge_wt }

                    #print('Added graph_edge->', graph_entry_parent_['method_name'], \
                    #                            graph_entry_child_['method_name'],\
                    #                            edge_property_ )

                    self.graph_.add_edge( parent_key, child_key, **edge_property_ )

                for local_uses in data_['global_uses']:
                    ## find the parent node ( parent == node whose local_use is being mapped here
                    parent_fnm, parent_method = fnm_, data_["method_name"]
                    parent_key = parent_fnm+'::'+parent_method

                    graph_entry_parent_ = self.graph_.nodes[ parent_key ]

                    child_key = local_uses['file_path']+'::'+local_uses['method_nm']
                    graph_entry_child_ = self.graph_.nodes[ child_key ]

                    ## now that we have both nodes create edge
                    edge_property_ = { 'usage_type': 'global',\
                                       'method_nm': local_uses['method_nm'],\
                                       'method_usage_snippet': local_uses["usage"],\
                                       'weight': self.default_edge_wt }

                    print( 'Added graph_edge->',graph_entry_parent_['method_name'], \
                                               graph_entry_child_['method_name'],\
                                               edge_property_ )

                    self.graph_.add_edge( parent_key, child_key, **edge_property_ )

        except:
            print('EXCPN::EDGE_ADDITION::', traceback.format_exc())

    def list_and_download_files_with_phrase(self, phrase):
        s3 = boto3.client('s3')
        paginator = s3.get_paginator('list_objects_v2')

        filtered_files = []

        for page in paginator.paginate(Bucket=self.bucket_name_):
            if 'Contents' not in page:
                continue

            for obj in page['Contents']:
                key = obj['Key']
                if phrase in key:
                    # Download the file content
                    response = s3.get_object(Bucket=self.bucket_name_, Key=key)
                    file_content = response['Body'].read().decode('utf-8')

                    # Add to results
                    filtered_files.append((key, file_content))

        return filtered_files

    def createGraphEntries( self ):
        
        src_folder_ = self.list_and_download_files_with_phrase('graph_entity_summary.json')

        for src_folder, content in src_folder_:
            graph_json_ = json.loads( content )

            for file_nm_, method_deets_ in graph_json_.items():
                method_details_ = method_deets_[ "method_details_" ]
                file_level_api_calls_ = method_deets_[ "inter_service_api_call" ] if \
                                        "inter_service_api_call" in method_deets_ else \
                                        []

                self.createNodes( file_nm_, method_details_, file_level_api_calls_ )

        ## once nodes are inserted, its time to create the edges
        for src_folder, content in src_folder_:
            graph_json_ = json.loads( content )

            for file_nm_, method_deets_ in graph_json_.items():
                method_details_ = method_deets_[ "method_details_" ]
                self.createEdges( file_nm_, method_details_ )

    def shipToS3( self ):
        
        graph_pickle_ = pickle.dumps( self.graph_ )
        #print('DUDU->', self.bucket_name_, self.pickle_name_)
        self.s3_client.put_object(Bucket=self.bucket_name_, Key=self.pickle_name_, Body=graph_pickle_ )

    def readFromS3( self ):

        # Download the serialized graph from S3
        try:
            response = self.s3_client.get_object(Bucket=self.bucket_name_, Key=self.pickle_name_)
            graph_data = response['Body'].read()

            # Deserialize the graph using pickle
            G = pickle.loads(graph_data)
            #print( G.number_of_nodes(), G.number_of_edges() )

            #print("Graph loaded from S3")

        except Exception as e:
            print(f"An error occurred: {e}")


if __name__ == '__main__':
    localGraph = generateGraph()
    localGraph.createGraphEntries()
    print( localGraph.graph_.number_of_nodes(), localGraph.graph_.number_of_edges() )
    localGraph.shipToS3()
    localGraph.readFromS3()
