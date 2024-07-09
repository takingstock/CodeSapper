const mockOcrResponse = {
  MainObject: [
    {
      dimension: {
        aspectRatio: 2.459016393442623,
        height: 900,
        width: 366,
      },
      id: 'WB_aadhar_card.jpeg',
      imageUrl: 'https://s3-ap-south-1.amazonaws.com/vision-era-uploads/WB_aadhar_card.jpeg',
      isFlipped: false,
      staticImageWidth: 300,
      suggestions: [],
      textContent: [
        {
          id: 1,
          inputValue: 'Soumick Mondal',
          newlyCreated: false,
          pts: [
            0.17759562841530055,
            0.3022222222222222,
            0.4098360655737705,
            0.31333333333333335,
          ],
          type: 'Name',
          value: 'Soumick Mondal',
        },
        {
          id: 2,
          inputValue: '9903098516',
          newlyCreated: false,
          pts: [
            0.17759562841530055,
            0.4122222222222222,
            0.33879781420765026,
            0.4222222222222222,
          ],
          type: 'Mobile',
          value: '9903098516',
        },
        {
          id: 3,
          inputValue: '8737 1709 8216',
          newlyCreated: false,
          pts: [
            0.20765027322404372,
            0.64,
            0.7431693989071039,
            0.6666666666666666,
          ],
          type: 'Aadhaar Number',
          value: '8737 1709 8216',
        },
        {
          id: 4,
          inputValue: '29/04/1989',
          newlyCreated: false,
          pts: [
            0.32786885245901637,
            0.8688888888888889,
            0.6530054644808743,
            0.8811111111111111,
          ],
          type: 'Date of Birth',
          value: '29/04/1989',
        },
        {
          id: 5,
          inputValue: 'Male',
          newlyCreated: false,
          pts: [
            0.32786885245901637,
            0.8944444444444445,
            0.4562841530054645,
            0.9077777777777778,
          ],
          type: 'Gender',
          value: 'Male',
        },
        {
          id: 6,
          inputValue: 'S/O: Ashis Kumar Mondal',
          newlyCreated: false,
          pts: [
            0.17759562841530055,
            0.3288888888888889,
            0.5136612021857924,
            0.3422222222222222,
          ],
          type: 'Address line 1',
          value: 'S/O: Ashis Kumar Mondal',
        },
        {
          id: 7,
          inputValue: 'SRIDHAR BANSHIDHAR SCHOOL',
          newlyCreated: false,
          pts: [
            0.17759562841530055,
            0.34,
            0.6420765027322405,
            0.3566666666666667,
          ],
          type: 'Address line 2',
          value: 'SRIDHAR BANSHIDHAR SCHOOL',
        },
        {
          id: 8,
          inputValue: '1. SB ROAD',
          newlyCreated: false,
          pts: [
            0.17759562841530055,
            0.3566666666666667,
            0.3442622950819672,
            0.36777777777777776,
          ],
          type: 'Address line 3',
          value: '1. SB ROAD',
        },
        {
          id: 9,
          inputValue: 'North Barrackpore (m)',
          newlyCreated: false,
          pts: [
            0.17759562841530055,
            0.3688888888888889,
            0.4672131147540984,
            0.3844444444444444,
          ],
          type: 'Address line 4',
          value: 'North Barrackpore (m)',
        },
        {
          id: 10,
          inputValue: 'Ichapur Nawabganj, North 24 Paraganas, North 24 Parganas,',
          newlyCreated: false,
          pts: [
            0.17759562841530055,
            0.38222222222222224,
            0.9644808743169399,
            0.4022222222222222,
          ],
          type: 'Address line 5',
          value: 'Ichapur Nawabganj, North 24 Paraganas, North 24 Parganas,',
        },
        {
          id: 11,
          inputValue: 'West Bengal - 743144',
          newlyCreated: false,
          pts: [
            0.17486338797814208,
            0.39666666666666667,
            0.4644808743169399,
            0.4111111111111111,
          ],
          type: 'Address line 6',
          value: 'West Bengal - 743144',
        },
      ],
      type: 'aadhaar',
    },
  ],
};

const invoice = (customerId, docId) => (
  {
    "non_table_content":
      [
        {
          "local_key": "",
          "key": "Invoice Date",
          "value": "30/09/2020",
          "confidence": 92,
          "page": 0,
          "pts_key": [],
          "pts_value": [539, 172, 587, 187],
          "mandatory": true,
          "type": "date",
          "embeds_score": 92
        },
        {
          "local_key": "",
          "key": "Invoice Number",
          "value": "AP07000024742021",
          "confidence": 91,
          "page": 0,
          "pts_key": [],
          "pts_value": [504, 126, 616, 141],
          "mandatory": true,
          "type": "alphanumeric",
          "embeds_score": 95
        },
        {
          "local_key": "",
          "key": "Supplier Name",
          "value": "AIR CANADA",
          "confidence": 92,
          "page": 0,
          "pts_key": [],
          "pts_value": [32, 162, 96, 178],
          "mandatory": true,
          "type": "string",
          "embeds_score": 94
        },
        {
          "local_key": "",
          "key": "Total Invoice Amount",
          "value": "81921.0",
          "confidence": 95,
          "page": 0,
          "pts_key": [],
          "pts_value": [949, 391, 991, 407],
          "mandatory": true,
          "type": "number",
          "embeds_score": 91
        }, { "local_key": "", "key": "Total Tax Amount", "value": "7802.0", "confidence": 96, "page": 0, "pts_key": [], "pts_value": [858, 370, 895, 385], "mandatory": false, "type": "number", "embeds_score": 92 }, { "local_key": "", "key": "Supplier Tax Identification Number", "value": "07AACCA8260F1ZU", "confidence": 93, "page": 0, "pts_key": [], "pts_value": [33, 261, 160, 278], "mandatory": false, "type": "alphanumeric", "embeds_score": 94 }],
    "table_content": [{ "tbl_x0": 10, "tbl_y0": 332, "tbl_x2": 1014, "tbl_y2": 408, "column_vector": [27, 386, 539, 665, 988], "row_vector": [296, 329, 370, 409], "cell_info": [[{ "column": "Description", "local_column": "Date", "text": "10/09/2020", "pts": [37, 372, 82, 384] }, { "column": "Quantity", "local_column": "Base Value", "text": "58,320.00", "pts": [503, 371, 544, 385] }], [{ "column": "Description", "local_column": "Date", "text": "TOTAL", "pts": [33, 393, 75, 408] }, { "column": "Quantity", "local_column": "Base Value", "text": "58,320.00", "pts": [503, 391, 544, 407] }]], "hdr_row": [{ "text": "Date", "pts": [10, 333, 74, 349], "ids": ["70"], "id": "70" }, { "text": "Class", "pts": [89, 333, 123, 349], "ids": ["69"], "id": "69" }, { "text": "Ticket No.", "pts": [222, 334, 272, 351], "ids": ["56-57"], "id": "56-57" }, { "text": "Orig", "pts": [378, 332, 407, 351], "ids": ["68"], "id": "68" }, { "text": "Dest", "pts": [419, 332, 450, 350], "ids": ["67"], "id": "67" }, { "text": "Base Value", "pts": [472, 335, 526, 350], "ids": ["55-54"], "id": "55-54" }, { "text": "Surcharge", "pts": [561, 335, 609, 351], "ids": ["53"], "id": "53" }, { "text": "CGST 0.009% SGST 0.00% IGST 5.009% Total Net Amount", "pts": [639, 332, 1014, 350], "ids": ["63-62", "61-60", "66-59", "65-64-58"], "id": "63-6261-6066-5965-64-58" }], "column_match": { "Description": "Date", "Quantity": "Base Value", "Amount": "CGST 0.009% SGST 0.00% IGST 5.009% Total Net Amount" } }],
    "type_of_document": "Invoices Static",
    "customer_id": customerId,
    "doc_id": docId,
    "confidence_score_document": 93,
    "ai_unique_id": "ac79de6d-b646-4fa7-a391-07901ed125f0",
    "page_array": [{ "dimension": { "height": 724, "width": 1024 }, "ocr_path": "/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT_ORIGINAL/27AAACR4849R1ZL_TaxInvoice_AP07000024742021_09-30-2020_1.json", "s3_path": "https://s3-ap-south-1.amazonaws.com/vision-era-uploads/27AAACR4849R1ZL_TaxInvoice_AP07000024742021_09-30-2020_1.jpg", "jpg_path": "/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/uploads/27AAACR4849R1ZL_TaxInvoice_AP07000024742021_09-30-2020_1.jpg", "all_kvp_path": "/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT/27AAACR4849R1ZL_TaxInvoice_AP07000024742021_09-30-2020_1_global_kvp.json", "s3_path_ocr": "https://s3-ap-south-1.amazonaws.com/vision-era-uploads/27AAACR4849R1ZL_TaxInvoice_AP07000024742021_09-30-2020_1.json", "ocr_path_output": "/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT/27AAACR4849R1ZL_TaxInvoice_AP07000024742021_09-30-2020_1__20221018-141954__output.json", "cell_input_path": "", "tod_input_path": "/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT/27AAACR4849R1ZL_TaxInvoice_AP07000024742021_09-30-2020_1_tod_input.json", "ocr_path_table_detection_input": "", "table_points_image_path": "", "cell_extraction_image_path": "", "ocr_path_output_original": "/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT/27AAACR4849R1ZL_TaxInvoice_AP07000024742021_09-30-2020_1_output_original_633a7a759ec3b4581bb7e75f.json", "ocr_path_stitched": "/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT/27AAACR4849R1ZL_TaxInvoice_AP07000024742021_09-30-2020_1.json", "ggk_input_path": "", "time_conv_ocr": -1, "time_govt_id": -1, "time_kvp": -1, "time_table": -1, "time_cell_extraction": -1, "time_doc_type": -1, "time_doc_keys": -1, "time_table_save": -1, "time_s3_upload": -1, "time_draw_contours": -1, "page": 0, "s3_ocr_path_output": "https://s3-ap-south-1.amazonaws.com/vision-era-uploads/27AAACR4849R1ZL_TaxInvoice_AP07000024742021_09-30-2020_1__20221018-141954__output.json", "time_upload_files": 0.0037270616739988327, "time_extract": 20.501198379322886 }],
    "non_table_flag": true,
    "table_flag": true,
    "forward_feedback_kvp_flag": true,
    "forward_feedback_flag_table": false,
    "master_sim_score": { "Invoices Static": 66 },
    "doc_list": ["Invoices Static"],
    "file_name": "27AAACR4849R1ZL_Tax Invoice_AP07000024742021_09-30-2020_1.jpg"
  })

const mockOcrResponseSource = () => Promise.resolve(mockOcrResponse);
const mockVoice = async (customerId, documentId) => {
  console.log("sent request")
  const r = invoice(customerId, documentId)
  return Promise.resolve(r)
}
const mockTableInvoice = (customerId, docId) => {
  return [{
    "non_table_content": [{
      "local_key": "AccoUnt No",
      "key": "Account Number",
      "value": "3513752596",
      "confidence": 89,
      "page": 0,
      "pts_key": [1288, 841, 1470, 885],
      "pts_value": [1692, 841, 1884, 889],
      "mandatory": true,
      "type": "number",
      "embeds_score": 100
    },
    {
      "local_key": "Branch",
      "key": "Branch",
      "value": "TIRUPUR",
      "confidence": 85,
      "page": 0,
      "pts_key": [1288, 974, 1403, 1022],
      "pts_value": [1692, 974, 1847, 1022],
      "mandatory": false,
      "type": "string",
      "embeds_score": 100
    },
    {
      "local_key": "",
      "key": "Customer Name",
      "value": "",
      "confidence": 0,
      "page": 0,
      "pts_key": [],
      "pts_value": [],
      "mandatory": true,
      "type": "string",
      "embeds_score": 0
    },
    {
      "local_key": "Kotak Mahinara Bank",
      "key": "Bank",
      "value": "O1-O4-2O2O",
      "confidence": 88,
      "page": 0,
      "pts_key": [1677, 510, 2283, 583],
      "pts_value": [1692, 704, 1869, 752],
      "mandatory": true,
      "type": "string",
      "embeds_score": 95
    },
    {
      "local_key": "DATE :",
      "key": "Start Date",
      "value": "LC",
      "confidence": 86,
      "page": 0,
      "pts_key": [571, 3678, 721, 3742],
      "pts_value": [903, 3746, 1147, 3867],
      "mandatory": false,
      "type": "date",
      "embeds_score": 76
    },
    {
      "local_key": "",
      "key": "End Date",
      "value": "",
      "confidence": 0,
      "page": 0,
      "pts_key": [],
      "pts_value": [],
      "mandatory": false,
      "type": "date",
      "embeds_score": 0
    },
    {
      "local_key": "",
      "key": "Closing Balance",
      "value": "",
      "confidence": 0,
      "page": 0,
      "pts_key": [],
      "pts_value": [],
      "mandatory": false,
      "type": "number",
      "embeds_score": 0
    },
    {
      "local_key": "",
      "key": "Opening Balance",
      "value": "",
      "confidence": 0,
      "page": 0,
      "pts_key": [],
      "pts_value": [],
      "mandatory": false,
      "type": "number",
      "embeds_score": 0
    }],
    "table_content": [{
      "tbl_x0": 10,
      "tbl_y0": 1394,
      "tbl_x2": 2512,
      "tbl_y2": 3234,
      "column_vector": [10, 216, 768, 1396, 1731, 1810, 2512],
      "row_vector": [1394,
        1482,
        1531,
        1616,
        1688,
        1753,
        1829,
        1910,
        1967,
        2055,
        2136,
        2197,
        2269,
        2338,
        2402,
        2483,
        2560,
        2636,
        2713,
        2782,
        2858,
        2939,
        3012,
        3052,
        3157,
        3234],
      "cell_info": [[{
        "column": "abc",
        "local_column": "Date",
        "text": "B/F",
        "pts": [278, 1478, 339, 1531]
      }],
      [{
        "column": "abc",
        "local_column": "Date",
        "text": "25-04-2020 Chrg : Weekly Bal Alerts",
        "pts": [61, 1547, 632, 1599]
      },
      {
        "column": "cde",
        "local_column": "( Dr )/",
        "text": "23.60(Dr )",
        "pts": [1724, 1551, 1871, 1599]
      }],
      [{
        "column": "abc",
        "local_column": "Date",
        "text": "26-05-2020 BR: ETAX",
        "pts": [61, 1624, 433, 1672]
      },
      {
        "column": "cde",
        "local_column": "( Dr )/",
        "text": "1,121.00( Dr )",
        "pts": [1682, 1628, 1874, 1684]
      }],
      [{
        "column": "abc",
        "local_column": "Date",
        "text": "06-06-2020 Chrg : Weekly Bal Alerts",
        "pts": [64, 1688, 632, 1741]
      },
      {
        "column": "cde",
        "local_column": "( Dr )/",
        "text": "23.60(Dr )",
        "pts": [1724, 1692, 1871, 1745]
      }],
      [{
        "column": "abc",
        "local_column": "Date",
        "text": "25-06-2020 Chrg: Weekly Bal Alerts",
        "pts": [61, 1765, 630, 1817]
      },
      {
        "column": "cde",
        "local_column": "( Dr )/",
        "text": "23.60(Dr)",
        "pts": [1724, 1773, 1871, 1821]
      }],
      [{
        "column": "abc",
        "local_column": "Date",
        "text": "04-07-2020 CASH WITHDRAWAL",
        "pts": [59, 1842, 608, 1890]
      },
      {
        "column": "cde",
        "local_column": "( Dr )/",
        "text": "148,900.00(DR)",
        "pts": [1645, 1850, 1871, 1898]
      }],
      [{
        "column": "abc",
        "local_column": "Date",
        "text": "17-07-2020 Chrg : Weekly Bal Alerts",
        "pts": [64, 1910, 630, 1963]
      },
      {
        "column": "cde",
        "local_column": "( Dr )/",
        "text": "23.60(Dr )",
        "pts": [1724, 1918, 1869, 1967]
      }],
      [{
        "column": "abc",
        "local_column": "Date",
        "text": "23-07-2020 Received from MERC",
        "pts": [61, 1987, 600, 2039]
      },
      {
        "column": "cde",
        "local_column": "( Dr )/",
        "text": "52,300.00(Cr)",
        "pts": [1657, 1991, 1871, 2051]
      }],
      [{
        "column": "abc",
        "local_column": "Date",
        "text": "31-07-2020 CASH WITHDRAWAL BY R TIRUPUR",
        "pts": [61, 2055, 696, 2136]
      },
      {
        "column": "cde",
        "local_column": "( Dr )/",
        "text": "52,300.00( Dr)",
        "pts": [1657, 2059, 1871, 2120]
      }],
      [{
        "column": "abc",
        "local_column": "Date",
        "text": "07-08-2020 CASH DEPOSIT BY",
        "pts": [59, 2128, 581, 2185]
      },
      {
        "column": "cde",
        "local_column": "( Dr )/",
        "text": "5,000.00(Cr )",
        "pts": [1677, 2144, 1869, 2193]
      }],
      [{
        "column": "abc",
        "local_column": "Date",
        "text": "07-08-2020 BR: ETAX GST",
        "pts": [59, 2197, 507, 2249]
      },
      {
        "column": "cde",
        "local_column": "( Dr )/",
        "text": "2,616.00(Dr )",
        "pts": [1677, 2213, 1866, 2261]
      }],
      [{
        "column": "abc",
        "local_column": "Date",
        "text": "07-08-2020 Received from MERC XX2101",
        "pts": [56, 2261, 724, 2314]
      },
      {
        "column": "cde",
        "local_column": "( Dr )/",
        "text": "2,640.00(Cr)",
        "pts": [1677, 2277, 1869, 2334]
      }],
      [{
        "column": "abc",
        "local_column": "Date",
        "text": "13-08-2020 TO CLG JOHN MUTHU",
        "pts": [59, 2326, 625, 2378]
      },
      {
        "column": "cde",
        "local_column": "( Dr )/",
        "text": "5,000.00(Dr)",
        "pts": [1677, 2346, 1866, 2394]
      }],
      [{
        "column": "abc",
        "local_column": "Date",
        "text": "19-08-2020 NEFT AXMB202325505262 UTIB0002810",
        "pts": [61, 2394, 687, 2483]
      },
      {
        "column": "cde",
        "local_column": "( Dr )/",
        "text": "5,000.00(Cr )",
        "pts": [1672, 2411, 1869, 2471]
      }],
      [{
        "column": "abc",
        "local_column": "Date",
        "text": "19-08-2020 RTGS UTIBR52020081900358185 UTIB",
        "pts": [56, 2471, 788, 2560]
      },
      {
        "column": "efg",
        "local_column": "Withdrawal Deposit",
        "text": "300,000.00(Cr )",
        "pts": [1637, 2495, 1864, 2544]
      },
      {
        "column": "cde",
        "local_column": "( Dr )/",
        "text": "300,000.00(Cr )",
        "pts": [1637, 2495, 1864, 2544]
      }],
      [{
        "column": "abc",
        "local_column": "Date",
        "text": "20-08-2020 CASH WITHDRAWAL TIRUPUR",
        "pts": [54, 2548, 600, 2636]
      },
      {
        "column": "efg",
        "local_column": "Withdrawal Deposit",
        "text": "300,000.00(Dr )",
        "pts": [1637, 2572, 1864, 2624]
      },
      {
        "column": "cde",
        "local_column": "( Dr )/",
        "text": "300,000.00(Dr )",
        "pts": [1637, 2572, 1864, 2624]
      }],
      [{
        "column": "abc",
        "local_column": "Date",
        "text": "08-09-2020 Chrg : Debit Card ANnual",
        "pts": [54, 2624, 635, 2681]
      },
      {
        "column": "cde",
        "local_column": "( Dr )/",
        "text": "295.00(Dr )",
        "pts": [1696, 2649, 1864, 2705]
      }],
      [{
        "column": "abc",
        "local_column": "Date",
        "text": "10-09-2020 NEFT AXMB202545369603 UTIB0002810",
        "pts": [54, 2689, 684, 2782]
      },
      {
        "column": "cde",
        "local_column": "( Dr )/",
        "text": "50,000.00(Cr)",
        "pts": [1650, 2717, 1864, 2770]
      }],
      [{
        "column": "abc",
        "local_column": "Date",
        "text": "11-09-2020 CASH WITHDRAWAL BY TIRUPUR",
        "pts": [51, 2766, 650, 2858]
      },
      {
        "column": "cde",
        "local_column": "( Dr )/",
        "text": "54,700.00(Dr)",
        "pts": [1647, 2794, 1864, 2854]
      }],
      [{
        "column": "abc",
        "local_column": "Date",
        "text": "23-09-2020 Chrg : Weekly Bal Alerts",
        "pts": [46, 2842, 618, 2903]
      },
      {
        "column": "cde",
        "local_column": "( Dr )/",
        "text": "23.60(Dr )",
        "pts": [1701, 2875, 1859, 2927]
      }],
      [{
        "column": "abc",
        "local_column": "Date",
        "text": "16-10-2020 NEFT AXMB202909702771 UTIB0002810",
        "pts": [51, 2911, 677, 3004]
      },
      {
        "column": "efg",
        "local_column": "Withdrawal Deposit",
        "text": "100,000.00 ( Cr)",
        "pts": [1630, 2939, 1859, 3000]
      },
      {
        "column": "cde",
        "local_column": "( Dr )/",
        "text": "100,000.00 ( Cr)",
        "pts": [1630, 2939, 1859, 3000]
      }],
      [{
        "column": "abc",
        "local_column": "Date",
        "text": "17-10-2020 CASH WITHDRAWAL BY SELF AT TIRUPUR",
        "pts": [46, 2988, 950, 3052]
      }],
      [{
        "column": "abc",
        "local_column": "Date",
        "text": "21-10-2020 NEFT AXMB202951726620 UTIB0002810",
        "pts": [41, 3052, 672, 3145]
      },
      {
        "column": "efg",
        "local_column": "Withdrawal Deposit",
        "text": "100,000.00( Dr ) 175,000.00(Cr )",
        "pts": [1627, 3020, 1859, 3141]
      },
      {
        "column": "cde",
        "local_column": "( Dr )/",
        "text": "100,000.00( Dr ) 175,000.00(Cr )",
        "pts": [1627, 3020, 1859, 3141]
      }],
      [{
        "column": "abc",
        "local_column": "Date",
        "text": "22-10-2020 CASH WITHDRAWAL",
        "pts": [39, 3129, 586, 3185]
      },
      {
        "column": "efg",
        "local_column": "Withdrawal Deposit",
        "text": "175,000.00(Dr)",
        "pts": [1625, 3165, 1857, 3226]
      },
      {
        "column": "cde",
        "local_column": "( Dr )/",
        "text": "175,000.00(Dr)",
        "pts": [1625, 3165, 1857, 3226]
      }]],
      "hdr_row": [{
        "text": "Date",
        "pts": [10, 1410, 216, 1458],
        "ids": ["282"],
        "id": "282"
      },
      {
        "text": "Narration",
        "pts": [613, 1410, 768, 1458],
        "ids": ["281"],
        "id": "281"
      },
      {
        "text": "( Dr )/",
        "pts": [1733, 1394, 1810, 1446],
        "ids": ["283"],
        "id": "283"
      },
      {
        "text": "Balance",
        "pts": [2044, 1410, 2512, 1458],
        "ids": ["279"],
        "id": "279"
      },
      {
        "id": "278",
        "ids": [278],
        "pts": [1201, 1410, 1396, 1462],
        "text": "No Chq/Ref"
      },
      {
        "id": "276",
        "ids": [276],
        "pts": [1546, 1398, 1731, 1482],
        "text": "Withdrawal Deposit"
      }],
      "table_points": [41, 1410, 2359, 3234],
      "page": 0,
      "column_match": {
        "abc": "Date",
        "cde": "( Dr )/",
        "efg": "Withdrawal Deposit"
      }
    }],
    "type_of_document": "Invoices Custom",
    "customer_id": customerId,
    "doc_id": docId,
    "confidence_score_document": 73,
    "ai_unique_id": "2b5b7d50-6a99-4ac5-8f89-4dad1c352f41",
    "page_array": [{
      "dimension": { "height": 4132, "width": 2522 },
      "ocr_path": "/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT_ORIGINAL/A01_BANK_STATEMENT06_Nov_2020_16_49_48null-0.json",
      "s3_path": "https://s3-ap-south-1.amazonaws.com/vision-era-uploads/A01_BANK_STATEMENT06_Nov_2020_16_49_48null-0.jpg",
      "jpg_path": "/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/uploads/A01_BANK_STATEMENT06_Nov_2020_16_49_48null-0.jpg",
      "all_kvp_path": "/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT/A01_BANK_STATEMENT06_Nov_2020_16_49_48null-0_global_kvp.json",
      "s3_path_ocr": "https://s3-ap-south-1.amazonaws.com/vision-era-uploads/A01_BANK_STATEMENT06_Nov_2020_16_49_48null-0.json",
      "s3_path_ocr_stitched": "https://s3-ap-south-1.amazonaws.com/vision-era-uploads/A01_BANK_STATEMENT06_Nov_2020_16_49_48null-0.json",
      "ocr_path_output": "/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT/A01_BANK_STATEMENT06_Nov_2020_16_49_48null-0__20220830-154913__output.json",
      "cell_input_path": "/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT/A01_BANK_STATEMENT06_Nov_2020_16_49_48null-0_cell_input.json",
      "tod_input_path": "/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT/A01_BANK_STATEMENT06_Nov_2020_16_49_48null-0_tod_input.json",
      "ocr_path_table_detection_input": "/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT/A01_BANK_STATEMENT06_Nov_2020_16_49_48null-0_table_detection_input.json",
      "table_points_image_path": "/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/TABLE_DETECTION_TEST/A01_BANK_STATEMENT06_Nov_2020_16_49_48null-0.jpg",
      "cell_extraction_image_path": "/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/CELL_EXTRACTION_TEST_ALL/A01_BANK_STATEMENT06_Nov_2020_16_49_48null-0.jpg",
      "ocr_path_output_original": "/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT/A01_BANK_STATEMENT06_Nov_2020_16_49_48null-0_output_original_62e3c481751d5a9c0a8a92d1.json",
      "ocr_path_stitched": "/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT/A01_BANK_STATEMENT06_Nov_2020_16_49_48null-0.json",
      "ggk_input_path": "/home/ubuntu/ABHIJEET/INVOICES/CURTISS_WRIGHT/DEV/ALL_OCR_OUTPUT/A01_BANK_STATEMENT06_Nov_2020_16_49_48null-0_ggk_input.json",
      "time_conv_ocr": 0.001152118667960167,
      "time_govt_id": 1.360622518695891,
      "time_kvp": 5.594158275052905,
      "time_table": 1.6447982024401426,
      "time_cell_extraction": 3.512173069640994,
      "time_doc_type": 1.8403674233704805,
      "time_doc_keys": 1.452277929522097,
      "time_table_save": 0.7674642447382212,
      "time_s3_upload": 0.184370337985456,
      "time_draw_contours": 4.0996819734573364e-06,
      "page": 0,
      "time_forward_feedback_kvp": 0.7568095698952675,
      "s3_ocr_path_output": "https://s3-ap-south-1.amazonaws.com/vision-era-uploads/A01_BANK_STATEMENT06_Nov_2020_16_49_48null-0__20220830-154913__output.json"
    }],
    "non_table_flag": false,
    "table_flag": true,
    "forward_feedback_kvp_flag": true,
    "forward_feedback_flag_table": false,
    "master_sim_score": { "Invoices Custom": 66 },
    "doc_list": ["Invoices Custom"],
    "file_name": "A01_BANK_STATEMENT06_Nov_2020_16_49_48null-0.jpg"
  }]
}
module.exports = {
  // eslint-disable-next-line import/prefer-default-export
  mockOcrResponseSource,
  mockVoice,
  mockTableInvoice
};
