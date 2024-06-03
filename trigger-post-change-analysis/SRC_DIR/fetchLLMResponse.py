import os
from openai import OpenAI

client = OpenAI(
    # This is the default and can be omitted
    api_key="sk-proj-jAfrcY6XXrnEcY8sfSexT3BlbkFJ2uzU6vTgITfQGj2NJpY3",
)

def returnOpenAI_response( dataframe ):

    completion = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": '''You are an agent that specializes in summarizing the tabular content attached below. The summary needs to be condensed to 5 lines at max and needs to mention important notes like dates and any other frequently occuring information. \n''' + dataframe,
            }
        ],
        model="gpt-4-turbo",
    )

    print( 'FINAL RESP->', completion.choices[0].message.content )

    return completion.choices[0].message.content
