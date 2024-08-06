import json, os, traceback
import numpy as np
import s3_utils

def cleanUp( t1, t2 ):
    '''
    remove known impurities :P
    '''
    # at times the last part of the url can come with params, typically demarcated using "?"
    return t1.split('?')[0], t2.split('?')[0]

def innerCallingOuter( inner_api_, of_api_definition_ ):
    '''
    the api definition could be a simple route like "/someAPI" and the call could be
    something like "https://<some_ip_addr>:<port_num>/someAPI?key='abc'..." ; so lets match !!
    '''
    primary, secondary = None, None

    if type( inner_api_ ) == str:
        inner_api_list_ = [ inner_api_ ]
    else:
        inner_api_list_ = inner_api_

    if type( of_api_definition_ ) == str:
        of_api_definition_list_ = [ of_api_definition_ ]
    else:
        of_api_definition_list_ = of_api_definition_

    for inner_api_call_ in inner_api_list_:
      for of_api_definition_ in of_api_definition_list_: 
        shorter_url_ = inner_api_call_ if len( inner_api_call_ ) < len( of_api_definition_ ) else of_api_definition_
        longer_url_  = of_api_definition_ if len( inner_api_call_ ) < len( of_api_definition_ ) else inner_api_call_

        shorter_arr_, longer_arr_ = shorter_url_.split('/'), longer_url_.split('/')

        print('DODO-> shorter_, longer_::', shorter_arr_, longer_arr_)
        ## try matching last 2 first if url like /abc/def and the other is v1/abc/def?123
        if len( shorter_arr_ ) >= 2 and shorter_arr_[-1] != '':
            primary_candidate_ = '/'.join( shorter_arr_[-2:] )
            if primary_candidate_ in longer_url_:
                print('HAWK TUAAH->', primary_candidate_, longer_url_ )
                primary = primary_candidate_ ## it just needs to be NOT NONE
                return primary, secondary

        shorter_, longer_ = cleanUp( shorter_arr_[-1], longer_arr_[-1] )
        ## now ensure that the last element on the shorter_arr is a substring of longer_arr's last term
        ## for e.g. using above, short_arr = ['', 'someAPI'] longer = [ 'https:',....,'someAPI?key='abc' ]
        if len(shorter_arr_[-1]) > 0 and shorter_arr_[-1] == longer_arr_[-1]:
            print( inner_api_call_, of_api_definition_, shorter_arr_, longer_arr_)
            secondary = shorter_arr_[-1]
            return primary, secondary

    return primary, secondary

def updateGlobalUsage( outer_file_, inner_file_ ):
    ## since the format of ALL graph inputs is the same
    #print('AIVO->', outer_file_, inner_file_ )
    of_json_, inner_json_ = outer_file_, inner_file_

    for of_file, of_contents_ in of_json_.items():
        of_method_details_ = of_contents_["method_details_"]

        for inner_file, inner_contents_ in inner_json_.items():
            inner_method_details_ = inner_contents_["method_details_"]
            
            ## check if inner method uses / calls an API thats defined in of_method_details_ and update
            ## global_usages of of_method_details_
            for of_method in of_method_details_:
                for inner_method in inner_method_details_:
                    ## DEFENSIVE CHECK
                    if "inter_service_api_call" not in inner_method or "api_end_point" not in of_method: continue

                    inner_api_call_ = inner_method["inter_service_api_call"]
                    of_api_definition_ = of_method["api_end_point"]

                    if of_api_definition_ == "NA" or len( inner_api_call_ ) == 0: continue
                    print('OUTER_URL::', of_api_definition_, of_file, '::INNER_URL::', inner_api_call_, inner_file)

                    for call in inner_api_call_: ## since , theoretically , we can call multiple APIs from a method
                        primary, secondary = innerCallingOuter( call, of_api_definition_ )

                        if primary != None:
                            ## now add inner method details to of_method

                            if "global_uses" in of_method:
                                ll_ = of_method["global_uses"]
                                existing_tmp_f = [ x['file_path'] for x in ll_ ]
                                existing_tmp_m = [ x['method_nm'] for x in ll_ ]
                                if inner_file in existing_tmp_f and inner_method["method_name"] in existing_tmp_m:
                                    ## DONT ADD DUPES !!
                                    print('DUPE !!')
                                    continue
                            else:
                                ll_ = list()

                            print('Inner API ::', inner_api_call_,' :: is defined in ::', of_api_definition_,\
                                                  inner_method )

                            ll_.append( { 'file_path': inner_file,\
                                          'method_nm': inner_method["method_name"],\
                                          "method_defn": inner_method["method_begin"],\
                                          "usage": primary,\
                                          "method_end": inner_method["method_end"]
                                          } )

                            of_method["global_uses"] = ll_
                            print( 'GLOBAL USAGE ADD->', of_method["global_uses"][-1], ' ::For:: ', \
                                    of_file )

                        elif secondary != None:
                            ## now add inner method details to of_method

                            if "low_prob_global_uses" in of_method:
                                ll_ = of_method["low_prob_global_uses"]
                                existing_tmp_f = [ x['file_path'] for x in ll_ ]
                                existing_tmp_m = [ x['method_nm'] for x in ll_ ]
                                if inner_file in existing_tmp_f and inner_method["method_name"] in existing_tmp_m:
                                    ## DONT ADD DUPES !!
                                    print('DUPE !!')
                                    continue
                            else:
                                ll_ = list()

                            print('Inner API ::', inner_api_call_,' :: is defined in ::', of_api_definition_,\
                                                  inner_method )

                            ll_.append( { 'file_path': inner_file,\
                                          'method_nm': inner_method["method_name"],\
                                          "method_defn": inner_method["method_begin"],\
                                          "usage": secondary,\
                                          "method_end": inner_method["method_end"]
                                          } )

                            of_method["low_prob_global_uses"] = ll_
                            print('LOW PROB GLOBAL USAGE ADD->', of_method["low_prob_global_uses"][-1], ' ::For:: ', \
                                    of_file )


def connectInterServiceCalls():
    '''
    trawl through s3 and pick all relevant method summary files first, then iterate and match inter service calls
    '''
    ## get the json's from the s3 buckets
    s3_ = s3_utils.s3_utils()
    rel_files_ = s3_.relevantFiles( pattern=os.getenv('GRAPH_INPUT_FILE_NM_SUFFIX') )

    graph_input_repo_ = dict()

    for method_summary_fnm in rel_files_:
        summ_ = s3_.readFromS3( method_summary_fnm )

        if summ_ != None:
            print('ADDING METHOD SUMMARY FOR ->', method_summary_fnm)
            graph_input_repo_[ method_summary_fnm ] = ( json.loads( summ_ ) )

    ## process the graph inputs of different languages as pairs
    ## so for e.g. the outer loop is the ".py" code base and the inner loop will be ".js" , ".java" etc
    for outer_file_nm, outer_file_jsn_ in ( graph_input_repo_.items() ):
        for inner_file_nm, inner_file_jsn_ in ( graph_input_repo_.items() ):
            if outer_file_nm == inner_file_nm:
                        continue ## obviously, we ignore the files that are exactly same

            updateGlobalUsage( outer_file_jsn_, inner_file_jsn_ )

            ## write back all the contents
            try:
                s3_.shipToS3( outer_file_nm, json.dumps( outer_file_jsn_, indent=4 ) )
                s3_.shipToS3( inner_file_nm, json.dumps( inner_file_jsn_, indent=4 ) )
            except:
                print('EXCPN::"match_inter_service_calls.py"::connectInterServiceCalls:: writing fail!!')
                print( traceback.format_exc() )


if __name__ == "__main__":
    connectInterServiceCalls()
