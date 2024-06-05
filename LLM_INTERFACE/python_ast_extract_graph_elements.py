import python_ast_utils as py_ast
import numpy as np
import json, os, sys, traceback, glob

class generateGraphEntities():
    def __init__(self, src_dir):
        self.src_dir_ = src_dir
        self.LOCAL = 'local'
        self.GLOBAL = 'global'
        self.LOCAL_USAGE_KEY = 'local_uses'
        self.GLOBAL_USAGE_KEY = 'global_uses'
        self.relevant_files_ = []
        self.file_master_ = dict()
        ## iterate through sub folders as well and list dirs that have py files
        for filename in glob.iglob( self.src_dir_ + '/**', recursive=True):
            if os.path.isfile(filename) and '.py' in filename and not '.pyc' in filename: # filter dirs
                self.relevant_files_.append( filename )

    def generateFileDeets(self, fnm):
        self.file_master_[ fnm ] = { 'method_details_': [] , 'line_wise_details_': {} }

        try:
            file_deets_ = py_ast.find_methods_and_traces( fnm )
        except:
            print('generateFileDeets:: EXCPN in py_ast.find_methods_and_traces->', traceback.format_exc())
            return None
        ## the response will be a tuple
        ## first element -> array of dicts containing method deets {'name': , 'start_line': , 'end_line': }
        ## 2nd element -> dict with key-> line # and val -> dict ( 'Type': , 'Targets': , 'Ending': , 'Values': , 'Function': )
        if file_deets_ != None and len( file_deets_ ) == 0:
            self.file_master_[ fnm ] = { 'method_details_': file_deets_[0] , 'line_wise_details_': file_deets_[1] }

    def returnSnippet(self, fnm, begin, end=None ):
        with open( fnm, 'r' ) as fp:
            return fp.readlines()[ begin: end if end != None else begin + 1 ]

    def returnUsageDict(self, mode, used_in_file_, usage_line_num_, called_method_, called_method_file_ ,\
                                                   used_in_file_method_deets_ ):
        ## first find the name of the method where this call is being made
        for method_deets_ in used_in_file_method_deets_:
            method_nm_, begin, end = method_deets_['name'], method_deets_['start_line'], method_deets_['end_line']

            if usage_line_num_ > begin and usage_line_num_ < end:
                print( mode.upper() ,' Usage of ', called_method_, ' Found in ', method_nm_)
                tmpD = dict()
                tmpD['file_path'] = used_in_file_
                tmpD['called_method_nm'] = called_method_
                tmpD['file_path_called_method_nm'] = called_method_file_
                tmpD['method_nm'] = method_nm_
                tmpD['method_defn'] = self.returnSnippet( used_in_file_, begin )
                tmpD['method_end'] = self.returnSnippet( used_in_file_, end )
                tmpD['usage'] = [ self.returnSnippet( used_in_file_, usage_line_num_ ) ]
                ## the array usage above is redundant for now but the idea is that in case the method
                ## is called multiple times in the same func / method, we could accomodate ..for now
                ## the assumption is 1 usage per method 
                return tmpD

    def generateLocalUsage(self, fnm):
        ## iterate through self.file_master_ and find IF and WHERE methods are used within a file_
        local_methods_ = self.file_master_[ fnm ]['method_details_']
        line_wise_details_ = self.file_master_[ fnm ]['line_wise_details_']

        for method_deets_ in local_methods_:
            method_nm_, begin, end = method_deets_['name'], method_deets_['start_line'], method_deets_['end_line']

            for line_no, line_dict in line_wise_details_.items():
                ## the idea is to check for usage of the method as a funcation call somewhere within the code
                if ( 'Function' in line_dict and line_dict['Function'] != 'NA' ) and\
                        ( method_nm_ == line_dict['Function'] ):

                            ll_ = self.file_master_[ fnm ][self.LOCAL_USAGE_KEY] in self.file_master_[ fnm ]\
                                    if self.LOCAL_USAGE_KEY in self.file_master_[ fnm ]\
                                    else []
                            ## create dict to store the local usage
                            usageD_ = self.returnUsageDict(self.LOCAL, fnm, line_no, method_nm_, fnm, local_methods_)
                            if usageD_ != None:
                                ll_.append( usageD_ )

                            self.file_master_[ fnm ][self.LOCAL_USAGE_KEY] = ll_

    def global_usage(self, func_, reference_funcs_ ):
        for methodD in reference_funcs_:
            if func_ == methodD['name']: return methodD['name']

    def generateGlobalUsage(self, fnm):
        ## iterate through self.file_master_ and find IF and WHERE methods are used within a file_
        reference_methods_ = self.file_master_[ fnm ]['method_details_']
        line_wise_details_ = self.file_master_[ fnm ]['line_wise_details_']
        
        for used_method_in_file_, other_file_deets_ in self.file_master_.items():
            if used_method_in_file_ == fnm: continue ## dont process the same file for which you are find global usage

            of_methods_ = other_file_deets_['method_details_']
            of_line_wise_ = other_file_deets_['line_wise_details_']

            for line_no, line_dict in of_line_wise_.items():
                if ( 'Function' in line_dict and line_dict['Function'] != 'NA' ):
                    used_in_method_nm_ = self.global_usage( line_dict['Function'], reference_methods_ )

                    ll_ = self.file_master_[ fnm ][self.GLOBAL_USAGE_KEY] in self.file_master_[ fnm ]\
                            if self.GLOBAL_USAGE_KEY in self.file_master_[ fnm ]\
                            else []

                    if used_in_method_nm_ != None:
                        usageD_ = self.returnUsageDict( self.GLOBAL, fnm, line_no, used_in_method_nm_, \
                                                           used_method_in_file_, of_methods_ )
                        if usageD_ != None:
                            ll_.append( usageD_ )

                        self.file_master_[ fnm ][self.GLOBAL_USAGE_KEY] = ll_

    def generate(self): 

        for file_ in self.relevant_files_:
            self.generateFileDeets( file_ )
            self.generateLocalUsage( file_ )
            self.generateGlobalUsage( file_ )

        print('Graph INput data generated!!')
        with open( 'examine.json', 'w+' ) as fp:
            json.dump( self.file_master_, fp, indent=4 )

        #response_json_ = 
        #for fnm_, file_elements_ in self.file_master_.items():
        
if __name__ == "__main__":
    gg_ = generateGraphEntities('SRC_DIR')
    gg_.generate()
