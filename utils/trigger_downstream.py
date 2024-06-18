import json, sys, os
import numpy as np
import time, re, requests

## currently using sys.path approach but should be able to create microservices while making performance changes
from graph_utils.graphTraversal import traverseGraph
##local packages
from LLM_INTERFACE import chunking_utils
from LLM_INTERFACE.LLM_Interface import LLM_interface
from notifications import sendEmail
from test_utils import test_chunking_utils
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

    print('CALLING LLM addChangeImpactOnDownstreamFile->', msg_ )
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
            time.sleep(30)

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

def testImpact( change_summary_, context_window_sz_, criticality_thresh_, test_folder_, email_subject_ ):

    impact_storage_, results_ = dict(), dict()
    test_files_ = []
    llm_interface_ = LLM_interface()
    test_impact_prompt_ = llm_interface_.config_["EXTRACTION_PROMPT"]["TESTING_IMPACT"]

    for root, dirs, files in os.walk( test_folder_ ):
        for file_ in files:
            test_files_.append( os.path.join(root, file_) )

    for changes in change_summary_:
        impact_storage_[ changes["file"] ] = changes["base_change_impact"]
        for downstream_impact in changes["impact_analysis"]:
            if downstream_impact['criticality'] != 'NA' and \
                    int( downstream_impact['criticality'] ) >= criticality_thresh_:
                downstream_impact["impacted_method"] = downstream_impact["impact_analysis"]

    for key, impact_analysis in downstream_impact.items():
        results_[ key ] = []

        for test_file in test_files_:
          try:  
            chunky_ = test_chunking_utils.test_plan_chunker( context_window_sz_, test_file, \
                                                         impact_analysis + test_impact_prompt_ )

            eval_chunks_ = chunky_.genEvalChunks()

            for chunk_ in eval_chunks_:
                ## call the LLM 
                print('Test-File->', len(chunk_.split()), '\n', test_file)
                test_impact_ = llm_interface_.executeInstruction( mode=None, msg=chunk_ )
                results_[ key ].append( test_impact_ )
                time.sleep(90)
          except:
              continue

    ## send email 
    email_body_ = json.dumps( results_, indent=4 )
    email_subject_ = "TEST FILE::" + email_subject_
    print('SENDING TEST IMP ANALYSIS!!\n', email_body_, '\n', len( email_body_ ))
    send_response_mail( email_subject_, email_body_ )

def send_response_mail( subject, email_body ):
    try:
        # url = "http://amygbdemos.in:3434/api/emailManager/sendEmailForVertiv"
        url = "https://email.amygbserver.in/api/emailManager/sendEmailFromSecondaryServer"
        recepient_ids = "vikram@amygb.ai"

        payload = {'subject': subject, 'body': email_body, 'emails': recepient_ids}
        # files = {'file': open(file_path, 'rb')}
        files = {'file': None}

        res = requests.post(url, data=payload, files=files, timeout=30)  # , headers = headers)
        print(res)
        res.close()
    except:
        traceback.print_exc()
        return None


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
        context_window_sz_ = daemon_cfg_['python']["context_window"]
        criticality_thresh_ = daemon_cfg_['python']["criticality_thresh_"]
        test_folder_ = daemon_cfg_['python']["test_folder_"]

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

        print('HULLO ALLO->', json.dumps( change_summary_, indent=4 ))
        response = requests.post( viz_url_, json=change_summary_ )
        ## NOTE->post this, we need to trigger an email with the URL of the visualized graph

        if response.status_code == 200:
            with open( os.getenv('DAEMON_CONFIG'), 'r' ) as fp:
                daemon_cfg = json.load( fp )

            json_response = response.json()
            
            viz_id_ = json_response['viz_id']
            viz_url_ = daemon_cfg['python']['view_viz_url'] + viz_id_

            subject_ = "IMPACT ANALYSIS: Changes in " + fnm + " Criticality: " \
                       + change_record_['base_change_criticality']

            body_    = "Hi, Kindly visualize the impact analysis of the changes made to the file in the Subject.\n"\
                    + viz_url_
            ## now send an email
            send_response_mail( subject_, body_ )

        ## NOTE->now find the impact on test plans
        testImpact( change_summary_, context_window_sz_, criticality_thresh_, test_folder_, subject_ )

if __name__ == "__main__":

    with open( os.getenv('DAEMON_CONFIG'), 'r' ) as fp:
        cfg = json.load( fp )

    start( cfg['python']['git_change_summary_file'] )

