import os, json
import sys

sys.path.insert(1, os.getcwd() + "/date_utils/")
# sys.path.insert(1, os.getcwd() + "/date_utils/ALL_OCR_OUTPUT/")
# sys.path.insert(1, os.getcwd() + "/date_utils/ALL_OCR_OUTPUT_ORIGINAL/")

import main_cw
import main_trial_a as main_trial

def get_details_bkp(file, ocr_orig_path, ocr_path):
    cid = "62b453cc65b3c03231fb3b56"
    ends_with = file.split(".")[-1]
    doc_id = "1111"    
    print("cid, doc_id :", cid, doc_id)
    output = main_trial.extract(file, cid, ends_with.lower(), doc_id, ocr_path, ocr_orig_path, False, True)
    print("output check afterwards:", output)
    output = main_cw.get_global_dict(output, output[0].get("page_array")[0].get("jpg_path"))
    ntc = output[0].get("non_table_content")
    result_details = dict()

    print("ntc here afterwards:", ntc, output)
    
    for i in range(len(ntc)):
        item = ntc[i]
        print("item afterwards check :", item)
        key = item.get("key")
        if key == "Invoice Date" or key == "Invoice Number":
            value = item.get("value")
            pts = item.get("pts_value")
            result_details[key] = dict({"value" : value, "pts" : pts})
            # break

    return result_details

def isGreater( invObj, neoDt ):
   
    neoDt = cleanup( neoDt ) 
    print('Entering isGreater ', invObj, neoDt, len( invObj['value'] ) == len( neoDt ), invObj['value'][2:] == neoDt[2:] ) 
    if invObj['value'] is not None and len( invObj['value'] ) == len( neoDt ) and\
      invObj['value'][2:] == neoDt[2:]:
      try:
        curr_, neo_ = int( invObj['value'][:2] ), int( neoDt[:2] )
        if curr_ > neo_:
          print('No REPLACEMENT !!->', invObj['value'],' greater than neo ', neoDt )
          return False
        else:
          print('REPLACEMENT !!->', invObj['value'],' lesser than neo ', neoDt )
          return True
      except:
          return True 
    
    return True

def cleanup( wd_ ):
    
    if 'Date' in wd_:  wd_ = ( (wd_.split('Date'))[1] ).replace(' ','')
    if 'dated' in wd_.lower():  wd_ = ( (wd_.lower().split('dated'))[1] ).replace(' ','')
    if '-' == wd_[0]: wd_ = wd_[1:]
    if 'Dt:-' in wd_:  wd_ = ( (wd_.split('Dt:-'))[1] ).replace(' ','')
    if 'DT:-' in wd_:  wd_ = ( (wd_.split('DT:-'))[1] ).replace(' ','')
    if 'invoice' in wd_.lower():  wd_ = ( (wd_.lower().split('invoice'))[1] ).replace(' ','')
    if '2021' in wd_: return ( (wd_.split('2021'))[0]+'2021' ).replace(' ','').replace(':','').replace(';','').replace('O','0')
    if '2022' in wd_: return ( (wd_.split('2022'))[0]+'2022' ).replace(' ','').replace(':','').replace(';','').replace('O','0') 
    if '2023' in wd_: return ( (wd_.split('2023'))[0]+'2023' ).replace(' ','').replace(':','').replace(';','').replace('O','0') 
    if len(wd_.split()) > 2 and len(wd_.split()[0]) > 5: wd_ = ' '.join( wd_.split()[1:] ) 
    return wd_.replace(':','').replace(';','').replace(' ','').replace('O','0').replace('d','')

def get_details( fnm, orig_, src_ ):
    
    print("Input to get_details :", fnm, orig_, src_)
    
    deets_ = get_details_bkp( fnm, orig_, src_ )
    
    file_name_original = ".".join(fnm.split("/")[-1].split(".")[:-1])
    base_code_storage_path = os.getcwd() + "/OUTPUT_V2/" + file_name_original + ".json"
        
    with open(base_code_storage_path, "w") as f:    
        json.dump(dict({"response" : deets_}), f)
    
    if "Invoice Date" in deets_:    
      pot_dt_val_ = deets_["Invoice Date"]['value']
      dot_arr_, slash_arr_, dash_arr_ = pot_dt_val_.split('.'), pot_dt_val_.split('/'), pot_dt_val_.split('-')
    else:
      pot_dt_val_ = None
      

    '''
    if ( len( deets_["Invoice Date"]['value'] ) < 8 or len( deets_["Invoice Date"]['value'] ) > 14 ) or \
      ( '.' in pot_dt_val_ and len( dot_arr_ ) < 3 ) or ( '/' in pot_dt_val_ and len( slash_arr_ ) < 3 ) or\
      ( '-' in pot_dt_val_ and len( dash_arr_ ) < 3 ) or not\
      ( ord(pot_dt_val_[0]) >= 48 and ord(pot_dt_val_[0]) <= 57 ): 
    '''
    print('MOFO-> deets_ ', deets_)
    if 'Invoice Number' in deets_ and deets_['Invoice Number']["pts"] is not None and deets_['Invoice Number']["pts"][1] < 1000 and deets_['Invoice Number']["pts"][0] > 100  and deets_['Invoice Number']['value'] is not None and 'e - Way Bill' not in deets_['Invoice Number']['value'] and pot_dt_val_ is not None and '2022' not in deets_['Invoice Number']['value'] and '2023' not in deets_['Invoice Number']['value'] and not 'www' in deets_['Invoice Number']['value'] and not '2021' in pot_dt_val_ and not '2022' in pot_dt_val_ and not '2023' in pot_dt_val_: 
      print('Mostly incoming dt->',  deets_, ' is FP ')
      # find potential dates around invoice number  
      inv_co_ords_ = deets_["Invoice Number"]["pts"]

      with open( src_ , 'r' ) as fp:
        jsn_ = json.load( fp )
     
      print('IMG PATH->', jsn_['path'])
      for line_ in jsn_['lines']:
        for wd_ in line_:
          if abs( wd_['pts'][1] - inv_co_ords_[1] ) <= 100 and len(wd_['text']) > 2:
            print('Evaluating ....',wd_)
            if 'PO' in wd_['text'] and 'date' in wd_['text'].lower(): continue
            if '-' in wd_['text']:
              tmp_, prev = '', ''
              for char in wd_['text']:
                if prev == '-' and char == ' ': continue
                tmp_ += char
                prev = char 
              print('Evaluating2 ....',tmp_)
              wd_['text'] = tmp_

            split_arr_ = wd_['text'].split()
            txt_ = wd_['text'].lower()
            for pot_dt_ in split_arr_:
              if ( '19' in pot_dt_[-2:] or '20' in pot_dt_[-2:] or '21' in pot_dt_[-2:] or '22' in pot_dt_[-2:] or\
                '23' in pot_dt_[-2:] ):
                #if ( '-' in wd_['text'] and '/' in wd_['text'] ) or '(' in wd_['text'] or ')' in wd_['text'] or\
                #  ( wd_['pts'][1] < inv_co_ords_[1] and inv_co_ords_[1] - wd_['pts'][1] > 50 ): continue
                print('Cocaine->', wd_['pts'][1] < inv_co_ords_[1] , ( inv_co_ords_[1] - wd_['pts'][1] > 80 ) )
                if wd_['pts'][1] < inv_co_ords_[1] and ( inv_co_ords_[1] - wd_['pts'][1] > 80 or\
                   abs( inv_co_ords_[0] - wd_['pts'][0] ) > 500 ): continue
                print('Potential date ?', split_arr_, pot_dt_, wd_['pts'], wd_['text'])

                if len( wd_['text'].split('-') ) == 3 or 'date' in txt_[:4]:
                  if 'jan' in txt_ or 'feb' in txt_ or 'mar' in txt_ or 'apr' in txt_ or 'may' in txt_ or \
                    'jun' in txt_ or 'jul' in txt_ or 'aug' in txt_ or 'sep' in txt_ or 'oct' in txt_ or \
                    'nov' in txt_ or 'dec' in txt_:
                    print('1.1', wd_, abs( deets_["Invoice Date"]['pts'][1] - inv_co_ords_[1] ),\
                                      abs( inv_co_ords_[1] - wd_['pts'][1]), inv_co_ords_ )
                    if ( abs( deets_["Invoice Date"]['pts'][1] - inv_co_ords_[1] ) > \
                       abs( inv_co_ords_[1] - wd_['pts'][1] ) ) or \
                       deets_["Invoice Date"]['pts'] == inv_co_ords_ or\
                       ( deets_["Invoice Date"]['pts'][1] == inv_co_ords_[1] and \
                         deets_["Invoice Date"]['pts'][0] < inv_co_ords_[0] )  :
                      deets_["Invoice Date"] = { 'value': cleanup( wd_['text'] ), 'pts': wd_['pts'] }
                      return deets_

                if len( pot_dt_ ) > 2 and ( ( '-' in wd_['text'] and len( wd_['text'].split('-') ) == 3  ) or ( '/' in wd_['text'] and len( wd_['text'].split('/') ) == 3 ) \
                                               or ( '.' in wd_['text'] and len( wd_['text'].split('.') ) == 3 ) ):
                  try:
                      dd_mm_ = int( pot_dt_[:1] )
                  except:
                      dd_mm_ = None
                  if dd_mm_ is not None and dd_mm_ <= 31:    
                    print('1.2.0', pot_dt_, deets_["Invoice Date"]['pts'] , inv_co_ords_, len( pot_dt_ ) )
                    if ( abs( deets_["Invoice Date"]['pts'][1] - inv_co_ords_[1] ) > \
                       abs( inv_co_ords_[1] - wd_['pts'][1] ) ) or \
                       deets_["Invoice Date"]['pts'] == inv_co_ords_ or \
                       ( deets_["Invoice Date"]['pts'][1] == inv_co_ords_[1] and \
                         deets_["Invoice Date"]['pts'][0] < inv_co_ords_[0] ) or wd_['pts'][1] > inv_co_ords_[1]  :
                      if len( pot_dt_ ) <= 5:
                        deets_["Invoice Date"] = { 'value': cleanup( wd_['text'] ), 'pts': wd_['pts'] }
                      else:
                        deets_["Invoice Date"] = { 'value': cleanup( pot_dt_ ), 'pts': wd_['pts'] }
                      return deets_

                else:
                  try:
                        dd_mm_ = int( split_arr_[0] ) 
                  except:
                      dd_mm_ = None
                  if dd_mm_ is not None and dd_mm_ <= 31 and ( ( '-' in wd_['text'] and len( wd_['text'].split('-') ) == 3  ) or ( '/' in wd_['text'] and len( wd_['text'].split('/') ) == 3 ) \
                                               or ( '.' in wd_['text'] and len( wd_['text'].split('.') ) == 3 ) ):    
                    print('1.3', wd_)
                    if ( abs( deets_["Invoice Date"]['pts'][1] - inv_co_ords_[1] ) > \
                       abs( inv_co_ords_[1] - wd_['pts'][1] ) ) or \
                       deets_["Invoice Date"]['pts'] == inv_co_ords_ or\
                       ( deets_["Invoice Date"]['pts'][1] == inv_co_ords_[1] and \
                         deets_["Invoice Date"]['pts'][0] < inv_co_ords_[0] ) or wd_['pts'][1] > inv_co_ords_[1]  :
                      deets_["Invoice Date"] = { 'value': cleanup( wd_['text'] ), 'pts': wd_['pts'] }
                      return deets_
                  elif ( ( '-' in wd_['text'] and len( wd_['text'].split('-') ) == 3  ) or ( '/' in wd_['text'] and len( wd_['text'].split('/') ) == 3  ) \
                                               or ( '.' in wd_['text'] and len( wd_['text'].split('.') ) == 3 ) ):
                    print('DESP', wd_ )
                    if ( abs( deets_["Invoice Date"]['pts'][1] - inv_co_ords_[1] ) > \
                       abs( inv_co_ords_[1] - wd_['pts'][1] ) ) or \
                       deets_["Invoice Date"]['pts'] == inv_co_ords_ or\
                       ( deets_["Invoice Date"]['pts'][1] == inv_co_ords_[1] and \
                         deets_["Invoice Date"]['pts'][0] < inv_co_ords_[0] ) or wd_['pts'][1] > inv_co_ords_[1]  :
                      deets_["Invoice Date"] = { 'value': cleanup( wd_['text'] ), 'pts': wd_['pts'] }
                      return deets_

    else: # meaning invoice number is being shown in 2nd half ..doubtful case
      inv_co_ords_ = None

      with open( src_ , 'r' ) as fp:
        jsn_ = json.load( fp )
     
      podt_marker_ = None
      for line_ in jsn_['lines']:
        if inv_co_ords_ is not None: break 
        for wd_ in line_:
          if wd_['pts'][1] > 1000: continue 
          if ( ( 'invoic' in wd_['text'].lower() and not 'tax' in wd_['text'].lower() and not 'bank' in wd_['text'].lower() ) or ( 'bill' in wd_['text'].lower() and not 'party' in wd_['text'].lower()  ) or 'Reference' in wd_['text'] ) and wd_['pts'][1] >= 100:
            print('Possible INVOICE co-ord->', wd_)
            inv_co_ords_ = wd_['pts']
            break
      
      if inv_co_ords_ is not None:     
        for line_ in jsn_['lines']:
          for wd_ in line_:
            print('Evaluating ....',wd_)
            if ( 'PO' in wd_['text'] and 'date' in wd_['text'].lower() ) or \
                   ( abs( inv_co_ords_[2] - wd_['pts'][0] ) > 500 ) or \
                ( podt_marker_ is not None and abs( podt_marker_ - wd_['pts'][1] ) <= 10): 
                
                if ( 'PO' in wd_['text'] and 'date' in wd_['text'].lower() ):
                  podt_marker_ = wd_['pts'][1]
                print('SKIPPING due to ',( 'PO' in wd_['text'] and 'date' in wd_['text'].lower() ), ( abs( inv_co_ords_[2] - wd_['pts'][0] ) > 500 ), podt_marker_, wd_['pts'][1] )
                continue
            split_arr_ = wd_['text'].split()
            txt_ = wd_['text'].lower()
            for pot_dt_ in split_arr_:
              print( pot_dt_, pot_dt_[-2:] ) 
              if ( '19' in pot_dt_[-2:] or '20' in pot_dt_[-2:] or '21' in pot_dt_[-2:] or '22' in pot_dt_[-2:] or\
                '23' in pot_dt_[-2:] ) and ( len( txt_ ) <= 16 or ( 'jan' in txt_ or 'feb' in txt_ or 'mar' in txt_ or 'apr' in txt_ or 'may' in txt_ or \
                    'jun' in txt_ or 'jul' in txt_ or 'aug' in txt_ or 'sep' in txt_ or 'oct' in txt_ or \
                    'nov' in txt_ or 'dec' in txt_ or 'date' in txt_ ) ):

                if len( wd_['text'].split('-') ) == 3 or 'date' in txt_[:4]:
                  if 'jan' in txt_ or 'feb' in txt_ or 'mar' in txt_ or 'apr' in txt_ or 'may' in txt_ or \
                    'jun' in txt_ or 'jul' in txt_ or 'aug' in txt_ or 'sep' in txt_ or 'oct' in txt_ or \
                    'nov' in txt_ or 'dec' in txt_:
                    print('1.1', wd_ )
                    if ( "Invoice Date" in deets_ and abs( deets_["Invoice Date"]['pts'][1] - inv_co_ords_[1] ) > \
                       abs( inv_co_ords_[1] - wd_['pts'][1] ) ) or \
                       ( "Invoice Date" in deets_ and deets_["Invoice Date"]['pts'] == inv_co_ords_ ) or \
                       wd_['pts'][1] > inv_co_ords_[1] and isGreater( deets_["Invoice Date"], cleanup( wd_['text'] )):
                      deets_["Invoice Date"] = { 'value': cleanup( wd_['text'] ), 'pts': wd_['pts'] }
                      return deets_
                  
                print('EVAL->', pot_dt_, ( '-' in wd_['text'] and len( wd_['text'].split('-') ) == 3  ), pot_dt_[:1] )
                if len( pot_dt_ ) > 2 and ( ( '-' in wd_['text'] and len( wd_['text'].split('-') ) == 3  ) or ( '/' in wd_['text'] and len( wd_['text'].split('/') ) == 3 ) \
                                               or ( '.' in wd_['text'] and len( wd_['text'].split('.') ) == 3 ) ):
                  try:
                      dd_mm_ = int( pot_dt_[:1] )
                  except:
                      dd_mm_ = None
                  if dd_mm_ is not None and dd_mm_ <= 31:    
                    print('1.2', pot_dt_, wd_['pts'][1] > inv_co_ords_[1])
                    if ( ( "Invoice Date" in deets_ and abs( deets_["Invoice Date"]['pts'][1] - inv_co_ords_[1] ) > \
                       abs( inv_co_ords_[1] - wd_['pts'][1] ) ) or \
                       ( "Invoice Date" in deets_ and deets_["Invoice Date"]['pts'] == inv_co_ords_ ) or \
                       ( "Invoice Date" in deets_ and deets_["Invoice Date"]['pts'][1] == inv_co_ords_[1] and \
                         deets_["Invoice Date"]['pts'][0] < inv_co_ords_[0] ) or\
                       wd_['pts'][1] > inv_co_ords_[1] ) and isGreater( deets_["Invoice Date"], cleanup( wd_['text'] )):
                      
                      print('GHOULISH->', pot_dt_) 
                      if len( pot_dt_ ) <= 5:
                        deets_["Invoice Date"] = { 'value': cleanup( wd_['text'] ), 'pts': wd_['pts'] }
                      else:
                        deets_["Invoice Date"] = { 'value': cleanup( pot_dt_ ), 'pts': wd_['pts'] }
                      return deets_

                else:
                  try:
                        dd_mm_ = int( split_arr_[0] ) 
                  except:
                      dd_mm_ = None
                  if dd_mm_ is not None and dd_mm_ <= 31 and ( ( '-' in wd_['text'] and len( wd_['text'].split('-') ) == 3  ) or ( '/' in wd_['text'] and len( wd_['text'].split('/') ) == 3 ) \
                                               or ( '.' in wd_['text'] and len( wd_['text'].split('.') ) == 3 ) ):    
                    print('1.3', wd_)
                    if ( ( "Invoice Date" in deets_ and abs( deets_["Invoice Date"]['pts'][1] - inv_co_ords_[1] ) > \
                       abs( inv_co_ords_[1] - wd_['pts'][1] ) ) or \
                       ( "Invoice Date" in deets_ and deets_["Invoice Date"]['pts'] == inv_co_ords_ ) or\
                       wd_['pts'][1] > inv_co_ords_[1] ) and isGreater( deets_["Invoice Date"], cleanup( wd_['text'] )):
                      deets_["Invoice Date"] = { 'value': cleanup( wd_['text'] ), 'pts': wd_['pts'] }
                      return deets_
                  elif ( ( '-' in wd_['text'] and len( wd_['text'].split('-') ) == 3  ) or ( '/' in wd_['text'] and len( wd_['text'].split('/') ) == 3  ) \
                                               or ( '.' in wd_['text'] and len( wd_['text'].split('.') ) == 3 ) ):
                    print('DESP', wd_ )
                    if ( ( "Invoice Date" in deets_ and abs( deets_["Invoice Date"]['pts'][1] - inv_co_ords_[1] ) > \
                       abs( inv_co_ords_[1] - wd_['pts'][1] ) ) or \
                       deets_["Invoice Date"]['pts'] == inv_co_ords_ or\
                       wd_['pts'][1] > inv_co_ords_[1] ) and isGreater( deets_["Invoice Date"], cleanup( wd_['text'] )):
                      deets_["Invoice Date"] = { 'value': cleanup( wd_['text'] ), 'pts': wd_['pts'] }
                      return deets_

    deets_["Invoice Date"] = { 'value': cleanup( deets_["Invoice Date"]['value'] ), \
                               'pts': deets_["Invoice Date"]['pts'] }
    return deets_

if __name__ == '__main__':

    src_ = '/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT/'
    orig_src_ = '/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT_ORIGINAL/'
    fnm = sys.argv[1]
    import all_inputs
    file, ocr_orig_file, ocr_st_file = all_inputs.get_inputs(fnm)
    print(get_details( file, ocr_orig_file, ocr_st_file ))
    
    # print( date_bkp( fnm, orig_src_+fnm, src_+fnm ) )
