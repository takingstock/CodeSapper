import os
import sys
import requests
import pandas as pd
import get_best_vendor_match_v2
import time
import traceback

us_state_codes = ["AL", "NE", "AK", "NV", "AZ", "NH", "AR", "NJ", "CA", "NM", "CO", "NY", "CT", "NC", "DE", "ND",
                  "DC", "OH", "FL", "OK", "GA", "OR", "HI", "PA", "ID", "PR", "IL", "RI", "IN", "SC", "IA", "SD",
                  "KS", "TN", "KY", "TX", "LA", "UT", "ME", "VT", "MD", "VA", "MA", "VI", "MI", "WA", "MN", "WV",
                  "MS", "WI", "MO", "WY", "MT"] # , "California", "CALIFORNIA", "NewYork", "NEWYORK"]

canada_state_codes = ["AB", "BC", "MB", "NB", "NL", "NT", "NS", "NU", "ON", "PE", "QC", "SK", "YT"]

extra_codes_lowercase = ["Tx", "Al", "Mo", "Ga"]

us_state_codes = us_state_codes + canada_state_codes

def contains_us_state_code(text):
    text = str(text)
    if text.strip() == "":
        # return [False, "NOOO"]
        return [False, ""]
    # text_split = text.replace("New ", "New").replace("NEW ", "NEW").replace("IL6", "IL 6").split()
    text_replaced = text.replace("IL6", "IL 6")
    # text_replaced = get_best_vendor_match_v2.state_names_to_code(text.replace("IL6", "IL 6"))
    text_split = text_replaced.split()
    
    num_flag = False
    num_count = 0
    for char in text:
        if char in "0123456789":
            num_count = num_count + 1
    if num_count >= 3:
        num_flag = True
    if num_flag or True:
        for text_iter in text_split:
            text_to_consider = text_iter.replace(",", "").replace("0", "O")
            if text_to_consider in us_state_codes:
                for us_state_code in us_state_codes:
                    if text_to_consider == us_state_code:
                        return [True, us_state_code]
                    
    # text_replaced = text.replace("IL6", "IL 6")
    text_replaced = get_best_vendor_match_v2.state_names_to_code(text.replace("IL6", "IL 6"))
    text_split = text_replaced.split()
    
    num_flag = False
    num_count = 0
    for char in text:
        if char in "0123456789":
            num_count = num_count + 1
    if num_count >= 3:
        num_flag = True
    if num_flag or True:
        for text_iter in text_split:
            text_to_consider = text_iter.replace(",", "").replace("0", "O")
            if text_to_consider in us_state_codes:
                for us_state_code in us_state_codes:
                    if text_to_consider == us_state_code:
                        return [True, us_state_code]
    
    if len(text_replaced) > 15:
        return [False, "ALL"]
    
    return [False, ""]

def split_data(df):
    print(df.count())
    df["state_code"] = df.apply(lambda x: contains_us_state_code(x['Vendor_Address'])[1], axis=1)
    return df
    
def add_address(string):
    if string in ["NO_VENDOR", "CANNOT_BE_PROCESSED"]:
        return string
    else:
        return "DEFAULT"
    
def match_vendor_columns_v2(external_sheet, df_columns):
    df_columns_match = len(df_columns) * [""]
    for i_mvc in range(len(external_sheet)):
        item_here = external_sheet[i_mvc]
        key_mapping = item_here.get("keyMapping")
        column_header = item_here.get("columnHeader")
        for j_mvc in range(len(df_columns)):
            column_here = df_columns[j_mvc]
            if column_here == column_header:                
                if key_mapping == None:
                    key_mapping = "Customer_ID"
                key_mapping = str(key_mapping).replace(" ", "_")
                df_columns_match[j_mvc] = key_mapping
                break
            
    return df_columns_match
    
def match_vendor_columns(external_sheet, df_columns):
    print("df_columns :", df_columns)
    df_columns_match = len(df_columns) * [""]
    for i_mvc in range(len(external_sheet)):
        item_here = external_sheet[i_mvc]
        key_mapping = item_here.get("keyMapping")
        column_header = item_here.get("columnHeader")
        if column_header == None:
            continue
            
        print("key_mapping :", key_mapping)
        print("column_header :", column_header)
        
        for j_mvc in range(len(df_columns)):
            column_here = df_columns[j_mvc]
            if column_here == column_header:       
                key_mapping = str(key_mapping).replace(" ", "_")
                df_columns_match[j_mvc] = key_mapping
                break
            
    return df_columns_match
    
def match_vendor_columns(external_sheet, df_columns):
    print("df_columns :", df_columns)
    df_columns_match = len(df_columns) * [""]
    for i_mvc in range(len(external_sheet)):
        item_here = external_sheet[i_mvc]
        key_mapping = item_here.get("keyMapping")
        column_header = item_here.get("columnHeader")
        if column_header == None:
            continue
            
        print("key_mapping :", key_mapping)
        print("column_header :", column_header)
        
        for j_mvc in range(len(df_columns)):
            column_here = df_columns[j_mvc]
            if column_here == column_header:       
                key_mapping = str(key_mapping).replace(" ", "_")
                df_columns_match[j_mvc] = key_mapping
                break
            
    return df_columns_match
    
static_columns_df = ["Vendor_Address", "Vendor_Name", "Customer_ID", "Vendor_ID", "Header_Table"]
    
def replace_basic(df_columns):
    global static_columns_df
    
    for i_dfc in range(len(df_columns)):
        column_here = df_columns[i_dfc]
        df_columns[i_dfc] = column_here.replace(" ", "_")
        
    columns_left = list(set(static_columns_df) - set(df_columns))
    return [df_columns, columns_left]
    
def get_hl_flag(external_sheet):
    for i_es in range(len(external_sheet)):
        item_here = external_sheet[i_es]
        key_mapping = item_here.get("keyMapping")
        if key_mapping == "Header Table":
            lineItemsVendor = item_here.get("lineItemsVendor")
            return lineItemsVendor
    return "L"
    
def download(backend_url, type_of_doc, suffix = "", tenant_id = "", external_sheet = []):
    return None
    # backend_url = "https://idpscaler.amygbserver.in"
    # url = backend_url + "/downloads/vendorList2023-02-16 15:21::00.xlsx"
    # dls = "http://www.muellerindustries.com/uploads/pdf/UW SPD0114.xls"
    
    generic_flag = True
    if type_of_doc.lower() in ["invoices custom", "bol", "so", "statements", "mh bol"]:
        generic_flag = False
        
    url = backend_url + "/downloads/bolVendorListLatest.xlsx"
    if type_of_doc.lower() == "invoices custom":
        url = backend_url + "/downloads/vendorListLatest.xlsx"
    elif type_of_doc.lower() == "bol":
        url = backend_url + "/downloads/bolVendorListLatest.xlsx"
    elif type_of_doc.lower() == "so":
        url = backend_url + "/downloads/soVendorListLatest.xlsx"
    elif type_of_doc.lower() == "statements":
        url = backend_url + "/downloads/statementVendorListLatest.xlsx"
    elif type_of_doc.lower() == "mh bol":
        url = backend_url + "/downloads/mhBolVendorListLatest.xlsx"
    else:
        # Change This
        # url = backend_url + "/downloads/statementVendorListLatest.xlsx"
        # url = backend_url + "/downloads/" + type_of_doc.replace(" ", "_") + "_" + tenant_id + "_" + "VendorListLatest.xlsx"
        url = backend_url + "/downloads/" + type_of_doc.replace(" ", "_") + "_" + tenant_id + "_" + "VendorListLatest.csv"
        
    print("url for excel download :", url)
    resp = None
    try:
        resp = requests.get(url)
    except:
        traceback.print_exc()
        print("Sleeping for 5 seconds")
        print("Failure at step 1 for fetching vendor list :", url)
        time.sleep(5)
        resp = requests.get(url)
    
    if generic_flag:
        excel_read_write_path = 'all_vendor_list_raw' + suffix + '.csv'
    else:
        excel_read_write_path = 'all_vendor_list_raw' + suffix + '.xlsx'
    
    with open(excel_read_write_path, 'wb') as f:
        f.write(resp.content)
        
    # df = pd.read_excel("all_vendor_list_raw.xlsx", engine = 'openpyxl', sheet_name = 'vendors')
    
    if generic_flag:
        df = pd.read_csv(excel_read_write_path, dtype = object)
        ordered_columns, columns_left = replace_basic(list(df.columns))
        df.columns = ordered_columns

        for i_cl in range(len(columns_left)):
            column_to_add = columns_left[i_cl]
            if column_to_add == "Header_Table":
                hl_flag = get_hl_flag(external_sheet)
                df[column_to_add] = hl_flag
                
            if column_to_add in ["Vendor_Name", "Vendor_Address"]:
                df[column_to_add] = df.apply(lambda x: add_address(x[2]), axis=1)
                
        df = df[["Customer_ID", "Vendor_ID", "Vendor_Name", "Vendor_Address", "Header_Table"]]

        ##############################
        """ordered_columns = match_vendor_columns(external_sheet, df.columns)
        print("ordered_columns :", ordered_columns)
        # time.sleep(30)
        df.columns = ordered_columns
        
        if len(ordered_columns) == 3:
            if "Vendor Address" in ordered_columns:
                df = df[["Customer_ID", "Vendor_ID", "Vendor_Address"]]
                df["Vendor_Name"] = df.apply(lambda x: add_address(x[2]), axis=1)
            else:
                df = df[["Customer_ID", "Vendor_ID", "Vendor_Name"]]
                df["Vendor_Address"] = df.apply(lambda x: add_address(x[2]), axis=1)                
                
        df = df[["Customer_ID", "Vendor_ID", "Vendor_Name", "Vendor_Address"]]"""
        ##############################
    else:
        df = pd.read_excel(excel_read_write_path, engine = 'openpyxl',
                           sheet_name = 'Sheet1',
                           header = None,
                           dtype = object)
        
        if len(df.columns) == 3:
            if type_of_doc.lower() == "so":
                df["V_A"] = df.apply(lambda x: add_address(x[2]), axis=1)

        if len(df.columns) == 4:
            df["H_L"] = "L"
            if type_of_doc.lower() in ["invoices custom", "mh bol"]:
                df["H_L"] = "H"

        df.columns = ["Customer_ID", "Vendor_ID", "Vendor_Name", "Vendor_Address", "Header_Table"]
        # print(list(df.columns))

    df1 = df[["Customer_ID", "Vendor_ID", "Vendor_Name", "Vendor_Address", "Header_Table"]]
    
    df2 = df1
    df3 = df2
    # df2 = df1[((df1["Vendor_ID"] != "NO_VENDOR") & 
    #            (df1["Vendor_Name"] != "NO_VENDOR") & 
    #            (df1["Vendor_Address"] != "NO_VENDOR"))]
    # df3 = df2[((df2["Vendor_ID"] != "CANNOT_BE_PROCESSED") & 
    #            (df2["Vendor_Name"] != "CANNOT_BE_PROCESSED") & 
    #            (df2["Vendor_Address"] != "CANNOT_BE_PROCESSED"))]
    df3['Vendor_Address'] = df3['Vendor_Address'].fillna("")
    df3['Vendor_ID'] = df3['Vendor_ID'].fillna("")
    df3['Vendor_Name'] = df3['Vendor_Name'].fillna("")
    df3['Header_Table'] = df3['Header_Table'].fillna("")
    
    df4 = df3.dropna()
    df5a = df4[((df4["Customer_ID"] != ""))]
    df5 = df5a[((df5a["Vendor_ID"] != "") | (df5a["Vendor_Name"] != "") | (df5a["Vendor_Address"] != ""))]
    
    df7 = split_data(df5)
    
    # df8 = df7[df7["state_code"] != "NOOO"]
    # df9 = df8[df8["state_code"] != ""]    
    
    df8 = df7
    df9 = df8    
    
    df10 = df9.drop_duplicates().astype(str)
    df11 = df10.reset_index(drop = True)
    
    # df12 = df11[["Customer_ID", "Vendor_ID", "Vendor_Name", "Vendor_Address", "state_code"]]
    # df12.columns = ["Customer_ID", "Code", "Name", "Address", "state_code"]
    
    df12 = df11[["Customer_ID", "Vendor_ID", "Vendor_Name", "Vendor_Address", "state_code", "Header_Table"]]
    df12.columns = ["Customer_ID", "Code", "Name", "Address", "state_code", "Header_Table"]
    
    path_to_write_df = os.getcwd() + "/all_vendor_details_latest.csv"
    df12.to_csv(path_to_write_df, index = False)
    print(df12.count())
    print("All Vendor List Done & Downloaded!")
    # return path_to_write_df
    return df12
