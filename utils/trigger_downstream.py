import json, sys, os
import numpy as np
import time

## currently using sys.path approach but should be able to create microservices while making performance changes
from graph_utils.graphTraversal import traverseGraph
##local packages
from LLM_INTERFACE import chunking_utils
from LLM_INTERFACE.LLM_Interface import LLM_interface
##glocal "ENUMS"
GLOBAL, LOCAL = "global_uses", "local_uses"

def addChangeImpactOnFile( change_record_ ):

    llm_interface_ = LLM_interface()
    msg_ = change_record_['method_context'] + '\n' ## add the changed method
    msg_ += "Changed line - NEW : " + ( ''.join( change_record_["new_code"] ) ) + '\n' ## add new changes
    msg_ += " OLD : " + ( ''.join( change_record_["old_code"] ) ) + '\n' ## add older version of the above

    impact_response_ = llm_interface_.executeInstruction( "IMPACT_SAMEFILE", msg_ )

    return impact_response_

def addChangeImpactOnDownstreamFile( change_record_, downstream_snippet_ ):

    llm_interface_ = LLM_interface()
    msg_ = change_record_['method_context'] + '\n' ## add the changed method
    msg_ += "Changed line - NEW : " + ( ''.join( change_record_["new_code"] ) ) + '\n' ## add new changes
    msg_ += " OLD : " + ( ''.join( change_record_["old_code"] ) ) + '\n' ## add older version of the above
    msg_ += " downstream file importing " + change_record_["method_class_nm_new"]["method_nm"] + '\n'
    msg_ += downstream_snippet_ ## add the downstream method importing the above method

    print('CALLING LLM addChangeImpactOnDownstreamFile->', msg_)
    impact_response_ = llm_interface_.executeInstruction( "IMPACT_DOWNSTREAM", msg_ )

    return impact_response_

def aggregateImpactResponse( changed_D, usage_, change_record_, mode, default_home_dir_ ):

    for usage_rec_ in usage_:
        usage_D = { 'file_nm': usage_rec_['file_name'] if default_home_dir_ in usage_rec_['file_name'] \
                                                       else default_home_dir_ + usage_rec_['file_name'],\
                                                       'method_nm': usage_rec_['method_name'] }

        downstream_snippet_ = chunking_utils.createChunkInDownStreamFile( changed_D, usage_D )

        if downstream_snippet_ != None and 'method_context' in change_record_:
            ## method_context is added in the call made to chunking_utils.createChunkInChangeFile
            ## now concatenate all the snippets and code changes together to ascertain impact of change
            impact_analysis_ = addChangeImpactOnDownstreamFile( change_record_, downstream_snippet_ )

            imp_ll_ = change_record_['impact_analysis'] if 'impact_analysis' in change_record_ else []
            imp_ll_.append( { 'impacted_method': usage_D['file_nm'] + usage_D['method_nm'],\
                              'impact_analysis': impact_analysis_ ,\
                              'impact_type': mode } )

            change_record_['impact_analysis'] = imp_ll_

        elif downstream_snippet_ == None:
            raise ValueError('Downstream usage of method->', method_,' exists but couldnt be found in ',\
                    usage_D['file_nm'], '. Need to debug!' )

def start( change_summary_file_, \
           default_neo4j_config_=os.getenv("NEO4J_CONFIG"),\
           default_home_dir_=os.getenv("IKG_HOME") 
         ):
    '''
    iterate through every record and
    a) for every method , traverse graph and find all global usages and local uses
    b) once done, call the chunking methods
    c) once chunks are returned quickly call LLM for generating change impact summary
        - if global uses present then for every global usage, it makes sense to generate a separate
        contextual summary of what the change entails
    '''

    with open( change_summary_file_, 'r' ) as fp:
        change_summary_ = json.load( fp )
        ## call chunking for the changed method itself, first
        chunking_utils.createChunkInChangeFile( default_home_dir_, change_summary_ )
        print('STAGE1-> self chunking := ', change_summary_)

    with open( default_neo4j_config_, 'r' ) as fp:
        neo4j_conf_ = json.load( fp )

    start_timer_ = time.time()

    tg_ = traverseGraph( default_neo4j_config_ )

    for idx, change_record_ in enumerate( change_summary_ ):
        fnm, method_ = change_record_['file'], change_record_["method_class_nm_old"]["method_nm"]
        class_ = change_record_["method_class_nm_old"]["class_nm"]

        ## traverse the graph and find global uses first
        #NOTE->COMMENT THE BELOW & UNCOMMENT THE LINES BELOW ..only for testing 
        global_usage_ = tg_.call_traversal( method_, (default_home_dir_ + fnm), mode=GLOBAL )
        local_usage_ = tg_.call_traversal( method_, (default_home_dir_ + fnm), mode=LOCAL )

        #global_usage_ = tg_.call_traversal( method_, default_home_dir_ + fnm, mode='global' )
        #local_usage_ = tg_.call_traversal( method_, default_home_dir_ + fnm, mode='local' )

        print('STAGE2->Global->', global_usage_, time.time() - start_timer_)
        print('STAGE2->Local->', local_usage_)

        ## global_usage_ of type {'method_name': 'createDBRec', 'method_importance_': 0.23500000000000004, 'file_name': '/datadrive/IKG/LLM_INTERFACE/SRC_DIR/basic_generateXLMetaData.py', 'method_begin_ln': '359', 'method_end_ln': '385', 'method_begin_snippet': "def createDBRec( self, summary_D, mode='NORM' ): ", 'method_end_snippet': 'return insertRec'}

        changed_D = { 'file_nm': default_home_dir_ + fnm, 'class_nm': class_, 'method_nm': method_ }

        if global_usage_ != None and len( global_usage_ ) > 0:
            try:
                aggregateImpactResponse( changed_D, global_usage_, change_record_, 'global', default_home_dir_ )
            except:
                print('start->aggregateImpactResponse->EXCPN->', traceback.format_exc())

        elif local_usage_ != None and len( local_usage_ ) > 0:
            ## if no global impact formed simply summarize impact on local file itself
            try:
                aggregateImpactResponse( changed_D, local_usage_, change_record_, 'local', default_home_dir_ )
            except:
                print('Unable to find global usage method..INVESTIGATE')
        else:
            ## just add change impact summary for the method alone
            impact_ = addChangeImpactOnFile( change_record_ )
            change_record_['impact_analysis'] = [ { 'impacted_method': method_,\
                                                    'impact_analysis': impact_ ,\
                                                    'impact_type': 'local' } ]
        print( 'MOMO->', change_record_, time.time() - start_timer_ )

if __name__ == "__main__":

    with open( os.getenv('DAEMON_CONFIG'), 'r' ) as fp:
        cfg = json.load( fp )

    start( cfg['python']['git_change_summary_file'] )

