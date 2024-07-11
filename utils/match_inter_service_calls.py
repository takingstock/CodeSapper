import json, os 
import numpy as np

with open( os.getenv('DAEMON_CONFIG'), 'r' ) as fp:
    config_js_ = json.load( fp )

def cleanUp( t1, t2 ):
    '''
    remove known impurities :P
    '''
    # at times the last part of the url can come with params, typically demarcated using "?"
    return t1.split('?')[0], t2.split('?')[0]

def innerCallingOuter( inner_api_call_, of_api_definition_ ):
    '''
    the api definition could be a simple route like "/someAPI" and the call could be
    something like "https://<some_ip_addr>:<port_num>/someAPI?key='abc'..."
    '''
    shorter_url_ = inner_api_call_ if len( inner_api_call_ ) < len( of_api_definition_ ) else of_api_definition_
    longer_url_  = of_api_definition_ if len( inner_api_call_ ) < len( of_api_definition_ ) else inner_api_call_

    shorter_arr_, longer_arr_ = shorter_url_.split('/'), longer_url_.split('/')

    print('DODO-> shorter_, longer_::', shorter_arr_, longer_arr_)

    if len( shorter_arr_) >= 2 and shorter_url_ in longer_url_:
        return True

    shorter_, longer_ = cleanUp( shorter_arr_[-1], longer_arr_[-1] )
    ## now ensure that the last element on the shorter_arr is a substring of longer_arr's last term
    ## for e.g. using above, short_arr = ['', 'someAPI'] longer = [ 'https:',....,'someAPI?key='abc' ]
    if len(shorter_arr_[-1]) > 0 and shorter_arr_[-1] == longer_arr_[-1]:
        print( inner_api_call_, of_api_definition_, shorter_arr_, longer_arr_)
        return True

    return False

def updateGlobalUsage( outer_file_, inner_file_ ):
    ## since the format of ALL graph inputs is the same
    print('AIVO->', outer_file_, inner_file_ )
    with open( os.getenv('IKG_HOME') + outer_file_, 'r' ) as fp:
        of_json_ = json.load( fp )

    with open( os.getenv('IKG_HOME') + inner_file_, 'r' ) as fp:
        inner_json_ = json.load( fp )

    for of_file, of_contents_ in of_json_.items():
        of_method_details_ = of_contents_["method_details_"]

        for inner_file, inner_contents_ in inner_json_.items():
            inner_method_details_ = inner_contents_["method_details_"]
            
            ## check if inner method uses / calls an API thats defined in of_method_details_ and update
            ## global_usages of of_method_details_
            for of_method in of_method_details_:
                for inner_method in inner_method_details_:
                    ## DEFENSIVE CHECK
                    print('B4 DEFENSIVE->INNER::', inner_method, '::OUTER::', of_method)
                    if "inter_service_api_call" not in inner_method or "api_end_point" not in of_method: continue

                    inner_api_call_ = inner_method["inter_service_api_call"]
                    of_api_definition_ = of_method["api_end_point"]

                    if of_api_definition_ == "NA" or len( inner_api_call_ ) == 0: continue
                    print('OUTER_URL::', of_api_definition_, of_file, '::INNER_URL::', inner_api_call_, inner_file)

                    for call in inner_api_call_: ## since , theoretically , we can call multiple APIs from a method
                        if innerCallingOuter( call, of_api_definition_ ):
                            print('Inner API ::', inner_api_call_,' :: is defined in ::', of_api_definition_,\
                                                  inner_method )
                            ## now add inner method details to of_method
                            if "global_uses" in of_method:
                                ll_ = of_method["global_uses"]
                            else:
                                ll_ = list()

                            ll_.append( { 'file_path': inner_file,\
                                          'method_nm': inner_method["method_name"],\
                                          "method_defn": inner_method["method_begin"],\
                                          "usage": "NA",\
                                          "method_end": inner_method["method_end"]
                                          } )

                            of_method["global_uses"] = ll_
                            print( 'GLOBAL USAGE ADD->', of_method["global_uses"][-1], ' ::For:: ', \
                                    of_file )

    ## write back all the contents
    with open( os.getenv('IKG_HOME') + outer_file_, 'w' ) as fp:
        json.dump( of_json_, fp, indent=4 )

    with open( os.getenv('IKG_HOME') + inner_file_, 'w' ) as fp:
        json.dump( inner_json_, fp, indent=4 )

def connectInterServiceCalls():

    graph_input_repo_ = config_js_["graph_inputs"]

    ## process the graph inputs of different languages as pairs
    for outer_file_ in ( graph_input_repo_ ):
        for inner_file_ in ( graph_input_repo_ ):
            if outer_file_ == inner_file_: continue ## obviously, we ignore the files that are exactly same

            updateGlobalUsage( outer_file_, inner_file_ )

if __name__ == "__main__":
    connectInterServiceCalls()
