import json, sys, os
import numpy as np
## local imports
sys.path.append( os.getenv('TEST_PLAN_CONFIG') )
import doc_readers

class test_plan_chunker():
    def __init__(self, context_max_tokens, doc_path, existing_context_):
        self.max_tokens_ = context_max_tokens ## total number of tokens that can be passed into context window of LLM
        self.doc_path_ = doc_path
        self.change_summary_ = existing_context_
        self.eval_chunks_ = []

        with open( os.getenv('TEST_PLAN_CONFIG') + "/test_plan_details.json", 'r' ) as fp:
            test_cfg_ = json.load( fp )

        self.token_to_word_scaling_factor_ = test_cfg_["token_to_word_conversion"] ## 1.33 tokens for every word
        self.min_words_in_context_         = test_cfg_["min_words_in_context"] 

    def estimateTokens(self, str_):
        return len(str_.split()) * self.token_to_word_scaling_factor_

    def evaluateRow(self, deets_):
        '''
        iterate through the row and add only those rows to the context that have a sizeable amount of text
        no point wasting calls to the LLM by adding random noise
        sheet details -> Dict { line_num : int , row_values : dict }
        '''
        resp_ = dict()

        for details in deets_:
            row_content_ = ''

            for colHdr, content in details['row_values'].items():
                if type( content ) != str: continue

                if len( content.split() ) >= self.min_words_in_context_:
                    row_content_ += '\t' + content
            
            resp_[ details['line_num'] ] = row_content_

        return resp_

    def genEvalChunks(self):
        '''
        takes in the document and uses the self.available_tokens_ param and starts appending it to 
        already generated content 
        '''
        reader_ = doc_readers.readers( self.doc_path_ )
        xl_, doc_ = reader_.validate('XL'), reader_.validate('DOC')
        tokens_consumed_ = self.estimateTokens( self.change_summary_ )
        remaining_tokens_ = self.max_tokens_ - tokens_consumed_

        if not( xl_ or doc_ ):
            raise ValueError('Test plan format unrecognizable!')

        if remaining_tokens_ <= 0:
            raise ValueError('Context window tokens already consumed before adding test plan context!!')

        if xl_:
            xlDict_ = reader_.readXL()
            context_str_ = ''

            for sheet_nm, sheet_deets_ in xlDict_.items():
                row_deets_dict_ = self.evaluateRow( sheet_deets_ )

                for line_num, row_deets_ in row_deets_dict_.items():
                    tmp_ = [ str( sheet_nm ), str( line_num ), str( row_deets_ ) ]
                    context_str_ += '\n' + '\t'.join( tmp_ )

                    if self.estimateTokens( context_str_ ) >= remaining_tokens_:
                        self.eval_chunks_.append( self.change_summary_ + context_str_ )

                ## to get better results keep the context at a sheet level .. else 8192 tokens can 
                ## take in a lot more than a few sheets and the results will be poorer
                if len( context_str_ ) > 0:
                    self.eval_chunks_.append( self.change_summary_ + context_str_ )

                context_str_ = ''

        if doc_:
            docDict_ = reader_.readDOC()
            context_str_ = ''
            ## for now just use information from "paragraphs"; "tables"
            for para_ in docDict_["paragraphs"]:
                context_str_ += '\n' + para_

                if self.estimateTokens( context_str_ ) >= remaining_tokens_:
                    self.eval_chunks_.append( self.change_summary_ + context_str_ )
                    context_str_ = ''

            if len( context_str_ ) > 0: ## just in case context_str_ still has some content in it
                self.eval_chunks_.append( self.change_summary_ + context_str_ )

        return self.eval_chunks_

if __name__ == "__main__":
    chunky_ = test_plan_chunker( 8192, "../../test_db/test_plans/BRD-Project Mark.docx", \
                                 ''' "Here is the analysis of the impact of the change:\n\n```\n{\n  \"Issues\": [\n    \"The change from `string = response.read().decode('utf-8')` to `string = response.read()` may cause issues with character encoding, as the response from the urllib request is no longer being decoded from bytes to string.\"\n  ],\n  \"Criticality\": 3,\n  \"Recommendations\": [\n    \"Ensure that the response from the urllib request is properly encoded and decoded to avoid character encoding issues.\",\n    \"Test the downstream code to ensure that it can handle the changed encoding of the response.\"\n  ]\n}\n```\n\nExplanation:\n\nThe change from `string = response.read().decode('utf-8')` to `string = response.read()` may cause issues with character encoding, as the response from the urllib request is no longer being decoded from bytes to string. This could lead to errors or unexpected behavior in the downstream code that imports or uses this method.\n\nThe criticality of this change is rated as 3, as it may cause issues with character encoding, but it is not a critical vulnerability.\n\nThe recommendations are to ensure that the response from the urllib request is properly encoded and decoded to avoid character encoding issues, and to test the downstream code to ensure that it can handle the changed encoding of the response."''' )

    eval_chunks_ = chunky_.genEvalChunks()
    print('Num of eval chunks->', len( eval_chunks_ ) )

    for chk in eval_chunks_:
        print('GOJIRA->', len( chk.split() ))
        print( chk )
