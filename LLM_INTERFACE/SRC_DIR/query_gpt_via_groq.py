import os, ast, time, math, json

with open( 'prompts.json', 'r' ) as fp:
    prompts_dict_ = json.load( fp )

with open( 'openai_config.json', 'r' ) as fp:
    cfg_ = json.load( fp )

from openai import OpenAI

client = OpenAI(
    api_key=cfg_["KEY"],
)

def returnDocSummary( data_frame ):
        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": prompts_dict_["SUMMARIZE_SAMPLE"] + data_frame
                    }
                ],
                model=cfg_["BASE_MODEL"],
            )

            kk = ( chat_completion.choices[0].message.content )

            return kk
        except:
            return 'NO RESPONSE'

def augmentHeaderInformation( header_info_ ):

        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": prompts_dict_["SUMMARIZE_HEADER_VALUES"] + data_frame
                    }
                ],
                model=groq_cfg_["BASE_MODEL"],
            )

            kk = ( chat_completion.choices[0].message.content )

            return kk
        except:
            return 'NO RESPONSE'

