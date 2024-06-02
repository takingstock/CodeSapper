import numpy as np
import json, sys, os, traceback
from LLM_Interface import LLM_interface
from ast_utils import CodeAnalyzer

def findRange( file_, input_method_, method_json_ ):

    for file_key, method_deets_ in method_json_.items():
        ref_file_, input_file_ = file_key.split('/')[-1], file_.split('/')[-1]
        if ref_file_ == input_file_:
            for key, content in method_deets_.items():
                if key == "method_name" and content == input_method_:
                    return method_deets_[ 'range' ]

    return []

def createChunkInChangeFile( method_name, file_name, summary_of_changes ):
    '''
    ideally if the size of the method is small we could pass the entire method to the LLM
    but methods / functions are usually complex and there are high chances of LLMs missing critical info
    so its best to chunk the file methodically. What we do here is 
    a) find the lines of change and then ask the LLM to identify variables that are impacted by this change
    b) ensure these variables are in the vicinity of the changes made ( by simple file search )
    c) then find the variables that are indirectly impacted by these changes 
    d) finally find the max line # of the direct / indirected impactees of change and thence the context
       would be the beginning of the changed line and the max line # 
    e) for e.g. if the method / function is a 100 line behemoth instead of feeding in all the 100 lines 
       this approach will help u cut out the noise 
    f) worst case, the max line # will coincide with the line # of the return statement where we send the 
       entire method definition
    '''
    ##NOTE-> assumption is that we have access to the latest changed code
    llm_interface_ = LLM_interface()
    ast_utils_ = CodeAnalyzer()
    method_summary_ = llm_interface_.readMethodsDBJson()

    ## summary_of_changes -> [ { 'file name': <>, 'method name': <>, 'old_code': <>, 'new_code': <> } ]
    ## also search the graph to find the ending of the method so we can pass the bounds for ast search and analysis
    for changeD in summary_of_changes:
        file_nm_, method_nm_, changed_code_, old_code_ = changeD['file'], changeD['method_nm'], \
                                                         changeD['new_code'], changeD['old_code']

        begin_ln_, end_ln_ = findRange( file_nm_, method_nm_, method_summary_ )
        
        parsed_ast_ = ast_utils_.parse_ast( file_nm_, ( begin_ln_, end_ln_ ) )
        ## the above call , apart from initializing the ast also parses the code for the range defined
        ## this sub tree can now be accessed via its predicate parsed_ast
        ast_utils_.visit( parsed_ast_ )
        ## this should generate all the details which can be accessed via its predicate ast_linewise_deets_
        ast_details_ = ast_utils_.ast_linewise_deets_

        with open( file_name, 'r' ) as fp:
            file_contents_ = fp.readlines()

        method_specific_lines_ = file_contents_[ begin_ln_: end_ln_ ]

        chunk_range_ = findChunkRange( method_specific_lines_, ast_details_, 

def createChunkInDownStreamFile( method_name, file_name ):
    '''
    similar to the description in createChunkInChangeFile .. the only difference being that we dont
    need the LLM to trace the changes since a downstream file accesses another method only via a function call
    and the function call would either update the argument being sent OR return a value. We can use these 2 and
    then trace the dependent variables as well
    '''

def checkIfLegitVariable( method_name, file_name, var_name_ ):
    '''
    whilst calling createChunkInChangeFile, the LLM would return a bunch of variables ..need to ensure these
    varuables are indeed present in the context
    '''
