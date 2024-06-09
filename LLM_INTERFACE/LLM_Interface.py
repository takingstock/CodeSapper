import os, ast, time, math, traceback
import json
from fuzzywuzzy import fuzz
from groq import Groq
from pathlib import Path

class LLM_interface:
    def __init__(self, cfg_path_="./llm_config.json", llm_='LLAMA'):

        with open( cfg_path_, 'r' ) as fp:
            self.config_ = json.load( fp )

        self.llm_client_ = Groq( api_key=self.config_['GROQ_KEY'],  )
        self.extraction_prompt_ = self.config_['EXTRACTION_PROMPT']
        self.src_folder_ = self.config_['SRC_FOLDER']
        self.dest_folder_ = self.config_['DEST_FOLDER']
        self.chunk_size_ = self.config_['CHUNK_SIZE']
        self.model_to_be_used_ = self.config_['MODEL_NAME']
        self.code_ctx_win_ = self.config_['CODE_CONTEXT_WINDOW']

        self.temperature_ = self.config_['TEMP']
        self.py_return_syntax , self.js_return_syntax = self.config_["PYTHON_RETURN_SYNTAX"],\
                                                        self.config_["JS_RETURN_SYNTAX"]
        #self.response_format_ = self.config_['RESPONSE_FMT']

        self.variable_store_ = dict() #{ 'file_path': [ {'var_nm': <ln #> } ] }
        self.package_store_ = dict() #{ 'file_path': [ {'package_nm': <ln #> } ] }## since these are used in methods
        self.method_store_ = dict() #{ 'file_path': [ {'method_nm': ( < start ln #>, < end ln # > ) } ] }
        self.var_json_file, self.pack_json_file, self.method_json_file = \
                self.config_['VAR_JSON'], self.config_['PACK_JSON'], self.config_['METHOD_JSON']

    def populateLLMInput(self):

        path = Path( self.src_folder_ )
        llm_input_ = [str(file.resolve()) for file in path.rglob('*') if file.is_file()]

        return llm_input_

    def method_contains_variable(self, var_key , method_start_ln_num, method_end_ln_num, method_fp_nm ):

        with open( method_fp_nm, 'r' ) as fp:
            ll_ = fp.readlines()
        
        appearances_ = []
        try:
            for idx in range( method_start_ln_num - 1, method_end_ln_num + 1 ):
                if ( var_key in ll_[ idx ] or fuzz.ratio( var_key, ll_[ idx ] ) > 90 ) and\
                        'def' not in ll_[ idx ]: # at times 2 methods across files MIGHT have the same name
                    ## but different fucn..such methods are quite local to the files .. ignore such cases
                    ## check if var name is present in the line ..simple enough
                    appearances_.append( ll_[ idx ] )
        except:
            print('INDEX OUT OF RANGE ERR')

        return appearances_

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

    def returnLnNum( self, fnm, var_method_nm, pre_processed_ll_=None ):
        ## return the first instance of the match
        if pre_processed_ll_ == None:
            with open( fnm, 'r' ) as fp:
                ll_ = fp.readlines()
        else:
            ll_ = pre_processed_ll_
        
        for idx, line_ in enumerate( ll_ ):
            if var_method_nm in line_ or fuzz.ratio( var_method_nm, line_ ) >= 90:
                print('First occurence of ', var_method_nm ,' line #', idx)
                return idx

        ## if its come here, it means it couldn't find the end ..use a defaul language specific end statemet
        ## python -> return , javascript -> return
        ## self.py_return_syntax, self.js_return_syntax
        return_signature_ = self.py_return_syntax + ' ' + ''
        # add space at end ..else it will return some function call like returnXYZ ..lol
        for idx, line_text in enumerate( ll_ ):
            if return_signature_ in line_text :
                print('First occurence of ', var_method_nm ,' line #', idx)
                return idx

    def ensure_starts_with_square_bracket(self, s):
        # Find the first occurrence of the '[' character
        index = s.find('[')

        # If '[' is found, return the substring from that index
        if index != -1:
            return s[index:]
        # If '[' is not found, return an empty string or handle as needed
        else:
            return ''

    def checkLLMResponseFormat( self, resp_ ):

        legit_resp_ = self.ensure_starts_with_square_bracket( resp_ )
        print( 'MOD ENTRY->', legit_resp_ )

        try:
            ll_ = ast.literal_eval( legit_resp_ )
            return ll_
        except:
            print('No array returned by the model')
            return None

    def cleanUp( self, file_ ):
        ## if global vars are present in the package vars, delete them
        for fnm, varD_arr in self.variable_store_.items():
            tmp_vars_ = []

            for varD in varD_arr:
                dupe_ = False
                for pack_fnm, packD_arr in self.package_store_.items():
                    if varD in packD_arr: ## so an imported package was counted as a global var ..naaa aah
                        dupe_ = True
                        break

                if dupe_ is False:
                    tmp_vars_.append( varD )

            self.variable_store_[ fnm ] = tmp_vars_

        ## sort methods identified and ensure the begin and ends of methods are defined
        method_hold_ = sorted( self.method_store_[file_], key=lambda x:x['range'][0] )
        print('Going to SORT->', self.method_store_, '\n', method_hold_)
        neo_ = []

        for idx, method_ in enumerate( method_hold_ ):
            if idx < len( method_hold_ ) - 2:
                curr, nxt = method_hold_[ idx ], method_hold_[ idx + 1 ]

                if curr['range'][0] != nxt['range'][0]:
                    curr['range'] = ( curr['range'][0], nxt['range'][0] )

                    neo_.append( curr )
            elif ( idx > len( method_hold_ ) - 2 and len( method_hold_ ) >= 2 ):
                curr, nxt = method_hold_[ -2 ], method_hold_[ -1 ]

                if curr['range'][0] != nxt['range'][0]:
                    curr['range'] = ( curr['range'][0], nxt['range'][0] )

                    neo_.append( curr )
                    neo_.append( nxt )
            else:
                neo_.append( method_ )

        self.method_store_[file_] = neo_

    def readMethodsDBJson(self):
        '''
        read the method json and return reference ..let the caller decide what to do with the data
        especially since there might be a mongo call also to be made ..no convoluting this space
        '''
        with open( self.dest_folder_ + self.method_json_file, 'r' ) as fp:
            return json.load( fp )

if __name__ == "__main__":

    interface_ = LLM_interface()
    interface_.extractGraphElements()
