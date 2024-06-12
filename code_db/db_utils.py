import createJsonFeats
import json, urllib

flask_url_ = 'http://0.0.0.0:5200/'
#flask_url_ = 'http://13.127.133.141:5000/'

url_insert = flask_url_ + 'dbInsert'
url_search = flask_url_ + 'dbSearch'
url_update = flask_url_ + 'dbUpdate'

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

