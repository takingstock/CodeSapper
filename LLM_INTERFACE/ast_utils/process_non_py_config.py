import json, os, yaml
from pathlib import Path
'''
only json and yml files supported for now
'''
class nonPythonConfigParser():
    def __init__( self, src_dir ):

        self.src_dir_ = src_dir
        self.file_input_ = []
        self.all_apis_ = []

    def populateFileList(self):

        path = Path( self.src_dir_ )
        self.file_input_ = [ str(file.resolve()) for file in path.rglob('*') ]
        #print( 'RECURSIVE SRCH BEGIN->', self.src_dir_, self.file_input_ )

    def readJson(self, fnm):

        with open( fnm, 'r' ) as fp:
            json_cfg_ = json.load( fp )

        return json_cfg_

    def readYAML(self, fnm):

        with open( fnm, 'r' ) as fp:
            yaml_cfg_ = yaml.safe_load( fp )

        return yaml_cfg_

    def extractAPIMethods(self, file_, js_, key=None):
        '''
        we get a json file and scroll through them 
        '''
        if isinstance( js_, dict):
            for key, value in js_.items():
                self.extractAPIMethods( file_, value, key)
        elif isinstance( js_, list):
            for item in js_:
                self.extractAPIMethods( file_, item )
        elif isinstance( js_, str) and ( 'http://' in js_ or 'https://' in js_ ) and key != None:
            self.all_apis_.append( ( file_, key, js_ ) )

    def gather_deets(self):

        self.populateFileList()
        
        relevant_files_ = []
        for file_ in self.file_input_:
            resp_D = None
            if '.json' in file_:
                resp_D = self.readJson( file_ )
                #print('READ FILE->', file_)
            elif '.yml' in file_ or '.yaml' in file_:
                resp_D = self.readYAML( file_ )
                #print('READ FILE->', file_)

            self.extractAPIMethods( file_, resp_D )

        return self.all_apis_

if __name__ == "__main__":
    
    npc_ = nonPythonConfigParser( '/datadrive/IKG/LLM_INTERFACE/' )
    all_apis_ = npc_.gather_deets()
    config_url_assignments_ = dict()

    for tup in all_apis_:
        fnm, var_name, url = tup
        # defaullt ln # - 0
        config_url_assignments_[ fnm+'#'+var_name+'#0' ] = url

    #print( config_url_assignments_ )
