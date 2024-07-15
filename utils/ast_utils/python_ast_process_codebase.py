import python_ast_utils as py_ast
import numpy as np
import json, os, sys, traceback, glob

class generateGraphEntities():
    def __init__(self):
        ##NOTE-> this MUST be the root dir of all your codebase
        self.src_dir_ = os.getenv('CODE_DB_PYTHON') 
        self.LOCAL = 'local'
        self.GLOBAL = 'global'
        self.LOCAL_USAGE_KEY = 'local_uses'
        self.GLOBAL_USAGE_KEY = 'global_uses'
        self.relevant_files_ = []
        self.file_master_ = dict()

    def generateRelevantFiles( self, timestamp_file_ ):
        ## iterate through sub folders as well and list dirs that have py files
        tmp_store_, delta_ = dict(), dict()

        for filename in glob.iglob( self.src_dir_ + '/**', recursive=True):
            if os.path.isfile(filename) and '.py' in filename[ -3: ]: # filter dirs
                tmp_store_[ filename ] = os.path.getmtime( filename )

        stored_timestamps_ = json.loads( timestamp_file_ )

        for fnm, ts_ in tmp_store_.items():
            if fnm not in stored_timestamps_ or ( ( fnm in stored_timestamps_ and stored_timestamps_[fnm] != ts_ ) ):
                self.relevant_files_.append( fnm )
                delta_[ fnm ] = ts_

        ## update the timestamp store
        stored_timestamps_.update( delta_ )

        if len( delta_ ) == 0:
            self.relevant_files_ = []

        return self.relevant_files_, stored_timestamps_

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
        if file_deets_ != None and len( file_deets_ ) > 0:
            self.file_master_[ fnm ] = { 'method_details_': file_deets_[0] , 'line_wise_details_': file_deets_[1] }

    def returnSnippet(self, fnm, begin, end=None ):
        with open( fnm, 'r' ) as fp:
            return fp.readlines()[ begin: end if end != None else begin + 1 ]

    def returnUsageDict(self, mode, method_defn_file_, usage_line_num_, called_method_, invoking_file_ ,\
                                                   used_in_file_method_deets_ ):
        ## first find the name of the method where this call is being made
        for method_deets_ in used_in_file_method_deets_:
            method_nm_, begin, end = method_deets_['name'], method_deets_['start_line'], method_deets_['end_line']

            if usage_line_num_ > begin and usage_line_num_ < end:
                tmpD = dict()
                tmpD['file_path'] = method_defn_file_
                tmpD['called_method_nm'] = called_method_
                tmpD['file_path_method_nm'] = invoking_file_
                tmpD['method_nm'] = method_nm_
                ## add -1 to indices since the file arr is 0 index based
                tmpD['method_defn'] = self.returnSnippet( invoking_file_, begin - 1 )
                tmpD['method_end'] = self.returnSnippet( invoking_file_, end - 1 )
                tmpD['usage'] = [ self.returnSnippet( invoking_file_, usage_line_num_ - 1 ) ]
                ## the array usage above is redundant for now but the idea is that in case the method
                ## is called multiple times in the same func / method, we could accomodate ..for now
                ## the assumption is 1 usage per method 
                #print( mode.upper() ,' Usage of ', called_method_, ' Found in ', method_nm_, \
                #        '\n', tmpD)
                return tmpD

    def generateLocalUsage(self, fnm):
        ## iterate through self.file_master_ and find IF and WHERE methods are used within a file_
        local_methods_ = self.file_master_[ fnm ]['method_details_']
        line_wise_details_ = self.file_master_[ fnm ]['line_wise_details_']
        self.file_master_[ fnm ][self.LOCAL_USAGE_KEY] = []

        #print( 'ANALYZING FOR fnm ->', fnm, ' local_methods_ = ', local_methods_, ' line_wise_details_ = ',\
        #        line_wise_details_ )

        for method_deets_ in local_methods_:
            method_nm_, begin, end = method_deets_['name'], method_deets_['start_line'], method_deets_['end_line']

            for line_no, line_dict in line_wise_details_.items():
                ## the idea is to check for usage of the method as a funcation call somewhere within the code
                if ( 'Function' in line_dict and line_dict['Function'] != 'NA' ) and\
                        ( method_nm_ == line_dict['Function'] ):

                            ll_ = self.file_master_[ fnm ][self.LOCAL_USAGE_KEY]
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
        self.file_master_[ fnm ][self.GLOBAL_USAGE_KEY] = []
        
        for used_method_in_file_, other_file_deets_ in self.file_master_.items():
            if used_method_in_file_ == fnm: continue ## dont process the same file for which you are find global usage

            of_methods_ = other_file_deets_['method_details_']
            of_line_wise_ = other_file_deets_['line_wise_details_']

            for line_no, line_dict in of_line_wise_.items():
                if ( 'Function' in line_dict and line_dict['Function'] != 'NA' ):

                    #print('REF METHODS->', reference_methods_)
                    used_in_method_nm_ = self.global_usage( line_dict['Function'], reference_methods_ )
                    
                    ll_ = self.file_master_[ fnm ][self.GLOBAL_USAGE_KEY]

                    if used_in_method_nm_ != None:
                        usageD_ = self.returnUsageDict( self.GLOBAL, fnm, line_no, used_in_method_nm_, \
                                                           used_method_in_file_, of_methods_ )
                        if usageD_ != None:
                            ll_.append( usageD_ )

                        self.file_master_[ fnm ][self.GLOBAL_USAGE_KEY] = ll_
                        print('GLOBAL USAGE->', used_in_method_nm_, ' line_dict::', usageD_)

    def convert( self, js_ ):
        resp_ = dict()
        for file_, details_dict_ in js_.items():

            with open( file_, 'r' ) as fp:
                ll_ = fp.readlines()

            method_deets_, line_deets_, local_use, global_use = details_dict_["method_details_"],  \
                                                               details_dict_["line_wise_details_"], \
                                                           details_dict_["local_uses"], details_dict_["global_uses"]

            resp_[ file_ ] = { "method_details_" :[] , "text_details_" : line_deets_ }
            #resp_[ root_dir_ + file_ ] = { "method_details_" :[] , "text_details_" : line_deets_ }

            for method in method_deets_:
                tmpD = dict()
                tmpD["method_name"] = method["name"]
                tmpD["method_begin"] = ll_[ method["start_line"] - 1 ]
                tmpD["method_end"] = ll_[ method["end_line"] - 1 ]
                tmpD["api_end_point"] = method["api_definition"] if "api_definition" in method else "NA"
                tmpD["range"] = [ method["start_line"], method["end_line"] ]
                tmpD["global_uses"], tmpD["local_uses"] = [], []


                for globaluse in global_use:
                    localD = dict()
                    if globaluse["called_method_nm"] != method["name"]: continue

                    localD["file_path"] = globaluse["file_path_method_nm"]
                    localD["method_nm"] = globaluse["method_nm"]
                    localD["method_defn"] = globaluse["method_defn"][0]
                    localD["usage"] = globaluse["usage"][0][0]
                    localD["method_end"] = globaluse["method_end"][0]

                    tmpD["global_uses"].append( localD )

                for localuse in local_use:
                    localD = dict()
                    if localuse["called_method_nm"] != method["name"]: continue

                    localD["file_path"] = localuse["file_path_method_nm"]
                    localD["method_nm"] = localuse["method_nm"]
                    localD["method_defn"] = localuse["method_defn"][0]
                    localD["usage"] = localuse["usage"][0][0]
                    localD["method_end"] = localuse["method_end"][0]

                    tmpD["local_uses"].append( localD )

                resp_[ file_ ]["method_details_"].append( tmpD )

        return resp_

    def generate(self): 

        for file_ in self.relevant_files_:
            self.generateFileDeets( file_ )

        for file_ in self.relevant_files_:
            #print('GOIN THRU RELEVANT FILES->', file_)
            self.generateLocalUsage( file_ )
            self.generateGlobalUsage( file_ )

        try:
          final_ = self.convert( self.file_master_ )
        except:
            final_ = dict()
            print('EXCPN::"python_ast_process_codebase.py"::final_ = self.convert', traceback.format_exc())

        return final_
        
if __name__ == "__main__":
    gg_ = generateGraphEntities()
    print( json.dumps( gg_.generate(), indent=4 ) )
    '''
    ## now invoke graph entry addition
    gg_ = graphEntry.generateGraph( src_dir='./data/', neo4j_config='./config.json' )
    gg_.createUniqueConstraints()

    nodeList_ , edgeList_ = gg_.preProcess( 'METHODS.json' )

    gg_.execNodeCreationCypher( nodeList_ , edgeList_ )
    gg_.calculatePageRank()
    '''

