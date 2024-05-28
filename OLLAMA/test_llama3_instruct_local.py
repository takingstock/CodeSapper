import requests

url = "http://localhost:11434/api/generate"
data = {
        "model": "llama3:instruct",
    "prompt": '''In the following code below extract the global variables and method definitions. Restrict answer to 2 lists. One with list of variables and the other with list of method definitions.\n govt_id_sync_dict = dict({"drivinglicence" : "DL",
                          "voterid" : "Voter ID",
                          "passport" : "Passport",
                          "aadhaar" : "Aadhaar",
                          "pan" : "PAN"})

def get_num_pages(pdf_path):
    # Get num of pages '''
}

response = requests.post(url, json=data)

print(response.status_code)
print(response.text)

