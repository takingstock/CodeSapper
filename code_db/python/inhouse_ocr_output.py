import requests
import json
import os
import merge_close_contours

# url = 'http://0.0.0.0:8701/extractText'
# url = 'http://52.7.45.213:8701/extractText'
# url = 'http://3.81.234.11:8701/extractText'
# url = "http://35.172.217.69:8701/extractText"
# url = "http://35.172.217.69:8113/extractText"
url = "http://3.236.79.159:8115/extractText"

base_path = os.getcwd()
# path = base_path + "/data/0a3pe2ya6dp677tuwzunv8uweuff-0.jpg"
path = base_path + "/data/8lvl6tw5n26nq2lhxj1i5agur5zo.jpg"
import time

class ProcessOCR:
    def __init__(self, path = path):
        self.path = path
        
    def returnDump(self):
        path = self.path
        files = {'file': open(path, 'rb')}
        ocrtime_ = time.time()
        op = requests.post( url , files=files, timeout = 240)
        print('GORY->', time.time() - ocrtime_)
        kk = op.json()
        lines = kk["lines"]
        
        file_name = ".".join(path.split("/")[-1].split(".")[:-1])
        json_path = os.getcwd() + "/ALL_OCR_OUTPUT_ORIGINAL/" + file_name + ".json"
        with open(json_path, "w") as f:    
            json.dump(kk, f)
        
        lines = merge_close_contours.merge_close_texts(lines)
        kk["lines"] = lines
        for line in lines:
            line_txt = ''
            for block in line:

                #print( block )
                line_txt = line_txt+" "+block['text']
            print("LINE--",line_txt)
        return kk
