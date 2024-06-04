import os, ast, time, math, json

with open( 'prompts.json', 'r' ) as fp:
    prompts_dict_ = json.load( fp )

with open( 'groq_config.json', 'r' ) as fp:
    groq_cfg_ = json.load( fp )

from groq import Groq

client = Groq(
    api_key=groq_cfg_["GROQ_KEY"],
)

def returnDocSummary( data_frame, high_variance_cols_ ):

        if len( high_variance_cols_ ) > 0:
            content_ = prompts_dict_["SUMMARIZE_SAMPLE_FOCUS"] + ' , '.join( high_variance_cols_ ).strip() + '\n'
        else:
            content_ = prompts_dict_["SUMMARIZE_SAMPLE"]

        print( 'GETTIN IN->', content_ )

        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": content_ + data_frame
                    }
                ],
                model=groq_cfg_["GROQ_BASE_MODEL"],
            )

            kk = ( chat_completion.choices[0].message.content )

            return kk
        except:
            return 'NO RESPONSE'

def augmentHeaderInformation( header_info_ ):
        print('INCOMING HDR->', header_info_)
        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": prompts_dict_["SUMMARIZE_HEADER_VALUES"] + header_info_
                    }
                ],
                model=groq_cfg_["GROQ_BASE_MODEL"],
            )

            kk = ( chat_completion.choices[0].message.content )

            return kk
        except:
            return 'NO RESPONSE'

if __name__ == '__main__':
    print( returnDocSummary('Insurance	Before Training 	AT 1 Round %	AT 2 Round %') )
