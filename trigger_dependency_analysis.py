import sys, json, ast, subprocess
import re, os
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

    for method_summ_D in relevant_method_summaries_:
        if file_ in method_summ_D:
           method_deets_ = method_summ_D[ file_ ]["method_details_"] 
           for individual_method_ in method_deets_:
               range_ = individual_method_['range']

               if old_start >= range_[0] and old_start <= range_[1]:
                   method_nm_old = individual_method_["method_name"]

               if new_start >= range_[0] and new_start <= range_[1]:
                   method_nm_new = individual_method_["method_name"]


    return {'class_nm':class_nm_old, 'method_nm': method_nm_old}, \
            {'class_nm':class_nm_new, 'method_nm':method_nm_new }

def call_code_scanners():
    '''
    the below should
    a) ensure the latest code is scanned and a graph input json created
    b) upload the same to s3
    '''

    ## now call the python code base scanner
    py_ast_ = python_ast_routine.python_ast_routine()
    py_ast_.run_routine()

    ## now call the js code base scanner ..we shall use subprocess here since JS can't obviously be directly invoked
    script_path = os.getenv('CODE_JS_SCANNER')
    argument = os.getenv('CODE_JS_PYTHON')

    command = ['node', script_path, argument]    

    result = subprocess.run( command, capture_output=True, text=True, check=True )

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

def parse_diff_file(diff_file):
    changes = []
    current_file = None
    hunk_info = None
    s3_ = s3_utils.s3_utils()

    with open(diff_file, 'r') as file:
        for line in file:
            if line.startswith('diff --git'):
                match = re.search(r'diff --git a/(.*) b/(.*)', line)
                if match:
                    current_file = match.group(2)
                    print('DUMM->', current_file )
            elif line.startswith('@@') and current_file is not None and '.py' in current_file:
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
            elif line.startswith('-') and hunk_info and current_file is not None and '.py' in current_file:
                hunk_data['old_code'].append(line[1:])
            elif line.startswith('+') and hunk_info and current_file is not None and '.py' in current_file:
                hunk_data['new_code'].append(line[1:])

    print('FINAL CHANGE->', changes)
    ## finally add method name that the line changes belong to
    curr_file_ = None

    ## define all language code scanners below 
    ## ideally 99.99 of the code needs to be inside utils/<language>_ast_utils folder 
    ## only the call needs to be in the below code
    call_code_scanners()

    for chg_dict_ in changes:
      try:  

        method_class_nm_old, method_class_nm_new = find_method_class_for_line( s3_, chg_dict_ )

        ## in case the lines are moved to a new method
        chg_dict_['method_class_nm_old'] = method_class_nm_old
        chg_dict_['method_class_nm_new'] = method_class_nm_new
      except:
          continue
        
    ## dump into s3
    s3_.shipToS3( 'changes_for_further_analysis.json', json.dumps( changes, indent=4 ) )

    ## now call the graph insertion and get a reference to the graph
    impact_analysis( changes )

    return changes

def main():
    if len(sys.argv) != 2:
        print("Usage: python analyze_changes.py <diff_file>")
        sys.exit(1)

    diff_file = sys.argv[1]
    changes = parse_diff_file(diff_file)

    for change in changes:
        print(f"File: {change['file']}")
        print(f"Old code starts at line {change['old_start']} with length {change['old_length']}:")
        print("\n".join(change['old_code']))
        print(f"New code starts at line {change['new_start']} with length {change['new_length']}:")
        print("\n".join(change['new_code']))
        print("-" * 80)

if __name__ == "__main__":
    main()

