import createJsonFeats
import json, urllib

with open( 'eod_config.json', 'r' ) as fp:
    config_json_ = json.load( fp )

# url_insert = config_json_["url_insert"] 
# url_search = config_json_["url_search"]
# url_update = config_json_["url_update"]

from get_ip_address import ENV

config_feedback_dict = {"SCALAR" : "13.127.133.141",
                       "STAGING" : "0.0.0.0",
                       "MARK_INFRA_PROD" : "162.31.18.10",
                       "MARK_INFRA_STAGING" : "0.0.0.0"}

feedback_server_ip = config_feedback_dict.get(ENV)

url_insert = "http://" + str(feedback_server_ip) + ":5100/dbInsert"
url_search = "http://" + str(feedback_server_ip) + ":5100/dbSearch"
url_update = "http://" + str(feedback_server_ip) + ":5100/dbUpdate"

print("url_insert table :", url_insert)
print("url_search table :", url_search)
print("url_update table :", url_update)

def returnBlankDBRec():
    dbRec_ = dict()
    dbRec_['docID'] = ''
    dbRec_['docSignature'] = []
    dbRec_['tupArr'] = []
    dbRec_['ocr_op'] = [] ## assing raw ocr op ['lines']
    dbRec_['dimension'] = [] ## assing raw ocr op ht, wd
    dbRec_['tableFeedback'] = dict()
    dbRec_['feedbackDict'] = [ { 'config_field_nm': '',\
                               'field_co_ords':[],\
                               'field_datatype': '',\
                               'feedback_value': '',\
                               'local_neigh_dict': dict() } ]
    dbRec_['exception_feedback'] = [] ## will contain dicts of fmt -> 
            ## { 'docID':, 'failed_fields': [ { 'config_field_nm':, 'feedback_value':, 'feedback_co_ords':, 'comments;' } ]
    dbRec_['success_feedback'] = [] ## array of dicts        
    ## { 'docID':, 'passed_fields': [ { 'config_field_nm':, 'local_field':, 'feedback_value':, 'feedback_co_ords': , 'comments': } ]

    return dbRec_

def insertNewSignature( rec_ ):

    data = json.dumps( rec_ ).encode('utf-8')
    insert_request = urllib.request.Request( url_insert, data=data, method='POST', \
                                              headers={'Content-Type': 'application/json'})

    response = urllib.request.urlopen( insert_request )
    string = response.read().decode('utf-8')

    return string
    
def updateSignature( rec_ ):

    data = json.dumps( rec_ ).encode('utf-8')
    insert_request = urllib.request.Request( url_update, data=data, method='POST', \
                                              headers={'Content-Type': 'application/json'})

    response = urllib.request.urlopen( insert_request )
    string = response.read().decode('utf-8')

    return string

def searchSignature( rec_ ):

    data = json.dumps( rec_ ).encode('utf-8')
    search_request = urllib.request.Request( url_search, data=data, method='POST', \
                                                headers={'Content-Type': 'application/json'} )
    response = urllib.request.urlopen( search_request )
    string = response.read().decode('utf-8')
    json_obj = json.loads(string)

    return json_obj

