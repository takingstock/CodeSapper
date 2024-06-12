import json

def convert( js_, root_dir_='/datadrive/IKG/LLM_INTERFACE/' ):
    resp_ = dict()
    for file_, details_dict_ in js_.items():

        with open( file_, 'r' ) as fp:
            ll_ = fp.readlines()

        method_deets_, line_deets_, local_use, global_use = details_dict_["method_details_"],  \
                                                           details_dict_["line_wise_details_"], \
                                                           details_dict_["local_uses"], details_dict_["global_uses"]
        
        resp_[ root_dir_ + file_ ] = { "method_details_" :[] , "text_details_" : line_deets_ }

        for method in method_deets_:
            tmpD = dict()
            tmpD["method_name"] = method["name"]
            tmpD["method_begin"] = ll_[ method["start_line"] - 1 ]
            tmpD["method_end"] = ll_[ method["end_line"] - 1 ]
            tmpD["range"] = [ method["start_line"], method["end_line"] ]
            tmpD["global_uses"], tmpD["local_uses"] = [], []

            for globaluse in global_use:
                localD = dict()
                if globaluse["called_method_nm"] != method["name"]: continue

                localD["file_path"] = root_dir_ + globaluse["file_path_method_nm"]
                localD["method_nm"] = globaluse["method_nm"]
                localD["method_defn"] = globaluse["method_defn"][0]
                localD["usage"] = globaluse["usage"][0][0]
                localD["method_end"] = globaluse["method_end"][0]

                tmpD["global_uses"].append( localD )

            for localuse in local_use:
                localD = dict()
                if localuse["called_method_nm"] != method["name"]: continue

                localD["file_path"] = root_dir_ + globaluse["file_path_method_nm"]
                localD["method_nm"] = globaluse["method_nm"]
                localD["method_defn"] = globaluse["method_defn"][0]
                localD["usage"] = globaluse["usage"][0][0]
                localD["method_end"] = globaluse["method_end"][0]

                tmpD["local_uses"].append( localD )

            resp_[root_dir_ + file_]["method_details_"].append( tmpD )

    return resp_
    #with open( 'post_examine.json', 'a+' ) as fp:
    #    json.dump( resp_, fp, indent=4 )

if __name__ == "__main__":
    import sys

    with open( sys.argv[1], 'r' ) as fp:
        js_ = json.load( fp )

    convert( js_ )
