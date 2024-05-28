import os, ast, time, math, traceback
import json
from fuzzywuzzy import fuzz
from groq import Groq
from pathlib import Path

class LLM_interface:
    def __init__(self, src_folder_, dest_folder_, cfg_path_="./config.json", llm_='LLAMA'):

        with open( cfg_path_, 'r' ) as fp:
            self.config_ = json.load( fp )

        self.llm_client_ = Groq( api_key=self.config_['GROQ_KEY'],  )
        self.extraction_prompt_ = self.config_['EXTRACTION_PROMPT']
        self.src_folder_ = src_folder_
        self.dest_folder_ = dest_folder_
        self.chunk_size_ = self.config_['CHUNK_SIZE']
        self.model_to_be_used_ = self.config_['MODEL_NAME']

        self.temperature_ = self.config_['TEMP']
        #self.response_format_ = self.config_['RESPONSE_FMT']

        self.variable_store_ = dict() #{ 'file_path': [ {'var_nm': <ln #> } ] }
        self.package_store_ = dict() #{ 'file_path': [ {'package_nm': <ln #> } ] }## since these are used in methods
        self.method_store_ = dict() #{ 'file_path': [ {'method_nm': ( < start ln #>, < end ln # > ) } ] }

    def populateLLMInput(self):

        path = Path( self.src_folder_ )
        llm_input_ = [str(file.resolve()) for file in path.rglob('*') if file.is_file()]

        return llm_input_

    def method_contains_variable( var_key , method_start_ln_num, method_end_ln_num, method_fp_nm ):

        with open( method_fp_nm, 'r' ) as fp:
            ll_ = fp.readlines()
        
        appearances_ = []
        for idx in range( method_start_ln_num, method_end_ln_num ):
            if var_key in ll_[ idx ]: ## check if var name is present in the line ..simple enough
                appearances_.append( ll_[ idx ] )

        return appearances_

    def findUsage( self ):

        ## first find out uses of global variable in the local methods
        for fp_nm, var_arr_ in self.variable_store_.items():
            for method_fp_nm, method_deets in self.method_store_.items():

                if fp_nm == method_fp_nm:
                    for var_element in var_arr_:
                        for var_key, var_init_ln_num in var_element.items():
                            ## finally we get to the variable and its line num
                            ## now iterate through the method stores
                            for method_deet in method_deets:
                                for method_keys, method_items in method_deet.items():
                                    method_start_ln_num, method_end_ln_num = method_items
                                    uses_ = self.method_contains_variable( var_key , method_start_ln_num, \
                                            method_end_ln_num, method_fp_nm )

                                    if len( uses_ ) > 0:
                                        ll_ = var_element['usage'] if 'usage' in var_element else []
                                        ll_.append( { 'file_path': method_fp_nm, 'method_nm': method_keys } )
                                        var_element['usage'] = ll_

        ## first find out uses of global packages in the local methods
        for fp_nm, package_arr_ in self.package_store_.items():
            for method_fp_nm, method_deets in self.method_store_.items():

                if fp_nm == method_fp_nm:
                    for package_element in package_arr_:
                        for package_key, package_init_ln_num in package_element.items():
                            ## finally we get to the variable and its line num
                            ## now iterate through the method stores
                            for method_deet in method_deets:
                                for method_keys, method_items in method_deet.items():
                                    method_start_ln_num, method_end_ln_num = method_items
                                    uses_ = self.method_contains_variable( package_key , method_start_ln_num, \
                                            method_end_ln_num, method_fp_nm )

                                    if len( uses_ ) > 0:
                                        ll_ = package_element['usage'] if 'usage' in package_element else []
                                        ll_.append( { 'file_path': method_fp_nm, 'method_nm': method_keys } )
                                        package_element['usage'] = ll_

        ## now find the usage of methods within the file/module
        for fp_nm, method_arr_ in self.method_store_.items():
            for method_fp_nm, method_deets in self.method_store_.items():

                if fp_nm == method_fp_nm:
                    for _element in _arr_:
                        for _key, _init_ln_num in _element.items():
                            ## finally we get to the variable and its line num
                            ## now iterate through the method stores
                            for method_deet in method_deets:
                                for method_keys, method_items in method_deet.items():
                                    method_start_ln_num, method_end_ln_num = method_items
                                    uses_ = self.method_contains_variable( _key , method_start_ln_num, \
                                            method_end_ln_num, method_fp_nm )

                                    if len( uses_ ) > 0:
                                        ll_ = _element['usage'] if 'usage' in _element else []
                                        ll_.append( { 'file_path': method_fp_nm, 'method_nm': method_keys } )
                                        _element['usage'] = ll_


    def executeInstruction(self, mode, msg ):
        # modes -> MODULE_VARIABLES, PACKAGE_VARIABLES, METHODS

        chat_completion = self.llm_client_.chat.completions.create(
                        messages=[
                            {
                                "role": "user",
                                "content": self.extraction_prompt_[ mode ] + "\n" + msg
                            }
                        ],
                        model=self.model_to_be_used_,
                        temperature=self.temperature_,
                        #response_format=self.response_format_
                    )

        kk = ( chat_completion.choices[0].message.content )
        return kk

    def chunker(self, arr_ ):

        chunk_, chunk_lines_ = [], ''

        for line_ in arr_:
            if len( chunk_lines_ ) + len( line_ ) > self.chunk_size_:
                chunk_.append( chunk_lines_ )
                chunk_lines_ = ''
            chunk_lines_ += line_

        if len( chunk_lines_ ) > 0: chunk_.append( chunk_lines_ )

        return chunk_

    def returnLnNum( self, fnm, var_method_nm ):
        ## return the first instance of the match
        with open( fnm, 'r' ) as fp:
            ll_ = fp.readlines()
        
        for idx, line_ in enumerate( ll_ ):
            if var_method_nm in line_ or fuzz.ratio( var_method_nm, line_ ) >= 90:
                print('First occurence of ', var_method_nm ,' line #', idx)
                return idx

    def processModuleVars( self, resp_, fnm ):

        print('ENTERING-> processModuleVars ', resp_)
        try:
            ll_ = ast.literal_eval( resp_ )
        except:
            print('No array returned by the model ->', traceback.format_exc())
            return None

        for varNm in ll_:
            lnNo = self.returnLnNum( fnm, varNm )

            if lnNo is not None:
                if fnm in self.variable_store_:
                    varList = self.variable_store_[ fnm ]
                    if { varNm: lnNo } not in varList:
                        varList.append( { varNm: lnNo } )
                        self.variable_store_[ fnm ] = varList
                else:
                    varList = []
                    if { varNm: lnNo } not in varList:
                        varList.append( { varNm: lnNo } )
                        self.variable_store_[ fnm ] = varList

    def processPackageVars( self, resp_, fnm ):

        try:
            ll_ = ast.literal_eval( resp_ )
        except:
            print('No array returned by the model')
            return None

        for packageNm in ll_:
            for pack, moniker in packageNm.items():

                lnNo = self.returnLnNum( fnm, pack )

                if lnNo is not None:
                    if fnm in self.package_store_:
                        varList = self.package_store_[ fnm ]
                        if { pack: lnNo } not in varList:
                            varList.append( { pack: lnNo } )
                        ## if numpy is imported as "np" ( moniker ) then we need to store this as well
                        ## since most likely this is what will get used in the methods below
                        if moniker is not None and moniker != pack and { moniker: lnNo } not in varList:
                            varList.append( { moniker: lnNo } )

                        self.package_store_[ fnm ] = varList
                    else:
                        varList = []
                        if { pack: lnNo } not in varList:
                            varList.append( { pack: lnNo } )
                        if moniker is not None and moniker != pack and { moniker: lnNo } not in varList:
                            varList.append( { moniker: lnNo } )

                        self.package_store_[ fnm ] = varList

    def processModuleRefs( self, resp_, chunk_, fnm_ ): 
        ## populate self.method_store_ { 'file_path': [ {'method_nm': ( < start ln #>, < end ln # > ) } ] }
        try:
            ll_ = ast.literal_eval( resp_ )
        except:
            print('No array returned by the model')
            return None

        file_methods_ = self.method_store_[ fnm_ ] if fnm_ in self.method_store_ else []
        print('EXISTING file_methods_ = ', file_methods_, ll_)

        if len( ll_ ) == 0:
            try:
                ll_ = ast.literal_eval( self.executeInstruction( "METHOD_ENDING", chunk_ ) )
                print('BACKUP CALL to "METHOD_ENDING" ', ll_)
            except:
                print('EXCPN IN BACKUP CALL to "METHOD_ENDING" ->', traceback.format_exc() )

        for idx, method_deets in enumerate( ll_ ):
            if len( file_methods_ ) > 0 \
                and \
                ( 'method_name' in method_deets and method_deets['method_name'] in ['', None, 'None','NA']\
                    and 'method_end' in method_deets and method_deets['method_end'] not in ['', None, 'None','NA']\
                )\
                and \
                ( 'method_end' in file_methods_[-1] and file_methods_[-1]['method_end'] in ['', None, 'None','NA'] ):
                    print('Found the end for a prior method ', file_methods_[-1])
                    file_methods_[-1]['method_end'] = method_deets['method_end']
                    file_methods_[-1]['range'] = ( self.returnLnNum( fnm_, file_methods_[-1]['method_begin'] ),\
                                    self.returnLnNum( fnm_, file_methods_[-1]['method_end'] ) )

            ## ok, now we can go ahead with fresh insertions
            else:
                method_deets['range'] = ( self.returnLnNum( fnm_, method_deets['method_begin'] ),\
                                    self.returnLnNum( fnm_, method_deets['method_end'] ) )

                if method_deets['range'][0] is not None and method_deets['range'][0] > 0 \
                        and method_deets not in file_methods_:    
                    file_methods_.append( method_deets )

        self.method_store_[ fnm_ ] = file_methods_
        if len( file_methods_ ) > 0 and file_methods_[-1]['method_end'] in ['', None, 'None','NA']:
            print('Last method extracted->', file_methods_[-1],' Has no ending ..setting backtract to True')
            return True

        return False

    def cleanUp( self, file_ ):
        ## if global vars are present in the package vars, delete them
        tmp_vars_ = []
        for varD in self.variable_store_:
            dupe_ = False
            if varD in self.package_store_: ## so an imported package was counted as a global var ..naaa aah
                dupe_ = True
            if dupe_ is False: tmp_vars_.append( varD )

        self.variable_store_ = tmp_vars_

        ## sort methods identified and ensure the begin and ends of methods are defined
        print('Going to SORT->', self.method_store_)
        method_hold_ = sorted( self.method_store_[file_], key=lambda x:x['range'][0] )
        neo_ = []

        for idx, method_ in enumerate( method_hold_ ):
            if idx < len( method_hold_ ) - 2:
                curr, nxt = method_hold_[ idx ], method_hold_[ idx + 1 ]

                if curr['range'][0] != nxt['range'][0]:
                    curr['range'] = ( curr['range'][0], nxt['range'][0] )

                    neo_.append( curr )
            else:
                curr, nxt = method_hold_[ -2 ], method_hold_[ -1 ]

                if curr['range'][0] != nxt['range'][0]:
                    curr['range'] = ( curr['range'][0], nxt['range'][0] )

                    neo_.append( curr )
                    neo_.append( nxt )

        self.method_store_ = neo_


    def extractGraphElements(self):

        input_files_ = self.populateLLMInput()
        ## backtrack_ is used specifically to ensure right chunking size for methods. We dont want the llm
        ## to get chunks of the code which neither have a method defn OR method return values. So if the backtrack)
        ## is > 0 we start our chunkin from the backtrack values

        for file_ in input_files_:
            if 'basic_' not in file_: continue
            print('ooooooooooooooooooooooooooooooooooooooooooo')    
            backtrack_ = False

            with open( file_, 'r' ) as fp:
                file_lines_ = fp.readlines()

            chunks_ = self.chunker( file_lines_ )
            start_time_ = time.time()

            for chunk_ in chunks_:
                print('---------------------------------')
                print('CHUNK->', chunk_)
                var_, pack_, mod_ = self.executeInstruction( "MODULE_VARIABLES", chunk_ ),\
                                    self.executeInstruction( "PACKAGE_VARIABLES", chunk_ ),\
                                    self.executeInstruction( "METHODS", chunk_ )

                print( "MODULE_VARIABLES->", var_ )
                print( "PACKAGE_VARIABLES->", pack_ )
                print( "METHODS->", mod_ )
                print('time post groq->', time.time() - start_time_)

                if backtrack_ is False:
                    self.processModuleVars( var_, file_ )
                    self.processPackageVars( pack_, file_ )

                backtrack_ = self.processModuleRefs( mod_, chunk_, file_ )
                print('CHUNK_ENDS-> backtrack_ = ',backtrack_)
                print('time post pprocess->', time.time() - start_time_)
                time.sleep( 3 )

            self.cleanUp( file_ )
            print('ooooooooooooooooooooooooooooooooooooooooooo')    

        print('extracted CONTENTS->', self.variable_store_, '\n',self.package_store_, '\n', self.method_store_)

if __name__ == "__main__":

    interface_ = LLM_interface('./SRC_DIR/', './OP_DIR/')
    interface_.extractGraphElements()
