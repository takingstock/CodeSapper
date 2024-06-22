from flask import Flask, jsonify, request, render_template
import uuid, json
import numpy as np

app = Flask(__name__)

# Store visualizations in memory
visualizations = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/data/nodes/<viz_id>')
def get_nodes(viz_id):
    if viz_id in visualizations:
        #print('GETTING NODES->', visualizations[viz_id]['nodes'])
        return jsonify(visualizations[viz_id]['nodes'])
    else:
        return jsonify([])

@app.route('/data/links/<viz_id>')
def get_links(viz_id):
    if viz_id in visualizations:
        #print('GETTING LINKS->', visualizations[viz_id]['links'])
        return jsonify(visualizations[viz_id]['links'])
    else:
        return jsonify([])

def generateNode( fnm, method_, old_code_, new_code_, ln_no, method_context_, criticality, impact_ ):
    node_ = dict()

    node_['fnm'] = fnm
    node_['method_nm'] = method_
    node_['old_code_'] = old_code_
    node_['new_code_'] = new_code_
    node_['ln_no'] = ln_no
    node_['method_context_'] = method_context_
    node_['criticality'] = criticality
    node_['impact_analysis'] = impact_

    return node_

def generateLink( fnm, method_, impact_array_ ):

    link_rec_ = dict()
    link_rec_['method_nm'] = method_
    global_uses_, local_uses_, code_snippets_ = [], [], []

    for imp in impact_array_:

        code_snippets_.append( imp["impacted_code_snippet"][0] ) ## code snippet is inside an array of sz 1
        ## need to decide later why do we still need to retain this

        if imp['impact_type'] == 'global':
            global_uses_.append( imp['impacted_method'].split('/')[-1] )
        elif imp['impact_type'] == 'local':
            local_uses_.append( imp['impacted_method'].split('/')[-1] )

    link_rec_['global_uses_'], link_rec_['local_uses_'] = global_uses_, local_uses_
    link_rec_['impacted_code_snippet'] = code_snippets_

    print('DODO->', code_snippets_)
    print('FOFO->', global_uses_)

    return link_rec_

def processChangeSummary( change_summary_ ):
    node_resp_, link_resp_ = [], []

    for idx, change_record_ in enumerate( change_summary_ ):
        if "method_context" not in change_record_: continue

        fnm, method_ = change_record_['file'], change_record_["method_class_nm_old"]["method_nm"]
        old_code_, new_code_ = change_record_['old_code'], change_record_["new_code"]
        ln_no, method_context_ = change_record_["new_start"], change_record_["method_context"]
        criticality = change_record_['base_change_criticality']
        impact_analysis = change_record_['base_change_impact']

        node_rec_ = generateNode( fnm, method_, old_code_, new_code_, ln_no, \
                                  method_context_, criticality, impact_analysis )
        ## insert the root node for this path
        node_resp_.append( node_rec_ )
        ## now iterate through the "impact_analysis"

        for impacted_ in change_record_["impact_analysis"]:
            imp_fnm, imp_method_ = '/'.join( ( impacted_['impacted_method'].split('/') )[ :-1 ] ),\
                            impacted_['impacted_method'].split('/')[-1]

            imp_old_code_, imp_new_code_ = impacted_['impacted_code_snippet'], impacted_['impacted_code_snippet']
            imp_ln_no, imp_method_context_ = impacted_['impacted_code_range'][0], impacted_['impacted_code_context']
            imp_criticality, imp_impact_analysis = impacted_['criticality'], impacted_['impact_analysis']

            imp_node_rec_ = generateNode( imp_fnm, imp_method_, imp_old_code_, imp_new_code_, imp_ln_no, \
                                      imp_method_context_, imp_criticality, imp_impact_analysis )

            node_resp_.append( imp_node_rec_ )

        ## add links for global / local
        link_rec_ = generateLink( fnm, method_, change_record_["impact_analysis"] )
        link_resp_.append( link_rec_ )

    return node_resp_, link_resp_

@app.route('/create_visualization', methods=['POST'])
def create_visualization():
    data = request.get_json()
    ## data format received - look into the expected_formats.README
    nodes, links = processChangeSummary( data )
    #print('NODE DS->\n', json.dumps( nodes, indent=4 ) )
    #print('LINK DS->\n', json.dumps( links, indent=4 ) )

    viz_id = str(uuid.uuid4())
    visualizations[viz_id] = {'nodes': nodes, 'links': links}
    print('THE VIZ_ID=', viz_id)
    return jsonify( {'viz_id': viz_id} )

if __name__ == '__main__':
    app.run( debug=True, host='0.0.0.0', port=6999 )

