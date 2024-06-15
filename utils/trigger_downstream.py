import json, sys, os
import numpy as np
import time, re, requests

## currently using sys.path approach but should be able to create microservices while making performance changes
from graph_utils.graphTraversal import traverseGraph
##local packages
from LLM_INTERFACE import chunking_utils
from LLM_INTERFACE.LLM_Interface import LLM_interface
from notifications import sendEmail
##glocal "ENUMS"
GLOBAL, LOCAL = "global_uses", "local_uses"

def findPatterns(str1, pattern_, sub_pattern_):
    '''
    at times the LLM might not generate everything correctly ..useful to hunt for exact valyes
    '''

    start_index = str1.find( pattern_ )
    # If the label is found, proceed to extract the value
    if start_index != -1:
        # Move the index to the position after the label
        criticality_start = start_index + len( pattern_ )

        # Find the end of the criticality value (end of the number before the space)
        criticality_end = str1.find("\n", criticality_start)

        # Extract the criticality value
        criticality_value = str1[criticality_start:criticality_end]
        
        print('CRITICALITY->', criticality_value)
        match = re.search( sub_pattern_ , criticality_value )
        if match:
            return( match.group(0) )

    return 'NA'

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

        downstream_snippet_, downstream_loc_, range_ = chunking_utils.createChunkInDownStreamFile(changed_D, usage_D)

        if downstream_snippet_ != None and 'method_context' in change_record_:
            ## method_context is added in the call made to chunking_utils.createChunkInChangeFile
            ## now concatenate all the snippets and code changes together to ascertain impact of change
            impact_analysis_ = addChangeImpactOnDownstreamFile( change_record_, downstream_snippet_ )

            imp_ll_ = change_record_['impact_analysis'] if 'impact_analysis' in change_record_ else []
            imp_ll_.append( { 'impacted_method': usage_D['file_nm'] +'/'+ usage_D['method_nm'],\
                              'impacted_code_snippet': downstream_loc_, \
                              'impacted_code_range': range_, \
                              'impacted_code_context': downstream_snippet_, \
                              'criticality': findPatterns( impact_analysis_, 'Criticality', r"[0-5]"),\
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

    viz_id_store_ = dict()

    with open( change_summary_file_, 'r' ) as fp:
        change_summary_ = json.load( fp )
        ## call chunking for the changed method itself, first
        chunking_utils.createChunkInChangeFile( default_home_dir_, change_summary_ )
        print('STAGE1-> self chunking := ', change_summary_)

    with open( default_neo4j_config_, 'r' ) as fp:
        neo4j_conf_ = json.load( fp )

    with open( os.getenv("DAEMON_CONFIG"), 'r' ) as fp:
        daemon_cfg_ = json.load( fp )
        viz_url_ = daemon_cfg_['python']['viz_url']

    start_timer_ = time.time()

    tg_ = traverseGraph( default_neo4j_config_ )
    change_summary_comms_ = dict()

    for idx, change_record_ in enumerate( change_summary_ ):
        fnm, method_ = change_record_['file'], change_record_["method_class_nm_old"]["method_nm"]
        class_ = change_record_["method_class_nm_old"]["class_nm"]
        impact_ = addChangeImpactOnFile( change_record_ )
        change_record_['base_change_impact'] = impact_
        change_record_['base_change_criticality'] = findPatterns( impact_, 'Criticality', r"[0-5]")

        ## traverse the graph and find global uses first
        #NOTE->COMMENT THE BELOW & UNCOMMENT THE LINES BELOW ..only for testing 
        global_usage_ = tg_.call_traversal( method_, (default_home_dir_ + fnm), mode=GLOBAL )
        local_usage_ = tg_.call_traversal( method_, (default_home_dir_ + fnm), mode=LOCAL )

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
        '''        
        else:
            ## just add change impact summary for the method alone
            impact_ = addChangeImpactOnFile( change_record_ )
            change_record_['impact_analysis'] = [ { 'impacted_method': method_,\
                                                    'impacted_code_snippet': change_record_["method_context"],\
                                                    'impacted_code_range': ( change_record_["new_start"] ,\
                                                                                change_record_["new_start"]+1 ),\
                                                    'impacted_code_context': change_record_["method_context"],\
                                                    'criticality': findPatterns(impact_, 'Criticality', r"[0-5]"),\
                                                    'impact_analysis': impact_ ,\
                                                    'impact_type': 'local' } ]
        '''        

        #resp_ = json.dumps( change_record_, indent=4 )
        #print( 'MOMO->', resp_, time.time() - start_timer_ )

        print('HULLO ALLO->', json.dumps( change_summary_, indent=4 ))
        response = requests.post( viz_url_, json=change_summary_ )
        ## NOTE->post this, we need to trigger an email with the URL of the visualized graph

        if response.status_code == 200:
            with open( os.getenv('DAEMON_CONFIG'), 'r' ) as fp:
                daemon_cfg = json.load( fp )

            json_response = response.json()
            
            viz_id_ = json_response['viz_id']
            viz_url_ = daemon_cfg['python']['view_viz_url'] + viz_id_

            subject_ = "Changes in " + fnm + " Criticality: " + change_record_['base_change_criticality']
            body_    = "Hi, Kindly visualize the impact analysis of the changes made to the file in the Subject.\n"\
                    + viz_url_
            ## now send an email
            sendEmail( ['vikram@amygb.ai'], subject_, body_ )

if __name__ == "__main__":

    with open( os.getenv('DAEMON_CONFIG'), 'r' ) as fp:
        cfg = json.load( fp )

    start( cfg['python']['git_change_summary_file'] )

