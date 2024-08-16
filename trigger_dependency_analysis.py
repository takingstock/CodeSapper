import sys, json, ast, subprocess
import re, os, time, requests, traceback
import s3_utils
from groq import Groq
sys.path.append('./utils/ast_utils')
import python_ast_routine

sys.path.append('./utils')
import trigger_downstream
import match_inter_service_calls

sys.path.append('./utils/graph_utils/networkx')
import createGraphEntry
## add comment from basic stuff
def parse_python_file(file_path):
    """
    Parses a Python file and returns a list of tuples containing
    the type (class or function), name, start line, and end line.
    """
    with open(file_path, "r") as file:
        tree = ast.parse(file.read(), filename=file_path)

    definitions = []

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            # Function/method definition
            name = node.name
            start_line = node.lineno
            end_line = node.end_lineno
            definitions.append(('function', name, start_line, end_line))
        elif isinstance(node, ast.ClassDef):
            # Class definition
            name = node.name
            start_line = node.lineno
            end_line = node.end_lineno
            definitions.append(('class', name, start_line, end_line))

    return definitions

def thoroughKeyCheck( key_, method_summ_D ):
    for key, val in method_summ_D.items():
        if key_ in key: return key

    return 'NA'

def find_method_class_for_line( s3_, chg_dict_ ):
    """
    Finds the method or class for a given line number.
    """
    old_start, new_start, file_ = chg_dict_['old_start'], chg_dict_['new_start'], chg_dict_['file']
    class_nm_old, method_nm_old, class_nm_new, method_nm_new  = None, None, None, None

    relevant_method_summaries_ = s3_.relevantFiles( os.getenv('GRAPH_INPUT_FILE_NM_SUFFIX') )

    for method_summary_fnm in relevant_method_summaries_:
        method_summ_D = s3_.readFromS3( method_summary_fnm )

        if method_summ_D != None:

            method_summ_D = json.loads( method_summ_D )
            key_ = file_
            #key_ = file_ if './' in file_ else ( './' + file_ )
            key_ = thoroughKeyCheck( key_, method_summ_D )
            print('KK->', key_, key_ in method_summ_D)

            if key_ in method_summ_D:
               method_deets_ = method_summ_D[ key_ ]["method_details_"] 
               for individual_method_ in method_deets_:
                   range_ = individual_method_['range']
                   print( 'GRUNGE-> range_, old_start, new_start=>', individual_method_["method_name"],\
                           range_, old_start, new_start )

                   if old_start >= range_[0] and old_start <= range_[1]:
                       method_nm_old = individual_method_["method_name"]

                   if new_start >= range_[0] and new_start <= range_[1]:
                       method_nm_new = individual_method_["method_name"]

    ## the reason we have old and new is to ensure the correct context is shared with the LLM for summary
    ## what if the line of code was in a method X before and its been moved to method Y now ..capisce ?
    return {'class_nm':class_nm_old, 'method_nm': method_nm_old}, \
            {'class_nm':class_nm_new, 'method_nm':method_nm_new }

def call_code_scanners( changes ):
    '''
    the below should
    a) ensure the latest code is scanned and a graph input json created
    b) upload the same to s3
    '''

    py_ast_ = python_ast_routine.python_ast_routine()
    py_ast_.run_routine()

    ## now call the js code base scanner ..we shall use subprocess here since JS can't obviously be directly invoked
    script_path_backend = os.getenv('CODE_JS_BACKEND_SCANNER')
    argument_backend = os.getenv('CODE_JS_BACKEND')

    command_backend = ['node', script_path_backend, argument_backend ]
    print('Running command for NODE CODE->', command_backend )
    try:
      result = subprocess.run( command_backend, capture_output=True, text=True, check=True )
    
    except subprocess.CalledProcessError as e:
        print(f"Return Code: {e.returncode}")
        print(f"Error Output: {e.stderr}")

    script_path_frontend = os.getenv('CODE_JS_FRONTEND_SCANNER')
    argument_frontend = os.getenv('CODE_JS_FRONTEND')

    command_frontend = [ 'node', script_path_frontend, argument_frontend ]
    print('Running command for NODE CODE->', command_frontend )
    result = subprocess.run( command_frontend, capture_output=True, text=True, check=True )

    match_inter_service_calls.connectInterServiceCalls( changes )

def impact_analysis( changes ):
    cumulative_graph_ = createGraphEntry.generateGraph()
    cumulative_graph_.createGraphEntries()
    ## grapg entries created ..save copy in s3
    cumulative_graph_.shipToS3() 
    ##obtain reference to graph ..we shall be traversing this graph 
    in_mem_graph_ = cumulative_graph_.graph_
    ## call downstream trigger !!
    global_usage_summary_ = trigger_downstream.start( changes )
    return global_usage_summary_

def valid_extn( filenm, extn_arr ):

    for extn in extn_arr:
        if extn in filenm[ -(len(extn)): ]: return True

    return False

def parse_diff_file(diff_file):
    changes = []
    current_file = None
    hunk_info = None

    s3_ = s3_utils.s3_utils()
    _extensions_ = os.getenv('VALID_FILE_EXTENSIONS').split(',')

    print('EXTN_FILE->', _extensions_)

    with open(diff_file, 'r') as file:

        for line in file:
            if 'Output of git diff in ' in line:
                repo_ = (line.split( 'Output of git diff in ' )[-1])
                print('REPO=>', repo_)

            elif line.startswith('diff --git'):
                match = re.search(r'diff --git a/(.*) b/(.*)', line)
                if match:
                    current_file = match.group(2)
                    print('DUMM->', current_file )

            elif line.startswith('@@') and current_file is not None and valid_extn( current_file, _extensions_ ):
                hunk_info = re.search(r'@@ -(\d+),(\d+) \+(\d+),(\d+) @@', line)
                if hunk_info is not None:
                    old_start = int(hunk_info.group(1))
                    old_length = int(hunk_info.group(2))
                    new_start = int(hunk_info.group(3))
                    new_length = int(hunk_info.group(4))
                    hunk_data = {
                        'file': current_file,
                        'old_start': old_start,
                        'old_length': old_length,
                        'new_start': new_start,
                        'new_length': new_length,
                        'old_code': [],
                        'new_code': []
                    }
                    changes.append(hunk_data)

            elif line.startswith('-') and hunk_info and current_file is not None and\
                    valid_extn( current_file, _extensions_ ) and '--' not in line and '++' not in line and line !='\n':
                hunk_data['old_code'].append(line[1:])

            elif line.startswith('+') and hunk_info and current_file is not None and\
                    valid_extn( current_file, _extensions_ ) and '--' not in line and '++' not in line and line !='\n':
                hunk_data['new_code'].append(line[1:])

    ## finally add method name that the line changes belong to
    curr_file_ = None

    ## define all language code scanners below
    ## ideally 99.99 of the code needs to be inside utils/<language>_ast_utils folder
    ## only the call needs to be in the below code

    #call_code_scanners( changes )

    for chg_dict_ in changes:
      try:

        method_class_nm_old, method_class_nm_new = find_method_class_for_line( s3_, chg_dict_ )

        ## in case the lines are moved to a new method
        chg_dict_['method_class_nm_old'] = method_class_nm_old
        chg_dict_['method_class_nm_new'] = method_class_nm_new
      except:
          continue

    print('FINAL CHANGE->', changes)
    ## dump into s3
    s3_.shipToS3( 'changes_for_further_analysis.json', json.dumps( changes, indent=4 ) )

    ## now call the graph insertion and get a reference to the graph
    global_usage_summary_ = impact_analysis( changes )
    return changes, global_usage_summary_


def send_response_mail_text( sub, body ):
    try:
        # url = "http://amygbdemos.in:3434/api/emailManager/sendEmailForVertiv"
        url = os.getenv( 'IMPACT_EMAIL_URL' )
        recepient_ids = os.getenv( 'IMPACT_RECEPIENT_LIST' )
        # recepient_ids = "abhijeet@amygb.ai"

        payload = {'subject': sub, 'body': body, 'emails': recepient_ids}
        # files = {'file': open(file_path, 'rb')}
        files = {'file': None}

        res = requests.post(url, data=payload, files=files, timeout=30)  # , headers = headers)
        print(res)
        res.close()
    except:
        traceback.print_exc()
        return None

def main(inp_file_=None):
    if len(sys.argv) != 2 and inp_file_ == None:
        print("Usage: python trigger_dependency_analysis.py <diff_file>")
        sys.exit(1)

    diff_file = sys.argv[1] if inp_file_ == None else inp_file_
    changes, global_usage_summary_ = parse_diff_file(diff_file)

    result, sub, dd_, receipient_list_ = [], [], dict(), []

    for change in changes:
        if change["file"] not in global_usage_summary_: continue
        if change["file"] in global_usage_summary_ and \
                len( global_usage_summary_[change["file"]]['global_usage_'] ) == 0: continue

        print('GLOB exists !=>', len( global_usage_summary_[change["file"]] ) )
        result.append(f"File: {change['file']}")
        sub.append( change['file'] )

        dd_[ change['file'] ] = dict()
        
        for uses_ in global_usage_summary_[change["file"]]['global_usage_']:
            dd_[ change['file'] ]['method_name'] = uses_.get( 'upstream_method_nm', "NA" )
            dd_[ change['file'] ]['api_endpoint'] = uses_.get( 'upstream_api_endpoint', "NA" )

        dd_[ change['file'] ]['change_impact'] = global_usage_summary_[change["file"]].get( 'base_change_impact', "NA" )

        result.append(f"Old code starts at line {change['old_start']} with length {change['old_length']}:")
        result.append("\n".join(change['old_code']))
        dd_[ change['file'] ]['old_code'] = "\n".join(change['old_code'])

        result.append(f"New code starts at line {change['new_start']} with length {change['new_length']}:")
        result.append("\n".join(change['new_code']))
        dd_[ change['file'] ]['new_code'] = "\n".join(change['new_code'])

        result.append(f'\nGlobal Usage=> {global_usage_summary_.get(change["file"], "No data available")}')
        dd_[ change['file'] ]['global_usage'] = global_usage_summary_[change["file"]]['global_usage_']
        
        #IMPACT_OWNERS_CFG
        if len( dd_[ change['file'] ]['global_usage'] ) > 0:

            owners_file_ = os.getenv( 'IMPACT_OWNERS_CFG' )
            with open( owners_file_, 'r' ) as fp:
                owners_ = json.load( fp )

            for usage_ in dd_[ change['file'] ]['global_usage']:
                fnm = usage_['file_path']
                found_ = False
                print('Searching...', fnm, owners_)

                for repo, recep_list in owners_.items():
                    if repo in fnm:
                        receipient_list_.append( recep_list )
                        found_ = True
                        print('Adding...', recep_list)
                        break

                if found_ is False:
                    receipient_list_.append( 'abhijeet@amygb.ai' )
                    ## default => Abhijeet

        result.append("-" * 80)

    dd_['recepient_list'] = receipient_list_
    email_bod = json.dumps( dd_, indent=4 )
    email_sub = "Impact Analysis: File Changes=>" + str(sub)
    print('Sending email =>', email_bod, email_sub)

    send_response_mail_text( email_sub, email_bod )

if __name__ == "__main__":
    main()

