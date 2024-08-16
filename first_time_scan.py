import sys, json, ast, subprocess
import re, os, time
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
            key_ = file_ if './' in file_ else ( './' + file_ )
            print('KK->', key_, method_summ_D.keys())

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

def call_code_scanners():
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

    match_inter_service_calls.connectInterServiceCalls()

def impact_analysis( changes ):
    cumulative_graph_ = createGraphEntry.generateGraph()
    cumulative_graph_.createGraphEntries()
    ## grapg entries created ..save copy in s3
    cumulative_graph_.shipToS3() 
    ##obtain reference to graph ..we shall be traversing this graph 
    in_mem_graph_ = cumulative_graph_.graph_
    ## call downstream trigger !!
    trigger_downstream.start( changes )

def valid_extn( filenm, extn_arr ):

    for extn in extn_arr:
        if extn in filenm[ -(len(extn)): ]: return True

    return False

def code_scan():

    call_code_scanners()

def main(inp_file_=None):
    changes = code_scan()


if __name__ == "__main__":
    main()

