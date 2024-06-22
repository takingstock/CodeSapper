import numpy as np
import json, sys, os, traceback

#sys.path.append( os.getenv('GRAPH_UTILS_FOLDER') )
sys.path.append( os.getenv('AST_UTILS_FOLDER') )

from ast_utils.python_ast_utils import CodeAnalyzer ## need to replace this based on programming language

MIN_LINES_CTXT = 5 ## min number of lines of context needed

def findRange( file_, input_method_, method_json_ ):

    with open( file_, 'r' ) as fp:
        usage_file_ = fp.readlines()

        for file_key, method_deets_ in method_json_.items():
            ref_file_, input_file_ = file_key.split('/')[-1], file_.split('/')[-1]
            print('FINDING RANGE->', ref_file_, input_file_)
            if ref_file_ == input_file_:
                for content in method_deets_['method_details_']:
                    print('DEEPER->', file_, content, input_method_)

                    if "method_name" in content and content["method_name"] == input_method_:
                        return content[ 'range' ]

    return []

def findRangeDownstream( file_, input_method_, method_json_ ):

    with open( file_, 'r' ) as fp:
        usage_file_ = fp.readlines()

        for file_key, method_deets_ in method_json_.items():
            ref_file_, input_file_ = file_key.split('/')[-1], file_.split('/')[-1]
            #print('FINDING RANGE->', ref_file_, input_file_)
            if ref_file_ == input_file_:
                for content in method_deets_['method_details_']:
                    print('DEEPER->', file_, content, input_method_)
                    range_ = content['range']
                    if range_[1] < range_[0]: continue
                    ## now find point of entry 
                    for idx, ln_ in enumerate( usage_file_[ range_[0]: range_[1] ] ):
                        if input_method_ in ln_:
                            print( 'POE->', usage_file_[ range_[0] + idx : range_[0] + idx + 1 ] )
                            return [ range_[0] + idx , range_[0] + idx + 1 ], content['range']

    return [], []

def cmpOldNew( old_code_vars_, new_code_vars_, target_dict_ ):
    '''
    so if the variables used in old code are "a" and "B" and in the new "a" is deleted a new one "C"
    is being used , we simply need to find how many lines actually use these variables and its assignees
    no point sending more than this context to the LLM ..capisce ?
    '''
    min_ln_, max_ln_ = 10000, -1
    #print('ENTERING cmpOldNew->', old_code_vars_, new_code_vars_)
    #print( target_dict_ )
    #print( len( target_dict_ ) )

    max_line_from_target_ = -1
    for key, val in target_dict_.items():
        if val['MAX'] is not None and val['MAX'] > max_line_from_target_:
            max_line_from_target_ = val['MAX']

    target_dict_keys_ = list( target_dict_.keys() )

    for _ , assignment_deets in old_code_vars_.items():
        print( 'cmpOldNew->', assignment_deets )
        tgt_of_interest_ = assignment_deets['Targets'][0]
        
        for target_, tdeets_ in target_dict_.items():
            if target_ == tgt_of_interest_ and \
                    ( tdeets_['MIN'] is not None and tdeets_['MAX'] is not None ):
                tgt_of_interest_ = tdeets_['MAX_LN_TGT']
                if tdeets_['MIN'] < min_ln_ : min_ln_ = tdeets_['MIN']
                if tdeets_['MAX'] > max_ln_ : max_ln_ = tdeets_['MAX']
                #print('NEW TGT->', tgt_of_interest_, min_ln_, max_ln_)

    for _ , assignment_deets in new_code_vars_.items():
        tgt_of_interest_ = assignment_deets['Targets'][0]
        
        for target_, tdeets_ in target_dict_.items():
            if target_ == tgt_of_interest_ and \
                    ( tdeets_['MIN'] is not None and tdeets_['MAX'] is not None ):
                tgt_of_interest_ = tdeets_['MAX_LN_TGT']
                if tdeets_['MIN'] < min_ln_ : min_ln_ = tdeets_['MIN']
                if tdeets_['MAX'] > max_ln_ : max_ln_ = tdeets_['MAX']
                print('NEW TGT->', tgt_of_interest_, min_ln_, max_ln_)
                    
    return min_ln_, max_ln_

def getSphereOfInfluence( ast_details_, changed_code_, old_code_ ):
    '''
    the idea is to use both the old and new code snippets and find out the "sphere of influence" of changes
    so we just follow the variables directly impacted by the code changes and then follow their trail of direct
    and indirect assignments
    NOTE-> a recursive solution here would be best but a little dangerous OR we can create small sub-graphs
    and then it would be a simple matter of graph traversal ..but this current algo is quick so any new soln
    needs to be robust and quick ( obviously )
    '''
    # parse_ast_snippet
    if changed_code_ != None and old_code_ != None:

        ast_old_, ast_new_ = CodeAnalyzer(), CodeAnalyzer()
        old_code_ast_, new_code_ast_ = ast_old_.parse_ast_snippet( old_code_ ), \
                                       ast_new_.parse_ast_snippet( changed_code_ )
        
        ast_old_.visit( old_code_ast_ )
        ast_new_.visit( new_code_ast_ )

        old_code_vars_, new_code_vars_ = ast_old_.ast_linewise_deets_, ast_new_.ast_linewise_deets_
        ## go through ast_details_ and find the begin and ending reference of the variable ( direct and indirect )
        target_dict_ = dict()
        for out_ln_no, line_ast_ in ast_details_.items():

            for eval_tgt_ in line_ast_['Targets']:
                max_ln_, min_line_ = -1, 10000

                for ln_no, line_ast_ in ast_details_.items():
                    print('BRAM->', line_ast_['Values'], eval_tgt_, out_ln_no, ln_no)
                    if eval_tgt_ in line_ast_['Values'] and max_ln_ < ln_no:
                        max_ln_ = ln_no

                    if eval_tgt_ in line_ast_['Values'] and min_line_ > ln_no:
                        min_line_ = ln_no

                print('Furthest assignment of ',eval_tgt_,' is ', max_ln_, min_line_)
                if min_line_ != 10000 and max_ln_ != -1:
                    print( ast_details_[min_line_], ast_details_[max_ln_] )

                #target_dict_[ eval_tgt_ ] = { 'MIN': min_line_ if min_line_ != 10000 else None ,\
                target_dict_[ eval_tgt_ ] = { 'MIN': out_ln_no,\
                                              'MAX': max_ln_ if max_ln_ != -1 else None,\
                                         'MAX_LN_TGT': ast_details_[max_ln_]['Targets'][0] \
                                         if ( max_ln_ != -1 and 'Targets' in ast_details_[max_ln_] and \
                                            len( ast_details_[max_ln_]['Targets'] ) > 0 ) \
                                         else None }

        ## the above will result in a DS like so
        ## key-> target value -> nearest & furthest USAGE of "target" as a VALUE .. so that we can follow the bread
        ## crumbs to the last indirect assignment of the target
        ast_old_.gc()
        ast_new_.gc()

        return cmpOldNew( old_code_vars_, new_code_vars_, target_dict_ )

    return ( 10000, -1 )

def readMethodsDBJson():
    '''
    read the method json and return reference ..let the caller decide what to do with the data
    especially since there might be a mongo call also to be made ..no convoluting this space
    '''
    _config_path_ = os.getenv("DAEMON_CONFIG")
    with open( _config_path_, 'r' ) as fp:
        tmp_json_ = json.load( fp )

    config_ = tmp_json_['python']
    method_summary_file_ = config_['method_summary']

    with open( method_summary_file_, 'r' ) as fp:
        return json.load( fp )

def createChunkInChangeFile( home_dir_, summary_of_changes ):
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
    ast_utils_ = CodeAnalyzer()
    method_summary_ = readMethodsDBJson()
    chunks_for_analysis_ = []
    
    ## summary_of_changes -> [ { 'file name': <>, 'method name': <>, 'old_code': <>, 'new_code': <> } ]
    ## also search the graph to find the ending of the method so we can pass the bounds for ast search and analysis
    for changeD in summary_of_changes:
        file_nm_, method_nm_, changed_code_, old_code_ = home_dir_ + changeD['file'], \
                                                         changeD["method_class_nm_old"]['method_nm'], \
                                                         changeD['new_code'], changeD['old_code']

        try:
            begin_ln_, end_ln_ = findRange( file_nm_, method_nm_, method_summary_ )
        except:
            print('TRACEBACK->', traceback.format_exc())
            continue
        
        parsed_ast_ = ast_utils_.parse_ast( file_nm_, ( begin_ln_, end_ln_ ) )
        ## the above call , apart from initializing the ast also parses the code for the range defined
        ## this sub tree can now be accessed via its predicate parsed_ast
        ast_utils_.visit( parsed_ast_ )
        ## this should generate all the details which can be accessed via its predicate ast_linewise_deets_
        ast_details_ = ast_utils_.ast_linewise_deets_
        #print( ast_details_ )

        try:
            code_review_range_ = getSphereOfInfluence( ast_details_, changed_code_, old_code_ )
        except:
            print('CODE CONTEXT EXTRACTION ERROR->', traceback.format_exc())
            code_review_range_ = ( 10000, -1 )

        with open( file_nm_, 'r' ) as fp:
            tmp_contents_ = fp.readlines()

        delta_ = abs( code_review_range_[1] - code_review_range_[0] )

        if code_review_range_[0] == 10000 or code_review_range_[1] == -1 or delta_ <= MIN_LINES_CTXT or \
            ( code_review_range_[0] == code_review_range_[1] ) or ( code_review_range_[1] < code_review_range_[0] ):
            print('Sending the entire code of <', method_nm_,'> for review')
        else:
            print('Found contextual subtext for <', method_nm_,'>', begin_ln_, end_ln_)
            begin_ln_ += ( code_review_range_[0] - 1 )
            end_ln_   = ( begin_ln_ + delta_ + 1 )
            ## since code_review_range_ just contains the line numbers within the context of the method
            ## to get the original subtext, add the min line to begin and calibrate end using begin

        chunks_for_analysis_.append( changeD.update( { \
                'method_context': ''.join( tmp_contents_[ begin_ln_: end_ln_ ] ) } ) )

    ast_utils_.gc()

def findPointOfEntry( file_path_, context_method_range_, changeDeets_ ):

    with open( file_path_, 'r' ) as fp:
        downstream_file_ = fp.readlines()

    begin_, end_ = context_method_range_
    context_ = downstream_file_[ begin_: end_ ]
    upstream_class_nm_, upstream_method_nm_ = changeDeets_["class_nm"],\
                                                changeDeets_["method_nm"]
    ## find the first occurence of either the imported class / method name's mention
    for idx, line_ in enumerate( context_ ):
        if ( upstream_class_nm_ != None and upstream_class_nm_ in line_ ) or\
                ( upstream_method_nm_ != None and upstream_method_nm_ in line_ ):
            return idx, [ line_ ] ## using array nomenclature to maintain std with other similar inputs

    return None, None

def createChunkInDownStreamFile( change_details_, downstream_file_details_ ):
    '''
    similar to the description in createChunkInChangeFile .. the only difference being that we dont
    need the LLM to trace the changes since a downstream file accesses another method only via a function call
    and the function call would either update the argument being sent OR return a value. We can use these 2 and
    then trace the dependent variables as well

    basically we are trying to trace "X" in the code below
    changed method -> classA.methodB 
    downstream file -> from upstream import classA
                       def downstream_func( abc ):
                          clsA = classA()
                          X = clsA.methodB( abc )
                          Y = doSomething( X ) ...
    '''
    ##NOTE-> input to the method will be the changes and its downstream usage .. this will need to be called in a
    ## for loop since we have to invoke graph traversal to find global and local calls for the method
    ## change_details_ -> keys - class_nm, method_nm, file_nm
    ## downstream_file_details_ -> keys - method_nm, file_nm
    ast_utils_ = CodeAnalyzer()
    method_summary_ = readMethodsDBJson()
    chunks_for_analysis_ = []

    range_for_snippet, range_for_llm = findRangeDownstream( downstream_file_details_['file_nm'], \
                                                            change_details_['method_nm'], method_summary_ )

    parsed_ast_ = ast_utils_.parse_ast( downstream_file_details_['file_nm'], range_for_snippet )
    ast_utils_.visit( parsed_ast_ )
    ast_details_ = ast_utils_.ast_linewise_deets_

    begin_ln_, downstream_point_of_entry_ = findPointOfEntry( downstream_file_details_['file_nm'], \
                                                                range_for_snippet,\
                                                                                change_details_ )
    if downstream_point_of_entry_ == None:
        print('Point of entry not found ..raise EXCPN')
        return None

    try:
        changed_code_ = old_code_ = downstream_point_of_entry_
        ## since we want to understand how much of the downstream code is actually impacted by teh upstream
        ## method change we would like to ONLY shortlist those lines of code which are actually impacted
        ## both changed and old can contain the same input since the below method only returns the best possible
        ## range considering both
        code_review_range_ = getSphereOfInfluence( ast_details_, changed_code_, old_code_ )
    except:
        print('CODE CONTEXT EXTRACTION ERROR->', traceback.format_exc())
        code_review_range_ = ( 10000, -1 )

    print('TIMMY->', code_review_range_)
    with open( downstream_file_details_['file_nm'], 'r' ) as fp:
        tmp_contents_ = fp.readlines()

    if code_review_range_[0] == 10000 or code_review_range_[1] == -1 or \
            ( begin_ln_ == end_ln_ ) or ( end_ln_ < begin_ln_ ):

        begin_ln_, end_ln_ = range_for_llm
        print('Sending the entire code of <', downstream_point_of_entry_,'> for review', begin_ln_, end_ln_)
    else:
        _, end_ln_ = code_review_range_ ## begin will be point of entry ..just get the furthest assignment
        print('Found contextual subtext for <', downstream_point_of_entry_,'>', begin_ln_, end_ln_ )

    ast_utils_.gc()

    print('RETURNING->', ''.join( tmp_contents_[ begin_ln_: end_ln_ ] ))

    return ( ''.join( tmp_contents_[ begin_ln_: end_ln_ ] ) ), downstream_point_of_entry_, ( begin_ln_, end_ln_ )

if __name__ == '__main__':
    import json, time
    start_ = time.time()
    with open( '../github-monitor/downloaded_artifacts/changes_for_further_analysis.json', 'r' ) as fp:
        js_ = json.load( fp )

    #createChunkInChangeFile( '/datadrive/IKG/', js_ )
    for elem in js_:
        changed_, downstream_ = { 'class_nm': elem["method_class_nm_new"]["class_nm"],'method_nm': elem["method_class_nm_new"]["method_nm"] , 'file_nm': '/datadrive/IKG/' + elem["file"] }, \
                                { 'method_nm':'downstream_antics' , 'file_nm': "/datadrive/IKG/LLM_INTERFACE/SRC_DIR/testMonkey.py" }

        createChunkInDownStreamFile( changed_, downstream_ )
    print('Total time->', time.time() - start_)
