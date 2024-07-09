const mockTrainingResponse = [
  {
    ai_unique_id: '54c96772-6bc9-43c8-a5ba-76f9a06bf4cf',
    customer_id: 'asdasdsss',
    non_table_content: [
      {
        confidence: 'L',
        key: 'seller name',
        page: 0,
        pts_key: null,
        pts_value: null,
        value: null,
      },
      {
        confidence: 'L',
        key: 'buyer name',
        page: 0,
        pts_key: null,
        pts_value: null,
        value: null,
      },
      {
        confidence: 'L',
        key: 'seller address',
        page: 0,
        pts_key: null,
        pts_value: null,
        value: null,
      },
      {
        confidence: 'L',
        key: 'buyer address',
        page: 0,
        pts_key: null,
        pts_value: null,
        value: null,
      },
      {
        confidence: 'L',
        key: 'invoice number',
        page: 0,
        pts_key: [
          0.473,
          0.12840466926070038,
          0.555,
          0.14113901662539796,
        ],
        pts_value: [
          0.4725,
          0.14467633533781393,
          0.608,
          0.1574106827025115,
        ],
        value: 'GINC/0069/21-22',
      },
      {
        confidence: 'L',
        key: 'invoice date',
        page: 0,
        pts_key: [
          0.595,
          0.12875840113194198,
          0.643,
          0.14113901662539796,
        ],
        pts_value: [
          0.4725,
          0.14467633533781393,
          0.608,
          0.1574106827025115,
        ],
        value: 'GINC/0069/21-22',
      },
      {
        confidence: 'L',
        key: 'buyer order number',
        page: 0,
        pts_key: [
          0.473,
          0.16342412451361868,
          0.606,
          0.17651220374955784,
        ],
        pts_value: [
          0.473,
          0.18004952246197384,
          0.747,
          0.19490626105412098,
        ],
        value: 'POUSL00090000088',
      },
      {
        confidence: 'L',
        key: 'order date',
        page: 0,
        pts_key: null,
        pts_value: null,
        value: null,
      },
      {
        confidence: 'L',
        key: 'bank name',
        page: 0,
        pts_key: [
          0.062,
          0.6441457375309515,
          0.152,
          0.6565263530244075,
        ],
        pts_value: [
          0.1915,
          0.64379200565971,
          0.335,
          0.658648744251857,
        ],
        value: 'WELLS FARGO BANK',
      },
      {
        confidence: 'L',
        key: 'account number',
        page: 0,
        pts_key: [
          3.05e-05,
          0.00023348555774206701,
          0.000114,
          0.00023799010226442202,
        ],
        pts_value: [
          3.05e-05,
          0.00023348555774206701,
          0.000114,
          0.00023799010226442202,
        ],
        value: '5414598473',
      },
      {
        confidence: 'L',
        key: 'routing number',
        page: 0,
        pts_key: [
          3.125e-05,
          0.00023924136463174286,
          0.00014099999999999998,
          0.00024449666657449035,
        ],
        pts_value: [
          3.125e-05,
          0.00023924136463174286,
          0.00014099999999999998,
          0.00024449666657449035,
        ],
        value: '121000248',
      },
      {
        confidence: 'L',
        key: 'taxes',
        page: 0,
        pts_key: null,
        pts_value: null,
        value: null,
      },
      {
        confidence: 'L',
        key: 'total amount',
        page: 0,
        pts_key: null,
        pts_value: null,
        value: null,
      },
    ],
    non_table_flag: null,
    page_array: [
      {
        dimension: {
          height: 2827,
          width: 2000,
        },
        ocr_path: '/home/ubuntu/ABHIJEET/INVOICES/TABLE_DETECTION/YOLO_TEST/new/ALL_OCR_OUTPUT_ORIGINAL/Microfocus_Invoice_30.09.2021.json',
        s3_path: 'https://s3-ap-south-1.amazonaws.com/finkraftfiles/Microfocus_Invoice_30.09.2021.jpg',
      },
    ],
    table_content: {
      cell_info: {
        0: {
          Amount: {
            pts: [
              1534,
              1159,
              1690,
              1195,
            ],
            text: '15, 625, .00',
          },
          Particulars: {
            pts: [
              297,
              1158,
              991,
              1301,
            ],
            text: 'Data Visualisation and Consulting Services CyberRes Website Data Storytelling Mjlestone 4, Pllot Release Part 7',
          },
          'SI No.': {
            pts: [
              136,
              1162,
              150,
              1190,
            ],
            text: '1',
          },
        },
      },
      column_vector: [
        194,
        1428,
        1694,
      ],
      row_vector: [
        1083,
        1083,
        1137,
        1301,
      ],
      table_points: [
        100,
        1040,
        1700,
        1420,
      ],
      tbl_x0: 128,
      tbl_x2: 1694,
      tbl_y0: 1046,
      tbl_y2: 1301,
    },
    table_flag: null,
    type_of_document: 'invoices',
  },
];

module.exports = {
  // eslint-disable-next-line import/prefer-default-export
  mockTrainingResponse,
};
