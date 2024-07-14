'''
the primary goal of this daemon is to ensure the code is processed periodically and the graph is maintained up to dt
'''
import os, sys, json, traceback, time
import numpy as np
import datetime
from python_ast_process_codebase import generateGraphEntities 
from python_ast_process_API_contracts import addAPIUsageToGraph
from python_ast_generate_URL_usage import analyze_codebase
import s3_utils

class python_ast_routine():

    def __init__(self):

        self.method_summary_file_ = 'py_graph_entity_summary.json'
        self.time_stamp_file_ = 'py_codebase_time_stamps.json'
        ## initialize ast utils 
        self.ast_codebase_utils_ = generateGraphEntities()
        self.ast_API_utils_      = addAPIUsageToGraph()
        self.s3_ = s3_utils.s3_utils()

    def update_method_summary_(self, current_graph_inputs_ ):

        try:
            existing_ = json.loads( self.s3_.readFromS3( self.method_summary_file_ ) )
        except:
            existing_ = dict()
            print('EXCPN::"python_ast_routine.py"::update_method_summary_:: reading->',self.method_summary_file_)

        for key, val in current_graph_inputs_.items():
            if key not in existing_:
                existing_[ key ] = val

        ## update done, if any .. now recreate the file
        #print('DUMPLINGS->', self.method_summary_file_, existing_)
        updated_ = json.dumps( existing_, indent=4 )
        try:
            self.s3_.shipToS3( self.method_summary_file_, updated_ )
        except:
            print('EXCPN::"python_ast_routine.py"::update_method_summary_:: writing->',self.method_summary_file_)

    def update_url_usages(self, current_graph_inputs_, url_, local_usage_store_, api_endpoint_defined_in_microservice_ ):
        '''
        the graph inputs have fnm as key and 2 inner keys -> method details & text / code snippet details
        we will iterate through the methods to match the input args and if matched, update URL usage
        we will add 2 new keys to method info -> intra service APIs being called and inter service APIs being called
        IN case the input arg "method_nm_" is NA then we add a new key to graph_inputs_ and call it "global_usage"
        ** the main intent here is the ability to look for these API end points across code bases to link for 
        future impact analysis
        '''
        for fnm_, file_dict_ in current_graph_inputs_.items():

           method_details_ = file_dict_["method_details_"]
           #if 'main_multi_prod' in fnm_:
           #    print('GOPHER->', local_usage_store_, method_details_)
           ## iterate through local_usage
           for usageD in local_usage_store_:
                for graph_input_ in method_details_:
                    if "method_nm" in usageD and graph_input_["method_name"] in usageD["method_nm"] and \
                            fnm_ == usageD["file_name"]:
                                ## init both keys for uniformity
                                #print('THAR->', fnm_, api_endpoint_defined_in_microservice_, usageD["method_nm"])
                                ## now based on usage, overwrite the default values
                                if api_endpoint_defined_in_microservice_ == True:
                                    if 'local_api_call' in graph_input_:
                                        tmpLL = graph_input_['local_api_call']
                                    else:
                                        tmpLL = list()

                                    tmpLL.append( url_ )
                                    graph_input_['local_api_call'] = tmpLL
                                    if 'inter_service_api_call' not in graph_input_:
                                        graph_input_[ 'inter_service_api_call' ] = list()

                                else:
                                    if 'inter_service_api_call' in graph_input_:
                                        tmpLL = graph_input_['inter_service_api_call']
                                    else:
                                        tmpLL = list()

                                    tmpLL.append( url_ )
                                    graph_input_['inter_service_api_call'] = tmpLL
                                    if 'local_api_call' not in graph_input_:
                                        graph_input_[ 'local_api_call' ] = list()

                ## separate loop for usage method_nm == NA  
                if "method_nm" in usageD and graph_input_["method_name"] not in usageD["method_nm"] and\
                        fnm_ == usageD["file_name"]:

                    tmp_ll_ , tmp_key_ = [], ""

                    if api_endpoint_defined_in_microservice_ == True and \
                            'global_usage_local_api_call' in file_dict_:

                        tmp_ll_ = file_dict_["global_usage_local_api_call"]
                        tmp_key_ = "global_usage_local_api_call"
                    elif api_endpoint_defined_in_microservice_ == True and \
                            'global_usage_local_api_call' not in file_dict_:

                        tmp_key_ = "global_usage_local_api_call"

                    elif api_endpoint_defined_in_microservice_ != True and \
                            'inter_service_api_call' in file_dict_:

                        tmp_ll_ = file_dict_["inter_service_api_call"]
                        tmp_key_ = "inter_service_api_call"
                    elif api_endpoint_defined_in_microservice_ != True and \
                            'inter_service_api_call' not in file_dict_:

                        tmp_key_ = "inter_service_api_call"

                    ## simply add to file_dict_
                    if { 'url': url_ } not in tmp_ll_:
                        tmp_ll_.append( { 'url': url_ } )

                    file_dict_[ tmp_key_ ] = tmp_ll_

    def run_routine(self):
            
            start_time_ = time.time()
            try:
                ts_file_ = self.s3_.readFromS3( self.time_stamp_file_ )

                if ts_file_ == None:
                    ts_file_ = json.dumps( dict() )

                relevant_files_, updated_ts_file_ = self.ast_codebase_utils_.generateRelevantFiles( ts_file_ )
                ## update the time stamp
                self.s3_.shipToS3( self.time_stamp_file_, json.dumps( updated_ts_file_, indent=4 ) )
            except:
                print( 'EXCPN::"python_ast_routine.py"::run_routine:: reading->',self.method_summary_file_,\
                        traceback.format_exc() )
                relevant_files_ = []

            print('DELTA FILE->', relevant_files_)
            if len( relevant_files_ ) == 0:
                print('"python_ast_routine.py"::run_routine::NO CHANGES IN CODEBASE..EXITING!')
                return None

            non_api_graph_inputs_ = self.ast_codebase_utils_.generate()

            api_graph_inputs_     = self.ast_API_utils_.createGraphInput( relevant_files_ )
            print('ST TIME1 ->', time.time() - start_time_) 
            
            ## create a cumulutive json with both inputs
            for non_api_key, non_api_value in non_api_graph_inputs_.items():
                for non_api_D in non_api_value['method_details_']:
                    ##now iterate via api_graph_inputs_ and ONLY add keys to the non_api_D that DONT YET EXIST..capice
                    for api_key, api_value in api_graph_inputs_.items():
                        for api_D in api_value['method_details_']:
                            non_keys_ , api_keys_ = set( list(non_api_D.keys()) ), set( list(api_D.keys()) )
                            api_key_not_in_non_ = api_keys_ - non_keys_
                            for key in list( api_key_not_in_non_ ):
                                non_api_D[ key ] = api_D[ key ]
            ## simpler naming convention post combination of both types of inputs
            graph_inputs_ = non_api_graph_inputs_

            formatted_time = time.strftime( '%Y-%m-%d %H:%M', time.localtime() )
            
            print('ST TIME2 ->', time.time() - start_time_) 
            ## get URL usages 
            url_usages_ = analyze_codebase( os.getenv('CODE_DB_PYTHON') )
            #print('URL USAGES->', json.dumps( url_usages_, indent=4 ) )
            '''
            url_usages_ DS = [ { 'url': [{file_name, method_nm}, {file_name, api_definition}]
            ... now check if the URL is defined locally OR inter services and group them by file name
            then finally just add to the graph_inputs_
            '''
            for url_, usage_list in url_usages_.items():
                #print('Processing->', url_)
                api_endpoint_defined_in_microservice_ = False
                local_usage_store_ = []

                for usageD in usage_list:
                    # if the dict contains definition details then we just skip it .. it was meant to add
                    ## redundancy .. this info is already present thanks to findAPIDefs BUT this is very helpful
                    ### to create an additional data point. Whether the API being called is defined within the
                    #### microservice OR with OUT
                    if 'api_definition' in usageD: 
                        api_endpoint_defined_in_microservice_ = True
                        continue
                    ## now we know there's only usage info left
                    local_usage_store_.append( usageD )

                self.update_url_usages( graph_inputs_, url_, local_usage_store_, \
                                                             api_endpoint_defined_in_microservice_ )

            ##  save the inputs
            self.update_method_summary_( graph_inputs_ )
            print('ST TIME3 ->', time.time() - start_time_) 
            

if __name__ == "__main__":
    looper_ = python_ast_routine()
    looper_.run_routine()
