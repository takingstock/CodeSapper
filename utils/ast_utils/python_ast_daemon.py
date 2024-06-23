'''
the primary goal of this daemon is to ensure the code is processed periodically and the graph is maintained up to dt
'''
import os, sys, json, traceback, time
import numpy as np

from python_ast_process_codebase import generateGraphEntities 
from python_ast_process_API_contracts import addAPIUsageToGraph

sys.path.append( os.getenv('GRAPH_UTILS_FOLDER') )
from createGraphEntry import generateGraph


class python_ast_daemon():

    def __init__(self):

        self.daemon_config_path_ = os.getenv("DAEMON_CONFIG")
        with open( self.daemon_config_path_, 'r' ) as fp:
            tmp_json_ = json.load( fp )
        
        self.home_dir_ = os.getenv('IKG_HOME')
        self.config_ = tmp_json_['python']
        self.log_file_ = self.home_dir_ + self.config_["log_file"]
        self.sleep_time_ = self.config_['frequency_in_seconds']
        self.method_summary_file_ = self.home_dir_ + self.config_['method_summary']
        ## initialize ast utils 
        self.ast_codebase_utils_ = generateGraphEntities()
        self.ast_API_utils_      = addAPIUsageToGraph()

    def update_method_summary_(self, current_graph_inputs_ ):

        try:
            with open( self.method_summary_file_, 'r' ) as fp:
                existing_ = json.load( fp )
        except:
            existing_ = dict()

        for key, val in current_graph_inputs_.items():
            if key not in existing_:
                existing_[ key ] = val

        ## update done, if any .. now recreate the file
        with open( self.method_summary_file_, 'w' ) as fp:
            json.dump( existing_, fp, indent=4 )

    def run_loop(self):

        while True:
          try:  
            relevant_files_ = self.ast_codebase_utils_.generateRelevantFiles( self.home_dir_ +\
                                                                              self.config_['timestamp_json'] )

            print('DELTA FILE->', relevant_files_)
            non_api_graph_inputs_ = self.ast_codebase_utils_.generate()
            api_graph_inputs_     = self.ast_API_utils_.createGraphInput( relevant_files_ )

            ## create a cumulutive json with both inputs
            non_api_graph_inputs_.update( api_graph_inputs_ )
            ## simpler naming convention post combination of both types of inputs
            graph_inputs_ = non_api_graph_inputs_

            formatted_time = time.strftime( '%Y-%m-%d %H:%M', time.localtime() )
            with open( self.log_file_, 'a+' ) as fp:
                fp.write( str( formatted_time ) + ':: GRAPH INPUTS ::\n' + json.dumps(graph_inputs_,indent=4) + '\n')

            ## now dump the files 
            self.update_method_summary_( graph_inputs_ )

            ##instantiate graph module for entry into graph
            graph_utils_ = generateGraph( neo4j_config=os.getenv("NEO4J_CONFIG") )
            nodeList_ , edgeList_ = graph_utils_.preProcess( graph_inputs_ )
            exec_status_, err_if_any_ = graph_utils_.execNodeCreationCypher( nodeList_ , edgeList_ )
            ## update page rank of nodes
            print('POST GRAPH INSERT->', exec_status_, err_if_any_)
            graph_utils_.calculatePageRank()

            ## now sleep 
            time.sleep( self.sleep_time_ )
          except:
              print('LOOP Stopped!->', traceback.format_exc())
              with open( self.log_file_, 'a+' ) as fp:
                  fp.write( 'LOOP Stopped!->' + str(traceback.format_exc()) + '\n' )
              break

if __name__ == "__main__":
    looper_ = python_ast_daemon()
    looper_.run_loop()
