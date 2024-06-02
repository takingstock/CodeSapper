import numpy as np
import json, sys, os, traceback
from LLM_Interface import LLM_interface
from ast_utils import CodeAnalyzer

def findRange( file_, input_method_, method_json_ ):

    for file_key, method_deets_ in method_json_.items():
        ref_file_, input_file_ = file_key.split('/')[-1], file_.split('/')[-1]
        print('FINDING RANGE->', ref_file_, input_file_)
        if ref_file_ == input_file_:
            for key, content in method_deets_.items():
                if key == "method_name" and content == input_method_:
                    return method_deets_[ 'range' ]

    return []

def cmpOldNew( old_code_vars_, new_code_vars_, target_dict_ ):
    '''
    so if the variables used in old code are "a" and "B" and in the new "a" is deleted a new one "C"
    is being used , we simply need to find how many lines actually use these variables and its assignees
    no point sending more than this context to the LLM ..capisce ?
    '''
    min_ln_, max_ln_ = 10000, -1

    for _ , assignment_deets in old_code_vars_.items():
        tgt_of_interest_ = assignment_deets['Targets'][0]

        if tgt_of_interest_ in target_dict_ and target_dict_[tgt_of_interest_]['MAX'] is not None:
            idx_ = target_dict_[tgt_of_interest_]['MAX']

            while idx_ < len( target_dict_ ) - 1:
                neo_tgt_ = target_dict_[tgt_of_interest_]['MAX_LN_TGT']

                if neo_tgt_ in target_dict_ and target_dict_[neo_tgt_]['MAX'] is not None:
                    idx_ = target_dict_[neo_tgt_]['MAX']
                    if target_dict_[neo_tgt_]['MIN'] < min_ln_ : min_ln_ = target_dict_[neo_tgt_]['MIN'] 
                    if target_dict_[neo_tgt_]['MAX'] > max_ln_ : max_ln_ = target_dict_[neo_tgt_]['MAX']
                else:
                    idx_ += 1

    for _ , assignment_deets in new_code_vars_.items():
        tgt_of_interest_ = assignment_deets['Targets'][0]

        if tgt_of_interest_ in target_dict_ and target_dict_[tgt_of_interest_]['MAX'] is not None:
            idx_ = target_dict_[tgt_of_interest_]['MAX']

            while idx_ < len( target_dict_ ) - 1:
                neo_tgt_ = target_dict_[tgt_of_interest_]['MAX_LN_TGT']

                if neo_tgt_ in target_dict_ and target_dict_[neo_tgt_]['MAX'] is not None:
                    idx_ = target_dict_[neo_tgt_]['MAX']
                    if target_dict_[neo_tgt_]['MIN'] < min_ln_ : min_ln_ = target_dict_[neo_tgt_]['MIN'] 
                    if target_dict_[neo_tgt_]['MAX'] > max_ln_ : max_ln_ = target_dict_[neo_tgt_]['MAX']
                else:
                    idx_ += 1
                    
    return min_ln_, max_ln_

def getSphereOfInfluence( ast_details_, changed_code_, old_code_ ):
    # parse_ast_snippet
    ast_old_, ast_new_ = CodeAnalyzer(), CodeAnalyzer()
    old_code_ast_, new_code_ast_ = ast_old_.parse_ast_snippet( old_code_ ), \
                                   ast_new_.parse_ast_snippet( changed_code_ )
    
    ast_old_.visit( old_code_ast_ )
    ast_new_.visit( new_code_ast_ )

    old_code_vars_, new_code_vars_ = ast_old_.ast_linewise_deets_, ast_new_.ast_linewise_deets_
    ## go through ast_details_ and find the begin and ending reference of the variable ( direct and indirect )
    target_dict_ = dict()
    for ln_no, line_ast_ in ast_details_.items():

        for eval_tgt_ in line_ast_['Targets']:
            max_ln_, min_line_ = -1, 10000

            for ln_no, line_ast_ in ast_details_.items():

                if eval_tgt_ in line_ast_['Values'] and max_ln_ < ln_no:
                    max_ln_ = ln_no

                if eval_tgt_ in line_ast_['Values'] and min_line_ > ln_no:
                    min_line_ = ln_no

            print('Furthest assignment of ',eval_tgt_,' is ', max_ln_, max_val_)

            target_dict_[ eval_tgt_ ] = { 'MIN': min_line_ if min_line_ != 10000 else None ,\
                                          'MAX': max_ln_ if max_ln_ != -1 else None,\
                                     'MAX_LN_TGT': ast_details_[max_ln_]['Targets'][0] if max_ln_ != -1 else None }

    ## the above will result in a DS like so
    ## key-> target value -> nearest & furthest USAGE of "target" as a VALUE .. so that we can follow the bread
    ## crumbs to the last indirect assignment of the target
    ast_old_.gc()
    ast_new_.gc()

    return cmpOldNew( old_code_vars_, new_code_vars_, target_dict_ )

def createChunkInChangeFile( summary_of_changes ):
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
    chunks_for_analysis_ = []
    
    ## summary_of_changes -> [ { 'file name': <>, 'method name': <>, 'old_code': <>, 'new_code': <> } ]
    ## also search the graph to find the ending of the method so we can pass the bounds for ast search and analysis
    for changeD in summary_of_changes:
        file_nm_, method_nm_, changed_code_, old_code_ = changeD['file'], changeD["method_class_nm_old"]['method_nm'], \
                                                         changeD['new_code'], changeD['old_code']

        begin_ln_, end_ln_ = findRange( file_nm_, method_nm_, method_summary_ )
        
        parsed_ast_ = ast_utils_.parse_ast( file_nm_, ( begin_ln_, end_ln_ ) )
        ## the above call , apart from initializing the ast also parses the code for the range defined
        ## this sub tree can now be accessed via its predicate parsed_ast
        ast_utils_.visit( parsed_ast_ )
        ## this should generate all the details which can be accessed via its predicate ast_linewise_deets_
        ast_details_ = ast_utils_.ast_linewise_deets_

        code_review_range_ = getSphereOfInfluence( ast_details_, changed_code_, old_code_ )

        with open( file_nm_, 'r' ) as fp:
            tmp_contents_ = fp.readlines()

        if code_review_range_[0] == 10000 or code_review_range_[1] == -1:
            print('Sending the entire code of <', method_nm_,'> for review')
        else:
            print('Found contextual subtext for <', method_nm_,'>')
            begin_ln_, end_ln_ = code_review_range_

        chunks_for_analysis_.append( changeD.update( { 'method_context': tmp_contents_[ begin_ln_: end_ln_ ] } ) )

    ast_utils_.gc()


def createChunkInDownStreamFile( method_name, file_name ):
    '''
    similar to the description in createChunkInChangeFile .. the only difference being that we dont
    need the LLM to trace the changes since a downstream file accesses another method only via a function call
    and the function call would either update the argument being sent OR return a value. We can use these 2 and
    then trace the dependent variables as well
    '''
    return None

if __name__ == '__main__':
    import json
    with open( '../github-monitor/downloaded_artifacts/changes_for_further_analysis.json', 'r' ) as fp:
        js_ = json.load( fp )

    createChunkInChangeFile( js_ )
