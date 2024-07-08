import os, sys, json, glob, math
import copy
import nltk
import traceback

#nltk.download('words')
from nltk.corpus import words

sys.path.insert(0, '/home/ubuntu/BITHIKA/amyvis_blocks/')
import amyvis

sys.path.insert(1, os.getcwd() + "/date_utils/")
sys.path.insert(1, os.getcwd() + "/date_utils/ALL_OCR_OUTPUT/")
sys.path.insert(1, os.getcwd() + "/date_utils/ALL_OCR_OUTPUT_ORIGINAL/")

import amyvis.docs.table_extractor as tamy
from fuzzywuzzy import fuzz
import invoice_details_inv_num
from inv_num_utils import *

debug = True


def get_invoice_number(img_path,
                       original_contours,
                       stitched_contours,
                       debug=False):

    stitched_contours_json = json.load(open(stitched_contours))
    stitched_ocr_lines = stitched_contours_json["lines"]
    stitched_word_contains_invoice_no = [False, {}, '']

    try:
        print("In invoice_details.get_details>>")
        result_details = invoice_details_inv_num.get_details(
            img_path, original_contours, stitched_contours)
    except:
        traceback.print_exc()
        print("no invoice date or invoice number found form base code")
        result_details = {}
    print("Result from base code :", result_details)
    result_invoice_number = dict()
    if "Invoice Number" in result_details:
        possible_inv_num_base = result_details["Invoice Number"]["value"]
        if possible_inv_num_base is None:
            possible_inv_num_base = ''
        possible_inv_num_base_cntr = {
            "text": possible_inv_num_base,
            "pts": result_details["Invoice Number"]["pts"]
        }

        if possible_inv_num_base_cntr[
                "text"] is not None and possible_inv_num_base_cntr[
                    "pts"] is not None:
            if not check_inv_num_FP(possible_inv_num_base_cntr,
                                    stitched_ocr_lines,
                                    stitched_word_contains_invoice_no):

                # if "Invoice Date" in result_details:
                #     print("Invoice date in base code")
                #     if not (result_details["Invoice Date"]["value"]
                #             in possible_inv_num_base):
                #         print(
                #             "checking that inv date anc inv num hve different values"
                #         )
                #         print(result_details["Invoice Date"]["value"],
                #               possible_inv_num_base)
                #         result_invoice_number["Invoice Number"] = result_details[
                #             "Invoice Number"]
                #         return result_invoice_number
                # else:
                #     print("Invoice NOT in date in base code")
                result_invoice_number["Invoice Number"] = result_details[
                    "Invoice Number"]

                if debug:
                    return result_invoice_number, 'output from base code'

                print("Returning value from base code")
                return result_invoice_number

    # invoice number is usually numbers only or alphanum or alphanum with special characters

    print("IN <<<< get_top_fraction_pg")

    ocr_for_inv_num = get_top_fraction_pg(stitched_contours_json, 0.3)
    print("OUTPUT>>> get_top_fraction_pg")
    print(ocr_for_inv_num)
    keywords = ["invoice no", "number", "inv", "no", "nvoice", "bill"]
    exclusions = ["date", "dt", "tax", "period"]
    possible_candidates = []
    for line in ocr_for_inv_num:

        for keyword in keywords:
            for ex in exclusions:
                #print(ex)

                if (keyword in line["text"].lower()):
                    if (ex in line["text"].lower()):
                        break
                    else:

                        if line not in possible_candidates:
                            possible_candidates.append(line)

    print('possible_candidates', possible_candidates)
    # pruning
    print("pruning level 1 ")
    cleaned_possible_candidates = []
    inv_pseudonyms = ['invoice', 'inv']
    num_pseudonums = ['no', 'number']
    for item in possible_candidates:
        text = item["text"]
        pts = item["pts"]
        font_size = len(text) / ((pts[2] - pts[0]))

        split_text = text.split()
        if len(split_text) == 1:
            if 'inv' in text.lower() and 'no' in text.lower():
                poss_word = find_next_contour_by_textbox(
                    json.load(open(stitched_contours))["lines"], pts)
                cleaned_possible_candidates.append({
                    "text": poss_word["text"],
                    "pts": poss_word["pts"]
                })

        if len(split_text) == 2:
            print("split_text :", split_text)
            number_to_text = get_numbers_in_text(text)
            new_split_text = convert_to_allowed_word_transitions(
                number_to_text, split_text)
            print('new_split_text', new_split_text)
            new_word = ' '.join(new_split_text)
            if 'invoice' in new_split_text[0].lower(
            ) and 'no' in new_split_text[1].lower():
                print('invoice no in text')
                print(len(new_split_text))

                if len(new_split_text) > 0:
                    print('second yay')

                    poss_word = find_next_contour_by_textbox(
                        json.load(open(stitched_contours))["lines"], pts)
                    if (poss_word['text'].lower() in 'abcdefghijklmnopqrstuvwxyz' ) and (poss_word['text'].lower() in'0123456789'):

                        cleaned_possible_candidates.append({
                            "text":
                            poss_word["text"],
                            "pts":
                            poss_word["pts"]
                        })
                        stitched_word_contains_invoice_no = [
                                True, {
                            "text":
                            poss_word["text"],
                            "pts":
                            poss_word["pts"]
                        }, 'invoice no'
                            ]

                    else:
                        new_poss_word = find_next_contour_by_textbox(
                        json.load(open(stitched_contours))["lines"], poss_word['pts'])
                        print('poss_word after special chars', new_poss_word)
                        cleaned_possible_candidates.append({
                            "text":
                            new_poss_word["text"],
                            "pts":
                            new_poss_word["pts"]
                        })
                        stitched_word_contains_invoice_no = [
                                True, {
                            "text":
                            new_poss_word["text"],
                            "pts":
                            new_poss_word["pts"]
                        }, 'invoice no'
                            ]



            elif 'invoice' in new_split_text[0].lower():
                #and not check_inv_num_FP(new_split_text[1], stitched_ocr_lines)
                if new_split_text[0].lower() == split_text[0].lower():
                    print(text, text.split()[1])
                    start_index = text.index(text.split()[1])
                    print('font_size', font_size)
                    start_x = round(pts[2] - ((len(text) -
                                               (start_index)) / font_size))

                    cleaned_possible_candidates.append({
                        "text":
                        text.split()[1],
                        "pts": [start_x, pts[1], pts[2], pts[3]]
                    })

                    stitched_word_contains_invoice_no = [
                                True, {
                        "text":
                        text.split()[1],
                        "pts": [start_x, pts[1], pts[2], pts[3]]
                    }, 'invoice'
                            ]

            elif any(["bill" in x.lower() for x in new_split_text]):
                poss_word = find_next_contour_by_textbox(
                    json.load(open(stitched_contours))["lines"], pts)
                cleaned_possible_candidates.append({
                    "text": poss_word["text"],
                    "pts": poss_word["pts"]
                })

        if len(split_text) >= 3:

            prev_split_text = copy.deepcopy(split_text)
            print("split_text :", prev_split_text)
            number_to_text = get_numbers_in_text(text)
            split_text = convert_to_allowed_word_transitions(
                number_to_text, split_text)
            print('now split_text', split_text)
            print('now prev_split_text', prev_split_text)

            new_word = ' '.join(split_text)
            print('new_word', new_word)
            no_list = ['no', 'n0']
            if (match_4(split_text[0].lower(), "invoice")
                    or match_4(split_text[0].lower(), "invo")
                    or match_4(split_text[0].lower(), "nvoice")) and (
                        (len(split_text[1].lower()) <= 2)
                        or any([nu in split_text[1].lower()
                                for nu in no_list])):
                # second word can be # or no or no: or n0: or n0
                print('case 1')
                inv_num = prev_split_text[2:]
                inv_num = ' '.join(inv_num)
                start_index = text.index(inv_num[0])
                start_x = round(pts[2] - ((len(text) -
                                           (start_index)) / font_size))
                print(inv_num)

                cleaned_possible_candidates.append({
                    "text":
                    inv_num,
                    "pts": [start_x, pts[1], pts[2], pts[3]]
                })
                stitched_word_contains_invoice_no = [
                    True, {
                        "text": inv_num,
                        "pts": [start_x, pts[1], pts[2], pts[3]]
                    }, 'inv no'
                ]

            if (any([iv in text.lower() for iv in inv_pseudonyms]) and any([
                    nu in text.lower() for nu in num_pseudonums
            ])) or (any([iv in new_word.lower() for iv in inv_pseudonyms])
                    and any([nu in new_word.lower()
                             for nu in num_pseudonums])):
                print('case 4')
                poss_word = find_next_contour_by_textbox(
                    json.load(open(stitched_contours))["lines"], pts)
                cleaned_possible_candidates.append({
                    "text": poss_word["text"],
                    "pts": poss_word["pts"]
                })

    print('cleaned_possible_candidates >>')
    print(cleaned_possible_candidates)
    # remove FP
    print("remove FP")
    backup_result_invoice_number = dict()

    if len(cleaned_possible_candidates) == 1:
        print("checking inv_num in ", cleaned_possible_candidates[0])
        if len(cleaned_possible_candidates[0]['pts']) != 0:

            if not check_inv_num_FP(cleaned_possible_candidates[0],
                                    stitched_ocr_lines,
                                    stitched_word_contains_invoice_no):
                backup_result_invoice_number["Invoice Number"] = dict({
                    "value":
                    cleaned_possible_candidates[0]["text"],
                    "pts":
                    cleaned_possible_candidates[0]["pts"]
                })
                if debug:
                    return backup_result_invoice_number, 'output from level 1 pruning where only ONE candidate was found'

                return backup_result_invoice_number
    else:
        for clean_cand in cleaned_possible_candidates:
            print("checking inv_num in ", clean_cand)

            if len(clean_cand['pts']) != 0:

                if not check_inv_num_FP(clean_cand, stitched_ocr_lines,
                                        stitched_word_contains_invoice_no):
                    backup_result_invoice_number["Invoice Number"] = dict({
                        "value":
                        clean_cand["text"],
                        "pts":
                        clean_cand["pts"]
                    })

                    if debug:
                        return backup_result_invoice_number, 'output from level 1 pruning where MULTIPLE candidates were found'

                    return backup_result_invoice_number

    print("pruning - level 2, looking below")
    cleaned_possible_candidates = []
    for item in possible_candidates:
        text = item["text"]
        pts = item["pts"]
        font_size = len(text) / ((pts[2] - pts[0]))
        print(text)
        split_text = text.split()

        if (("invoice" in text.lower()) or ("bill" in text.lower()) or
            ("inv" in text.lower())) and all(
                [ex not in text.lower() for ex in exclusions]):
            print("Looking for word below")
            word_below = all_possible_below(
                {
                    "text": item["text"],
                    "pts": item["pts"]
                }, stitched_contours_json["lines"])
            print("Foundd ")
            cleaned_possible_candidates.append({
                "text": word_below["text"],
                "pts": word_below["pts"]
            })

    print('sec_cleaned_possible_candidates >>')
    print(cleaned_possible_candidates)
    # remove FP
    print("remove FP")
    backup_result_invoice_number = dict()

    if len(cleaned_possible_candidates) == 1:
        print("checking inv_num in ", cleaned_possible_candidates[0])

        if not check_inv_num_FP(cleaned_possible_candidates[0],
                                stitched_ocr_lines,
                                stitched_word_contains_invoice_no):
            backup_result_invoice_number["Invoice Number"] = dict({
                "value":
                cleaned_possible_candidates[0]["text"],
                "pts":
                cleaned_possible_candidates[0]["pts"]
            })
            if debug:
                return backup_result_invoice_number, 'output from level 2 pruning where only ONE candidate was found'
            return backup_result_invoice_number

    else:
        print("checking inv_num in multiple candidates")
        for cleaned_possible_candidate in cleaned_possible_candidates:
            #FIXME
            # score needs to be included here to select the corrrect candidate

            if not check_inv_num_FP(cleaned_possible_candidate,
                                    stitched_ocr_lines,
                                    stitched_word_contains_invoice_no):
                backup_result_invoice_number["Invoice Number"] = dict({
                    "value":
                    cleaned_possible_candidate["text"],
                    "pts":
                    cleaned_possible_candidate["pts"]
                })
                if debug:
                    return backup_result_invoice_number, 'output from level 2 pruning where MULTIPLE candidates were found'

                return backup_result_invoice_number

    # last resort any inv type - which is present first in the ocr
    print("TRYING LAST RESORT")
    last_resort = []
    for cntr in ocr_for_inv_num:
        wd_ = cntr["text"].lower()
        special_char, alpha_, digs_, num = 0, 0, 0, ''
        for char in wd_:
            if ord(char) >= 48 and ord(char) <= 57 or char in [',', '.', '-']:
                digs_ += 1
                num += char
            elif ord(char) >= 65 and ord(char) <= 90:
                alpha_ += 1
            elif ord(char) >= 97 and ord(char) <= 122:
                alpha_ += 1
            else:
                special_char += 1
        print(special_char, alpha_, digs_)
        if (alpha_) > 0 and (digs_) > 0 and not (special_char) > 0:
            last_resort.append(cntr)
        elif (alpha_) > 0 and (digs_) > 0 and (special_char) > 0:
            last_resort.append(cntr)
        elif (alpha_) > 0 and (special_char) > 0:
            last_resort.append(cntr)

    print('when stitched contours fails')

    allowed_invoice_words = ['invoice', 'nvoice']
    allowed_number_word = ['no', 'number']
    backup_result_invoice_number = dict()
    for line in stitched_ocr_lines:
        for idx, word in enumerate(line):

            try:
                if any([
                        word["text"].lower() in x.lower()
                        for x in allowed_invoice_words
                ]) and any([
                        word[idx + 1]["text"].lower() in x.lower()
                        for x in allowed_number_word
                ]):
                    print("FOUND INVOICE NUMBER", word["text"],
                          line[idx + 1]["text"])
                    print("INVOICE NUMBER", line[idx + 2]["text"])
                    backup_result_invoice_number["Invoice Number"] = dict({
                        "value":
                        line[idx + 2]["text"],
                        "pts":
                        line[idx + 2]["pts"]
                    })
                    if debug:
                        return backup_result_invoice_number, 'output when stitched contours fails'

                    return backup_result_invoice_number
            except:
                print('invoice number : {inv number} format not found')

    allowed_invoice_words = [
        'invoice', 'nvoice', 'inv', 'bill', 'no', 'number'
    ]
    backup_result_invoice_number = dict()
    for line in ocr_for_inv_num:

        recursive_pruned_inv_num = get_inv_number(line,
                                                  allowed_invoice_words,
                                                  used_words=[])
        if recursive_pruned_inv_num is not None and recursive_pruned_inv_num[
                'pts'] != 0:
            backup_result_invoice_number["Invoice Number"] = dict({
                "value":
                recursive_pruned_inv_num["text"],
                "pts":
                recursive_pruned_inv_num["pts"]
            })

    print(
        'when stitched contours fails and ONLY resort left of  TAX INVOICE has inv number '
    )
    allowed_first_word = ['tax']
    allowed_second_word = ['invoice', 'nvoice']
    backup_result_invoice_number = dict()
    for line in stitched_ocr_lines:
        for idx, word in enumerate(line):

            try:

                if any([
                        x.lower() in word["text"].lower()
                        for x in allowed_first_word
                ]) and any([
                        x.lower() in word["text"].lower()
                        for x in allowed_second_word
                ]):
                    print("FOUND TAX INVOICE", word["text"])
                    res = all_possible_below(word, stitched_ocr_lines)
                    if res is not None:

                        backup_result_invoice_number["Invoice Number"] = dict({
                            "value":
                            res["text"],
                            "pts":
                            res["pts"]
                        })
                        if debug:
                            return backup_result_invoice_number, 'output when stitched contours works and ONLY resort left of  TAX INVOICE has inv number '
                        else:

                            return backup_result_invoice_number

                if any([
                        word["text"].lower() in x.lower()
                        for x in allowed_first_word
                ]) and any([
                        word[idx + 1]["text"].lower() in x.lower()
                        for x in allowed_second_word
                ]):
                    print("FOUND TAX INVOICE", word["text"],
                          line[idx + 1]["text"])
                    print("INVOICE NUMBER", line[idx + 2]["text"])
                    backup_result_invoice_number["Invoice Number"] = dict({
                        "value":
                        line[idx + 2]["text"],
                        "pts":
                        line[idx + 2]["pts"]
                    })
                    if debug:
                        return backup_result_invoice_number, 'output when stitched contours fails and ONLY resort left of  TAX INVOICE has inv number '

                    return backup_result_invoice_number
            except:

                print('tax invoice : {inv number} format not found')

    print("last_resort", last_resort)

    final = []
    for lt in last_resort:
        if not check_inv_num_FP(lt, stitched_ocr_lines,
                                stitched_word_contains_invoice_no):
            print(">>>>> SUCCESS")
            final.append(lt)

    if len(final) == 1:
        print("FOUND SOMETHING IN LAST RESORT", final)
        backup_result_invoice_number["Invoice Number"] = dict({
            "value":
            final[0]["text"],
            "pts":
            final[0]["pts"]
        })
        if debug:
            return backup_result_invoice_number, 'output from last resort, only ONE option'
        return backup_result_invoice_number
    else:
        print("multiple outputs")
        print(final)
        for opt in final:
            file_name = os.path.basename(img_path).split('.jpg')[0]
            score = fuzz.ratio(file_name, opt["text"]) / 100
            print("score", score)
            if score > 0.9:
                print("FOUND SOMETHING IN USING FILENAME", opt["text"])
                backup_result_invoice_number["Invoice Number"] = dict({
                    "value":
                    opt["text"],
                    "pts":
                    opt["pts"]
                })
                if debug:
                    return backup_result_invoice_number, 'output from FOUND SOMETHING IN USING FILENAME, score > 0.9'
                return backup_result_invoice_number
            if score > 0.8:
                print("FOUND SOMETHING IN USING FILENAME", opt["text"])
                backup_result_invoice_number["Invoice Number"] = dict({
                    "value":
                    opt["text"],
                    "pts":
                    opt["pts"]
                })
                if debug:
                    return backup_result_invoice_number, 'output from FOUND SOMETHING IN USING FILENAME, score > 0.8'
                return backup_result_invoice_number
            if score > 0.78:
                print("FOUND SOMETHING IN USING FILENAME", opt["text"])
                backup_result_invoice_number["Invoice Number"] = dict({
                    "value":
                    opt["text"],
                    "pts":
                    opt["pts"]
                })
                if debug:
                    return backup_result_invoice_number, 'output from FOUND SOMETHING IN USING FILENAME, score > 0.78'
                return backup_result_invoice_number

    # result_invoice_number["Invoice Number"] = dict({"value" : invoice_number_value, "pts" : pts})
    return {}


# if __name__ == '__main__':
#     img = 'Digiserve077.jpg'
#     base_path = '/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/'
#     #After Stitching Closer Contours
#     img_path = os.path.join(base_path, "uploads", img)
#     ocr_path = os.path.join(base_path, "ALL_OCR_OUTPUT",
#                             img.split('.jpg')[0] + ".json")
#     #Original Contours
#     ocr_orig_path = os.path.join(base_path, "ALL_OCR_OUTPUT_ORIGINAL",
#                                  img.split('.jpg')[0] + ".json")
#     orig_ocr = json.load(open(ocr_orig_path))
#     stitched_ocr = json.load(open(ocr_path))
#     print(get_invoice_number(img_path, ocr_orig_path, ocr_path))

if __name__ == '__main__':
    import pandas as pd
    import os
    df_in = pd.read_csv('/home/ubuntu/BITHIKA/CustomizedInvoices/round_4.csv')

    # idx = int(sys.argv[1])
    print(
        '>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>'
    )
    print(
        '>>>>>>>>>>>>>>>>>>>>>>   STARTING >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>'
    )
    print(
        '>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>'
    )
    # print('idx', idx)
    # base_path = '/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV'

    # #After Stitching Closer Contours
    # img_path = df_in.iloc[idx]['file_paths']
    # ocr_path = df_in.iloc[idx]['ocr_stitched_paths']
    # #Original Contours
    # ocr_orig_path = df_in.iloc[idx]['ocr_orig_paths']
    # orig_ocr = json.load(open(ocr_orig_path))
    # stitched_ocr = json.load(open(ocr_path))

    # img_path, ocr_orig_path, ocr_path = [
    #     '/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/uploads/422IndoScottish-0.jpg',
    #     '/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT_ORIGINAL/422IndoScottish-0.json',
    #     '/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT/422IndoScottish-0.json'
    # ]

    img_path, ocr_orig_path, ocr_path = ['/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/uploads/Invoice-Ms.SuchitraLotekar-0.jpg',
 '/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT_ORIGINAL/Invoice-Ms.SuchitraLotekar-0.json',
 '/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT/Invoice-Ms.SuchitraLotekar-0.json']
    orig_ocr = json.load(open(ocr_orig_path))
    stitched_ocr = json.load(open(ocr_path))
    debug = True
    data = get_invoice_number(img_path, ocr_orig_path, ocr_path, debug=debug)

    print(
        '>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>'
    )
    print(
        '>>>>>>>>>>>>>>>>>>>>>>   RESULT >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>'
    )
    print(
        '>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>'
    )
    print(data)
    print(os.path.basename(img_path))

# if __name__ == '__main__':
#     import pandas as pd
#     import os
#     df_in = pd.read_csv(
#         '/home/ubuntu/BITHIKA/CustomizedInvoices/round_4.csv')
#     # df_inv_num_present = df_in[(df_in['Correct / Incorrect / Not fetched']=='FN')&(df_in['OUTPUT_FLAG'].isna() )]

#     fp_err_ = open('ERR_round_4.txt', 'a')
#     for idx, row in df_in.iterrows():
#         base_path = '/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/'
#         #After Stitching Closer Contours

#         try:
#             img_path = row['file_paths']
#             img = os.path.basename(img_path).split('.jpg')[0]
#             ocr_path = row['ocr_stitched_paths']
#             #Original Contours
#             ocr_orig_path = row['ocr_orig_paths']
#             orig_ocr = json.load(open(ocr_orig_path))
#             stitched_ocr = json.load(open(ocr_path))
#             print("img path: ", img_path)
#             print("Stictched contours: ", ocr_path)
#             print("Original Contours: ", ocr_orig_path)

#             data = get_invoice_number(img_path,
#                                       ocr_orig_path,
#                                       ocr_path,
#                                       debug=debug)
#             print(data)
#             print(
#                 'SAVING DATA AT -> /home/ubuntu/BITHIKA/CustomizedInvoices/RES_round_4/'
#                 + img + '.txt')

#             with open(
#                     '/home/ubuntu/BITHIKA/CustomizedInvoices/RES_round_4/'
#                     + img + '.txt', 'a') as fp:
#                 fp.write(str(data) + '\n')

#         except:
#             fp_err_.write(img + ' had an exception!!\n')

#     fp_err_.close()

# if __name__ == '__main__':
#     base_path = '/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV'

#     file_1 = base_path + "/uploads/Naaz008.jpg"
#     file_2 = base_path + "/uploads/jpg/electrotech226-0.jpg"
#     file_3 = base_path + "/uploads/jpg/Fern107-0.jpg"
#     file_4 = base_path + "/uploads/jpg/Fern105-0.jpg"
#     file_5 = base_path + "/uploads/jpg/Elin7384-0.jpg"
#     file_6 = base_path + "/uploads/jpg/elin7382-0.jpg"

#     img_paths =[file_1, file_2, file_3, file_4, file_5, file_6]

#     for img_path in img_paths:
#         img = os.path.basename(img_path).split('.jpg')[0]
#         print('****************')
#         print(img)
#         print('****************')

#         ocr_path = '/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT/'+ img +'.json'
#         ocr_orig_path = '/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT_ORIGINAL/'+ img +'.json'

#         data = get_invoice_number(img_path, ocr_orig_path, ocr_path)
