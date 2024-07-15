import json, sys, os
import numpy as np
import time, re, requests, traceback

## currently using sys.path approach but should be able to create microservices while making performance changes
from graph_utils.networkx.graphTraversal import traverseGraph
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
    if 'method_context' not in change_record_: return ""

    msg_ = change_record_['method_context'] + '\n' ## add the changed method
    msg_ += "Changed line - NEW : " + ( ''.join( change_record_["new_code"] ) ) + '\n' ## add new changes
    msg_ += " OLD : " + ( ''.join( change_record_["old_code"] ) ) + '\n' ## add older version of the above

    impact_response_ = llm_interface_.executeInstruction( "IMPACT_SAMEFILE", msg_ )

    return impact_response_

def addChangeImpactOnDownstreamFile( change_record_, downstream_snippet_ ):

    llm_interface_ = LLM_interface()
    if 'method_context' not in change_record_: return ""

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
            time.sleep(3)

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

def format_test_results( test_file, test_impact_ ):
    search_phrase = "Upon reviewing the test cases"
    match = re.search(search_phrase, test_impact_, re.IGNORECASE)
    if match:
        start_pos = match.end()
        # Extract the relevant part of the text
        relevant_text = test_impact_[start_pos:].strip()

        # Split the text by "\n\n"
        elements = relevant_text.split("\n\n")

        # Create the dictionary with element number as key and the split string as value
        result_dict = {i + 1: element for i, element in enumerate(elements)}

        # Print the dictionary
        print(result_dict)
        return { 'TEST_FILE': test_file, 'IMPACT': result_dict }
    else:
        return { 'TEST_FILE': test_file, 'IMPACT': test_impact_ }
    

def testImpact( change_summary_, context_window_sz_, criticality_thresh_, test_folder_, email_subject_ ):

    impact_storage_, results_, genEvalInp_ = dict(), dict(), dict()
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
                genEvalInp_[ downstream_impact["impacted_method"] ] = downstream_impact["impact_analysis"]

    for key, impact_analysis in genEvalInp_.items():
        results_[ key ] = []

        for test_file in test_files_:
          try:  
            chunky_ = test_chunking_utils.test_plan_chunker( context_window_sz_, test_file, \
                                                         impact_analysis + test_impact_prompt_ )

            eval_chunks_ = chunky_.genEvalChunks()
            print('SENDING TEST FILE ->', test_file, ' A BUNCH OF CHUNKS->', len(eval_chunks_))

            for chunk_ in eval_chunks_:
                ## call the LLM 
                print('Test-File->', len(chunk_.split()), '\n', test_file)
                test_impact_ = llm_interface_.executeInstruction( mode=None, msg=chunk_ )
                formatted_ = format_test_results( test_file, test_impact_ ) 
                results_[ key ].append( formatted_ )
                time.sleep(60)
          except:
              print('CHUNKING ERR->', traceback.format_exc())
              continue

    ## send email 
    with open( '/datadrive/IKG/utils/tmp.json', 'w' ) as fp:
        json.dump( results_, fp, indent=4 )
    email_body_ = "PFA the impact analysis for the test cases!"
    email_subject_ = "TEST FILE::" + email_subject_
    print('SENDING TEST IMP ANALYSIS!!\n', email_body_, '\n', len( email_body_ ))
    time.sleep(5)
    send_response_mail( email_subject_, email_body_, file_=True )

def send_response_mail( subject, email_body, file_=False ):
    try:
        # url = "http://amygbdemos.in:3434/api/emailManager/sendEmailForVertiv"
        url = "https://email.amygbserver.in/api/emailManager/sendEmailFromSecondaryServer"
        recepient_ids = "vikram@amygb.ai"

        payload = {'subject': subject, 'body': email_body, 'emails': recepient_ids}

        if file_:
            files = {'file': open( '/datadrive/IKG/utils/tmp.json', 'rb')}
        else:
            files = {'file': None}
        
        print('BEFORE EMAIL SEND PAYLOAD->', payload)
        res = requests.post(url, data=payload, files=files, timeout=30)  # , headers = headers)
        print(res)
        res.close()
    except:
        print( traceback.print_exc() )
        return None

def start( change_summary_file_, \
           send_notif_=False
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
    default_home_dir_ = './'

    change_summary_ = change_summary_file_
    ## call chunking for the changed method itself, first
    chunking_utils.createChunkInChangeFile( default_home_dir_, change_summary_ )
    print('STAGE1-> self chunking := ', change_summary_)

    with open( os.getenv("DAEMON_CONFIG"), 'r' ) as fp:
        daemon_cfg_ = json.load( fp )
        viz_url_ = daemon_cfg_['python']['viz_url']
        context_window_sz_ = daemon_cfg_['python']["context_window"]
        criticality_thresh_ = daemon_cfg_['python']["criticality_thresh_"]
        test_folder_ = daemon_cfg_['python']["test_folder_"]

    start_timer_ = time.time()

    tg_ = traverseGraph()
    change_summary_comms_ = dict()

    for idx, change_record_ in enumerate( change_summary_ ):
        if "method_class_nm_old" in change_record_ and "method_nm" in change_record_["method_class_nm_old"]\
                and change_record_["method_class_nm_old"]["method_nm"] == None:
                    continue

        fnm, method_ = change_record_['file'], change_record_["method_class_nm_old"]["method_nm"]
        class_ = change_record_["method_class_nm_old"]["class_nm"]
        impact_ = addChangeImpactOnFile( change_record_ )
        change_record_['base_change_impact'] = impact_
        change_record_['base_change_criticality'] = findPatterns( impact_, 'Criticality', r"[0-5]")

        ## traverse the graph and find global uses first
        #NOTE->COMMENT THE BELOW & UNCOMMENT THE LINES BELOW ..only for testing 
        global_usage_ = tg_.traverse_graph( method_, (default_home_dir_ + fnm), mode=GLOBAL )
        local_usage_  = tg_.traverse_graph( method_, (default_home_dir_ + fnm), mode=LOCAL )

        print('ABOUT TO START IMPACT ANALSYSIS FOR ->', method_,'::GLOBAL::',global_usage_)
        print('ABOUT TO START IMPACT ANALSYSIS FOR ->', method_,'::LOCAL::',local_usage_)

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

        try:
            response = requests.post( viz_url_, json=change_summary_ )
        except:
            response = None
        #print( 'HULLO ALLO->', json.dumps( change_summary_, indent=4 ), response )
        ## NOTE->post this, we need to trigger an email with the URL of the visualized graph if send_notif_ is true

        if response is not None and response.status_code == 200 and send_notif_ == True:
            with open( os.getenv('DAEMON_CONFIG'), 'r' ) as fp:
                daemon_cfg = json.load( fp )

            json_response = response.json()
            
            viz_id_ = json_response['viz_id']
            send_url_ = daemon_cfg['python']['view_viz_url'] + viz_id_

            subject_ = "IMPACT ANALYSIS: Changes in " + fnm + " Criticality: " \
                       + change_record_['base_change_criticality']

            if change_record_['base_change_criticality'] == 'NA':
                body_ = 'No IMPACT of the changes mentioned in the header!'
            else:    
                body_    = "Hi, Kindly visualize the impact analysis of the changes made to the file in \
                            the Subject.\n"+ send_url_
            ## now send an email
            send_response_mail( subject_, body_ )

            ## NOTE->now find the impact on test plans
            #testImpact( change_summary_, context_window_sz_, criticality_thresh_, test_folder_, subject_ )
        else:
            ## simply dump into json
            criticality_ = 'NO_IMPACT_' if change_record_['base_change_criticality'] == 'NA' else\
                                           change_record_['base_change_criticality']

            impact_file_ = default_home_dir_ + '/impact_analysis/impact_analysis_Method::' + fnm.replace('/','_') \
                    + '::Criticality::' + criticality_ + '.json'

            with open( impact_file_, 'w' ) as fp:
                json.dump( change_record_, fp, indent=4 )
            
            print('===================IMPACT SUMMARY ',fnm,' :: ', method_,'=======================================')
            print( json.dumps( change_record_, indent=4 ) )

if __name__ == "__main__":

    with open( os.getenv('DAEMON_CONFIG'), 'r' ) as fp:
        cfg = json.load( fp )

    start( os.getenv('IKG_HOME') + cfg['python']['git_change_summary_file'] )

