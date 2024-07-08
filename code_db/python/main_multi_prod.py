# "DEV", "PROD" or "TRIAL"
ENV = "SCALAR"

import os
import sys
import json
import traceback

# os.environ['OMP_THREAD_LIMIT'] = '1'

with open(os.getcwd() + "/master_config.json") as f:
    master_config = json.load(f)
    
# Whether fresh OCR should be done on every file    
fresh_flag = master_config.get("fresh_flag")

# Whether table content should be output or not
include_table = master_config.get("include_table")

# Whether oreintation of the image (jpg) be done or not
orientation_flag = master_config.get("orientation_flag")

# Which strategy to use for clustering documents
cluster_strategy = master_config.get("cluster_strategy")

import socket

hostname = socket.gethostname()
ip_address = socket.gethostbyname(hostname)

try:
    from requests import get
    ip = get('https://api.ipify.org', timeout = 5).content.decode('utf8')
    print("IP from IPIFY :", ip)
except:
    traceback.print_exc()
    try:
        from requests import get
        ip = get('https://checkip.amazonaws.com', timeout = 5).text.strip()
        print("IP from AWS :", ip)
    except:
        traceback.print_exc()
        ip = "NOT_DEFINED"
        print("NO IP Found :", ip)
    
# if ip_address == "10.13.0.5":
#     ENV = "STAGING"
if ip == "20.219.63.206":
    ENV = "STAGING"
elif ".".join(ip_address.split(".")[:-1]) == "162.31.32":    
    ENV = "MARK_INFRA_STAGING"
elif ".".join(ip_address.split(".")[:-1]) == "162.31.18":
    ENV = "MARK_INFRA_PROD"
else:
    ENV = "SCALAR"
    
print("ENV :", ENV)
print("ENV defined")

config_dict = {"SCALAR" : [7035, "http://10.0.8.154:4009"],
               "STAGING" : [7035, "https://aldstaging.amygbserver.in/"],#"https://requordit-staging.amygbserver.in"],
               "MARK_INFRA_PROD" : [7035, "http://162.31.17.199:4009"],
               "MARK_INFRA_STAGING" : [7035, "http://162.31.4.92:4009"]}

port = config_dict.get(ENV)[0]
backend_platform_url = config_dict.get(ENV)[1]

print("Entering Main")
print("Key Value Pairs & Table")

import traceback
import subprocess

import requests
from flask import Flask, redirect, url_for, request, render_template, jsonify, send_from_directory, send_file
from flask_cors import CORS, cross_origin
from werkzeug.utils import secure_filename
from werkzeug.exceptions import BadRequestKeyError
from fuzzywuzzy import fuzz
from fuzzywuzzy import process
import random
import uuid
import time
# from PyPDF2 import PdfFileReader
from PyPDF2 import PdfReader, PdfWriter
from pikepdf import Pdf
import math
import random
# os.environ["OPENCV_IO_MAX_IMAGE_PIXELS"] = str(pow(2,40))
import cv2 as cv
import numpy as np
import pandas as pd
import zipfile
from datetime import date
from PIL import Image
# import qr_reader

from s3_util import S3
# import test_output
import cellExtractionV2_trial as cellExtractionV2
# import cellExtractionV2
# import test_key_value_detection
import stitch_contours_trial as stitch_contours
import inhouse_ocr_output_trial_new as inhouse_ocr_output
import pytesseract_api_v2 as pytesseract_api
import heuristic_TblDetection_trial as heuristic_TblDetection
import heuristic_TblDetection as heuristic_TblDetection_backup
import docID
import document_type_trial_new as document_type
import document_classification_backup
import mongo
# import customInvoiceHookV2
import customInvoiceMark
import clusterDocs
import address_id_generator
import domain_agnostic_orientation_correction
try:
    from pdfminer.high_level import extract_text
except:
    traceback.print_exc()

import time
import logging
from multiprocessing import Process
import vendor_list_download
import rule_3_5
import pdfRead
# import utils
import cluster_docs_generic
import real_time_application_streamlined
import get_best_vendor_match_v2
import supplier_details_only
import record_column_matching

from PIL import Image  # install by > python3 -m pip install --upgrade Pillow  # ref. https://pillow.readthedocs.io/en/latest/installation.html#basic-installation

try:
    import latest_tbl_det_multipg_v1
except:
    traceback.print_exc()
    pass

logging.basicConfig(filename='multi_page.log',
                    format='%(name)s - %(levelname)s - %(message)s',
                    level=logging.DEBUG)
logger = logging.getLogger()

try:
    import govt_id_check
except:
    traceback.print_exc()
    pass

s3_bucket = S3()

status_flag_file = "status_prod.json"
timestamp_flag_file = "timestamp_prod.json"
timestamp_flag_file_bol = "timestamp_prod_bol.json"
timestamp_flag_file_so = "timestamp_prod_so.json"
timestamp_flag_file_stat = "timestamp_prod_stat.json"
timestamp_flag_file_mhbol = "timestamp_prod_mhbol.json"
timestamp_flag_file_generic = "timestamp_prod_generic.json"

with open(status_flag_file, "w") as f:
    json.dump({"response" : False, "time" : time.time()}, f)

with open(timestamp_flag_file, "w") as f:
    json.dump({"time" : int(time.time())}, f)

with open(timestamp_flag_file_bol, "w") as f:
    json.dump({"time" : int(time.time())}, f)

with open(timestamp_flag_file_so, "w") as f:
    json.dump({"time" : int(time.time())}, f)

with open(timestamp_flag_file_stat, "w") as f:
    json.dump({"time" : int(time.time())}, f)

with open(timestamp_flag_file_mhbol, "w") as f:
    json.dump({"time" : int(time.time())}, f)
    
with open(timestamp_flag_file_generic, "w") as f:
    json.dump([], f)
    
if not os.path.exists(os.getcwd() + "/FINAL_PDF/"):
    os.makedirs(os.getcwd() + "/FINAL_PDF/")    

if not os.path.exists(os.getcwd() + "/FINAL_PDF_OCR/"):
    os.makedirs(os.getcwd() + "/FINAL_PDF_OCR/")    

if not os.path.exists(os.getcwd() + "/FINAL_PDF_OCR_GS/"):
    os.makedirs(os.getcwd() + "/FINAL_PDF_OCR_GS/")    

if not os.path.exists(os.getcwd() + "/FINAL_PDF_OCR_NTC/"):
    os.makedirs(os.getcwd() + "/FINAL_PDF_OCR_NTC/")    

if not os.path.exists(os.getcwd() + "/uploads/mix_png/"):
    os.makedirs(os.getcwd() + "/uploads/mix_png/")    

if not os.path.exists(os.getcwd() + "/uploads/png/"):
    os.makedirs(os.getcwd() + "/uploads/png/")    

if not os.path.exists(os.getcwd() + "/uploads/thumbnails/"):
    os.makedirs(os.getcwd() + "/uploads/thumbnails/")    

if not os.path.exists(os.getcwd() + "/uploads/pdftoppm_files/"):
    os.makedirs(os.getcwd() + "/uploads/pdftoppm_files/")    

if not os.path.exists(os.getcwd() + "/uploads/pdftocairo_files/"):
    os.makedirs(os.getcwd() + "/uploads/pdftocairo_files/")    

if not os.path.exists(os.getcwd() + "/ALL_OCR_OUTPUT_METADATA/"):
    os.makedirs(os.getcwd() + "/ALL_OCR_OUTPUT_METADATA/")    
    
if not os.path.exists(os.getcwd() + "/TABLE_OUTPUT/"):
    os.makedirs(os.getcwd() + "/TABLE_OUTPUT/")    

if not os.path.exists(os.getcwd() + "/uploads_split/"):
    os.makedirs(os.getcwd() + "/uploads_split/")    
    
if not os.path.exists(os.getcwd() + "/RAW_OCR_OUTPUT_ORIGINAL/"):
    os.makedirs(os.getcwd() + "/RAW_OCR_OUTPUT_ORIGINAL/")
    
if not os.path.exists(os.getcwd() + "/OCR_OUTPUT_DIFF/"):
    os.makedirs(os.getcwd() + "/OCR_OUTPUT_DIFF/")

if not os.path.exists(os.getcwd() + "/TABLE_FAILURES/"):
    os.makedirs(os.getcwd() + "/TABLE_FAILURES/")

if not os.path.exists(os.getcwd() + "/FEEDBACK/"):
    os.makedirs(os.getcwd() + "/FEEDBACK/")

if not os.path.exists(os.getcwd() + "/FEEDBACK_SUCCESS/"):
    os.makedirs(os.getcwd() + "/FEEDBACK_SUCCESS/")
    
if not os.path.exists(os.getcwd() + "/FEEDBACK_FAILURE/"):
    os.makedirs(os.getcwd() + "/FEEDBACK_FAILURE/")
    
if not os.path.exists(os.getcwd() + "/ALL_OCR_OUTPUT_ORIGINAL_FF/"):
    os.makedirs(os.getcwd() + "/ALL_OCR_OUTPUT_ORIGINAL_FF/")
    
if not os.path.exists(os.getcwd() + "/ALL_OCR_OUTPUT_FF/"):
    os.makedirs(os.getcwd() + "/ALL_OCR_OUTPUT_FF/")
    
if not os.path.exists(os.getcwd() + "/FEEDBACK_SUCCESS_KVP/"):
    os.makedirs(os.getcwd() + "/FEEDBACK_SUCCESS_KVP/")
    
if not os.path.exists(os.getcwd() + "/FEEDBACK_FAILURE_KVP/"):
    os.makedirs(os.getcwd() + "/FEEDBACK_FAILURE_KVP/")

if not os.path.exists(os.getcwd() + "/FEEDBACK_SUCCESS_COLUMN/"):
    os.makedirs(os.getcwd() + "/FEEDBACK_SUCCESS_COLUMN/")

if not os.path.exists(os.getcwd() + "/FEEDBACK_FAILURE_COLUMN/"):
    os.makedirs(os.getcwd() + "/FEEDBACK_FAILURE_COLUMN/")

if not os.path.exists(os.getcwd() + "/FEEDBACK_ALL_OCR_OUTPUT_ORIGINAL/"):
    os.makedirs(os.getcwd() + "/FEEDBACK_ALL_OCR_OUTPUT_ORIGINAL/")

if not os.path.exists(os.getcwd() + "/FEEDBACK_ALL_OCR_OUTPUT/"):
    os.makedirs(os.getcwd() + "/FEEDBACK_ALL_OCR_OUTPUT/")

if not os.path.exists(os.getcwd() + "/FEEDBACK_INPUT/"):
    os.makedirs(os.getcwd() + "/FEEDBACK_INPUT/")
    
if not os.path.exists(os.getcwd() + "/NEIGH/"):
    os.makedirs(os.getcwd() + "/NEIGH/")
    
if not os.path.exists(os.getcwd() + "/ALL_OCR_OUTPUT_FAILURES/"):
    os.makedirs(os.getcwd() + "/ALL_OCR_OUTPUT_FAILURES/")
    
host_address = "0.0.0.0"
print("port :", port)

app = Flask(__name__)
cors = CORS(app)
app.config['CORS_HEADERS'] = 'Content-Type'

# url_forward_feedback = "http://20.219.34.135:8502/processKeyValueFwdFeedback"
# url_forward_feedback_table = "http://20.219.34.135:8522/processTableFeedback"

basepath = os.path.abspath(
    subprocess.check_output("git rev-parse --show-toplevel",
                            shell=True).decode().strip())

# 0 == int
# 1 == pure string
# 2 == alphanumeric

df_master_here = vendor_list_download.download(backend_platform_url, "Invoices Custom")
df_master_here_bol = vendor_list_download.download(backend_platform_url, "BOL")
df_master_here_so = vendor_list_download.download(backend_platform_url, "SO")
df_master_here_stat = vendor_list_download.download(backend_platform_url, "Statements")
df_master_here_mhbol = vendor_list_download.download(backend_platform_url, "MH BOL")
df_dict = {}

govt_id_sync_dict = dict({
    "drivinglicence": "DL",
    "voterid": "Voter ID",
    "passport": "Passport",
    "aadhaar": "Aadhaar",
    "pan": "PAN"
})

non_table_content_static = []
with open(os.getcwd() + "/non_table_content_static.json") as f:
    non_table_content_static = json.load(f)

"""table_static_columns = ["Line Number",
                        "Part Number",
                        "Description",
                        "Quantity",
                        "UOM",
                        "Unit Price",
                        "Total Price"]"""

        
def call_with_timeout(myfunc, args=(), kwargs={}, timeout=5):
    from multiprocessing import (Process, Manager)

    def funcwrapper(p, *args, **kwargs):
        res = myfunc(*args, **kwargs)
        p["value"] = res

    with Manager() as manager:
        return_dict = manager.dict()
        task = Process(target=funcwrapper, args=(return_dict, *args))
        task.start()
        task.join(timeout=timeout)
        task.terminate()
        try:
            result = return_dict["value"]
            return result
        except:
            raise Exception("Timeout")

            
def get_num_pages(pdf_path):
    pdf = PdfReader(open(pdf_path, 'rb'), strict=False)
    return len(pdf.pages)

def get_num_pages_pikepdf(pdf_path):
    pdf_doc = Pdf.open(pdf_path)
    pdf_page_count = len(pdf_doc.pages)
    return pdf_page_count

def get_num_pages_convert(pdf_path):
    cmd = 'identify -format %n ' + pdf_path
    print(cmd)
    page_here = subprocess.run(cmd, stdout=subprocess.PIPE, check=True, shell=True).stdout.decode('utf-8')
    total_pages = get_unique_page_num(page_here)
    return total_pages
                
def get_unique_page_num(page_here):
    # Identity gives repeated page numbers, getting the unique number here
    
    len_page = len(page_here)
    page_int = int(page_here[0])
    if len_page >= 20 and len_page <= 198:
        page_int = int(page_here[:2])
    elif len_page >= 200 and len_page <= 2997:
        page_int = int(page_here[:3])
    elif len_page >= 3000:
        page_int = int(page_here[:4])
    else:
        pass
    return page_int

def get_num_pages_all(file_path):
    # Get num of pages

    total_pages = None
    # if "tif" in file_path.lower():
    #     total_pages = 1
    # if not ("jpg" in file_path or "jpeg" in file_path or "png" in file_path):
    if file_path.split(".")[-1].lower() not in ["jpg", "jpeg", "png"]:    
        pdf_path = file_path
        
        try:
            num_pages_pypdf = get_num_pages(pdf_path)
            print("num_pages_pypdf :", num_pages_pypdf)
        except:
            traceback.print_exc()
            num_pages_pypdf = 0

        try:
            num_pages_pikepdf = get_num_pages_pikepdf(pdf_path)
            print("num_pages_pikepdf :", num_pages_pikepdf)
        except:
            traceback.print_exc()
            num_pages_pikepdf = 0

        try:
            num_pages_convert = get_num_pages_convert(pdf_path)
            print("num_pages_convert :", num_pages_convert)
        except:
            traceback.print_exc()
            num_pages_convert = 0

        if num_pages_pypdf == num_pages_pikepdf == num_pages_convert:
            total_pages = num_pages_pypdf
        elif num_pages_pypdf == num_pages_pikepdf == 0:
            total_pages = num_pages_convert
        elif num_pages_pikepdf == num_pages_convert == 0:
            total_pages = num_pages_pypdf
        elif num_pages_convert == num_pages_pypdf == 0:
            total_pages = num_pages_pikepdf
        elif num_pages_pypdf == num_pages_pikepdf:
            total_pages = num_pages_pypdf
        elif num_pages_pikepdf == num_pages_convert:
            total_pages = num_pages_pikepdf
        elif num_pages_convert == num_pages_pypdf:
            total_pages = num_pages_convert
        else:
            total_pages = 0
    else:
        total_pages = 1
        
    return total_pages

def get_num_pages_all_v2(file_path):
    # Get num of pages

    total_pages = None
    if not ("jpg" in file_path or "jpeg" in file_path or "png" in file_path):
        # is_pdf = True
        pdf_path = file_path
        try:
            total_pages = get_num_pages(pdf_path)
        except:
            traceback.print_exc()
            try:
                cmd = 'identify -format %n ' + file_path
                print(cmd)
                page_here = subprocess.run(cmd, stdout=subprocess.PIPE, check=True, shell=True).stdout.decode('utf-8')
                # total_pages = int(page_here[0])
                total_pages = get_unique_page_num(page_here)
            except:
                traceback.print_exc()
                total_pages = 0

    else:
        # jpg_path = file_path
        total_pages = 1
    return total_pages


def convert_save(pdf_path, jpg_out_path, page_idx):
    # Conversion to JPG
    
    print("ip_address :", ip_address)

    dst = pdf_path.replace(" ", "").strip()
    os.rename(pdf_path, dst)
    output_file = jpg_out_path + "/" + os.path.splitext(
        os.path.basename(dst))[0]
    jpg_path = output_file + "-" + str(page_idx) + ".jpg"
    
    full_jpg_path = os.getcwd() + "/" + jpg_path
    
    try:
        # error_function()
        gs_cmd = ("gs -o " + full_jpg_path + " -sDEVICE=jpeg -dJPEGQ=90 -r300 -dPDFFitPage -dFirstPage=" +
                  str(page_idx + 1) + " -dLastPage=" + str(page_idx + 1) +
                  " " + pdf_path)
        print("gs_cmd :", gs_cmd)
        subprocess.check_output(gs_cmd, shell = True)
    except:
        traceback.print_exc()
        try:
            subprocess.check_output(
                'convert -density 300 -quality 90 -alpha remove ' + dst + "[" +
                str(page_idx) + "] " + jpg_path,
                shell=True)

            try:
                img_temp_here = cv.imread(jpg_path)
                img_temp_here_shape = img_temp_here.shape
            except:
                traceback.print_exc()
                send_response_mail_text_special(jpg_path, "Subprocess Special",
                                                ("[Try] Failed at " + 
                                                 str(time.time()) + 
                                                 " on " + str(ip_address) + 
                                                 ". Check if there is a mail from idpmailer at this time."))

        except:
            traceback.print_exc()
            try:
                subprocess.check_output('convert -quality 90 -alpha remove ' + dst +
                                        "[" + str(page_idx) + "] " + jpg_path,
                                        shell=True)

                try:
                    img_temp_here = cv.imread(jpg_path)
                    img_temp_here_shape = img_temp_here.shape
                except:
                    traceback.print_exc()
                    send_response_mail_text_special(jpg_path, "Subprocess Special",
                                                    ("[Except] Failed at " + 
                                                     str(time.time()) + 
                                                     " on " + str(ip_address) + 
                                                     ". Check if there is a mail from idpmailer at this time."))            
            except:
                traceback.print_exc()
                try:
                    jpg_path_backup_ppm = convert_save_pdftoppm_ind_v2(pdf_path, jpg_out_path, page_idx)
                    return jpg_path_backup_ppm    
                except:
                    traceback.print_exc()
                    jpg_path_backup_cairo = convert_save_pdftocairo_ind_v2(pdf_path, jpg_out_path, page_idx)
                    return jpg_path_backup_cairo

    # time.sleep(30)
    
    return jpg_path


def convert_save_mupdf(pdf_path, jpg_out_path, total_pages):
    # Conversion to JPG Backup
    print("ip_address :", ip_address)

    only_file_name = ".".join(pdf_path.split("/")[-1].split(".")[:-1])
    dst = pdf_path # .replace(" ", "").strip()
    output_file = jpg_out_path + "/" + os.path.splitext(os.path.basename(dst))[0]
    # jpg_path = output_file + "-" + str(page_idx) + ".jpg"
    png_path = os.getcwd() + "/uploads/png/" + only_file_name + "__.png" 
    
    mucmd = "mutool convert -o " + png_path + " " + dst
    subprocess.check_output(mucmd, shell=True)
    
    png_jpg_list = []
    
    for t1 in range(total_pages):
        png_path_ut = png_path.replace("__.png", "__" + str(t1 + 1) + ".png")
        jpg_path_ut = os.getcwd() + "/" + output_file + "-" + str(t1) + ".jpg"
        png2jpgcmd = "convert " + png_path_ut + " " + jpg_path_ut
        subprocess.check_output(png2jpgcmd, shell=True)
        png_jpg_list.append(jpg_path_ut)
    
    return png_jpg_list


def convert_save_pdftoppm(pdf_path, jpg_out_path, total_pages):
    # Conversion to JPG Backup
    print("ip_address :", ip_address)

    only_file_name = ".".join(pdf_path.split("/")[-1].split(".")[:-1])
    dst = pdf_path
    output_file = os.getcwd() + "/" + jpg_out_path + "/" + os.path.splitext(os.path.basename(dst))[0]
    
    if total_pages == 1:
        pdftoppm_cmd = "pdftoppm " + dst + " " + output_file + "-0 -jpeg"
        print(pdftoppm_cmd)
        subprocess.check_output(pdftoppm_cmd, shell=True)
    else:
        pdftoppm_cmd = "pdftoppm " + dst + " " + output_file + " -jpeg"
        print(pdftoppm_cmd)
        subprocess.check_output(pdftoppm_cmd, shell=True)
    
    jpg_list = []
    
    for t1 in range(total_pages):
        jpg_path_ut = output_file + "-" + str(t1) + ".jpg"
        jpg_list.append(jpg_path_ut)
    
    return jpg_list


def convert_save_pdftoppm_ind(pdf_path, jpg_out_path, pg_idx):
    # Conversion to JPG Backup
    print("ip_address :", ip_address)

    only_file_name = ".".join(pdf_path.split("/")[-1].split(".")[:-1])
    dst = pdf_path
    output_file = os.getcwd() + "/" + jpg_out_path + "/" + os.path.splitext(os.path.basename(dst))[0] + "-" + str(pg_idx)
    
    options = "-f " + str(pg_idx + 1) + " -l " + str(pg_idx + 1) + " -singlefile"
    
    pdftoppm_cmd = "pdftoppm " + options + " " + dst + " " + output_file + " -jpeg"
    print(pdftoppm_cmd)
    subprocess.check_output(pdftoppm_cmd, shell=True)
        
    final_output_file = output_file + ".jpg"    
    return final_output_file


def convert_save_pdftoppm_ind_v2(pdf_path, jpg_out_path, pg_idx):
    # Conversion to JPG Backup
    print("ip_address :", ip_address)

    only_file_name = ".".join(pdf_path.split("/")[-1].split(".")[:-1])
    dst = pdf_path
    output_file = os.getcwd() + "/" + jpg_out_path + "/" + os.path.splitext(os.path.basename(dst))[0] + "-" + str(pg_idx)
    
    options = "-f " + str(pg_idx + 1) + " -l " + str(pg_idx + 1) + " -singlefile"
    
    pdftoppm_cmd = "pdftoppm " + options + " " + dst + " " + output_file + " -jpeg"
    print(pdftoppm_cmd)
    subprocess.check_output(pdftoppm_cmd, shell=True)
        
    final_output_file = output_file + ".jpg"
    final_output_file = final_output_file.replace(os.getcwd() + "/", "")
    return final_output_file


def convert_save_pdftocairo(pdf_path, jpg_out_path, total_pages):
    # Conversion to JPG Backup
    print("ip_address :", ip_address)

    only_file_name = ".".join(pdf_path.split("/")[-1].split(".")[:-1])
    dst = pdf_path
    output_file = os.getcwd() + "/" + jpg_out_path + "/" + os.path.splitext(os.path.basename(dst))[0]
    
    if total_pages == 1:
        pdftoppm_cmd = "pdftocairo " + dst + " " + output_file + "-0 -jpeg"
        print(pdftoppm_cmd)
        subprocess.check_output(pdftoppm_cmd, shell=True)
    else:
        pdftoppm_cmd = "pdftocairo " + dst + " " + output_file + " -jpeg"
        print(pdftoppm_cmd)
        subprocess.check_output(pdftoppm_cmd, shell=True)
    
    jpg_list = []
    
    for t1 in range(total_pages):
        jpg_path_ut = output_file + "-" + str(t1) + ".jpg"
        jpg_list.append(jpg_path_ut)
    
    return jpg_list


def convert_save_pdftocairo_ind(pdf_path, jpg_out_path, pg_idx):
    # Conversion to JPG Backup
    print("ip_address :", ip_address)

    only_file_name = ".".join(pdf_path.split("/")[-1].split(".")[:-1])
    dst = pdf_path
    output_file = os.getcwd() + "/" + jpg_out_path + "/" + os.path.splitext(os.path.basename(dst))[0] + "-" + str(pg_idx)
    
    options = "-f " + str(pg_idx + 1) + " -l " + str(pg_idx + 1) + " -singlefile"
    
    pdftoppm_cmd = "pdftocairo " + options + " " + dst + " " + output_file + " -jpeg"
    print(pdftoppm_cmd)
    subprocess.check_output(pdftoppm_cmd, shell=True)
        
    final_output_file = output_file + ".jpg"    
    return final_output_file


def convert_save_pdftocairo_ind_v2(pdf_path, jpg_out_path, pg_idx):
    # Conversion to JPG Backup
    print("ip_address :", ip_address)

    only_file_name = ".".join(pdf_path.split("/")[-1].split(".")[:-1])
    dst = pdf_path
    output_file = os.getcwd() + "/" + jpg_out_path + "/" + os.path.splitext(os.path.basename(dst))[0] + "-" + str(pg_idx)
    
    options = "-f " + str(pg_idx + 1) + " -l " + str(pg_idx + 1) + " -singlefile"
    
    pdftoppm_cmd = "pdftocairo " + options + " " + dst + " " + output_file + " -jpeg"
    print(pdftoppm_cmd)
    subprocess.check_output(pdftoppm_cmd, shell=True)
        
    final_output_file = output_file + ".jpg"    
    final_output_file = final_output_file.replace(os.getcwd() + "/", "")
    return final_output_file


def convert_save_thumbnail(pdf_path, jpg_out_path, total_pages):
    # Conversion to Thumbnails
    print("ip_address :", ip_address)

    only_file_name = ".".join(pdf_path.split("/")[-1].split(".")[:-1])
    dst = pdf_path # .replace(" ", "").strip()
    # tn_path = os.getcwd() + "/uploads/thumbnails/" + only_file_name + "__thumbnail.jpg"
    tn_path = os.getcwd() + "/uploads/thumbnails/" + only_file_name + "__thumbnail.png"
    
    tncmd = "convert -auto-orient -thumbnail 500x300 " + dst + " " + tn_path
    
    try:
        subprocess.check_output(tncmd, shell=True)
    except:
        traceback.print_exc()
        if total_pages == 1:
            tncmdinner = "convert -auto-orient -thumbnail 500x300 " + dst + "[0] " + tn_path
            subprocess.check_output(tncmdinner, shell=True)
        else:
            for p1 in range(total_pages):
                tn_updated_path = os.getcwd() + "/uploads/thumbnails/" + only_file_name + "__thumbnail-" + str(p1) + ".png"
                tncmdinner = "convert -auto-orient -thumbnail 500x300 " + dst + "[" + str(p1) + "]" + " " + tn_updated_path
                subprocess.check_output(tncmdinner, shell=True)

    tn_list = []

    if total_pages == 1:
        tn_list = [tn_path]
    else:
        for t1 in range(total_pages):
            tn_ind_pages = ".".join(tn_path.split(".")[:-1]) + "-" + str(t1) + "." + tn_path.split(".")[-1]
            tn_list.append(tn_ind_pages)

    return tn_list


def convert_to_pdf(image_list, file_name, i, today, output_ext):
    # Conversion to PDF from Images
    output_ext = output_ext.lower() # .replace("tif", "tiff")
    if output_ext == "tif":
        output_ext = "tiff"

    if output_ext != "tiff":
        output_ext = "pdf"
    images = [
        # Image.open(os.getcwd() + "/uploads/jpg/" + f)
        Image.open(f)
        for f in image_list
    ]

    for iter_v2 in range(len(images)):
        image_iter_v2 = images[iter_v2]
        if image_iter_v2.mode == 'RGBA':
            print("Converting RGBA mode to RGB")
            images[iter_v2] = images[iter_v2].convert('RGB')

    # pdf_path = os.getcwd() + "/FINAL_PDF/" + file_name + "-" + str(i) + ".pdf"
    pdf_path = os.getcwd() + "/FINAL_PDF_OCR/" + file_name +  "." + output_ext.lower()
    
    images[0].save(
        pdf_path, output_ext.upper() ,resolution=100.0, save_all=True, append_images=images[1:]
    )
    
    # s3_file_path = s3_bucket.upload_file(pdf_path)
    s3_file_path = s3_bucket.upload_file_specific(pdf_path, today + "/split_pdf")

    return s3_file_path


def split_pdf_local(path_to_input_save, output_extension, start_page, end_page):
    # Splitting PDF
    output_ext = output_extension.lower() # .replace("tif", "tiff")
    doc_name = ".".join(path_to_input_save.split("/")[-1].split(".")[:-1])
    if output_ext == "tif":
        output_ext = "tiff"
    print("output_ext :", output_ext)
    if output_ext != "tiff":
        output_ext = "pdf"
    
    inputpdf = PdfReader(open(path_to_input_save, "rb"), strict=False)
    inputpdf_pages = inputpdf.pages
    print("inputpdf_pages :", inputpdf_pages)

    pdf_output_path = os.getcwd() + "/uploads_split/" + doc_name +  "." + output_ext.lower()
    
    output = PdfWriter()
    for i in range(start_page, end_page):
        output.add_page(inputpdf_pages[i])
        
    with open(pdf_output_path, "wb") as outputStream:
        output.write(outputStream)
        
    return pdf_output_path

def is_pdf_check_pdfminer(path_to_file):
    try:
        extract_text(path_to_file)
        return True
    except:
        traceback.print_exc()
        return False
    
def clean_pdf_file(pdf_output_path, pdf_output_path_gs, pdf_output_path_pdftocairo):
    corrupt_file_check = is_pdf_check_pdfminer(pdf_output_path)
    print("corrupt_file_check 2:", corrupt_file_check)
    if corrupt_file_check:
        return pdf_output_path
    else:
        gs_cmd_cr = """gs -o {0} -sDEVICE=pdfwrite -dPDFSETTINGS=/prepress {1}""".format(pdf_output_path_gs, pdf_output_path)
        print("gs_cmd_cr :", gs_cmd_cr)
        subprocess.check_output(gs_cmd_cr, shell = True)
        corrupt_file_check = is_pdf_check_pdfminer(pdf_output_path_gs)
        print("corrupt_file_check 3:", corrupt_file_check)
        if corrupt_file_check:
            # Mail
            subject = "CORRUPT_FILE_RECOVERED_GS | IDP_REQUORDIT | " + ENV
            email_body = "Ghostscript"
            # send_response_mail_text(pdf_output_path, subject, email_body)
            return pdf_output_path_gs
        else:
            pdftocairo_cmd_cr = """pdftocairo -pdf {0} {1}""".format(pdf_output_path, pdf_output_path_pdftocairo)
            print("pdftocairo_cmd_cr :", pdftocairo_cmd_cr)
            subprocess.check_output(pdftocairo_cmd_cr, shell = True)
            corrupt_file_check = is_pdf_check_pdfminer(pdf_output_path_pdftocairo)
            print("corrupt_file_check 4:", corrupt_file_check)
            if corrupt_file_check:
                # Mail
                subject = "CORRUPT_FILE_RECOVERED_PTC | IDP_REQUORDIT | " + ENV
                email_body = "PDFTOCAIRO"
                send_response_mail_text(pdf_output_path, subject, email_body)
                return pdf_output_path_pdftocairo
            else:
                # Mail
                subject = "CORRUPT_FILE_NOT_RECOVERED_DEFAULT | IDP_REQUORDIT | " + ENV
                email_body = "DEFAULT"
                send_response_mail_text(pdf_output_path, subject, email_body)
                return pdf_output_path
                
    return pdf_output_path
    
def split_pdf(path_to_save, doc_name, today, output_extension, start_page, end_page, total_pages = -1):
    # Splitting PDF
    output_ext = output_extension.lower() # .replace("tif", "tiff")
    if output_ext == "tif":
        output_ext = "tiff"
    print("output_ext :", output_ext)
    if output_ext != "tiff":
        output_ext = "pdf"

    print("quick fix :", total_pages, start_page, end_page)    
    # time.sleep(30)
        
    # if (total_pages == 1) and (start_page == 0) and (end_page == 1):
    #     s3_file_path = s3_bucket.upload_file_specific(path_to_save, today + "/split_pdf")
    #     return s3_file_path
    
    inputpdf = PdfReader(open(path_to_save, "rb"), strict=False)
    inputpdf_pages = inputpdf.pages
    print("inputpdf_pages :", inputpdf_pages)

    pdf_output_path = os.getcwd() + "/FINAL_PDF_OCR/" + doc_name +  "." + output_ext.lower()
    pdf_output_path_gs = os.getcwd() + "/FINAL_PDF_OCR_GS/" + doc_name +  "." + output_ext.lower()
    pdf_output_path_pdftocairo = os.getcwd() + "/FINAL_PDF_OCR_PTC/" + doc_name +  "." + output_ext.lower()

    output = PdfWriter()
    for i in range(start_page, end_page):
        output.add_page(inputpdf_pages[i])
        
    with open(pdf_output_path, "wb") as outputStream:
        output.write(outputStream)

    print("All Inputs CR :", pdf_output_path, pdf_output_path_gs, pdf_output_path_pdftocairo)
    
    if output_ext == "pdf":
        try:
            pdf_output_path = clean_pdf_file(pdf_output_path, pdf_output_path_gs, pdf_output_path_pdftocairo)
            print("pdf_output_path :", pdf_output_path)
        except:
            traceback.print_exc()
        
    # time.sleep(30)
        
    s3_file_path = s3_bucket.upload_file_specific(pdf_output_path, today + "/split_pdf")

    return s3_file_path


def draw_contours(result_1, jpg_path, write_path):
    return None
    result = result_1[0]
    img = cv.imread(jpg_path)
    curr_colour = [255, 0, 0]
    # curr_colour_header = [150, 75, 0]
    curr_colour_header = [0, 0, 0]
    curr_colour_vline = [0, 255, 0]
    curr_colour_hline = [0, 0, 255]

    if (result.get("cell_info") == None or result.get("cell_info") == {}):
        cv.imwrite(write_path, img)
        return None

    for keys in result["cell_info"]:
        # print(result["cell_info"], i)
        row = result["cell_info"][keys]
        for keys_inner in row:
            # print(row, j)
            dict_here = row[keys_inner]
            text = dict_here["text"]
            pts = dict_here["pts"]
            # print(pts)
            cv.rectangle(img, (pts[0], pts[1]), (pts[2], pts[3]), curr_colour,
                         6)
            cv.putText(img, str(keys), (pts[0], pts[1] - 10),
                       cv.FONT_HERSHEY_SIMPLEX, 1.5, (0, 0, 0), 4)

    for i in range(len(result["hdr_row"])):
        # print(result["cell_info"], i)
        row = result["hdr_row"][i]
        text = row["text"]
        pts = row["pts"]
        # print(pts)
        cv.rectangle(img, (pts[0], pts[1]), (pts[2], pts[3]),
                     curr_colour_header, 6)

    row_vector = result["row_vector"]
    column_vector = result["column_vector"]
    if len(row_vector) > 0 and len(column_vector) > 0:
        min_cv = min(column_vector)
        max_cv = max(column_vector)
        min_rv = min(row_vector)
        max_rv = max(row_vector)
        for r in row_vector:
            cv.line(img, (min_cv, r), (max_cv, r), curr_colour_vline, 6)
        for c in column_vector:
            cv.line(img, (c, min_rv), (c, max_rv), curr_colour_hline, 6)

    # write_path = ".".join(jpg_path.split(".")[:-1]) + "_image." + jpg_path.split(".")[-1]
    print("Write Path : ", write_path)
    cv.imwrite(write_path, img)

    # write_path = ".".join(jpg_path.split(".")[:-1]) + "_header_image." + jpg_path.split(".")[-1]
    # print("Write Path : ", write_path)
    # cv.imwrite(write_path, img)

    # return write_path
    # return Image(filename=write_path)
    return None


def get_required_list(map_customer):
    for mth in range(len(map_customer)):
        td_inner_v2 = map_customer[mth]
        for td_key in td_inner_v2:
            td_inner_v3 = td_inner_v2[td_key]
            return td_inner_v3
    return []
   
    
def convert_format(input_format):
    output_format = []
    for i_if in range(len(input_format)):
        format_here = input_format[i_if]
        local_key = ""
        key = format_here.get("key")
        value = ""
        if key in ["Vendor ID", "Vendor Name", "Vendor Address"]:
            value = "NO_VENDOR"
        confidence = 0
        page = 0
        pts_key = []
        pts_value = []
        mandatory = format_here.get("mandatory_field")
        type_here = format_here.get("data_type")
        embeds_score = 0
        
        ind_dict_item = {}
        ind_dict_item["local_key"] = local_key
        ind_dict_item["key"] = key
        ind_dict_item["value"] = value
        ind_dict_item["confidence"] = confidence
        ind_dict_item["page"] = page
        ind_dict_item["pts_key"] = pts_key
        ind_dict_item["pts_value"] = pts_value
        ind_dict_item["mandatory"] = mandatory
        ind_dict_item["type"] = type_here
        ind_dict_item["embeds_score"] = embeds_score
        
        output_format.append(ind_dict_item)
    
    return output_format
    
    
def get_required_list_index(list_input, global_key_input):
    for mth_i in range(len(list_input)):
        td_inner_v4 = list_input[mth_i]
        td_inner_v4_key = td_inner_v4["key"]
        print("td_inner_v4_key :", td_inner_v4_key)
        if td_inner_v4_key == global_key_input:
            return mth_i
    return -1


def get_full_json(output_format, height, width, page1, map_customer):
    # Format Change to Output Format
    
    key_list_input = get_required_list(map_customer)
    
    list_dict = [{}] * len(key_list_input)
    mandatory_count = 0
    mandatory_all_count = 0
    print("get_final_kvp_output : ", output_format)
    non_table_flag = True
    if (len(output_format) == 0):
        non_table_flag = False
    for i in range(len(output_format)):
        item = output_format[i]
        key_local = item[0].get("text")
        key_global = item[0].get("text_global")
        key_global_index = get_required_list_index(key_list_input, key_global)
        
        value = None
        if (type(item[1]) == dict):
            value = item[1].get("text")
        value_raw_ocr = value
        key_pts = item[0].get("pts")
        value_pts = None
        if (type(item[1]) == dict):
            value_pts = item[1].get("pts")
        # confidence = item[0].get("confidence")
        # confidence = random.randrange(80, 99, 1)
        confidence = 100
        try:
            page = int(item[1].get("page"))
        except:
            traceback.print_exc()
            page = page1
        # mandatory = True
        mandatory = item[0].get("mandatory")
        if mandatory:
            mandatory_all_count = mandatory_all_count + 1
            if ((value == None
                 or value.strip() == "")):  #  or confidence != "H"):
                mandatory_count = mandatory_count + 1
                non_table_flag = False
        type_here = item[0].get("type")
        
        if type_here.lower() == "number":
            value = clean_input(value)
        
        embeds_score = item[0].get("embeds_score")
        if type(embeds_score) not in [
                int, float, np.float64, np.float32, np.float16
        ]:
            embeds_score = 0

        if (value == None):
            embeds_score = 0
            # confidence = 0
        else:
            value = str(value).strip().strip(":").strip(";").strip(",")

        if key_local == None:
            key_local = ""
        if value == None:
            value = ""
            value_raw_ocr = ""
        if key_pts == None:
            key_pts = []
        if value_pts == None:
            value_pts = []

        confidence_threshold = 90
        
        dict_to_add = dict()
        dict_to_add["local_key"] = key_local
        dict_to_add["key"] = key_global
        dict_to_add["value"] = value
        dict_to_add["value_raw_ocr"] = value_raw_ocr
        dict_to_add["confidence"] = confidence
        dict_to_add["confidence_threshold"] = confidence_threshold
        dict_to_add["page"] = page
        dict_to_add["pts_key"] = key_pts
        dict_to_add["pts_value"] = value_pts
        dict_to_add["mandatory"] = mandatory
        dict_to_add["type"] = type_here
        dict_to_add["embeds_score"] = int(embeds_score)

        # list_dict.append(dict_to_add)
        list_dict[key_global_index] = dict_to_add
        
    mandatory_ratio = 0
    if (mandatory_all_count != 0):
        mandatory_ratio = mandatory_count / mandatory_all_count
    return [list_dict, mandatory_ratio, non_table_flag]

def change_here(list1, document_type_input):
    # Helper of ++ function

    # table_present = True
    table_present_dict = dict()
    json_result_list = []
    json_result_list_table = []
    qr_present_dict = {}
    code_present_dict = {}
    externalSheet_dict = {}
    table_id_all_list = []
    
    for i in range(len(list1)):
        json_result = dict()
        json_result_table = dict()
        json_result_table_id = dict()
        
        a1_here = list1[i]
        doc_here = a1_here['docType']
        
        print("document_type_input :", document_type_input)
        print("doc_here :", doc_here)
        
        if (document_type_input != "ANY") and (document_type_input.lower() != doc_here.lower()):
            continue
        table_present = a1_here['isTablePresent']

        try:
            qr_present = a1_here['isQrCodePresent']
        except:
            traceback.print_exc()
            qr_present = False
            
        try:
            code_present = a1_here['isBarCodePresent']
        except:
            traceback.print_exc()
            code_present = False
            
        try:
            externalSheet = a1_here['externalSheet']
        except:
            traceback.print_exc()
            externalSheet = []
        
        table_present_dict[doc_here.lower()] = table_present
        qr_present_dict[doc_here.lower()] = qr_present
        code_present_dict[doc_here.lower()] = code_present
        externalSheet_dict[doc_here.lower()] = externalSheet
        
        json_result[doc_here] = []
        
        tableHeaders = a1_here["tableHeaders"]
        table_column_list = []
        table_id_list = []
        for i_t_c in range(len(tableHeaders)):
            t_h_item_here = tableHeaders[i_t_c]["columns"]
            table_column_list.append(t_h_item_here)
            table_id_list.append(tableHeaders[i_t_c]["tableName"])
        
        # table_column_list = a1_here["columns"]
        json_result_table[doc_here] = table_column_list
        json_result_table_id[doc_here] = table_id_list
        print("table_column_list :", table_column_list)
        
        key_list = a1_here["keys"]
        
        if document_type_input.lower() == "invoices custom":
            with open("mapping.json") as f:
                json_all_temp = json.load(f)
            key_list = json_all_temp.get("keys")
        
        print("key_list :", key_list)
        # time.sleep(10)
        
        length_key_list = len(key_list)
        if length_key_list < 3:
            continue
        for j in range(len(key_list)):
            key_list_here = key_list[j]
            inner_dict = dict()
            inner_dict["key"] = key_list_here["key"]
            try:
                type_here = key_list_here["type"]
            except:
                type_here = key_list_here["dataType"]
            inner_dict["mandatory_field"] = key_list_here["isRequired"]
            type_here_to_return = 2
            if (type_here == "string"):
                type_here_to_return = 1
            elif (type_here == "number"):
                type_here_to_return = 0
            else:
                type_here_to_return = 2
            # print("json_result : ", json_result)
            inner_dict["type"] = type_here_to_return
            inner_dict["data_type"] = type_here
            inner_dict["is_table"] = table_present
            json_result[doc_here].append(inner_dict)
        json_result_list.append(json_result)
        json_result_list_table.append(json_result_table)
        table_id_all_list.append(json_result_table_id)
        print("table_id_all_list :", table_id_all_list)
        # time.sleep(30)
    return [json_result_list, 
            table_present_dict,
            json_result_list_table,
            qr_present_dict,
            code_present_dict,
            externalSheet_dict,
            table_id_all_list]

def change_format(input1, doc_id, document_type_input, flag_constant=False):
    # Get Global Mapping from Platform API
    url = backend_platform_url + "/api/v1/globalMapping/ocr?sortBy=docType&orderBy=DESC&tenantId=" + input1 # "&docId=" + doc_id

    if flag_constant or doc_id == "1111":
        url = backend_platform_url + "/api/v1/globalMapping/ocr?sortBy=docType&orderBy=DESC&tenantId=" + input1

    print("Global Mapping URL : ", url)
    # time.sleep(10)
    r = None
    r = requests.get(url)
    print("Response Global Mapping : ", r)
    json1 = None
    try:
        json1 = r.json()
        # if document_type_input.lower() == "invoices custom":
        #     with open("mapping.json") as f:
        #         json_temp = [json.load(f)]
        #         print("New Strategy")
        #     json1[0]["keys"] = json_temp[0]["keys"]
    except:
        traceback.print_exc()
        return [[], False, []]
    # print("Response Json Global Mapping : ", type(json1), json1)
    if type(json1) == dict and json1.get("statusCode") is not None:
        print("AGAIN!!!")
        return [[], False, []]
    
    print("json1 input :", json1)
    
    response1 = change_here(json1, document_type_input)
    # return [response1, json1]
    return response1


def is_intersecting(once_comp_pts, table_points):
    print("table_points, once_comp_pts : ", once_comp_pts, table_points)
    x1, y1, x2, y2 = once_comp_pts
    x3, y3, x4, y4 = table_points

    x1_iou = max(x1, x3)
    y1_iou = max(y1, y3)
    x2_iou = min(x2, x4)
    y2_iou = min(y2, y4)

    ht_iou = x2_iou - x1_iou
    wd_iou = y2_iou - y1_iou

    area_iou = max(0, ht_iou) * max(0, wd_iou)

    if ht_iou <= 0 or wd_iou <= 0:
        return False
    else:
        return True


def is_only_row(pivot_pts, compare_pts):
    pivot_y1 = pivot_pts[1]
    pivot_y2 = pivot_pts[3]
    compare_y1 = compare_pts[1]
    compare_y2 = compare_pts[3]
    max_y1 = max(pivot_y1, compare_y1)
    min_y2 = min(pivot_y2, compare_y2)
    intersection_y = max(0, min_y2 - max_y1)
    pivot_diff_y = pivot_y2 - pivot_y1
    ratio = intersection_y / (pivot_diff_y + 0.0001)
    if ratio < 0.15:
        return True
    else:
        return False


def remove_table_part(once, twice, intersection, individual, table_points):
    get_all_once_twice = []
    for i in range(len(once)):
        get_all_once_twice.append(once[i][0])
    for i in range(len(twice)):
        if twice[i][0] in get_all_once_twice:
            continue
        get_all_once_twice.append(twice[i][0])

    print("get_all_once_twice : ", get_all_once_twice)

    only_one_row = []

    for i in range(len(get_all_once_twice)):
        pivot_key = get_all_once_twice[i]
        pivot_pts = pivot_key.get("pts")
        flag_here = True
        for j in range(len(get_all_once_twice)):
            if i == j:
                continue
            compare_key = get_all_once_twice[j]
            compare_pts = compare_key.get("pts")
            is_only_row_check = is_only_row(pivot_pts, compare_pts)
            print("pivot_key, compare_key : ", pivot_key, compare_key, " = ",
                  is_only_row_check)
            if is_only_row_check:
                pass
            else:
                flag_here = False
                break
        if flag_here:
            only_one_row.append(pivot_key)

    print("only_one_row : ", only_one_row)

    counter_once = 0
    while (counter_once < len(once)):
        once_comp = once[counter_once]
        once_comp_pts = once_comp[0]["pts"]
        once_comp_text = once_comp[0]["text"]
        if (is_intersecting(once_comp_pts, table_points)
                and (once_comp[0] not in only_one_row)):
            print("once_comp : ", once_comp)
            once.remove(once_comp)
            if once_comp_text in individual:
                individual.remove(once_comp_text)
        else:
            counter_once = counter_once + 1

    counter_twice = 0
    while (counter_twice < len(twice)):
        twice_comp = twice[counter_twice]
        twice_comp_pts = twice_comp[0]["pts"]
        twice_comp_text = twice_comp[0]["text"]
        if (is_intersecting(twice_comp_pts, table_points)
                and (twice_comp[0] not in only_one_row)):
            print("twice_comp : ", twice_comp)
            twice.remove(twice_comp)
            if twice_comp_text in intersection:
                intersection.remove(twice_comp_text)
        else:
            counter_twice = counter_twice + 1

    return [once, twice, intersection, individual]


def get_full_json_special(output_format, page1):
    # Format Change to Output Format
    convert_dict_name = dict({
        "INVOICE_NUMBER": "Invoice Number",
        "INVOICE_DATE": "Invoice Date",
        "PO_NUMBER": "Purchase Order Number",
        "PO_DATE": "Purchase Order Date",
        "SUPPLIER_NAME": "Vendor Name",
        "INVOICE_TOTAL": "Total Invoice Amount",
        "INVOICE_TAX": "Total Tax Amount",
        "SUPPLIER_ADDRESS": "Vendor Address",
        "SUPPLIER_ID" : "Vendor ID",
        "INVOICE_SUB_TOTAL": "Invoice Sub Total",
        "INVOICE_FREIGHT_TOTAL": "Invoice Freight",
        "VENDOR_REG_NUM": "Vendor Registration Number",
        "ACCT_NUM": "Account Number",
        "JOB_NUM": "Job Number",
        "LOAN_NUM": "Loan Number",
        "SUB_CONTRACT_NUM": "Sub Contract Number",
        "CUSTOMER_NUMBER" : "Customer Number",
        "PAYMENT_TERMS" : "Payment Terms"
    })

    key_type_dict = dict({
        "INVOICE_NUMBER": "alphanumeric",
        "INVOICE_DATE": "date",
        "PO_NUMBER": "alphanumeric",
        "PO_DATE": "date",
        "SUPPLIER_NAME": "string",
        "INVOICE_TOTAL": "number",
        "INVOICE_TAX": "number",
        "SUPPLIER_ADDRESS": "alphanumeric",
        "INVOICE_SUB_TOTAL": "number",
        "INVOICE_FREIGHT_TOTAL": "number",
        "VENDOR_REG_NUM": "alphanumeric",
        "ACCT_NUM": "alphanumeric",
        "JOB_NUM": "alphanumeric",
        "LOAN_NUM": "alphanumeric",
        "SUB_CONTRACT_NUM": "alphanumeric",
        "CUSTOMER_NUMBER": "alphanumeric",
        "PAYMENT_TERMS": "alphanumeric"
    })

    convert_dict_order = ({"Vendor ID" : 0,
                            "Vendor Name" : 1,
                            "Vendor Address" : 2,
                            "Purchase Order Number" : 3,
                            "Job Number" : 4,
                            "Invoice Number" : 5,
                            "Invoice Date" : 6,
                            "Invoice Sub Total" : 7,
                            "Total Tax Amount" : 8,
                            "Invoice Freight" : 9,
                            "Total Invoice Amount" : 10,
                            "Account Number" : 11,
                            "Purchase Order Date" : 12,
                            "Loan Number" : 13,
                            "Sub Contract Number" : 14,
                            "Vendor Registration Number" : 15,
                            "Customer Number" : 16,
                            "Payment Terms" : 17})

    # list_dict = []
    list_dict = [dict({})] * len(convert_dict_order.keys())
    mandatory_count = 0
    mandatory_all_count = 0
    print("get_final_kvp_output : ", output_format)
    non_table_flag = True
    if (len(list(output_format.keys())) == 0):
        non_table_flag = False
    for i in output_format:
        i_here = i
        if "tabular" in i_here.lower():
            continue
        item = output_format[i]
        value_v1 = str(item.get("value"))
        value_pts_v1 = item.get("pts")
        if value_v1 == "NA":
            value_v1 = None
        if (value_pts_v1 == [0, 0, 0, 0]) or (type(value_pts_v1) != list) or (len(value_pts_v1) != 4): #  or (type(value_pts_v1[0]) != int):
            value_pts_v1 = None
        key_local = None
        i_changed = convert_dict_name.get(i_here)
        order_key_here = -1
        if i_changed != None:
            i = i_changed
            order_key_here = convert_dict_order.get(i_changed)
        key_global = i
        value = value_v1
        key_pts = None
        value_pts = value_pts_v1
        # confidence = random.randrange(90, 99, 1)
        confidence = 100
        page = item.get("pg_idx")
        if page == None:
            page = 0
        mandatory = False
        if ("invoice number" in i.lower() or "invoice date" in i.lower() or "total invoice amount" in i.lower() or
            "vendor name" in i.lower() or "vendor address" in i.lower() or "vendor id" in i.lower()):
            mandatory = True
        if mandatory:
            mandatory_all_count = mandatory_all_count + 1
            if ((value == None
                 or value.strip() == "")):  #  or confidence != "H"):
                mandatory_count = mandatory_count + 1
                non_table_flag = False
        type_here = "alphanumeric"
        type_here_changed = key_type_dict.get(i_here)
        if type_here_changed != None:
            type_here = type_here_changed
        embeds_score = random.randrange(90, 99, 1)
        if (value == None):
            embeds_score = 0
            # confidence = 0
        else:
            value = str(value).strip().strip(":").strip(";").strip(",")

        value_raw_ocr = value    
            
        if key_local == None:
            key_local = ""
        if value == None or value == "None":
            value = ""
            value_raw_ocr = ""
        if key_pts == None:
            key_pts = []
        if value_pts == None:
            value_pts = []

        feedback_applied = False    
            
        confidence_threshold = 90
        
        dict_to_add = dict()
        dict_to_add["local_key"] = key_local
        dict_to_add["key"] = key_global
        dict_to_add["value"] = value
        dict_to_add["value_raw_ocr"] = value_raw_ocr
        dict_to_add["confidence"] = confidence
        dict_to_add["confidence_threshold"] = confidence_threshold
        dict_to_add["page"] = page
        dict_to_add["pts_key"] = key_pts
        dict_to_add["pts_value"] = value_pts
        dict_to_add["mandatory"] = mandatory
        dict_to_add["type"] = type_here
        dict_to_add["embeds_score"] = int(embeds_score)
        dict_to_add["feedback_applied"] = feedback_applied

        # list_dict.append(dict_to_add)
        list_dict[order_key_here] = dict_to_add
    mandatory_ratio = 0
    if (mandatory_all_count != 0):
        mandatory_ratio = mandatory_count / mandatory_all_count
    return [list_dict, mandatory_ratio, non_table_flag]


def get_revised_lists(pg_sep, extension):
    # ocr_split_list = []
    master_ocr_path_here = []
    master_ocr_output_here = []
    master_jpg_path_here = []
    master_ocr_orig_path_here = []
    
    for i in range(len(pg_sep)):
        inner = pg_sep[i]
        list_ocr_path_here = []
        list_ocr_output_here = []
        list_jpg_path_here = []
        list_ocr_orig_path_here = []
        for j in range(len(inner)):
            inner_v2 = inner[j]
            file_name_here = ".".join(inner_v2.split("/")[-1].split(".")[:-1])
            ocr_here = None
            with open(inner_v2) as f:
                ocr_here = json.load(f)    
                
            inner_v2_base_path = os.getcwd() + "/ALL_OCR_OUTPUT/"
            inner_replaced_base_path = os.getcwd() + "/uploads/"
            if "pdf" in extension.lower() or "tif" in extension.lower():
                inner_replaced_base_path = os.getcwd() + "/uploads/jpg/"
            ocr_orig_path_base_path = os.getcwd() + "/ALL_OCR_OUTPUT_ORIGINAL/"

            # inner_replaced = inner_v2.replace("json", "jpg")
            # ocr_orig_path_here = inner_v2.replace("ALL_OCR_OUTPUT", "ALL_OCR_OUTPUT_ORIGINAL")

            list_ocr_path_here.append(inner_v2_base_path + file_name_here +
                                      ".json")
            list_ocr_output_here.append(ocr_here)
            if extension.lower() in ["jpg", "jpeg", "png"]:
                list_jpg_path_here.append(inner_replaced_base_path +
                                          file_name_here + "." + extension)
            else:
                list_jpg_path_here.append(inner_replaced_base_path +
                                          file_name_here + ".jpg")
                
            list_ocr_orig_path_here.append(ocr_orig_path_base_path +
                                           file_name_here + ".json")

        master_ocr_path_here.append(list_ocr_path_here)
        master_ocr_output_here.append(list_ocr_output_here)
        master_jpg_path_here.append(list_jpg_path_here)
        master_ocr_orig_path_here.append(list_ocr_orig_path_here)
    return [master_ocr_path_here, master_ocr_output_here, master_jpg_path_here, master_ocr_orig_path_here]


def integrate_global_kvp(global_kvp_master):
    return global_kvp_master[0]


def get_sublist_numbers(ocr_sublist):
    pg_range = []
    print("In get_sublist_numbers")
    print("ocr_sublist", ocr_sublist)
    for ocr_path in ocr_sublist:
        try:
            print("Extracted pg num is ", extract_pg_number(ocr_path))
            pg_range.append(extract_pg_number(ocr_path))
        except:
            pg_range.append(-1)

    print("Returning pg_range:", pg_range)
    return pg_range


def extract_pg_number(ocr_path):
    return int(ocr_path.split('/')[-1].split('-')[-1].split('.json')[0])


def get_hdr_text_list(hdr_item):
    hdr_list_all = []
    for m in range(len(hdr_item)):
        ind_hdr_item = hdr_item[m]
        hdr_item_here = ind_hdr_item["text"]
        hdr_list_all.append(hdr_item_here)
    return hdr_list_all
       
    
def get_global_hdr_dict(hdr_item, match_column_result_inv, table_static_columns):
    # global table_static_columns
    # print("table_static_columns_temp_v2 :", table_static_columns_temp_v2)
    table_static_columns_temp_v2 = table_static_columns[:]
    
    list_return = []
    for i in range(len(hdr_item)):
        hdr_item_here = hdr_item[i]
        text = hdr_item_here["text"]
        pts = hdr_item_here["pts"]
        if text in match_column_result_inv and text != "":
            text_global = match_column_result_inv.get(text)
            if text_global in table_static_columns_temp_v2:
                new_dict = {"text" : text_global, "pts" : pts}
                list_return.append(new_dict)
                print("text_global :", text_global)
                table_static_columns_temp_v2.remove(text_global)
            
    for q in range(len(table_static_columns_temp_v2)):
        text_global_v2 = table_static_columns_temp_v2[q]
        new_dict = {"text" : text_global_v2, "pts" : [0, 0, 0, 0]}
        list_return.append(new_dict)
    
    list_return_v3 = [{}] * len(list_return)
    
    for r1 in range(len(table_static_columns)):
        col_here_v2 = table_static_columns[r1]
        for s1 in range(len(list_return)):
            list_ind_hdr = list_return[s1]
            text_ind_hdr = list_ind_hdr.get("text")
            if text_ind_hdr == col_here_v2:
                list_return_v3[r1] = list_ind_hdr
                break
            
    return list_return_v3
    

def get_real_length_column(column_vector_item, table_points_item):
    threshold_margin = 20
    count_to_return = 0
    column_vector_item_new = []
    for i_ct in range(len(column_vector_item)):
        column_vector_ct = column_vector_item[i_ct]
        # if (table_points_item[0] <= column_vector_ct <= table_points_item[2]):
        if ((table_points_item[0] + threshold_margin) < column_vector_ct < (table_points_item[2] - threshold_margin)):    
            count_to_return = count_to_return + 1
            column_vector_item_new.append(column_vector_ct)
    return [count_to_return, column_vector_item_new]


def clean_input(num):
    if num == None:
        return ""
    num = str(num)
    num_static = num[:]
    output_num = ""
    others = False
    for char in num:
        if char in "0123456789.":
            output_num = output_num + char
        elif char == ",":
            pass
        else:
            others = True
            output_num = output_num + " "
    
    # print("output_num step 1 :", output_num)
    
    try:
        output_num_split = output_num.strip().split()
        if len(output_num_split) != 1:
            others = True
        output_num = output_num_split[0]
    except:
        traceback.print_exc()
        output_num = ""
        others = True

    # print("output_num step 2 :", output_num)

    try:
        get_num = int(output_num)
        if others == False:
            get_num = num_static
    except:
        traceback.print_exc()
        try:
            get_num = float(output_num)
            if others == False:
                get_num = num_static
        except:
            traceback.print_exc()
            get_num = ""
            
    get_num = str(get_num).replace(",", "")        
        
    return str(get_num)

def get_dt_and_th(global_column_v2, table_static_columns, datatype_columns_list, th_columns_list):
    try:
        for i_gc_v2 in range(len(table_static_columns)):
            tsc_here_v3 = table_static_columns[i_gc_v2]
            if tsc_here_v3 == global_column_v2:
                return [datatype_columns_list[i_gc_v2], th_columns_list[i_gc_v2]]
    except:
        traceback.print_exc()
        return ['alphanumeric', 50]
    
    return ['alphanumeric', 50]

def change_table_format(table_output,
                        table_static_columns,
                        datatype_columns_list = [],
                        feedback_column_dict = {},
                        th_columns_list = []):
    table = table_output
    master_table_array = []
    outermost_keys = list(table.keys())
    table_id = str(uuid.uuid4())

    table_end_flag = False
    table_start_flag = False
    col_vector_length = -1
    
    for l in range(len(outermost_keys)):
        outermost_key_here = outermost_keys[l]
        ind_item_all = table[outermost_key_here]
        
        row_vector_item = ind_item_all["row_vector"]
        column_vector_item = ind_item_all["col_vector"]
        table_points_item = ind_item_all["table_points"]
        
        if l == 0:
            # col_vector_length = len(column_vector_item)
            try:
                col_vector_length, column_vector_item = get_real_length_column(column_vector_item, table_points_item)
            except:
                traceback.print_exc()
                col_vector_length = len(column_vector_item)
        else:
            # if col_vector_length != len(column_vector_item):
            try:
                col_vector_length_temp, column_vector_item = get_real_length_column(column_vector_item, table_points_item)
            except:
                traceback.print_exc()
                col_vector_length_temp = len(column_vector_item)
            if col_vector_length == 0:
                col_vector_length = col_vector_length_temp
            if col_vector_length != col_vector_length_temp:
                # print("col_vector_length_v2 :", col_vector_length, col_vector_length_temp)
                table_end_flag = True
        
        for points_inside in table_points_item:
            if points_inside <= 0:
                # error_function()
                table_end_flag = True
                
        # print("table_points_item_v2 :", table_points_item)
        # print("table_end_flag_v2 :", table_end_flag)
            
        ind_table_flag = False
        if table_points_item in [[0,0,0,0], [], None]:
            ind_table_flag = True
            if table_start_flag == True:
                table_end_flag = True
        else:
            table_start_flag = True
            
        # print("table_end_flag_v2 :", table_end_flag)
            
        if table_end_flag or ind_table_flag:
            # print("Instant Break! :", table_end_flag, ind_table_flag)
            default_array = [{"cell_info": [],
                             "column_vector": [],
                             "row_vector": [],
                             "hdr_row": [],
                             "table_points": []}]
            master_table_array = master_table_array + default_array
            continue
        
        ind_item = ind_item_all["cell_info"]
        hdr_item = ind_item_all["hdr_info"]
        hdr_text_list = get_hdr_text_list(hdr_item)
        
        local_columns = hdr_text_list
        global_columns = table_static_columns
        
        print("local_columns :", local_columns)
        print("global_columns :", global_columns)
        
        match_column_result, dummy_a, dummy_b = document_type.match_columns(global_columns, local_columns, feedback_column_dict)
        match_column_result_inv = {v: k for k, v in match_column_result.items()}
        
        hdr_global_dict_list = get_global_hdr_dict(hdr_item, match_column_result_inv, table_static_columns)
            
        page_item = outermost_key_here
        same_page_table_array = []
        for k in range(len(ind_item)):
            # table_id = str(uuid.uuid4())
            ind_item_1 = ind_item[k]
            all_keys_here = list(ind_item_1.keys())
            cell_info_array = []
            outer_list = []
            outer_list_extra = []
            
            for i in range(len(all_keys_here)):
                key_here = all_keys_here[i]
                det_p1 = ind_item_1[key_here]
                # print("det_p1 :", det_p1)
                inner_list = []
                inner_list_extra = []
                table_static_columns_temp = table_static_columns[:]
                for key_v2 in det_p1:                    
                    value_v2 = det_p1[key_v2]
                    print("value_v2 :", key_v2, value_v2)
                    text_v2 = value_v2["text"]
                    pts_v2 = value_v2["pts"]
                    try:
                        conf_v2 = int(value_v2["confidence_score_"] * 100)
                    except:
                        conf_v2 = 100
                    
                    conf_th = 50
                    
                    if key_v2 in match_column_result_inv and key_v2 != "":
                        global_column_v2 = match_column_result_inv[key_v2]
                        dt_from_dc, th_from_dc = get_dt_and_th(global_column_v2, 
                                                               table_static_columns,
                                                               datatype_columns_list,
                                                               th_columns_list)
                        conf_th = th_from_dc
                        # print("global_column_v2 input :", global_column_v2)
                        
                        text_v3 = text_v2
                        # if global_column_v2 in ["Unit Price", "Total Price", "Quantity"]:
                        if dt_from_dc.lower() == "number":
                            text_v3 = clean_input(text_v2)
                            
                        dict_here = {"column": global_column_v2,
                                     "local_column": key_v2,
                                     "text": text_v3,
                                     "pts": pts_v2,
                                     "confidence": conf_v2,
                                     "confidence_threshold" : conf_th}
                        # print("table_static_columns_temp checker :", table_static_columns_temp)
                        table_static_columns_temp.remove(global_column_v2)
                        inner_list.append(dict_here)
                        
                    dict_here_extra = {"local_column": key_v2,
                                       "text": text_v2,
                                       "pts": pts_v2,
                                       "confidence": conf_v2}
                    inner_list_extra.append(dict_here_extra)
    
                for p in range(len(table_static_columns_temp)):
                    global_header_here_v2_temp = table_static_columns_temp[p]
                    inner_list_temp = {"text" : "",
                                       "pts" : [0, 0, 0, 0],
                                       "local_column" : "",
                                       "column" : global_header_here_v2_temp}
                    inner_list.append(inner_list_temp)
                    
                outer_list.append(inner_list)
                outer_list_extra.append(inner_list_extra)
            dict_table = {"cell_info" : outer_list,
                          "cell_info_metadata" : outer_list_extra,
                          "column_match" : match_column_result,
                          "hdr_row" : hdr_global_dict_list,
                          "hdr_row_metadata" : hdr_item,
                          "column_vector" : column_vector_item,
                          "row_vector" : row_vector_item,
                          "page" : page_item,
                          "table_id" : table_id,
                          "table_points" : table_points_item}
            same_page_table_array.append(dict_table)
        # master_table_array.append(same_page_table_array)
        master_table_array = master_table_array + same_page_table_array
        
    return master_table_array


def char_count_function_ut(lines):
    ccount = 0
    for i in range(len(lines)):
        line = lines[i]
        for j in range(len(line)):
            item = line[j]
            text = item["text"]
            ccount = ccount + len(text.strip())
    return ccount

def orientation(jpg_path):
    return_image = domain_agnostic_orientation_correction.checkForFlips(jpg_path)
    cv.imwrite(jpg_path , return_image)
    return jpg_path


def extract_text_from_pdf(pdf_path):
    text = extract_text(pdf_path)
    text_output = text.split("\x0c")
    return text_output


def get_full_json_special_generic(final_output_ntc, output_ff):
    for key1 in output_ff:
        if key1.lower() in ["vendor id", "vendor name", "vendor address"]:
            continue
        value1 = output_ff[key1]
        text_ff, pts_ff, confidence_score_ff, feedback_applied_ff, page_ff = (value1.get("text"),
                                                                              value1.get("pts"),
                                                                              value1.get("confidence_score_"),
                                                                              value1.get("replacedWithFeedback_"),
                                                                              value1.get("pgNum"))
        if text_ff in [None, "NA"] or pts_ff in [[0, 0, 0, 0], None, "NA"]:
            print("text NA for :", key1)
            continue
        else:
            for i in range(len(final_output_ntc)):
                item_here = final_output_ntc[i]
                if item_here.get("key") == key1:
                    print("Change for :", key1)
                    text_ff_raw_ocr = text_ff
                    final_output_ntc[i]["value_raw_ocr"] = text_ff_raw_ocr
                    type_to_consider = final_output_ntc[i]["type"]
                    if type_to_consider.lower() == "number":
                        text_ff = clean_input(text_ff)
                    final_output_ntc[i]["value"] = text_ff
                    final_output_ntc[i]["pts_value"] = pts_ff
                    final_output_ntc[i]["confidence"] = int(confidence_score_ff * 100)
                    final_output_ntc[i]["feedback_applied"] = feedback_applied_ff
                    try:
                        page_ff = int(page_ff)
                    except:
                        traceback.print_exc()
                        page_ff = 0
                    final_output_ntc[i]["page"] = page_ff
                    break
                else:
                    print("Nothing found for :", key1)
    return final_output_ntc

def get_only_static_columns(map_customer_table_header, document_type_input):
    dict_inner_plus = map_customer_table_header[0][document_type_input]
    
    list_datatype_dict_master = []
    
    for dict_inner in dict_inner_plus:
        list_req = []
        datatype_list = []
        cth_list = []

        for i_2 in range(len(dict_inner)):
            dict_inner_here_v3 = dict_inner[i_2]
            col_here_v2 = dict_inner_here_v3.get("key")
            dt_here_v2 = dict_inner_here_v3.get("dataType")
            list_req.append(col_here_v2)
            datatype_list.append(dt_here_v2)
            cth_list.append(50)

        list_datatype_dict = dict()
        list_datatype_dict["text"] = list_req
        list_datatype_dict["datatype"] = datatype_list
        list_datatype_dict["confidence_threshold"] = cth_list
        
        list_datatype_dict_master.append(list_datatype_dict)
    
    return list_datatype_dict_master

def columns_input_intersection(total_table_dict, table_static_columns, type_of_doc, document_type_input):
    # time.sleep(15)
    
    if document_type_input.lower() == "any" or True:
        return total_table_dict
    
    table_json_list = total_table_dict.get(type_of_doc)
    new_table_dict = []
    new_table_dict_result = {}
    
    for i_tjl in range(len(table_json_list)):
        item_tjl = table_json_list[i_tjl]
        key_tjl = item_tjl.get("key")
        if key_tjl in table_static_columns:
            new_table_dict.append(item_tjl)
            
    new_table_dict_result[type_of_doc] = new_table_dict
        
    return new_table_dict_result
    
def clear_map_customer(map_customer, table_present_dict, map_customer_table_header,
                       type_of_doc, table_static_columns, document_type_input,
                       table_id_all_list):
    
    first_part = []
    second_part = {}
    third_part = []
    fourth_part = []
    
    for imc in range(len(map_customer)):
        inner_mc_v2 = map_customer[imc]
        for key_mc_v2 in inner_mc_v2:
            if key_mc_v2 == type_of_doc:
                first_part.append(inner_mc_v2)
                break
        else:
            continue
        break
        
    for key_mc_tp in table_present_dict:
        if key_mc_v2 == type_of_doc:
            # print("second_part :", table_present_dict[key_mc_tp])
            # time.sleep(30)
            second_part[key_mc_v2] = table_present_dict[key_mc_tp]
            break
        
    for imc2 in range(len(map_customer_table_header)):
        inner_mc2_v2 = map_customer_table_header[imc2]
        for key_mc2_v2 in inner_mc2_v2:
            if key_mc2_v2 == type_of_doc:
                # print("third_part :", inner_mc2_v2)
                inner_mc2_v2_updated = columns_input_intersection(inner_mc2_v2, table_static_columns, type_of_doc, document_type_input)
                # print("third_part updated :", inner_mc2_v2_updated)
                # time.sleep(60)
                third_part.append(inner_mc2_v2_updated)
                break
        else:
            continue
        break
    
    for imc4 in range(len(table_id_all_list)):
        inner_mc2_v4 = table_id_all_list[imc4]
        for key_mc2_v4 in inner_mc2_v4:
            if key_mc2_v4 == type_of_doc:
                # fourth_part.append(inner_mc2_v4[key_mc2_v4])
                fourth_part = inner_mc2_v4[key_mc2_v4]
                break
        else:
            continue
        break
    
    return [first_part, second_part, third_part, fourth_part]

def get_feedback_column_dict(backend_platform_url, table_static_columns, type_of_doc, client_customer_id, tenant_id, address_id):
    feedback_tsc_dict = {}
    
    for i_tsc in range(len(table_static_columns)):
        tsc_here = table_static_columns[i_tsc]
        local_list_here = record_column_matching.fetch_column_matching(backend_platform_url,
                                                                       client_customer_id,
                                                                       type_of_doc,
                                                                       tsc_here,
                                                                       tenant_id,
                                                                       address_id)
        feedback_tsc_dict[tsc_here] = local_list_here
        
    return feedback_tsc_dict

def merge_all_ot(global_kvp_all):
    once_merge = []
    twice_merge = []
    intersection_merge = []
    individual_merge = []
    for i_gka in range(len(global_kvp_all)):
        global_ind_here = global_kvp_all[i_gka]
        once_gka, twice_gka, intersection_gka, individual_gka = global_ind_here
        once_merge = once_merge + once_gka
        twice_merge = twice_merge + twice_gka
        intersection_merge = intersection_merge + intersection_gka
        individual_merge = individual_merge + individual_gka
        
    return [once_merge, twice_merge, intersection_merge, individual_merge]

def get_feedback_id(output_ff):
    for i_key_ff in output_ff:
        i_value_ff = output_ff[i_key_ff]
        try:
            i_page_ff = i_value_ff.get("pgNum")
            i_doc_id = i_value_ff.get("docID")
            if (int(i_page_ff) == 0) and (i_doc_id != None):
                return str(i_doc_id)
        except:
            traceback.print_exc()
        
    return "DEFAULT_ID_2"

def get_matching_doc_number(output_ff):
    for i_key_ff in output_ff:
        try:
            i_value_ff = output_ff[i_key_ff]
            match_doc = i_value_ff.get("Matching_Doc")
            if type(match_doc) != str:
                match_doc = ""
            else:
                try:
                    if "--" in match_doc:
                        match_doc = "--".join(match_doc.split("--")[1:])
                    else:
                        pass
                except:
                    traceback.print_exc()
            match_score = i_value_ff.get("Matching_Score")
            try:
                match_score = int(match_score * 100)
            except:
                traceback.print_exc()
                match_score = 0
            return [match_doc, match_score]
        except:
            traceback.print_exc()
        
    return ["", 0]

def change_table_format_azure(table_output,
                              table_static_columns,
                              datatype_columns_list = [],
                              feedback_column_dict = {},
                              th_columns_list = [],
                              table_id_ind_here = ""):
    
    hdr_row_metadata = table_output.get("hdr_row_metadata")
    cell_info_metadata = table_output.get("cell_info_metadata")

    cell_info = cell_info_metadata.copy()
    
    global_columns = table_static_columns
    local_columns = get_hdr_text_list(hdr_row_metadata)
    match_column_result, dummy_a, dummy_b, cost_final = document_type.match_columns(global_columns, local_columns, feedback_column_dict)

    match_column_result_inv = {v: k for k, v in match_column_result.items()} 
    hdr_global_dict_list = get_global_hdr_dict(hdr_row_metadata, match_column_result_inv, table_static_columns)

    cell_info = []
    
    for i_check in range(len(cell_info_metadata)):
        cell_info_line = []
        cell_line = cell_info_metadata[i_check]
        for j_check in range(len(cell_line)):
            cell_item = cell_line[j_check]
            local_column = cell_item["local_column"]
            if local_column in match_column_result_inv:
                """cell_info_item = {"text" : cell_item.get("text"),
                                  "pts" : cell_item.get("text"),
                                  "local_column" : cell_item.get("local_column")}"""
                cell_info_item = cell_item.copy()
                cell_info_item["column"] = match_column_result_inv[local_column]
                cell_info_line.append(cell_info_item)
        cell_info.append(cell_info_line)
        
    table_output["hdr_row"] = hdr_global_dict_list
    table_output["cell_info"] = cell_info
    table_output["table_id"] = table_id_ind_here
    
    return table_output

def get_azure_details(pdf_path):
    url = "http://0.0.0.0:8080/processOKT"

    payload = {'pdf_path': pdf_path}
    files=[]
    headers = {}

    response = requests.request("POST", url, headers=headers, data=payload, files=files)
    print(response.text)
    response_json = json.loads(response.text)
    
    return response_json

def extract_v2(file,
               cid,
               extension,
               doc_id,
               doc_name_static,
               today,
               df_to_pass,
               client_customer_id,
               table_static_columns,
               document_type_input,
               map_customer_static, 
               has_external_sheet,
               remove_table=True,
               invoices_flag=False):
    # Main Extract Result Function
    # error_function()
    # time.sleep(301)
    print("Enter extract_v2 here")
    time_start_global_req_1 = time.perf_counter()
    
    # error_function()
    final_timer_ = time.time()
    
    global fresh_flag
    global include_table
    global orientation_flag
    global cluster_strategy
    
    global_runner = 0
    ocr_character_count_threshold = 200
    
    global_runner = 0
    ocr_character_count_threshold = 200
    """table_static_columns = ["Line Number",
                            "Part Number",
                            "Description",
                            "Quantity",
                            "UOM",
                            "Unit Price",
                            "Total Price"]"""

    # if document_type_input == "ANY":
    #     document_type_input = "Invoices Custom"
    
    only_file_name_original = ".".join(file.split("/")[-1].split(".")[:-1])
    
    start_time_complete = time.perf_counter()
    is_pdf = False
    jpg_path = None

    if not ("jpg" in extension or "jpeg" in extension or "png" in extension):
        is_pdf = True
        pdf_path = file
        total_pages = get_num_pages_all(pdf_path)
    else:
        jpg_path = file
        total_pages = 1

    master_ocr_output = []
    master_ocr_path = []
    master_ocr_orig_path = []
    master_jpg_path = []
    master_mix_png_path = []
    master_ind_pdf_path = []
    
    # total_pages = 1

    # print("pdf_path :", pdf_path)
    
    all_jpg_backup_list = []
    try:
        all_jpg_backup_list = convert_save_mupdf(file, os.path.join("uploads", "mix_png"), total_pages)
    except:
        traceback.print_exc()
        pass
    
    print("all_jpg_backup_list :", all_jpg_backup_list)
    
    thumbnail_jpg_list = []
    try:
        thumbnail_jpg_list = convert_save_thumbnail(file, os.path.join("uploads", "thumbnail"), total_pages)
    except:
        traceback.print_exc()
        pass
    
    print("thumbnail_jpg_list :", thumbnail_jpg_list)
    
    master_thumbnail_jpg_list = thumbnail_jpg_list

    pdf_json_path_list = []
    try:
        # pdf_json_path_list = pdfRead.pdf_to_text_all(pdf_path)
        pdf_json_path_list = call_with_timeout(pdfRead.pdf_to_text_all,
                                               args=[pdf_path],
                                               timeout=(2 * total_pages))
    except:
        traceback.print_exc()
        try:
            # pdf_json_path_list = pdfRead.pdf_to_text_all(pdf_path, True)
            pdf_json_path_list = call_with_timeout(pdfRead.pdf_to_text_all,
                                                   args=[pdf_path, True],
                                                   timeout=(2 * total_pages))
        except:
            traceback.print_exc()
            pass
    
    pdf_json_path_list_pdf_miner = []
    try:
        # pdf_json_path_list = pdfRead.pdf_to_text_all(pdf_path)
        pdf_json_path_list_pdf_miner = call_with_timeout(extract_text_from_pdf,
                                                         args=[pdf_path],
                                                         timeout=(2 * total_pages))
    except:
        traceback.print_exc()
        pass
    
    # error_function()
    
    char_count_flag_ut = False
    first_pass_ocr_ = time.time()
    jpg_path_arr_ = []
    
    time_end_global_req_1 = time.perf_counter()
    time_global_req_1 = time_end_global_req_1 - time_start_global_req_1
    print("Initial Extract 1 :", time_global_req_1)
    
    ## major change
    for i in range(total_pages):
        char_count_flag_ut = False
        if is_pdf:
            start_time_convert = time.perf_counter()
            
            try:
                jpg_path = os.getcwd() + "/" + convert_save(pdf_path, os.path.join("uploads", "jpg"), i)
            except:
                traceback.print_exc()
                format_exc = traceback.format_exc()
                return {"processStart": "FAILURE",
                        "error": "[AI]--CORRUPT_FILE_NOT_CONVERTING_TO_JPG " + format_exc,
                        "errorCode": 3}
                
            print("JPG path after conversion : ", jpg_path)
            end_time_convert = time.perf_counter()
            print("PDF to JPG conversion took " +
                  str(end_time_convert - start_time_convert) + " seconds")
            
        try:
            if orientation_flag:
                jpg_path = orientation(jpg_path)
                print("Orientation Done for :", jpg_path)
        except:
            traceback.print_exc()
            
        # time.sleep(10)    
            
        time_start_global_req_2 = time.perf_counter()
        
        s3_ind_page_pdf_link = None
        if extension.lower() == "pdf":
            try:
                s3_ind_page_pdf_link = split_pdf(pdf_path,
                                                 only_file_name_original + "-" + str(i),
                                                 today,
                                                 extension,
                                                 i,
                                                 i + 1,
                                                 total_pages)
            except:
                traceback.print_exc()
                try:
                    s3_ind_page_pdf_link = convert_to_pdf([jpg_path], 
                                          only_file_name_original + "-" + str(i),
                                          i,
                                          today,
                                          extension)
                except:
                    traceback.print_exc()
                    format_exc = traceback.format_exc()
                    return {"processStart": "FAILURE",
                             "error": "[AI]--CORRUPT_FILE_NOT_SPLITTING_PDF " + format_exc,
                             "errorCode": 6}
        else:
            try:
                s3_ind_page_pdf_link = convert_to_pdf([jpg_path], 
                                                      only_file_name_original + "-" + str(i),
                                                      i,
                                                      today,
                                                      extension)
            except:
                traceback.print_exc()
                format_exc = traceback.format_exc()
                return {"processStart": "FAILURE",
                         "error": "[AI]--CORRUPT_FILE_NOT_CONVERTING_IMAGE_TO_PDF " + format_exc,
                         "errorCode": 7}

        master_ind_pdf_path.append(s3_ind_page_pdf_link)
        
        file_name = ".".join(jpg_path.split("/")[-1].split(".")[:-1])
        ocr_path = os.getcwd() + "/ALL_OCR_OUTPUT/" + file_name + ".json"
        ocr_orig_path = os.getcwd() + "/ALL_OCR_OUTPUT_ORIGINAL/" + file_name + ".json"

        sys.stdout.flush()
        
        print("A77777777")
        ocr_here = None
        try:
            error_function()
            with open(ocr_path) as f:
                ocr_here = json.load(f)
        except:
            try:
                try:
                    mix_png_path_ut = all_jpg_backup_list[i]
                except:
                    traceback.print_exc()
                    mix_png_path_ut = jpg_path

                ind_pdf_text_output = ""
                try:
                    ind_pdf_text_output = pdf_json_path_list[i]    
                except:
                    traceback.print_exc()
                    pass

                ind_pdf_text_output_pdf_miner = ""
                try:
                    ind_pdf_text_output_pdf_miner = pdf_json_path_list_pdf_miner[i]    
                except:
                    traceback.print_exc()
                    pass

                ocr_here = inhouse_ocr_output.ProcessOCR(jpg_path).returnDump(backend_platform_url, 
                                                                              fresh_flag,
                                                                              pdf_ocr_text = ind_pdf_text_output,
                                                                              pdf_ocr_text_pm = ind_pdf_text_output_pdf_miner)
                
                lines_ut = ocr_here["lines"]
                char_count_ut = char_count_function_ut(lines_ut)
                if (char_count_ut < ocr_character_count_threshold) and (all_jpg_backup_list != []):
                    # char_count_flag_ut = True
                    # mix_png_path_ut = all_jpg_backup_list[i]
                    ocr_here_new = inhouse_ocr_output.ProcessOCR(mix_png_path_ut).returnDump(backend_platform_url)
                    
                    lines_ut_again = ocr_here_new["lines"]
                    char_count_ut_again = char_count_function_ut(lines_ut_again)
                    try:
                        if char_count_ut_again < ocr_character_count_threshold:
                            jpg_path_backup_ppm = convert_save_pdftoppm_ind(pdf_path, "uploads/pdftoppm_files", i)
                            mix_png_path_ut = jpg_path_backup_ppm
                            ocr_here_new = inhouse_ocr_output.ProcessOCR(jpg_path_backup_ppm).returnDump(backend_platform_url)
                            lines_ut_again = ocr_here_new["lines"]
                            char_count_ut_again = char_count_function_ut(lines_ut_again)

                            if char_count_ut_again < ocr_character_count_threshold:
                                jpg_path_backup_cairo = convert_save_pdftocairo_ind(pdf_path, "uploads/pdftocairo_files", i)
                                mix_png_path_ut = jpg_path_backup_cairo
                                ocr_here_new = inhouse_ocr_output.ProcessOCR(jpg_path_backup_cairo).returnDump(backend_platform_url)
                                lines_ut_again = ocr_here_new["lines"]
                                char_count_ut_again = char_count_function_ut(lines_ut_again)

                                if char_count_ut_again < ocr_character_count_threshold:
                                    char_count_flag_ut = True
                    except:
                        traceback.print_exc()
                        pass
                    
                    if char_count_flag_ut == False:
                        ocr_here = ocr_here_new
                        try:
                            cpcmd = "cp " + mix_png_path_ut + " " + jpg_path 
                            subprocess.check_output(cpcmd, shell = True)
                        except:
                            traceback.print_exc()
                            pass
                
                        try:
                            thumbnail_jpg_list[i] = jpg_path
                        except:
                            traceback.print_exc()
                            pass
                
                # ocr_here["pdf_text_output"] = ind_pdf_text_output
                
                with open(ocr_path, "w") as f:
                    json.dump(ocr_here, f)
            except:
                traceback.print_exc()
                format_exc = traceback.format_exc()
                return {"processStart": "FAILURE", "error": "[AI]--OUTPUT_ERROR " + format_exc, "errorCode": 5}

        # print("OCR output : ", ocr_here)

        master_ocr_output.append(ocr_here)
        master_ocr_path.append(ocr_path)
        master_ocr_orig_path.append(ocr_orig_path)
        master_jpg_path.append(jpg_path)
        master_mix_png_path.append(mix_png_path_ut)
        
        time_end_global_req_2 = time.perf_counter()
        time_global_req_2 = time_end_global_req_2 - time_start_global_req_2
        print("Initial Extract 2 :", time_global_req_2)

    # time.sleep(30)    
        
    print("master_jpg_path :", master_jpg_path)
    print("master_mix_png_path :", master_mix_png_path)
    first_pass_ocr_ = time.time()
        
    end_time_complete = time.perf_counter()
    time_conv_ocr = end_time_complete - start_time_complete

    global_runner = 1
    
    start_time_complete1 = time.perf_counter()
    govt_id_output = None
    '''
    try:
        govt_id_output = govt_id_check.start_bg_task(master_ocr_output)
    except:
        pass

    if (govt_id_output != None and len(govt_id_output) != len(master_ocr_output)):
        govt_id_output = None

    '''
    print("govt_id_output : ", govt_id_output)
    end_time_complete1 = time.perf_counter()
    time_govt_id = end_time_complete1 - start_time_complete1

    master_final_output = []

    splitter_json = None
    pg_sep = None

    real_file_name = ".".join(file.split("/")[-1].split(".")[:-1])
    page_splitter_path = os.getcwd() + "/multi_page_results/" + real_file_name + "-ps.json"

    start_time_page_splitter = time.perf_counter()  
    
    try:
        master_ocr_path_only_name = []
        for files_raw in master_ocr_path:
            master_ocr_path_only_name.append(files_raw.split("/")[-1])
        # pg_sep = clusterDocs.clusterDocs(master_ocr_path)
        
        len_master_ocr_path_only_name = len(master_ocr_path_only_name)
        
        # pg_sep = clusterDocs.clusterDocs(master_ocr_path_only_name)
        
        if document_type_input.lower() == "invoices custom":
            cluster_strategy = "invoice"
        
        if "invoice" in cluster_strategy:
            pg_sep = call_with_timeout(clusterDocs.clusterDocs,
                                       args=[master_ocr_path_only_name],
                                       timeout=(6 * len(master_ocr_path_only_name)))
        else:
            pg_sep = call_with_timeout(cluster_docs_generic.split_document,
                                       args=[master_ocr_path_only_name],
                                       timeout=(6 * len(master_ocr_path_only_name)))
        
        print( 'Time taken for clusterDocs->', time.time() - first_pass_ocr_, (6 * len(master_ocr_path_only_name)) )
        pg_sep_output_list_count = 0
        
        for i in range(len(pg_sep)):
            for j in range(len(pg_sep[i])):
                # ind_here_special = pg_sep[i][j]
                pg_sep[i][j] = os.getcwd() + "/ALL_OCR_OUTPUT/" + pg_sep[i][j]
                pg_sep_output_list_count = pg_sep_output_list_count + 1
                
        print("pg_sep final :", pg_sep)
        
        if len_master_ocr_path_only_name != pg_sep_output_list_count:
            error_function()
        
    except:
        traceback.print_exc()
        print("Page Splitter Exception Called")
        # time.sleep(60)
        # error_function()
        pg_sep = []
        for i_index in range(len(master_ocr_path)):
            file_pg_sep_here = master_ocr_path[i_index]
            pg_sep.append([file_pg_sep_here])

    print('FT4->', time.time() - final_timer_)
    if pg_sep == None:
        pg_sep = []
        for i_index in range(len(master_ocr_path)):
            file_pg_sep_here = master_ocr_path[i_index]
            pg_sep.append([file_pg_sep_here])
       
    end_time_page_splitter = time.perf_counter()  
    
    time_page_splitter = end_time_page_splitter - start_time_page_splitter
    
    print("Response from PAGE SPLITTER API IS ", pg_sep)
    
    master_ocr_path, master_ocr_output, master_jpg_path, master_ocr_orig_path = get_revised_lists(pg_sep, extension)

    print("USEFUL master_ocr_path: ", master_ocr_path)

    print("master_ocr_path length all :", len(master_ocr_path))
    print("master_ocr_path length all v2 :", len(master_ocr_path[0]))
    
    index_sum_here = -1
    
    global_runner = 2
    
    #FIXME
    for k in range(len(master_ocr_output)):

        print('FT5',k,'->', time.time() - final_timer_)
        global_kvp_master = []
        master_ocr_output_inner = master_ocr_output[k]
        first_pass_ocr_ = time.time()
        outer_jpg_path_orig_list = master_jpg_path[k]
        final_output = dict()
        page_array_list = []
        table_content_classic = []
        doc_type_imm = None
        all_time_doc_class_static = 0
        ocr_done = False
        s3_path_list_jpg = []
        s3_path_list_orig_ocr = []
        s3_path_list_stit_ocr = []
        output_ff_dynamic = None
        all_time_list = [time_conv_ocr, -1, -1, -1, -1]
        
        jpg_path_list = master_jpg_path[k]
        ocr_original_list = master_ocr_orig_path[k]
        ocr_stitched_list = master_ocr_path[k]
        page_range = get_sublist_numbers(master_ocr_path[k])
        feedback_id = "DEFAULT_ID"
        feedback_match_doc = "DEFAULT_MATCH"
        feedback_match_score = -1
        document_metadata = {"feedback_match_doc" : feedback_match_doc,
                             "feedback_match_score" : feedback_match_score}
        
        try:
            global_kvp_all = stitch_contours.get_key_values_all(ocr_original_list, jpg_path_list)
        except:
            traceback.print_exc()
            global_kvp_all = [[[], [], [], []]] * len(ocr_original_list)
            
        try:
            once_all, twice_all, intersection_all, individual_all = merge_all_ot(global_kvp_all)
        except:
            traceback.print_exc()
            once_all, twice_all, intersection_all, individual_all = [], [], [], []
            
        print("length all four :", len(once_all), len(twice_all), len(intersection_all), len(individual_all))
        # time.sleep(30)
        
        qr_content = {}
        code_content = ""
        external_sheet = []
        
        for i in range(len(master_ocr_output_inner)):
            index_sum_here = index_sum_here + 1
            ocr_here = master_ocr_output[k][i]
            ocr_path = master_ocr_path[k][i]
            ocr_orig_path = master_ocr_orig_path[k][i]
            jpg_path_here = master_jpg_path[k][i]
            file_name_here = ".".join(jpg_path_here.split("/")[-1].split(".")[:-1])
            
            height = ocr_here["height"]
            width = ocr_here["width"]
            s3_path_here = ocr_here["path"]
            
            disallow_snippet_flag = "static" in ocr_here
            disallow_kvp_flag = "static" in ocr_here
            
            ind_pdf_path_here = master_ind_pdf_path[index_sum_here]
            try:
                thumbnail_jpg_here = master_thumbnail_jpg_list[index_sum_here]
                s3_thumbnail_path = s3_bucket.upload_file_specific(thumbnail_jpg_here, today + "/thumbnails")
            except:
                traceback.print_exc()
                # thumbnail_jpg_here = s3_path_here
                s3_thumbnail_path = s3_path_here
                
            print("JPG path where core function is processed : ", jpg_path_here)
            print("File Name of processing file : ", file_name_here)
            print("Page range is ", page_range)

            all_lines = ocr_here["lines"]

            start_time_complete10 = time.perf_counter()
            
            # s3_path_json = s3_bucket.upload_file(ocr_orig_path)
            s3_path_json = s3_bucket.upload_file_specific(ocr_orig_path, today + "/ocr_output_original")
            s3_path_stitched_json = s3_bucket.upload_file_specific(ocr_path, today + "/ocr_output_stitched")
            
            end_time_complete10 = time.perf_counter()
            time_s3_upload = end_time_complete10 - start_time_complete10
            print('STG1->', time.time() - first_pass_ocr_)

            if document_type_input == "ANY":
                type_of_doc_safe = "#NEW_FORMAT#"
            else:
                type_of_doc_safe = document_type_input

            page_array = [{
                    "dimension": {
                        "height": height,
                        "width": width
                    },  # in use
                    "ocr_path": ocr_orig_path,
                    "s3_path": s3_path_here,  # in use
                    "jpg_path": jpg_path_here,
                    "all_kvp_path": "",
                    "s3_path_ocr": s3_path_json,  # in use
                    "s3_path_ocr_stitched" : s3_path_stitched_json,  # in use
                    "ocr_path_output": "",
                    "cell_input_path": "",
                    "tod_input_path": "",
                    "ocr_path_table_detection_input": "",
                    "table_points_image_path": "",
                    "cell_extraction_image_path": "",
                    "ocr_path_output_original": "",
                    "ocr_path_stitched": ocr_path,
                    "ggk_input_path": "",
                    "time_conv_ocr": -1,
                    "time_govt_id": -1,
                    "time_kvp": -1,
                    "time_table": -1,
                    "time_cell_extraction": -1,
                    "time_doc_type": -1,
                    "time_doc_keys": -1,
                    "time_table_save": -1,
                    "time_s3_upload": -1,
                    "time_draw_contours": -1,
                    "time_backup_inv_num_date" : 0,
                    "time_page_splitter" : time_page_splitter,
                    "all_time_doc_class" : 0,
                    "page": i,  # in use
                    "page_type": type_of_doc_safe, # "#NEW_FORMAT#",  # in use
                    "s3_ind_pdf_path" : ind_pdf_path_here,  # in use
                    "s3_thumbnail_path" : s3_thumbnail_path,  # in use
                    "disallow_snippet_flag" : disallow_snippet_flag,  # in use
                    "disallow_kvp_flag" : disallow_kvp_flag  # in use
                }]

            try:
                # error_function()
                start_time_doc_class_v2 = time.perf_counter()
                start_time_complete2 = time.perf_counter()
                # global_kvp = stitch_contours.get_key_values(ocr_orig_path, jpg_path_here)
                global_kvp = global_kvp_all[i]
                end_time_complete2 = time.perf_counter()
                time_global_kvp = end_time_complete2 - start_time_complete2

                global_kvp_master.append(global_kvp)

                # FROM HERE

                # global_kvp_integrated = integrate_global_kvp(global_kvp_master)
                # global_kvp = global_kvp_integrated

                contour_count = 0
                for rows in all_lines:
                    for elem in rows:
                        contour_count = contour_count + 1

                gid_contour_flag = True
                if (contour_count > 60):
                    gid_contour_flag = False

                timestr = time.strftime("%Y%m%d-%H%M%S")

                time_table = 0
                time_cell_extraction = 0
                time_table_save = 0
                time_draw_contours = 0

                ocr_path_cell_input = os.getcwd() + "/ALL_OCR_OUTPUT/" + file_name_here + "_cell_input.json"
                ocr_path_table_detection_input = os.getcwd() + "/ALL_OCR_OUTPUT/" + file_name_here + "_table_detection_input.json"
                table_points_image_path = os.getcwd() + "/TABLE_DETECTION_TEST/" + file_name_here + ".jpg"
                cell_extraction_image_path = os.getcwd() + "/CELL_EXTRACTION_TEST_ALL/" + file_name_here + ".jpg"

                dict_global_kvp = dict({"response": global_kvp})
                ocr_path_global_kvp = os.getcwd() + "/ALL_OCR_OUTPUT/" + file_name_here + "_global_kvp.json"

                with open(ocr_path_global_kvp, "w") as f:
                    json.dump(dict_global_kvp, f)

                once = global_kvp[0]
                twice = global_kvp[1]
                intersection = global_kvp[2]
                individual = global_kvp[3]

                # once = update_duplicates_once(once)
                # twice = update_duplicates_twice(twice)

                all_keys = intersection + individual

                print("all_keys :", all_keys)

                # map_customer_master = change_format(str(cid), str(doc_id), document_type_input)
                map_customer_master = map_customer_static
                map_customer = map_customer_master[0]
                table_present_dict = map_customer_master[1]
                map_customer_table_header = map_customer_master[2]
                qr_present_dict = map_customer_master[3]
                code_present_dict = map_customer_master[4]
                external_sheet_dict = map_customer_master[5]
                table_id_all_list = map_customer_master[6]
                
                # tsc_and_datatype = get_only_static_columns(map_customer_table_header, document_type_input)
                # table_static_columns = tsc_and_datatype.get("text")
                # datatype_columns_list = tsc_and_datatype.get("datatype")
                
                print("map_customer :", map_customer)
                
                # time.sleep(15)
                
                if (type(map_customer) != list or map_customer == []):
                    return {"processStart": "FAILURE",
                            "error": "[PLATFORM]--GLOBAL_MAPPING_FAILURE",
                            "errorCode": 51}

                print("Map Customer : ", map_customer)

                # time.sleep(20)
                
                ocr_path_tod_input = os.getcwd() + "/ALL_OCR_OUTPUT/" + file_name_here + "_tod_input.json"

                with open(ocr_path_tod_input, "w") as f:
                    json.dump(dict({"response": [cid, map_customer, all_keys, intersection, individual, once, twice]}), f)

                start_time_doc_type = time.perf_counter()
                gcm = document_type.get_customer_mapping_custom(cid, map_customer, all_keys, intersection, individual, once, twice)

                print("Result from get_customer_mapping_custom ", gcm)
                print('STG2->', time.time() - first_pass_ocr_)
                end_time_doc_type = time.perf_counter()

                time_doc_type = end_time_doc_type - start_time_doc_type

                type_of_doc = gcm[0]
                master_sim_score = gcm[1]
                master_sim_score = {
                    k: v
                    for k, v in sorted(master_sim_score.items(),
                                       key=lambda item: item[1],
                                       reverse=True)
                }

                doc_list = []
                for i5 in range(len(map_customer)):
                    docs = map_customer[i5]
                    ind_doc_here = list(docs.keys())[0]
                    doc_list.append(ind_doc_here)

                list_all_doc_type = map_customer

                mss_list = list(master_sim_score.keys())
                top_doc_type_value_flag = False
                if len(mss_list) > 0:
                    mss_top_key = list(master_sim_score.keys())[0]
                    mss_top_value = master_sim_score[mss_top_key]
                    top_doc_type_value_flag = (mss_top_value >= 25 and mss_top_value < 50)

                static_doc_list = ["Invoice", "Insurance", "Salary Slip", "Bank Statement", "Discharge Summary"]

                doc_type_backup_flag = False
                if top_doc_type_value_flag:
                    for doc_i1 in doc_list:
                        for doc_i2 in static_doc_list:
                            if document_type.match_4(doc_i1.lower(), doc_i2.lower()):
                                doc_type_backup_flag = True
                                break
                        else:
                            continue
                        break

                if invoices_flag:
                    # type_of_doc = "Invoices"
                    type_of_doc = "Invoices Static"

                if (type_of_doc.lower() == "#new_format#"):
                    invoices_present_flag = False
                    invoice_possible = None
                    for doc_here in doc_list:
                        if document_type.match_4("invoices", doc_here.lower()):
                            invoices_present_flag = True
                            invoice_possible = doc_here
                            break
                    if invoices_present_flag:
                        specific_invoice_flag = document_type.get_specific_invoice_flag(all_lines)
                        if specific_invoice_flag:
                            type_of_doc = invoice_possible

                doc_type_ratio_for_conf = 0
                if type(master_sim_score) == dict and master_sim_score.get(type_of_doc) != None:
                    doc_type_percentage = master_sim_score.get(type_of_doc)
                    doc_type_ratio_for_conf = doc_type_percentage / 100

                if type_of_doc != None:
                    type_of_doc = type_of_doc.replace("Invoices Static", "Invoices Custom")    

                start_time_backup_inv_num_date = time.perf_counter()    

                print("type_of_doc before ff v-2 :", type_of_doc)
                # time.sleep(10)
                
                if (type(type_of_doc) == str) and (type_of_doc.lower() == "#new_format#") and (i == 0):
                    for i_ind_here in range(len(ocr_stitched_list)):
                        ocr_path_ind_here = ocr_stitched_list[i_ind_here]
                        ocr_orig_path_ind_here = ocr_original_list[i_ind_here]

                        invoice_number_date_flag = customInvoiceMark.check_through_invoice_number_date(ocr_path_ind_here,
                                                                                                       ocr_orig_path_ind_here)
                        print('STG2.5->', time.time() - first_pass_ocr_, invoice_number_date_flag )
                        if invoice_number_date_flag:
                            type_of_doc = "Invoices Custom"
                            break

                end_time_backup_inv_num_date = time.perf_counter()
                time_backup_inv_num_date = end_time_backup_inv_num_date - start_time_backup_inv_num_date
                
                print("type_of_doc before ff v-1 :", type_of_doc)
                # time.sleep(10)
                
                negative_invoice_flag = document_type.get_specific_negative_invoice_flag(all_lines)
                if negative_invoice_flag:
                    type_of_doc = "#NEW_FORMAT#"

                print("type_of_doc before ff :", type_of_doc)    
                # time.sleep(10)

                if ((document_type_input.lower() not in ["invoices custom", "any"]) and (type_of_doc.lower() != "#new_format#")):
                    type_of_doc = document_type_input
                    
                try:
                    if ((type(type_of_doc) == str) and (i == 0)):
                        time_ff = -1
                        
                        if ((type_of_doc.lower() == "#new_format#") or (document_type_input.lower() == "any")):
                            # error_function()
                            print("Inside FF Before")
                            # time.sleep(15)
                            for i_dl in range(len(doc_list)):
                                document_type_input_dl = doc_list[i_dl]
                                # output_ff = real_time_application_streamlined.searchAndApplyExistingFeedback(ocr_original_list,
                                #                                                                              ocr_stitched_list,
                                #                                                                              document_type_input_dl)
                                
                                start_time_ff = time.perf_counter()
                                output_ff = call_with_timeout(real_time_application_streamlined.searchAndApplyExistingFeedback,
                                                              args=[ocr_original_list,
                                                                    ocr_stitched_list,
                                                                    document_type_input_dl],
                                                              timeout=(10 * len(ocr_original_list)))
                                end_time_ff = time.perf_counter()
                                
                                with open(os.getcwd() + "/ALL_OCR_OUTPUT/" + str(doc_id) + ".json", "w") as f:
                                    json.dump({"response": [ocr_original_list, ocr_stitched_list, document_type_input_dl, output_ff]}, f)

                                print("output_ff :", output_ff)
                                # print("document_type_input_dl :", document_type_input_dl)
                                # time.sleep(60)
                                
                                output_ff_dynamic = output_ff
                                if (type(output_ff) == dict) and (output_ff != {}):
                                    type_of_doc = document_type_input_dl
                                    feedback_id = get_feedback_id(output_ff)
                                    feedback_match_doc, feedback_match_score = get_matching_doc_number(output_ff)
                                    time_ff = end_time_ff - start_time_ff
                                    # print("feedback_id :", feedback_id)
                                    # time.sleep(30)
                                    break
                        elif (type_of_doc.lower() != "#new_format#"):
                            # error_function()
                            print("Inside FF Before V2")
                            # time.sleep(15)
                            # output_ff = real_time_application_streamlined.searchAndApplyExistingFeedback(ocr_original_list,
                            #                                                                              ocr_stitched_list,
                            #                                                                              type_of_doc)
                            
                            start_time_ff = time.perf_counter()
                            output_ff = call_with_timeout(real_time_application_streamlined.searchAndApplyExistingFeedback,
                                                          args=[ocr_original_list,
                                                                ocr_stitched_list,
                                                                type_of_doc],
                                                          timeout=(10 * len(ocr_original_list)))
                            end_time_ff = time.perf_counter()
                            
                            with open(os.getcwd() + "/ALL_OCR_OUTPUT/" + str(doc_id) + ".json", "w") as f:
                                json.dump({"response": [ocr_original_list, ocr_stitched_list, type_of_doc, output_ff]}, f)

                            print("output_ff :", output_ff)
                            # time.sleep(60)
                            output_ff_dynamic = output_ff
                            feedback_id = get_feedback_id(output_ff)
                            feedback_match_doc, feedback_match_score = get_matching_doc_number(output_ff)
                            time_ff = end_time_ff - start_time_ff
                            # print("feedback_id :", feedback_id)
                            # time.sleep(30)
                        else:
                            pass
                        
                        document_metadata = {"feedback_match_doc" : feedback_match_doc,
                                             "feedback_match_score" : feedback_match_score}
                        all_time_list[1] = time_ff
                except:
                    traceback.print_exc()
                    format_exc = traceback.format_exc()
                    
                    with open(os.getcwd() + "/ALL_OCR_OUTPUT_FAILURES/" + str(doc_id) + ".json", "w") as f:
                        json.dump({"response": [ocr_original_list, ocr_stitched_list],
                                   "error" : str(format_exc)}, f)
                    # time.sleep(60)
                    
                print("document_type_input :", document_type_input)
                
                if ((document_type_input.lower() not in ["invoices custom", "any"]) and
                    (type_of_doc.lower() != "#new_format#") or
                    True):
                    type_of_doc = document_type_input
                
                print("type_of_doc after ff :", type_of_doc)
                
                if doc_type_imm != None:
                    type_of_doc = doc_type_imm
                else:
                    doc_type_imm = type_of_doc
                    
                # time.sleep(30)    
                print("type_of_doc :", type_of_doc)    
                
                # time.sleep(10)
                
                print("map_customer :", map_customer)
                
                # time.sleep(30)
                
                (map_customer, 
                 table_present_dict,
                 map_customer_table_header,
                 table_id_ind_list) = clear_map_customer(map_customer,
                                                         table_present_dict,
                                                         map_customer_table_header,
                                                         type_of_doc,
                                                         table_static_columns,
                                                         document_type_input,
                                                         table_id_all_list)    
                
                print("map_customer after :", map_customer)
                print("table_id_ind_list :", table_id_ind_list)
                
                # time.sleep(30)
                
                # table_static_columns = []
                datatype_columns_list = []
                cth_column_list = []
                qr_present = False
                code_present = False
                external_sheet = []
                if type_of_doc.lower() != "#new_format#":
                    tsc_and_datatype = get_only_static_columns(map_customer_table_header, type_of_doc)
                    table_static_columns = tsc_and_datatype[0].get("text")
                    datatype_columns_list = tsc_and_datatype[0].get("datatype")
                    cth_column_list = tsc_and_datatype[0].get("confidence_threshold")
                    
                    qr_present = qr_present_dict.get(type_of_doc.lower())
                    code_present = code_present_dict.get(type_of_doc.lower())
                    external_sheet = external_sheet_dict.get(type_of_doc.lower())
                    
                    print("external_sheet :", external_sheet)
                    # time.sleep(20)
                    
                print('STG3->', time.time() - first_pass_ocr_)
                
                end_time_doc_class_v2 = time.perf_counter()
                all_time_doc_class = end_time_doc_class_v2 - start_time_doc_class_v2

                if i == 0:
                    all_time_doc_class_static = all_time_doc_class
                    all_time_list[2] = all_time_doc_class_static
                    
                # error_function()
            except:
                traceback.print_exc()
                # time.sleep(60)
                print('STG3.5 EXCPN->', traceback.print_exc())
                ai_unique_id_here = str(uuid.uuid4())
                address_id_here = str(uuid.uuid4())
                page_array_list.append(page_array[0])
                type_of_doc = "Invoices Custom"
                
                if document_type_input == "ANY":
                    type_of_doc = "#NEW_FORMAT#"
                else:
                    type_of_doc = document_type_input
                
                if type_of_doc == "Invoices Custom":
                    pass
                elif type_of_doc == "#NEW_FORMAT#":
                    non_table_content_static = []
                else:
                    try:
                        map_customer_ntc = get_required_list(map_customer)    
                    except:
                        traceback.print_exc()
                        map_customer_master = map_customer_static
                        map_customer = map_customer_master[0]
                        map_customer_ntc = get_required_list(map_customer)    
                
                    print("map_customer_ntc :", map_customer_ntc)
                    # time.sleep(15)
                    
                    try:
                        non_table_content_static = convert_format(map_customer_ntc)
                    except:
                        traceback.print_exc()
                        # time.sleep(15)
                        non_table_content_static = []
                        type_of_doc = "#NEW_FORMAT#"
                        
                if final_output == dict():
                    # print("non_table_content_static :", non_table_content_static)
                    # print("non_table_content_static :", type(non_table_content_static))
                    # time.sleep(15)
                    get_final_kvp_output = non_table_content_static
                    result = [dict({"cell_info": [],
                                    "column_vector": [],
                                    "row_vector": [],
                                    "hdr_row": [],
                                    "table_points": []})]

                    s3_document_pdf_link = None
                    original_resolution_flag = True
                    try:
                        start_page = int(master_jpg_path[k][0].split("-")[-1].split(".")[0])
                        end_page = int(master_jpg_path[k][-1].split("-")[-1].split(".")[0])
                        end_page = end_page + 1

                        s3_document_pdf_link = split_pdf(pdf_path,
                                                         ai_unique_id_here + "--" + only_file_name_original,
                                                         today,
                                                         extension,
                                                         start_page,
                                                         end_page,
                                                         total_pages)
                    except:
                        traceback.print_exc()
                        original_resolution_flag = False
                        s3_document_pdf_link = convert_to_pdf(master_jpg_path[k], ai_unique_id_here + "--" + only_file_name_original,
                                                              k, today, extension)

                    final_output = dict({
                        "non_table_content": get_final_kvp_output,
                        "table_content": result,
                        "qr_content" : qr_content,
                        "code_content" : code_content,
                        "type_of_document": type_of_doc,
                        "customer_id": cid,
                        "doc_id": doc_id,
                        "page_range": page_range,
                        "confidence_score_document": 0,
                        "ai_unique_id": ai_unique_id_here,
                        "page_array": page_array,
                        "non_table_flag": True,
                        "table_flag": True,
                        "forward_feedback_kvp_flag": False,
                        "forward_feedback_flag_table": False,
                        "master_sim_score": {}, # default
                        "doc_list": [], # default
                        "file_name": doc_name_static, # default
                        "total_pages" : total_pages,
                        "time_list" : [], # default
                        "time_doc_type": -1, # default
                        "s3_document_pdf_link" : s3_document_pdf_link,
                        "address_id" : address_id_here,
                        "flag_3_5" : False, # default
                        "flag_vendor_exist" : True,
                        "original_resolution_flag" : original_resolution_flag,
                        "table_columns" : table_static_columns,
                        "table_thresholds" : cth_column_list,
                        "table_datatypes" : datatype_columns_list,
                        "header_table" : "H",
                        "feedback_column_dict" : {},
                        "feedback_id" : feedback_id,
                        "all_time_list" : all_time_list,
                        "external_sheet" : external_sheet,
                        "document_metadata" : document_metadata
                    })
                continue
            
            try:
                just_page_array_flag = False
                # error_function()
                if (type_of_doc.lower() != "#new_format#"):
                    # Enter into Extraction Code
                    ocr_path_output = os.getcwd() + "/ALL_OCR_OUTPUT/" + file_name_here + "__" + timestr + "__output.json"
                    ocr_path_output_original = (os.getcwd() + "/ALL_OCR_OUTPUT/" +
                                                file_name_here + "_output_original_" +
                                                str(cid) + ".json")

                    s3_link_custom = s3_path_here                    
                    dest = os.getcwd() + "/S3_IMAGES/" + s3_link_custom.split("/")[-1]

                    s3_bucket.download_from_s3_url(s3_link_custom, dest)
                    
                    table_flag = True
                    
                    table_ratio_for_conf = 0
                    if table_flag:
                        table_ratio_for_conf = 1

                    doc_conf = 100

                    page_array = [{
                        "dimension": {
                            "height": height,
                            "width": width
                        },
                        "ocr_path": ocr_orig_path,
                        "s3_path": s3_path_here,
                        "jpg_path": jpg_path_here,
                        "all_kvp_path": ocr_path_global_kvp,
                        "s3_path_ocr": s3_path_json,
                        "s3_path_ocr_stitched" : s3_path_stitched_json,
                        "ocr_path_output": ocr_path_output,
                        "cell_input_path": "",
                        "tod_input_path": ocr_path_tod_input,
                        "ocr_path_table_detection_input": "",
                        "table_points_image_path": "",
                        "cell_extraction_image_path": "",
                        "ocr_path_output_original": ocr_path_output_original,
                        "ocr_path_stitched": ocr_path,
                        "ggk_input_path": "",
                        "time_conv_ocr": time_conv_ocr,
                        "time_govt_id": -1,
                        "time_kvp": time_global_kvp,
                        "time_table": -1,
                        "time_cell_extraction": -1,
                        "time_doc_type": all_time_doc_class_static,
                        "time_doc_keys": -1,
                        "time_table_save": -1,
                        "time_s3_upload": -1,
                        "time_draw_contours": -1,
                        "time_backup_inv_num_date" : time_backup_inv_num_date,
                        "time_page_splitter" : time_page_splitter,
                        "all_time_doc_class" : all_time_doc_class,
                        "page": i,
                        "page_type": type_of_doc,
                        "s3_ind_pdf_path" : ind_pdf_path_here,
                        "s3_thumbnail_path" : s3_thumbnail_path,
                        "disallow_snippet_flag" : disallow_snippet_flag,  # in use
                        "disallow_kvp_flag" : disallow_kvp_flag  # in use
                    }]

                    page_array_list.append(page_array[0])
                    just_page_array_flag = True
                    
                    if final_output == dict():
                        start_time_all_extraction = time.perf_counter()
                        
                        feedback_column_dict = {}
                        result = [dict({"cell_info": [],
                                    "column_vector": [],
                                    "row_vector": [],
                                    "hdr_row": [],
                                    "table_points": []})]
                        try:
                            # error_function()
                            if table_content_classic == []:
                                print("table_static_columns :", table_static_columns)
                                # time.sleep(15)
                                if include_table == False:
                                    error_function()
                                if table_static_columns == []:
                                    pass
                                else:
                                    # result_table = latest_tbl_det_multipg_v1.lineItemExtraction(master_jpg_path[k],
                                    #                                                             master_ocr_path[k],
                                    #                                                             master_ocr_orig_path[k],
                                    #                                                             type_of_doc)
                                    
                                    start_time_all_table = time.perf_counter()
                                    
                                    """result_table = call_with_timeout(latest_tbl_det_multipg_v1.lineItemExtraction,
                                                                     args=[master_jpg_path[k],
                                                                           master_ocr_path[k],
                                                                           master_ocr_orig_path[k],
                                                                           type_of_doc],
                                                                     timeout=(10 * len(master_jpg_path[k])))"""
                                    
                                    rj_here = get_azure_details(pdf_path)
                                    result_table = rj_here.get("table")
                                    
                                    end_time_all_table = time.perf_counter()
                                    time_all_table = end_time_all_table - start_time_all_table
                                    
                                    all_time_list[3] = time_all_table
                                    
                                    # result_table = call_with_timeout(latest_tbl_det_multipg_v1.lineItemExtraction,
                                    #                                  args=[master_jpg_path[k],
                                    #                                        master_ocr_path[k],
                                    #                                        master_ocr_orig_path[k]],
                                    #                                  timeout=(6 * len(master_jpg_path[k])))

                                    # Need to add code for format change here.
                                    # Format ---> [[TO1, TO2], [TO3], [TO4, TO5]] 
                                    # Later "result_table" ---> "result"

                                    with open(os.getcwd() + "/ALL_OCR_OUTPUT_METADATA/" + file_name_here +
                                              "_table_input_1__" + timestr + ".json", "w") as f:
                                        json.dump({"response": [master_jpg_path[k],
                                                                master_ocr_path[k],
                                                                master_ocr_orig_path[k],
                                                                result_table,
                                                                table_static_columns]},
                                                  f)
                                        
                                    # feedback_id = "242424219"
                                    try:
                                        if "default" in feedback_id.lower():
                                            feedback_column_dict = {}
                                        else:                                            
                                            print("table_static_columns :", table_static_columns)
                                            feedback_column_dict = get_feedback_column_dict(backend_platform_url,
                                                                                            table_static_columns,
                                                                                            type_of_doc,
                                                                                            client_customer_id, 
                                                                                            cid, 
                                                                                            feedback_id)
                                    except:
                                        traceback.print_exc()
                                        feedback_column_dict = {}
                                        
                                    # feedback_column_dict = {}    
                                        
                                    print("feedback_column_dict :", feedback_column_dict)
                                    print("feedback_id :", feedback_id)
                                    # time.sleep(60)
                                    
                                    """result = change_table_format(result_table,
                                                                 table_static_columns,
                                                                 datatype_columns_list = datatype_columns_list,
                                                                 feedback_column_dict = feedback_column_dict,
                                                                 th_columns_list = cth_column_list)"""
                                    
                                    result = []
                                    for i_atc in range(len(result_table)):
                                        result_table_ind = result_table[i_atc]
                                        tsc_and_datatype_item = tsc_and_datatype[i_atc]
                                        table_static_columns_here = tsc_and_datatype_item.get("text")
                                        datatype_columns_list_here = tsc_and_datatype_item.get("datatype")
                                        cth_columns_list_here = tsc_and_datatype_item.get("confidence_threshold")
                                        table_id_ind_here = table_id_ind_list[i_atc]
                                        
                                        result_temp = change_table_format_azure(result_table_ind,
                                                                                table_static_columns_here,
                                                                                datatype_columns_list = datatype_columns_list_here,
                                                                                feedback_column_dict = feedback_column_dict,
                                                                                th_columns_list = cth_columns_list_here,
                                                                                table_id_ind_here = table_id_ind_here)  
                                        result.append(result_temp)
                                        
                                    # result = [result]
                                    
                                    print("result :", result)
                                    # time.sleep(30)
                                    
                                    table_content_classic = result

                                    with open(os.getcwd() + "/ALL_OCR_OUTPUT_METADATA/" + file_name_here + 
                                              "_table_output_1__" + timestr + ".json", "w") as f:
                                        json.dump({"response": [master_jpg_path[k],
                                                                master_ocr_path[k],
                                                                master_ocr_orig_path[k],
                                                                result_table,
                                                                table_static_columns,
                                                                result]},
                                                  f)

                        except:
                            traceback.print_exc()
                            format_exc = traceback.format_exc()
                            # print("Table Failed")
                            # time.sleep(30)
                            with open(os.getcwd() + "/TABLE_FAILURES/" + file_name_here +
                                      "_table_output_1__" + timestr + ".json", "w") as f:
                                json.dump({"response" : format_exc}, f)
                                
                        try:
                            qr_content, code_content = qr_reader.read(master_jpg_path[k], qr_present, code_present)
                        except:
                            traceback.print_exc()
                            # time.sleep(30)
                            qr_content = {}
                            code_content = ""
                            
                        if type_of_doc.lower() == "invoices custom":
                            invoices_details, time_list = customInvoiceMark.custom_invoice_details(dest,
                                                                                                   ocr_path,
                                                                                                   ocr_orig_path,
                                                                                                   ocr_stitched_list,
                                                                                                   ocr_original_list,
                                                                                                   df_to_pass)

                            print("Output for custom invoice mark :", invoices_details)
                            # time.sleep(60)
                            print('STG5->', time.time() - first_pass_ocr_)

                            # invoices_details["SUPPLIER_ID"] = {"value" : "102405", "pts" : [0,0,0,0]}

                            get_final_kvp_output, mandatory_ratio_for_conf, non_table_flag = get_full_json_special(invoices_details, 0)
                        else:
                            if (remove_table and result != None and len(result[0]["table_points"]) == 4):
                                ocr_path_ggk_input_before = os.getcwd() + "/ALL_OCR_OUTPUT/" + file_name_here + "_ggk_before_input.json"

                                with open(ocr_path_ggk_input_before, "w") as f:
                                    json.dump(dict({"response": [intersection,
                                                                 individual,
                                                                 cid,
                                                                 type_of_doc,
                                                                 once,
                                                                 twice,
                                                                 map_customer]}),
                                              f)

                                once, twice, intersection, individual = remove_table_part(once,
                                                                                          twice,
                                                                                          intersection, 
                                                                                          individual,
                                                                                          result[0]["table_points"])

                            ocr_path_ggk_input = os.getcwd() + "/ALL_OCR_OUTPUT/" + file_name_here + "_ggk_input.json"

                            with open(ocr_path_ggk_input, "w") as f:
                                json.dump(dict({"response": [intersection, individual, cid, type_of_doc, once, twice, map_customer]}), f)

                            start_time_doc_keys = time.perf_counter()
                            get_global_keys_master = document_type.get_global_keys_only_2(intersection_all,
                                                                                          individual_all, 
                                                                                          cid,
                                                                                          type_of_doc,
                                                                                          once_all,
                                                                                          twice_all,
                                                                                          map_customer)

                            global_kvp_v2 = get_global_keys_master[0]
                            print("global_kvp_v2 :", global_kvp_v2)
                            # time.sleep(15)
                            non_table_flag = get_global_keys_master[1]
                            end_time_doc_keys = time.perf_counter()

                            time_doc_keys = end_time_doc_keys - start_time_doc_keys

                            get_full_json_here = get_full_json(global_kvp_v2, height, width, i, map_customer)
                            
                            non_table_flag = get_full_json_here[2]
                            mandatory_ratio_for_conf = get_full_json_here[1]
                            get_final_kvp_output = get_full_json_here[0]
                            
                            print("get_final_kvp_output :", get_final_kvp_output)
                            # time.sleep(30)
                    
                        ai_unique_id_here = str(uuid.uuid4())
                        address_id_here = str(uuid.uuid4())
                        
                        if type_of_doc.lower() == "invoices custom":
                            address_raw = invoices_details["SUPPLIER_ADDRESS"]["raw"]
                            address_match = invoices_details["SUPPLIER_ADDRESS"]["value"]
                            name_raw = invoices_details["SUPPLIER_NAME"]["raw"]
                            name_match = invoices_details["SUPPLIER_NAME"]["value"]
                            date_today_static = "2022-11-10"
                            header_table = invoices_details["SUPPLIER_ADDRESS"]["header_table"]
                        elif type_of_doc.lower() in ["bol", "so", "statements", "mh bol"] or has_external_sheet:
                            address_raw = get_final_kvp_output[2]["value"]
                            name_raw = get_final_kvp_output[1]["value"]
                            
                            name_raw_basic, address_raw_basic = supplier_details_only.get_only_supplier_details(dest,
                                                                                                                ocr_path,
                                                                                                                ocr_orig_path,
                                                                                                                ocr_stitched_list,
                                                                                                                df_to_pass)
                            
                            print("name_raw_basic :", name_raw_basic)
                            print("address_raw_basic :", address_raw_basic)
                            
                            name_raw = name_raw_basic
                            address_raw = address_raw_basic
                            
                            # time.sleep(15)
                            
                            if type_of_doc.lower() == "so":
                                (address_match, name_match,
                                 id_to_return_g, ht_to_return_g,
                                 val_here_g, input_address_g) = get_best_vendor_match_v2.get_best_match(address_raw,
                                                                                                        name_raw,
                                                                                                        df_to_pass)
                                # if address_match not in ["NO_VENDOR", "CANNOT_BE_PROCESSED"]:
                                #     address_match = "DEFAULT"
                            else:
                                (address_match, name_match,
                                 id_to_return_g, ht_to_return_g,
                                 val_here_g, input_address_g) = get_best_vendor_match_v2.get_best_match(address_raw,
                                                                                                        name_raw,
                                                                                                        df_to_pass)
                            
                            print("name_match_basic :", id_to_return_g, name_match, address_match)
                            # time.sleep(15)
                            
                            get_final_kvp_output[0]["value"] = id_to_return_g
                            get_final_kvp_output[0]["pts_value"] = [0, 0, 0, 0]
                            get_final_kvp_output[1]["value"] = name_match
                            get_final_kvp_output[1]["raw"] = name_raw
                            get_final_kvp_output[2]["value"] = address_match
                            get_final_kvp_output[2]["raw"] = address_raw
                            
                            date_today_static = "2022-11-10"
                            header_table = ht_to_return_g
                        else:
                            address_raw = ""
                            address_match = ""
                            name_raw = ""
                            name_match = ""
                            date_today_static = "2022-11-10"
                            header_table = "H"
                            
                        print("address_match :", address_match)
                        print("address_raw :", address_raw)
                        
                        # time.sleep(15)
                        
                        if type_of_doc.lower() in ["invoices custom", "bol", "so", "statements", "mh bol"] or has_external_sheet:
                            if address_match == "NO_VENDOR" and address_raw in ["NA", None, ""]:
                                pass
                            elif address_match == "NO_VENDOR":
                                address_raw_here = client_customer_id + " " + type_of_doc + " " + name_raw + " " + address_raw
                                address_match_here = client_customer_id + " " + type_of_doc + " " + name_match + " " + address_match
                                if type_of_doc.lower() == "bol":
                                    address_raw_here = (client_customer_id + " " + 
                                                        type_of_doc + " " + 
                                                        name_raw_basic + " " + 
                                                        address_raw_basic)
                                    
                                address_id_here = address_id_generator.get_address_id(address_match_here,
                                                                                      address_raw_here,
                                                                                      address_id_here,
                                                                                      date_today_static,
                                                                                      backend_platform_url)
                            else:
                                address_raw_here = client_customer_id + " " + type_of_doc + " " + name_raw + " " + address_raw
                                address_match_here = client_customer_id + " " + type_of_doc + " " + name_match + " " + address_match
                                if type_of_doc.lower() == "bol":
                                    address_raw_here = (client_customer_id + " " + 
                                                        type_of_doc + " " + 
                                                        name_raw_basic + " " + 
                                                        address_raw_basic)
                                    
                                address_id_here = address_id_generator.get_address_id(address_match_here,
                                                                                      address_raw_here,
                                                                                      address_id_here,
                                                                                      date_today_static,
                                                                                      backend_platform_url)

                            (flag_3_5, sup_id_3_5, sup_name_3_5,
                             sup_addr_3_5, header_table_temp, flag_vendor_exist) = rule_3_5.forward(backend_platform_url,
                                                                                                    address_id_here,
                                                                                                    address_raw,
                                                                                                    df_to_pass,
                                                                                                    client_customer_id,
                                                                                                    doc_name_static,
                                                                                                    type_of_doc)
                            
                            print("sup_id_3_5 :", flag_3_5, sup_id_3_5, sup_name_3_5, sup_addr_3_5)
                            
                            # time.sleep(30)
                            
                            # flag_3_5 = False
                            if flag_3_5:
                                if sup_addr_3_5 in ["NO_VENDOR", "CANNOT_BE_PROCESSED"]:
                                    flag_vendor_exist = True
                                get_final_kvp_output[0]["value"] = sup_id_3_5
                                get_final_kvp_output[1]["value"] = sup_name_3_5
                                get_final_kvp_output[2]["value"] = sup_addr_3_5
                                header_table = header_table_temp
                        else:
                            flag_3_5 = False
                            flag_vendor_exist = True
                            
                        print("address_id :", address_id_here)
                        # time.sleep(15)
                        
                        # s3_document_pdf_link = convert_to_pdf(master_jpg_path[k], only_file_name_original + "--" + ai_unique_id_here, k)
                        s3_document_pdf_link = None
                        original_resolution_flag = True
                        try:
                            start_page = int(master_jpg_path[k][0].split("-")[-1].split(".")[0])
                            end_page = int(master_jpg_path[k][-1].split("-")[-1].split(".")[0])
                            end_page = end_page + 1

                            s3_document_pdf_link = split_pdf(pdf_path,
                                                             ai_unique_id_here + "--" + only_file_name_original,
                                                             today,
                                                             extension,
                                                             start_page,
                                                             end_page,
                                                             total_pages)
                        except:
                            traceback.print_exc()
                            original_resolution_flag = False
                            s3_document_pdf_link = convert_to_pdf(master_jpg_path[k], ai_unique_id_here + "--" + only_file_name_original,
                                                                  k, today, extension)

                        if address_id_here == None:
                            address_id_here = str(uuid.uuid4())

                        """try:
                            feedback_column_dict = get_feedback_column_dict(backend_platform_url,
                                                                            table_static_columns,
                                                                            type_of_doc,
                                                                            client_customer_id, 
                                                                            cid, 
                                                                            address_id_here)
                        except:
                            traceback.print_exc()
                            feedback_column_dict = {}
                                    
                        print("feedback_column_dict after :", feedback_column_dict)        
                        # time.sleep(15)
                        
                        try:
                            result = change_table_format(result_table,
                                                         table_static_columns,
                                                         datatype_columns_list = datatype_columns_list,
                                                         feedback_column_dict = feedback_column_dict,
                                                         th_columns_list = cth_column_list)
                            table_content_classic = result
                        except:
                            traceback.print_exc()"""
                        
                        time_list = []
                        
                        if type_of_doc.lower() == "bol":
                            header_table = "L"
                        
                        final_output = dict({
                            "non_table_content": get_final_kvp_output,
                            "table_content": table_content_classic,
                            "qr_content" : qr_content,
                            "code_content" : code_content,
                            "type_of_document": type_of_doc,
                            "customer_id": cid,
                            "doc_id": doc_id,
                            "page_range": page_range,
                            "confidence_score_document": doc_conf,
                            "ai_unique_id": ai_unique_id_here,
                            "page_array": page_array,
                            "non_table_flag": non_table_flag,
                            "table_flag": table_flag,
                            "forward_feedback_kvp_flag": True,
                            "forward_feedback_flag_table": False,
                            "master_sim_score": master_sim_score,
                            "doc_list": doc_list,
                            "file_name": doc_name_static,
                            "total_pages" : total_pages,
                            "time_list" : time_list,
                            "time_doc_type": all_time_doc_class_static,
                            "s3_document_pdf_link" : s3_document_pdf_link,
                            "address_id" : address_id_here,
                            "flag_3_5" : flag_3_5,
                            "flag_vendor_exist" : flag_vendor_exist,
                            "original_resolution_flag" : original_resolution_flag,
                            "table_columns" : table_static_columns,
                            "table_thresholds" : cth_column_list,
                            "table_datatypes" : datatype_columns_list,
                            "timestr" : timestr,
                            "header_table" : header_table,
                            "feedback_column_dict" : feedback_column_dict,
                            "feedback_id" : feedback_id,
                            "all_time_list" : all_time_list,
                            "external_sheet" : external_sheet,
                            "document_metadata" : document_metadata
                        })

                        with open(ocr_path_output_original, "w") as f:
                            json.dump(final_output, f)

                        print('STG5->', time.time() - first_pass_ocr_)
                        try:
                            # error_function()
                            if output_ff_dynamic == None:
                                # output_ff = real_time_application_streamlined.searchAndApplyExistingFeedback(ocr_original_list,
                                #                                                                              ocr_stitched_list,
                                #                                                                              type_of_doc)
                                
                                output_ff = call_with_timeout(real_time_application_streamlined.searchAndApplyExistingFeedback,
                                                              args=[ocr_original_list,
                                                                    ocr_stitched_list,
                                                                    type_of_doc],
                                                              timeout=(10 * len(ocr_original_list)))
                                
                                feedback_id = get_feedback_id(output_ff)
                                feedback_match_doc, feedback_match_score = get_matching_doc_number(output_ff)
                                document_metadata = {"feedback_match_doc" : feedback_match_doc,
                                                     "feedback_match_score" : feedback_match_score}
                                print("output_ff :", output_ff)
                            else:
                                output_ff = output_ff_dynamic
                                
                            final_output["non_table_content"] = get_full_json_special_generic(final_output["non_table_content"],
                                                                                              output_ff)
                            final_output["forward_feedback_kvp_flag"] = True
                        except:
                            traceback.print_exc()
                            # time.sleep(60)
                            final_output["forward_feedback_kvp_flag"] = False

                        with open(ocr_path_output, "w") as f:
                            json.dump(final_output, f)

                        # s3_ocr_path_output = s3_bucket.upload_file(ocr_path_output)
                        s3_ocr_path_output = s3_bucket.upload_file_specific(ocr_path_output, today + "/ai_output")

                        # final_output["page_array"][0]["s3_ocr_path_output"] = s3_ocr_path_output
                        final_output["s3_ocr_path_output"] = s3_ocr_path_output

                        with open(ocr_path_output, "w") as f:
                            json.dump(final_output, f)
                            
                        end_time_all_extraction = time.perf_counter()
                        time_all_extraction = end_time_all_extraction - start_time_all_extraction
                        
                        all_time_list[4] = time_all_extraction
                        final_output["all_time_list"] = all_time_list
                        final_output["document_metadata"] = document_metadata
                    continue
            except:
                traceback.print_exc()
                # time.sleep(60)
                ai_unique_id_here = str(uuid.uuid4())
                address_id_here = str(uuid.uuid4())
                
                try:
                    map_customer_ntc = get_required_list(map_customer)    
                except:
                    traceback.print_exc()
                    map_customer_master = map_customer_static
                    map_customer = map_customer_master[0]
                    map_customer_ntc = get_required_list(map_customer)    

                print("map_customer_ntc :", map_customer_ntc)
                # time.sleep(15)

                try:
                    non_table_content_static = convert_format(map_customer_ntc)
                except:
                    traceback.print_exc()
                    # time.sleep(15)
                    non_table_content_static = []
                    type_of_doc = "#NEW_FORMAT#"
                    
                if just_page_array_flag == False:
                    page_array_list.append(page_array[0])
                
                # print("type_of_doc :", type_of_doc)
                
                if final_output == dict():
                    get_final_kvp_output = non_table_content_static
                    result = [dict({
                                "cell_info": [],
                                "column_vector": [],
                                "row_vector": [],
                                "hdr_row": [],
                                "table_points": []})]
                    
                    s3_document_pdf_link = None
                    original_resolution_flag = True
                    try:
                        start_page = int(master_jpg_path[k][0].split("-")[-1].split(".")[0])
                        end_page = int(master_jpg_path[k][-1].split("-")[-1].split(".")[0])
                        end_page = end_page + 1

                        s3_document_pdf_link = split_pdf(pdf_path,
                                                         ai_unique_id_here + "--" + only_file_name_original,
                                                         today,
                                                         extension,
                                                         start_page,
                                                         end_page,
                                                         total_pages)
                    except:
                        traceback.print_exc()
                        original_resolution_flag = False
                        s3_document_pdf_link = convert_to_pdf(master_jpg_path[k], ai_unique_id_here + "--" + only_file_name_original,
                                                              k, today, extension)

                    doc_conf = 0
                    
                    # table_static_columns = ["Description", "Quantity", "Unit Price", "Tax", "Amount"]
                    
                    if type_of_doc.lower() == "bol":
                        header_table = "L"
                        
                    final_output = dict({
                        "non_table_content": get_final_kvp_output,
                        "table_content": result,
                        "qr_content" : qr_content,
                        "code_content" : code_content,
                        "type_of_document": type_of_doc,
                        "customer_id": cid,
                        "doc_id": doc_id,
                        "page_range": page_range,
                        "confidence_score_document": doc_conf,
                        "ai_unique_id": ai_unique_id_here,
                        "page_array": page_array,
                        "non_table_flag": True,
                        "table_flag": True,
                        "forward_feedback_kvp_flag": False,
                        "forward_feedback_flag_table": False,
                        "master_sim_score": {},
                        "doc_list": [],
                        "file_name": doc_name_static,
                        "total_pages" : total_pages,
                        "time_list" : [],
                        "time_doc_type": -1,
                        "s3_document_pdf_link" : s3_document_pdf_link,
                        "address_id" : address_id_here,
                        "flag_3_5" : False,
                        "flag_vendor_exist" : True,
                        "original_resolution_flag" : original_resolution_flag,
                        "table_columns" : table_static_columns,
                        "table_datatypes" : datatype_columns_list,
                        "header_table" : "H",
                        "feedback_column_dict" : {},
                        "feedback_id" : feedback_id,
                        "all_time_list" : all_time_list,
                        "external_sheet" : external_sheet,
                        "document_metadata" : document_metadata
                    })
                continue
            
            try:
                just_page_array_flag = False                
                
                ocr_path_output = os.getcwd() + "/ALL_OCR_OUTPUT/" + file_name_here + "__" + timestr + "__output.json"
                ocr_path_output_original = (os.getcwd() + "/ALL_OCR_OUTPUT/" +
                                            file_name_here + "_output_original_" +
                                            str(cid) + ".json")

                page_array = [{
                    "dimension": {
                        "height": height,
                        "width": width
                    },
                    "ocr_path": ocr_orig_path,
                    "s3_path": s3_path_here,
                    "jpg_path": jpg_path_here,
                    "all_kvp_path": ocr_path_global_kvp,
                    "s3_path_ocr": s3_path_json,
                    "s3_path_ocr_stitched" : s3_path_stitched_json,
                    "ocr_path_output": ocr_path_output,
                    "cell_input_path": ocr_path_cell_input,
                    "tod_input_path": ocr_path_tod_input,
                    "ocr_path_table_detection_input":
                    ocr_path_table_detection_input,
                    "table_points_image_path": table_points_image_path,
                    "cell_extraction_image_path": cell_extraction_image_path,
                    "ocr_path_output_original": ocr_path_output_original,
                    "ocr_path_stitched": ocr_path,
                    "ggk_input_path": "",
                    "time_conv_ocr": time_conv_ocr,
                    "time_govt_id": -1,
                    "time_kvp": -1,
                    "time_table": -1,
                    "time_cell_extraction": -1,
                    "time_doc_type": -1,
                    "time_doc_keys": -1,
                    "time_table_save": -1,
                    "time_s3_upload": -1,
                    "time_draw_contours": -1,
                    "time_backup_inv_num_date" : time_backup_inv_num_date,
                    "time_page_splitter" : time_page_splitter,
                    "all_time_doc_class" : all_time_doc_class,
                    "page": k,
                    "page_type": type_of_doc,
                    "s3_ind_pdf_path" : ind_pdf_path_here,
                    "s3_thumbnail_path" : s3_thumbnail_path,
                    "disallow_snippet_flag" : disallow_snippet_flag,  # in use
                    "disallow_kvp_flag" : disallow_kvp_flag  # in use
                }]

                page_array_list.append(page_array[0])
                just_page_array_flag = True
                
                if final_output == dict():
                    get_final_kvp_output = []
                    result = []
                    table_content_classic == []
                    
                    ai_unique_id_here = str(uuid.uuid4())

                    s3_document_pdf_link = None
                    original_resolution_flag = True
                    try:
                        start_page = int(master_jpg_path[k][0].split("-")[-1].split(".")[0])
                        end_page = int(master_jpg_path[k][-1].split("-")[-1].split(".")[0])
                        end_page = end_page + 1

                        s3_document_pdf_link = split_pdf(pdf_path,
                                                         ai_unique_id_here + "--" + only_file_name_original,
                                                         today,
                                                         extension,
                                                         start_page,
                                                         end_page,
                                                         total_pages)
                    except:
                        traceback.print_exc()
                        original_resolution_flag = False
                        s3_document_pdf_link = convert_to_pdf(master_jpg_path[k],
                                                              ai_unique_id_here + "--" + only_file_name_original,
                                                              k, 
                                                              today,
                                                              extension)

                    # table_static_columns = ["Description", "Quantity", "Unit Price", "Tax", "Amount"]    
                        
                    non_table_flag = True
                    table_flag = True
                    
                    final_output = dict({
                        "non_table_content": get_final_kvp_output,
                        "table_content": result,
                        "qr_content" : qr_content,
                        "code_content" : code_content,
                        "type_of_document": type_of_doc,
                        "customer_id": cid,
                        "doc_id": doc_id,
                        "page_range": page_range,
                        "confidence_score_document": 0,
                        "ai_unique_id": ai_unique_id_here,
                        "page_array": page_array,
                        "non_table_flag": non_table_flag,
                        "table_flag": table_flag,
                        "forward_feedback_kvp_flag": True,
                        "forward_feedback_flag_table": False,
                        "master_sim_score": master_sim_score,
                        "doc_list": doc_list,
                        "file_name": doc_name_static,
                        "total_pages" : total_pages,
                        "s3_document_pdf_link" : s3_document_pdf_link,
                        "address_id" : "",
                        "flag_3_5" : False,
                        "flag_vendor_exist" : True,
                        "original_resolution_flag" : original_resolution_flag,
                        "table_columns" : table_static_columns,
                        "table_thresholds" : cth_column_list,
                        "table_datatypes" : datatype_columns_list,
                        "header_table" : "H",
                        "feedback_column_dict" : {},
                        "feedback_id" : feedback_id,
                        "all_time_list" : all_time_list,
                        "external_sheet" : external_sheet,
                        "document_metadata" : document_metadata
                    })

                    with open(ocr_path_output_original, "w") as f:
                        json.dump(final_output, f)
                
                    with open(ocr_path_output, "w") as f:
                        json.dump(final_output, f)

                    # s3_ocr_path_output = s3_bucket.upload_file(ocr_path_output)
                    s3_ocr_path_output = s3_bucket.upload_file_specific(ocr_path_output, today + "/ai_output")

                    # final_output["page_array"][0]["s3_ocr_path_output"] = s3_ocr_path_output
                    final_output["s3_ocr_path_output"] = s3_ocr_path_output

                    with open(ocr_path_output, "w") as f:
                        json.dump(final_output, f)
            except:
                traceback.print_exc()
                # time.sleep(60)
                ai_unique_id_here = str(uuid.uuid4())
                                    
                if just_page_array_flag == False:
                    page_array_list.append(page_array[0])
                    
                if final_output == dict():          
                    doc_conf = 0
                    get_final_kvp_output = []
                    result = [dict({
                                "cell_info": [],
                                "column_vector": [],
                                "row_vector": [],
                                "hdr_row": [],
                                "table_points": []})]
                    
                    s3_document_pdf_link = None
                    original_resolution_flag = True
                    try:
                        start_page = int(master_jpg_path[k][0].split("-")[-1].split(".")[0])
                        end_page = int(master_jpg_path[k][-1].split("-")[-1].split(".")[0])
                        end_page = end_page + 1

                        s3_document_pdf_link = split_pdf(pdf_path,
                                                         ai_unique_id_here + "--" + only_file_name_original,
                                                         today,
                                                         extension,
                                                         start_page,
                                                         end_page,
                                                         total_pages)
                    except:
                        traceback.print_exc()
                        original_resolution_flag = False
                        s3_document_pdf_link = convert_to_pdf(master_jpg_path[k], ai_unique_id_here + "--" + only_file_name_original,
                                                              k, today, extension)
                        
                    # table_static_columns = ["Description", "Quantity", "Unit Price", "Tax", "Amount"]

                    final_output = dict({
                        "non_table_content": get_final_kvp_output,
                        "table_content": result,
                        "qr_content" : qr_content,
                        "code_content" : code_content,
                        "type_of_document": type_of_doc,
                        "customer_id": cid,
                        "doc_id": doc_id,
                        "page_range": page_range,
                        "confidence_score_document": doc_conf,
                        "ai_unique_id": ai_unique_id_here,
                        "page_array": page_array,
                        "non_table_flag": True,
                        "table_flag": True,
                        "forward_feedback_kvp_flag": False,
                        "forward_feedback_flag_table": False,
                        "master_sim_score": {},
                        "doc_list": [],
                        "file_name": doc_name_static,
                        "total_pages" : total_pages,
                        "time_list" : [],
                        "time_doc_type": -1,
                        "s3_document_pdf_link" : s3_document_pdf_link,
                        "address_id" : "",
                        "flag_3_5" : False,
                        "flag_vendor_exist" : True,
                        "original_resolution_flag" : original_resolution_flag,
                        "table_columns" : table_static_columns,
                        "table_thresholds" : cth_column_list,
                        "table_datatypes" : datatype_columns_list,
                        "header_table" : "H",
                        "feedback_column_dict" : {},
                        "feedback_id" : feedback_id,
                        "all_time_list" : all_time_list,
                        "external_sheet" : external_sheet,
                        "document_metadata" : document_metadata
                    })
                continue
                
        final_output["page_array"] = page_array_list
        final_output["table_content"] = table_content_classic
        print('FT5.5->', time.time() - final_timer_)
        master_final_output.append(final_output)
        
    sys.stdout.flush()
    return master_final_output


def extract_wrapper(file, cid, extension, doc_id, doc_name_static, df_to_pass, 
                    client_customer_id, table_static_columns, document_type_input,
                    map_customer_static, has_external_sheet, time_overall_1):
    print(">>>> In extract_wrapper")
    global ENV
    extraction_time_ = time.time()
    
    file_name = ".".join(file.split("/")[-1].split(".")[:-1])
    path_to_read = os.getcwd() + "/FINAL_OUTPUT_V3/" + doc_id + "--" + file_name + ".json"
    print("path_to_read :", path_to_read)
    print("file, cid, extension, doc_id, doc_name_static", file, cid, extension, doc_id, doc_name_static)
    
    master_final_output = None
    today = str(date.today())
    try:
        print("file, cid, extension, doc_id, doc_name_static", file, cid, extension, doc_id, doc_name_static)
        master_final_output = extract_v2(file,
                                         cid,
                                         extension,
                                         doc_id,
                                         doc_name_static,
                                         today,
                                         df_to_pass,
                                         client_customer_id,
                                         table_static_columns,
                                         document_type_input, 
                                         map_customer_static, 
                                         has_external_sheet)
    except:
        traceback.print_exc()
        format_exc = traceback.format_exc()
        print()
        print("file, cid, extension, doc_id, doc_name_static", file, cid, extension, doc_id, doc_name_static)
        print("!!! FAILURE FAILURE FAILURE !!!")
        print("!!! FAILURE FAILURE FAILURE !!!")
        print()
        master_final_output = {
            "processStart": "FAILURE",
            "error": "[AI]--OUTPUT_ERROR " + format_exc,
            "errorCode": 4
        }

    with open(path_to_read, "w") as f:
        json.dump({}, f)
        f.flush()
        
    sys.stdout.flush()    
        
    try:
        s3_link_final_output = s3_bucket.upload_file_non_unique(path_to_read, today + "/final_outputs")
    except:
        traceback.print_exc()
        format_exc = traceback.format_exc()
        master_final_output = {
            "processStart": "FAILURE",
            "error": "[AI]--UPLOAD_S3_FAILED " + format_exc,
            "errorCode": 2
        }

    payload = {"data": master_final_output,
               "doc_id": doc_id,
               # "doc_id": "652fed59958a9aba4319bae6",
               "s3_link_final_output" : s3_link_final_output,
               "time_overall" : time.perf_counter() - time_overall_1}
    
    with open(path_to_read, "w") as f:
        json.dump(payload, f)
        f.flush()
        
    sys.stdout.flush()    
    
    try:
        s3_bucket.upload_file_non_unique(path_to_read, today + "/final_outputs")
    except:
        traceback.print_exc()
        format_exc = traceback.format_exc()
        error_json = {
            "processStart": "FAILURE",
            "error": "[AI]--UPLOAD_S3_FAILED " + format_exc,
            "errorCode": 2
        }
        email_body = str(error_json) + " || doc_id : " + doc_id + " || backend_platform_url : " + backend_platform_url
        send_response_mail_text(file, "!!!FAILURE : LAST UPLOAD TO S3 FAILED!!!", email_body)
        
    response_flag, response_text = send_response_webhook(payload)
    if (response_flag == False):
        print("Failure at webhook try 1")
        email_body = response_text + " || doc_id : " + doc_id + " || backend_platform_url : " + backend_platform_url
        send_response_mail_text(file, "!!!WARNING : 1ST FAILURE AT WEBHOOK!!! | IDP_REQUORDIT | " + ENV, email_body)
        time.sleep(15)
        response_flag, response_text = send_response_webhook(payload)
        if (response_flag == False):
            print("Failure at webhook try 2")
            email_body = response_text + " || doc_id : " + doc_id + " || backend_platform_url : " + backend_platform_url
            send_response_mail_text(file, "!!!CRITICAL FAILURE AT WEBHOOK!!! | IDP_REQUORDIT | " + ENV, email_body)
        
    with open(status_flag_file, "w") as f:    
        json.dump({"response" : False, "time" : time.time()}, f)

    print("Instant Speed, Finished! ->", time.time() - extraction_time_)

    return None

def send_response_webhook(payload):
    # print("Sending response",  uniqueId)
    print("Payload", payload)
    url = backend_platform_url + "/api/v1/imc/ocr/document"

    py = json.dumps(payload)
    headers = {
        # 'authorization': 'bearer 8cb7cd8aa2dbbe975030873a1f0a77a6',
        'Authorization': 'Bearer 9c72de2d9bb476ce68aa0f2abdcb0198',
        'Accept': '*/*',
        'Content-Type': 'application/json'
    }
    
    try:
        response = requests.request("POST", url, headers=headers, data=py, timeout = 60)
    except:
        traceback.print_exc()
        format_exc = traceback.format_exc()
        return [False, format_exc]
    
    response_text = response.text
    print("RESPONSE WEBHOOK", response_text)
    response.close()
    try:
        status_code = json.loads(response_text).get("statusCode")
        if status_code == 200:
            return [True, ""]
    except:
        traceback.print_exc()
        return [False, response_text]
        
    return [False, response_text]

def mail_output(output):
    file_path = "/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/prayer_hori.jpg"
    send_response_mail(file_path)

def extract_zip(zip_file, target_folder):
    '''
    extract zip_file and save the contents to target_folder
    :param zip_file: zip file to be extracted
    :param target_folder:
    :return: success/fail
    '''
    try:
        with zipfile.ZipFile(zip_file, "r") as zip_ref:
            zip_ref.extractall(target_folder)
            return True
    except:
        return False

def send_response_mail(file_path):
    try:
        # url = "http://amygbdemos.in:3434/api/emailManager/sendEmailForVertiv"
        url = "https://email.amygbserver.in/api/emailManager/sendEmailFromSecondaryServer"
        recepient_ids = "abhijeet@amygb.ai,bithika@amygb.ai"
        email_body = "Please find attached the results with this mail."
        subject = "Invoices Extraction"

        file_name = str(file_path).split("/")[-1]
        email_body = email_body + " || file_name : " + file_name

        payload = {'subject': subject, 'body': email_body, 'emails': recepient_ids}
        # files = {'file': open(file_path, 'rb')}
        files = {'file': None}

        res = requests.post(url, data=payload, files=files, timeout=30)  # , headers = headers)
        print(res)
        res.close()
    except:
        traceback.print_exc()
        return None

def send_response_mail_text(file_path, subject, email_body):
    try:
        # url = "http://amygbdemos.in:3434/api/emailManager/sendEmailForVertiv"
        url = "https://email.amygbserver.in/api/emailManager/sendEmailFromSecondaryServer"
        recepient_ids = "abhijeet@amygb.ai,vikram@amygb.ai,auqib@amygb.ai,shahab@amygb.ai,farha@amygb.ai"
        # recepient_ids = "abhijeet@amygb.ai"

        file_name = str(file_path).split("/")[-1]
        email_body = email_body + " || file_name : " + file_name

        payload = {'subject': subject, 'body': email_body, 'emails': recepient_ids}
        # files = {'file': open(file_path, 'rb')}
        files = {'file': None}

        res = requests.post(url, data=payload, files=files, timeout=30)  # , headers = headers)
        print(res)
        res.close()
    except:
        traceback.print_exc()
        return None

def send_response_mail_text_special(file_path, subject, email_body):
    try:
        # url = "http://amygbdemos.in:3434/api/emailManager/sendEmailForVertiv"
        url = "https://email.amygbserver.in/api/emailManager/sendEmailFromSecondaryServer"
        recepient_ids = "abhijeet@amygb.ai,vikram@amygb.ai"

        file_name = str(file_path).split("/")[-1]
        email_body = email_body + " || file_name : " + file_name

        payload = {'subject': subject, 'body': email_body, 'emails': recepient_ids}
        # files = {'file': open(file_path, 'rb')}
        files = {'file': None}

        res = requests.post(url, data=payload, files=files, timeout=30)  # , headers = headers)
        print(res)
        res.close()
    except:
        traceback.print_exc()
        return None
    
def start_bg_task(dst_folder, zip_name, logger):
    logger.info("--------------- Starting to process " + dst_folder +
                zip_name + " --------------------")
    zip_fp = os.path.join(dst_folder, zip_name)
    extract_zip(zip_fp,
                os.path.join(dst_folder,
                             'files'))  # extract into the created folder
    df_arr = []
    dst_folder = os.path.join(dst_folder, 'files')
    files = os.listdir(dst_folder)
    ## someone needs to add code here to convert PDF to JPEG

    ## someone needs to add code here to convert PDF to JPEG
    for idx, file in enumerate(files):
        secure_fn = secure_filename(file)
        # ext_here = secure_fn.split(".")[-1].lower()
        extension = secure_fn.split(".")[-1].lower()
        save_path = os.path.join(dst_folder, secure_fn)
        os.rename(os.path.join(dst_folder, file), save_path)
        """total_pages = 0      
        if not ("jpg" in extension or "jpeg" in extension or "png" in extension):
            is_pdf = True
            pdf_path = save_path
            total_pages = get_num_pages(pdf_path)
        else:
            jpg_path = save_path
            total_pages = 1
        
        for i in range(total_pages):
            if extension == "pdf":
                save_path = os.getcwd() + "/" + convert_save(save_path,os.path.join("uploads","jpg"),i)"""

        logger.info("Processing " + str(idx + 1) + " of " + str(len(files)))
        logger.info("File ---" + file + " Secure file name-- " + secure_fn)
        master_inv_res = dict()
        ends_with = secure_fn.split(".")[-2].split("_")[-1]

        # cid = "62973a809061cb9b6da9a572"
        # cid = "62ac22039061cb9b6d2b7453"
        # cid = "62b453cc65b3c03231fb3b56"
        cid = "62e3c481751d5a9c0a8a92d1"

        ext_here = file.split(".")[-1]
        # doc_id = "1111"
        # doc_id = "628b3e4bd82393e0b37d022b"
        doc_id = "1111"

        output = extract(save_path, cid, ext_here, doc_id, save_path, True,
                         False)
        """global_dict, _ = get_global_dict(output, save_path, True)

        for items in global_dict:
            key = items
            value = global_dict[items]"""

        ntc = output[0]["non_table_content"]

        for index1 in range(len(ntc)):
            ind_json = ntc[index1]
            key = ind_json.get("key")
            value = ind_json.get("value")

            df_arr.append({
                "FileName": secure_fn,
                "PageNum": str(0 + 1),
                "Key": key,
                "Value": value
            })

        tc = output[0]["table_content"]
        cell_info = tc[0]["cell_info"]

        df_arr.append({
            "FileName": secure_fn,
            "PageNum": str(0 + 1),
            "Key": "cell_info",
            "Value": cell_info
        })

        # df_arr.append({"FileName":"1",
        #                "PageNum" :"1",
        #                "Key":"1",
        #                "Value":"1"})

        df_arr.append({
            "FileName": "",
            "PageNum": "",
            "Key": "",
            "Value": ""
        })  # just for adding a blank row

    # df_arr.append({"FileName": "",
    #            "Type": "",
    #            "PageNum" : "",
    #            "Key": "",
    #            "Value": ""}) # just for adding a blank row

    basepath = os.getcwd()
    out_fp = os.path.join(basepath, "excel_out", os.path.splitext(zip_name)[0] + ".xlsx")
    df = pd.DataFrame(df_arr)
    df = df[['FileName', 'PageNum', 'Key', 'Value']]
    df.to_excel(out_fp)
    logger.info("Final output file -" + str(out_fp))
    subject = "Finkraft Testing - Processed File : " + zip_name
    # send_response_mail(out_fp, subject)
    send_response_mail(out_fp)
    return True


@app.route('/multi_page')
@cross_origin()
def index():
    # Main page
    return render_template('index2.html')


@app.route('/startBulkProcess', methods=['GET', 'POST'])
@cross_origin()
def bulk_upload():
    if request.method == 'POST':
        # Get the file from post request
        files = request.files
        basepath = os.path.dirname(__file__)
        file = files['file']

        name = secure_filename(file.filename)

        if name.endswith("zip"):
            logger.info("Received zip " + name)
            timestamp = str(time.strftime('%d-%m-%y-%H-%M-%S'))
            dst_folder = os.path.join(basepath, 'uploads', timestamp)
            # dst_folder_files = os.path.join(basepath, 'uploads', timestamp, 'files')
            subprocess.run('mkdir ' + dst_folder, shell=True)
            # subprocess.run('mkdir ' + dst_folder_files, shell=True)
            input_zip = os.path.join(dst_folder, name)
            file.save(input_zip)
            task_bg = Process(target=start_bg_task,
                              args=[dst_folder, name, logger])
            task_bg.start()
            return "Processing started"
        else:
            return "Please upload a zip file"


@app.route('/healthCheck', methods=['GET', 'POST'])
def file_upload_health():
    if request.method == 'GET':
        output = dict({"response": True})
        return jsonify(output)

    
def decode_pdf_fields(file_path_original, cid, extension, doc_id,
                      doc_name_static, df_to_pass, client_customer_id, table_static_columns,
                      document_type_input, map_customer_static, has_external_sheet, time_overall_1):
    
    time_start_page_number = time.perf_counter()
    num_pages = get_num_pages_all(file_path_original)
    
    if num_pages == 0:
        try:
            multool_special_cmd = "mutool clean " + file_path_original + " " + file_path_original
            print("multool_special_cmd :", multool_special_cmd)
            subprocess.check_output(multool_special_cmd, shell = True)
            num_pages = get_num_pages_all(file_path_original)
        except:
            traceback.print_exc()
            num_pages = 0
        
    if num_pages == 0:
        with open(status_flag_file, "w") as f:    
            json.dump({"response" : False, "time" : time.time()}, f)          
        return {"processStart": "FAILURE",
                "error": "[AI]--OUTPUT_FAILURE",
                "errorCode": 1,
                "errorDetails" : "CORRUPT_FILE_TOTAL_PAGES_0"}
      
    task_bg = Process(target=extract_wrapper,
                      args=[
                          file_path_original, cid, extension,
                          doc_id, doc_name_static, df_to_pass, client_customer_id,
                          table_static_columns, document_type_input, map_customer_static,
                          has_external_sheet, time_overall_1
                      ])
    task_bg.start()
    imm_response = {"processStart": "SUCCESS", "totalPages": num_pages}
    print("Immediate Response :", imm_response)
    
    time_end_page_number = time.perf_counter()
    time_page_number = time_end_page_number - time_start_page_number
    print("time_page_number :", time_page_number)
    
    return imm_response


@app.route('/processDocument', methods=['GET', 'POST'])
def file_upload_v1():
    time_overall_1 = time.perf_counter()
    
    global df_master_here
    global df_master_here_bol
    global df_master_here_so
    global df_master_here_stat
    global df_master_here_mhbol
    global df_dict
    
    if request.method == 'POST':
        # Get the file from post request
        print("Step 1 : Request reaches AI completed!")
        
        timestamp = str(time.strftime('%d-%m-%y-%H-%M-%S'))

        busy_flag = True
        time_static = time.time()
        with open(status_flag_file) as f:
            busy_flag = json.load(f).get("response")
            
        print("busy_flag :", busy_flag, timestamp)
            
        if busy_flag:
            print("Failure Response Busy :", {"processStart": "FAILURE","error": "[PLATFORM]--AI_SERVER_BUSY", "errorCode": 54})
            
            return jsonify({"processStart": "FAILURE",
                            "error": "[PLATFORM]--AI_SERVER_BUSY",
                            "errorCode": 54,
                            "timestamp" : time_static})
            
        with open(status_flag_file, "w") as f:    
            json.dump({"response" : True, "time" : time.time()}, f)

        print("busy_flag after :", busy_flag, timestamp)

        try:
            name = request.form['doc_name']
            doc_name_static = name
            print("name : ", name)
            # name = secure_filename(file.filename)
            ends_with = name.split(".")[-1].lower()
            name = (name.replace(" ", "").replace("(", "").replace(")", "").replace("'", "").
                    replace("^", "").replace("$", "").replace("&", "").strip())
            name = ".".join(name.split(".")[:-1]) + "." + ends_with
            file_write_path = os.getcwd() + "/uploads/" + name
            
            try:
                s3_url_file = request.form['s3_url_file']
                s3_bucket.download_from_s3_url_special(s3_url_file, file_write_path)
            except:
                traceback.print_exc()
                # print("Backup except Working")
                # time.sleep(30)
                files = request.files
                file = files['file']
                file.save(file_write_path)
                
            print("Step 2 : Recieved Files completed!")
        except BadRequestKeyError as e:
            print("Here 1 !!!")
            traceback.print_exc()
            format_exc = str(e) # + traceback.format_exc()
            
            with open(status_flag_file, "w") as f:    
                json.dump({"response" : False, "time" : time.time()}, f)

            return jsonify({
                "processStart": "FAILURE",
                "error": "[PLATFORM]--INPUT_PARAMETERS_NOT_CORRECT " + format_exc,
                "errorCode": 55
            })
        except:
            print("Here 2 !!!")
            traceback.print_exc()
            format_exc = traceback.format_exc()
            
            with open(status_flag_file, "w") as f:    
                json.dump({"response" : False, "time" : time.time()}, f)

            print("Returning")
            
            return jsonify({
                "processStart": "FAILURE",
                "error": "[PLATFORM]--INPUT_PARAMETERS_NOT_CORRECT " + format_exc,
                "errorCode": 55
            })

        if (ends_with.lower() not in ["pdf", "jpg", "jpeg", "png", "tif", "tiff"]):
            
            with open(status_flag_file, "w") as f:    
                json.dump({"response" : False, "time" : time.time()}, f)

            return jsonify({
                "processStart": "FAILURE",
                "error": "[PLATFORM]--PLEASE_UPLOAD_PDF_JPG_JPEG_TIF_PNG",
                "errorCode": 52
            })
        else:
            try:
                cid = request.form['customer_id']
                doc_id = request.form['doc_id']
            except:
                traceback.print_exc()
                format_exc = traceback.format_exc()
                
                with open(status_flag_file, "w") as f:    
                    json.dump({"response" : False, "time" : time.time()}, f)

                return jsonify({"processStart": "FAILURE",
                                "error": "[PLATFORM]--INPUT_PARAMETERS_NOT_CORRECT_DOC_ID_C_ID " + format_exc,
                                "errorCode": 56})
        
            try:
                table_static_columns = json.loads(request.form['table_columns'])
            except:
                traceback.print_exc()
                format_exc = traceback.format_exc()
                table_static_columns = []
        
            print("table_static_columns :", table_static_columns)
            # time.sleep(60)
            
            try:
                document_type_input = str(request.form["document_type"])
            except:
                # time.sleep(10)
                traceback.print_exc()
                document_type_input = "Invoices Custom"
                
            print("document_type_input :", document_type_input)

            print("Entering Timestamp")
            timestamp_vl = "DETHA"
            
            if document_type_input.lower() == "invoices custom":
                try:
                    # error_function()
                    timestamp_vl = str(request.form["timestamp"])
                    timestamp_now = timestamp_vl
                    with open(timestamp_flag_file) as f:
                        timestamp_now = json.load(f).get("time")

                    is_new_upload = False
                    if timestamp_now != timestamp_vl:
                        print("Fresh Download Now!")
                        is_new_upload = True                    
                        with open(timestamp_flag_file, "w") as f:
                            json.dump({"time" : timestamp_vl}, f)

                    print("Get going")
                    if is_new_upload:
                        df_master_here = vendor_list_download.download(backend_platform_url, document_type_input)
                        print("New Vendor List Downloaded!")
                except:
                    traceback.print_exc()
                    pass
            elif document_type_input.lower() == "bol":
                try:
                    # error_function()
                    timestamp_vl = str(request.form["timestamp"])
                    timestamp_now = timestamp_vl
                    with open(timestamp_flag_file_bol) as f:
                        timestamp_now = json.load(f).get("time")

                    is_new_upload = False
                    if timestamp_now != timestamp_vl:
                        print("Fresh Download Now!")
                        is_new_upload = True                    
                        with open(timestamp_flag_file_bol, "w") as f:
                            json.dump({"time" : timestamp_vl}, f)

                    print("Get going")
                    if is_new_upload:
                        df_master_here_bol = vendor_list_download.download(backend_platform_url, document_type_input)
                        print("New Vendor List Downloaded!")
                except:
                    traceback.print_exc()
                    pass
            elif document_type_input.lower() == "so":
                try:
                    # error_function()
                    timestamp_vl = str(request.form["timestamp"])
                    timestamp_now = timestamp_vl
                    with open(timestamp_flag_file_so) as f:
                        timestamp_now = json.load(f).get("time")

                    is_new_upload = False
                    if timestamp_now != timestamp_vl:
                        print("Fresh Download Now!")
                        is_new_upload = True                    
                        with open(timestamp_flag_file_so, "w") as f:
                            json.dump({"time" : timestamp_vl}, f)

                    print("Get going")
                    if is_new_upload:
                        df_master_here_so = vendor_list_download.download(backend_platform_url, document_type_input)
                        print("New Vendor List Downloaded!")
                except:
                    traceback.print_exc()
                    pass
            elif document_type_input.lower() == "statements":    
                try:
                    # error_function()
                    timestamp_vl = str(request.form["timestamp"])
                    timestamp_now = timestamp_vl
                    with open(timestamp_flag_file_stat) as f:
                        timestamp_now = json.load(f).get("time")

                    is_new_upload = False
                    if timestamp_now != timestamp_vl:
                        print("Fresh Download Now!")
                        is_new_upload = True                    
                        with open(timestamp_flag_file_stat, "w") as f:
                            json.dump({"time" : timestamp_vl}, f)

                    print("Get going")
                    if is_new_upload:
                        df_master_here_stat = vendor_list_download.download(backend_platform_url, document_type_input)
                        print("New Vendor List Downloaded!")
                except:
                    traceback.print_exc()
                    pass
            elif document_type_input.lower() == "mh bol":    
                try:
                    # error_function()
                    
                    # Change This
                    """try:
                        timestamp_vl = str(request.form["timestamp"])
                    except:
                        traceback.print_exc()
                        timestamp_vl = "TEST_TIMESTAMP" # """
                        
                    timestamp_vl = str(request.form["timestamp"])
                    timestamp_now = timestamp_vl
                    with open(timestamp_flag_file_mhbol) as f:
                        timestamp_now = json.load(f).get("time")

                    is_new_upload = False
                    if timestamp_now != timestamp_vl:
                        print("Fresh Download Now!")
                        is_new_upload = True                    
                        with open(timestamp_flag_file_mhbol, "w") as f:
                            json.dump({"time" : timestamp_vl}, f)

                    print("Get going")
                    if is_new_upload:
                        df_master_here_mhbol = vendor_list_download.download(backend_platform_url, document_type_input)
                        print("New Vendor List Downloaded!")
                except:
                    traceback.print_exc()
                    pass
            else:
                pass

            client_customer_id = "ABHIJEET"
            
            print("A")
            
            try:
                map_customer_static = change_format(cid, doc_id, document_type_input)
                print(cid, doc_id, document_type_input)
                # time.sleep(30)
                external_sheet_dict_static = map_customer_static[5]
            except:
                traceback.print_exc()
                return {"processStart": "FAILURE",
                        "error": "[PLATFORM]--GLOBAL_MAPPING_FAILURE",
                        "errorCode": 51}
            
            external_sheet_static = external_sheet_dict_static.get(document_type_input.lower())
            
            try:
                has_external_sheet = (type(external_sheet_static) == list and len(external_sheet_static) > 0)
            except:
                traceback.print_exc()
                has_external_sheet = False
            
            # print("B :", external_sheet_dict_static)
            
            # time.sleep(30)
            
            if document_type_input.lower() == "invoices custom":
                df_to_pass = df_master_here
            elif document_type_input.lower() == "bol":
                df_to_pass = df_master_here_bol
            elif document_type_input.lower() == "so":
                df_to_pass = df_master_here_so
            elif document_type_input.lower() == "statements":
                df_to_pass = df_master_here_stat
            elif document_type_input.lower() == "mh bol":
                df_to_pass = df_master_here_mhbol
            elif has_external_sheet:
                try:
                    # error_function()
                    # timestamp_vl = time.time()
                    timestamp_vl = str(request.form["timestamp"])
                    timestamp_now = timestamp_vl
                    print("timestamp_now :", timestamp_now)
                    with open(timestamp_flag_file_generic) as f:
                        # timestamp_now = json.load(f).get("time")
                        all_vendor_docs = json.load(f)
                        
                    index_avd = -1    
                    for i_avd in range(len(all_vendor_docs)):
                        vd_here = all_vendor_docs[i_avd]
                        doc_type_vd = vd_here.get("doc_type")
                        if doc_type_vd.lower() == document_type_input.lower():
                            timestamp_now = vd_here.get("time")
                            index_avd = i_avd
                            
                    is_new_upload = False
                    
                    if index_avd == -1:
                        timestamp_now = time.time()
                    
                    if timestamp_now != timestamp_vl:
                        print("Fresh Download Now!")
                        is_new_upload = True
                        if index_avd == -1:
                            all_vendor_docs.append({"doc_type" : document_type_input,
                                                    "time" : timestamp_vl})
                        else:
                            all_vendor_docs[index_avd]["time"] = timestamp_vl
                        with open(timestamp_flag_file_generic, "w") as f:
                            json.dump(all_vendor_docs, f)
                            
                    print("Get going")
                    if is_new_upload:
                        print("tenant_id :", cid)
                        print("document_type_input :", document_type_input)
                        # time.sleep(30)
                        
                        df_to_pass = vendor_list_download.download(backend_platform_url, 
                                                                   document_type_input,
                                                                   tenant_id = cid, 
                                                                   external_sheet = external_sheet_static)
                        print("New Vendor List Downloaded!")
                        df_dict[document_type_input] = df_to_pass
                        print("df_to_pass :", df_to_pass.count())
                        # time.sleep(20)
                    else:
                        df_to_pass = df_dict.get(document_type_input)
                except:
                    traceback.print_exc()
                    # time.sleep(30)
                    # pass   
                    format_exc = traceback.format_exc()

                    with open(status_flag_file, "w") as f:    
                        json.dump({"response" : False, "time" : time.time()}, f)

                    return jsonify({"processStart": "FAILURE",
                                    "error": "[PLATFORM]--INPUT_PARAMETERS_NOT_CORRECT_TIMESTAMP " + format_exc,
                                    "errorCode": 57})
            else:
                df_to_pass = None
                
            try:
                client_customer_id = str(request.form["client_customer_id"])
                df_to_pass = df_to_pass[df_to_pass["Customer_ID"] == client_customer_id] 
            except:
                traceback.print_exc()
                pass
                
            print("doc_id :", doc_id)
            print("Step 3 : Files Saved & Parameters Read completed!")

            # pdf_cleaned_path = os.getcwd() + "/uploads/" + name
            pdf_cleaned_path = file_write_path
            try:
                start_page = int(str(request.form["start_page"]))
                end_page = int(str(request.form["end_page"]))
                
                print("start_page :", start_page)
                print("end_page :", end_page)
                
                # time.sleep(10)
                
                if start_page < 0 or end_page < 0:
                    error_function()
                pdf_cleaned_path = split_pdf_local(pdf_cleaned_path, ends_with.lower(), start_page - 1, end_page)
            except:
                traceback.print_exc()
                # time.sleep(10)
                start_page = -1
                end_page = -1
                
            # time.sleep(30)
                
            output = {
                "processStart": "FAILURE",
                "error": "[AI]--OUTPUT_FAILURE",
                "errorCode": 4
            }
            time_extract = 0
            res = dict()
            try:
                start_time_2 = time.perf_counter()
                print("Step 4 : Going Inside Extract Function completed!")
                res = decode_pdf_fields(pdf_cleaned_path,
                                        cid,
                                        ends_with.lower(),
                                        doc_id,
                                        doc_name_static,
                                        df_to_pass,
                                        client_customer_id,
                                        table_static_columns,
                                        document_type_input,
                                        map_customer_static,
                                        has_external_sheet,
                                        time_overall_1)
                end_time_2 = time.perf_counter()
                time_extract = end_time_2 - start_time_2
            except:
                traceback.print_exc()
                format_exc = traceback.format_exc()
                print()
                print("!!! FAILURE FAILURE FAILURE !!!")
                print()
                res = {
                    "processStart": "FAILURE",
                    "error": "[AI]--OUTPUT_ERROR " + format_exc,
                    "errorCode": 4
                }

            print("Step 5 : Sucessfully Processed Files completed!")
            return jsonify(res)
    else:
        return jsonify({
            "processStart": "FAILURE",
            "error": "[PLATFORM]--NOT_A_POST_REQUEST",
            "errorCode": 53
        })


if __name__ == "__main__":
    app.config['JSON_SORT_KEYS'] = False
    app.run(host=host_address, port=port, threaded=True, debug=False)


