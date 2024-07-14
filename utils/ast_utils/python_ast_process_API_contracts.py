'''
if we are going to find out the impact of change in a method in some file/package
across the entire codebase , then its imperative to also record API calls and trace the definition
of the APIs
Now if the contracts for these APIs are well defined using Flask-RESTPlus OR Django DRF then this task is 
easier BUT imho that a LOT of contracts are poorly defined if at all. The below set of methods should help
bridge the gap , but of course, only a lot of testing by the community will make this more robust
'''
import os, json, sys, traceback
import numpy as np

from trackURLAndFindAPIDefs import findAPIDefAndUsage
from findAPIDefs import find_api_definitions

class addAPIUsageToGraph():
    def __init__(self):
        self.config_file_path_ = os.getenv("AST_CONFIG")
        with open( self.config_file_path_, 'r' ) as fp:
            cfg_ = json.load( fp )

        ##NOTE-> this MUST be the root dir of all your codebase
        self.src_dir_ = cfg_['SRC_DIR']
        self.method_summary_ = dict()

    def returnSnippet(self, fnm, ln_no):
        with open( fnm, 'r' ) as fp:
            ll_ = fp.readlines()

        return ll_[ ln_no ]

    def findGlobalUses(self, ref_method_nm, url_assignments_, url_assignments_within_methods_, url_usages_ ):
        ## first find the URL where this ref_method_nm is being used , then find its actual CALL
        global_uses_ = []

        for compKey, Url in url_assignments_.items():
            var_defined_in, var_nm, var_defined_ln_no = compKey.split('#')
            print('CHECKING ref_method_nm = ', ref_method_nm, ' var_nm = ', var_nm, ' Url = ', Url)

            if ref_method_nm.split('/')[-1] == Url.split('/')[-1]:
                print('Stage 1->', ref_method_nm, compKey, Url)
                ## now iterate through url_usages_ and find all references of "var_nm"
                for usage_file, usage_list_ in url_usages_.items():
                    
                  for usage_D in usage_list_:

                    if len( usage_D ) > 0 and usage_D['url_variable_'] == var_nm:
                        print('Stage 2->', usage_file, var_nm, usage_D)
                        localD= dict()
                        localD['file_path'] = usage_file
                        localD['method_nm'] = self.returnSnippet( usage_file, int(usage_D['ref_method_begin']) - 1 )
                        localD['method_defn'] = self.returnSnippet( usage_file, int(usage_D['ref_method_begin']) - 1 )
                        localD['usage'] = [ self.returnSnippet( usage_file, int(usage_D['ref_line_no']) - 1 ) ]

                        global_uses_.append( localD )

        ## in some cases the API is defined and called within a method ..poor programming practice
        ## but we need to cover all cases ( as much as possible )

        for _, assignments_ in url_assignments_within_methods_.items():
            for assignD in assignments_:
                fnm, ref_ln_no_ = assignD['url_fp'], assignD['url_defined_line_']
                potential_usage_snippet_ = self.returnSnippet( fnm, int( ref_ln_no_ ) - 1 )

                if ref_method_nm.split('/')[-1] in potential_usage_snippet_:
                        print('Stage 2.1->', fnm, assignD)
                        localD= dict()
                        localD['file_path'] = fnm
                        localD['method_nm'] = self.returnSnippet( fnm, int(assignD['ref_method_begin']) - 1 )
                        localD['method_defn'] = self.returnSnippet( fnm, int(assignD['ref_method_begin']) - 1 )
                        localD['usage'] = [ self.returnSnippet( fnm, int(assignD['ref_line_no']) - 1 ) ]

                        global_uses_.append( localD )

        return global_uses_

    def processResponse( self, url_assignments_, url_assignments_within_methods_, url_usages_, api_definitions_ ):

        for tup in api_definitions_:
            method_name, lineno, ending_line = tup['name'], tup['lineno'], tup['end_lineno']
            file_path, route_path = tup['file_path'], tup['route_path']

            if file_path not in self.method_summary_:
                self.method_summary_[ file_path ] = { "method_details_": [], "text_details_": [] }
            
            tmp_method_ll_ = self.method_summary_[ file_path ]["method_details_"]

            tmpD = dict()
            tmpD['method_name'] = method_name
            tmpD['method_begin'] = self.returnSnippet( file_path, int(lineno) - 1 )
            tmpD['method_end'] = self.returnSnippet( file_path, int(ending_line) - 1 )
            tmpD['range'] = [ lineno, ending_line ]

            tmpD["global_uses"] = self.findGlobalUses( route_path, url_assignments_, \
                                                        url_assignments_within_methods_ ,url_usages_ )
            tmpD["local_uses"]  = []

            tmp_method_ll_.append( tmpD )

            self.method_summary_[ file_path ]["method_details_"] = tmp_method_ll_
        
        return self.method_summary_

    def createGraphInput(self, relevant_files_):

        url_assignments_, url_assignments_within_methods_, url_usages_ = findAPIDefAndUsage( relevant_files_ )
        print('OUTSET->', url_usages_)
        '''
        url_assignments -> 
                        key -> var ( composite key -> fnm , var nm, line no separated by #
                                        value -> url
        url_usages -> 
                        key -> file_path
                        value -> list of tuple ( file_defined_, var nm, defined_line_, lineno, col_offset, method )
        '''
        ## now scour the code base and identify all the methods defined across flask and django apps
        api_definitions_ = find_api_definitions( relevant_files_ )
        '''
        list of dicts
        dict-> name, lineno, file_path, route_path, methods
        '''

        graph_input_ = self.processResponse( url_assignments_, url_assignments_within_methods_, \
                                             url_usages_, api_definitions_ )

        return graph_input_

if __name__ == "__main__":

        adder_ = addAPIUsageToGraph('/datadrive/IKG/LLM_INTERFACE/')
        resp_ = adder_.createGraphInput( relevant_files_ )
