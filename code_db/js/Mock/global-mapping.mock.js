// /* eslint-disable-no-unused-vars camelcase */
// const GLOBAL_MAPPING_MOCK_OLD = [
//   {
//     docCategory: 'INSURANCE',
//     isDefaultDoc: true,
//     isTablePresent: false,
//     documentType: 'Insurance Policy',
//     mapping: [
//       {
//         key: 'Chassis Number',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//       {
//         key: 'Engine Number',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//       {
//         key: 'Hypothecation details',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'IDV',
//         dataType: 'number',
//         isRequired: true,
//       },
//       {
//         key: 'Insured Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'Policy Expiry Date',
//         dataType: 'date',
//         isRequired: true,
//       },
//       {
//         key: 'Policy Number',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//       {
//         key: 'Registration Number',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//       {
//         key: 'Year of manufacture',
//         dataType: 'number',
//         isRequired: true,
//       },
//     ],
//   },
//   {
//     docCategory: 'SALARY',
//     isDefaultDoc: true,
//     isTablePresent: false,
//     documentType: 'Salary Slip',
//     mapping: [
//       {
//         key: 'Bank Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'Basic salary',
//         dataType: 'number',
//         isRequired: true,
//       },
//       {
//         key: 'Date of joining',
//         dataType: 'date',
//         isRequired: true,
//       },
//       {
//         key: 'Employee code',
//         dataType: 'number',
//         isRequired: true,
//       },
//       {
//         key: 'HRA',
//         dataType: 'number',
//         isRequired: true,
//       },
//       {
//         key: 'Income Tax',
//         dataType: 'number',
//         isRequired: true,
//       },
//       {
//         key: 'Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'Net Salary',
//         dataType: 'number',
//         isRequired: true,
//       },
//       {
//         key: 'PAN number',
//         dataType: 'number',
//         isRequired: true,
//       },
//       {
//         key: 'PF account number',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//       {
//         key: 'UAN',
//         dataType: 'number',
//         isRequired: true,
//       },
//     ],
//   },
//   {
//     docCategory: 'INVOICE',
//     isDefaultDoc: true,
//     isTablePresent: true,
//     documentType: 'Invoice Main',
//     mapping: [
//       {
//         key: 'Buyer Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'Buyer UID',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//       {
//         key: 'Invoice Date',
//         dataType: 'date',
//         isRequired: true,
//       },
//       {
//         key: 'Invoice Number',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//       {
//         key: 'Supplier Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'Supplier UID',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//       {
//         key: 'Taxes',
//         dataType: 'number',
//         isRequired: true,
//       },
//       {
//         key: 'Total Amount',
//         dataType: 'number',
//         isRequired: true,
//       },
//     ],
//   },
//   {
//     docCategory: 'TRANSACTION_STATEMENT',
//     isDefaultDoc: true,
//     isTablePresent: true,
//     documentType: 'Bank Statement',
//     mapping: [
//       {
//         key: 'Account Number',
//         dataType: 'number',
//         isRequired: true,
//       },
//       {
//         key: 'Bank',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'Branch',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'Closing Balance',
//         dataType: 'number',
//         isRequired: true,
//       },
//       {
//         key: 'Customer Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'From Date',
//         dataType: 'date',
//         isRequired: true,
//       },
//       {
//         key: 'Opening Balance',
//         dataType: 'number',
//         isRequired: true,
//       },
//       {
//         key: 'To Date',
//         dataType: 'date',
//         isRequired: true,
//       },
//     ],
//   },
//   {
//     docCategory: 'GOVT',
//     isDefaultDoc: true,
//     isTablePresent: false,
//     documentType: 'Pan',
//     mapping: [
//       {
//         key: 'Date of Birth',
//         dataType: 'date',
//         isRequired: true,
//       },
//       {
//         key: 'Father Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'PAN Number',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//     ],
//   },
//   {
//     docCategory: 'GOVT',
//     isDefaultDoc: true,
//     isTablePresent: false,
//     documentType: 'Aadhaar',
//     mapping: [
//       {
//         key: 'Aadhaar Number',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//       {
//         key: 'Address',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//       {
//         key: 'Date of Birth',
//         dataType: 'date',
//         isRequired: true,
//       },
//       {
//         key: 'Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//     ],
//   },
//   {
//     docCategory: 'GOVT',
//     isDefaultDoc: true,
//     isTablePresent: false,
//     documentType: 'Driving License',
//     mapping: [
//       {
//         key: 'Address',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//       {
//         key: 'D/L No',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//       {
//         key: 'Date of Birth',
//         dataType: 'date',
//         isRequired: true,
//       },
//       {
//         key: 'Expiry Date',
//         dataType: 'date',
//         isRequired: true,
//       },
//       {
//         key: 'Father Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'Issue Date',
//         dataType: 'date',
//         isRequired: true,
//       },
//       {
//         key: 'name\n\n\nName\nName',
//         dataType: 'string',
//         isRequired: true,
//       },
//     ],
//   },
//   {
//     docCategory: 'GOVT',
//     isDefaultDoc: true,
//     isTablePresent: false,
//     documentType: 'Voter Id',
//     mapping: [
//       {
//         key: 'Address',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//       {
//         key: 'Date of Birth',
//         dataType: 'date',
//         isRequired: true,
//       },
//       {
//         key: 'Father/Spouse Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'Voter ID No',
//         dataType: 'number',
//         isRequired: true,
//       },
//     ],
//   },
//   {
//     docCategory: 'GOVT',
//     isDefaultDoc: true,
//     isTablePresent: false,
//     documentType: 'Passport',
//     mapping: [
//       {
//         key: 'Address',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//       {
//         key: 'Expiry Date',
//         dataType: 'date',
//         isRequired: true,
//       },
//       {
//         key: 'Father Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'Issue Date',
//         dataType: 'date',
//         isRequired: true,
//       },
//       {
//         key: 'Mother Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'Spouse Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//     ],
//   },
// ];
// /* eslint-disable-no-unused-vars camelcase */
// const GLOBAL_MAPPING_MOCK_OLD_2 = [
//   {
//     docCategory: 'INVOICE',
//     isDefaultDoc: true,
//     isTablePresent: true,
//     documentType: 'Invoices',
//     mapping: [
//       {
//         key: 'Buyer Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'Buyer UID',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//       {
//         key: 'Invoice Date',
//         dataType: 'date',
//         isRequired: true,
//       },
//       {
//         key: 'Invoice Number',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//       {
//         key: 'Supplier Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'Supplier UID',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//       {
//         key: 'Taxes',
//         dataType: 'number',
//         isRequired: true,
//       },
//       {
//         key: 'Total Amount',
//         dataType: 'number',
//         isRequired: true,
//       },
//     ],
//   },
//   {
//     docCategory: 'OTHER',
//     isDefaultDoc: true,
//     isTablePresent: false,
//     documentType: 'Onboarding Form',
//     mapping: [
//       {
//         key: 'Date of Birth',
//         dataType: 'date',
//         isRequired: true,
//       },
//       {
//         key: 'Father Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'PAN Number',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//       {
//         key: 'PAN Number',
//         dataType: 'alphanumeric',
//         isRequired: false,
//       },
//       {
//         key: 'Aadhaar Number',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//     ],
//   },
//   {
//     docCategory: 'GOVT',
//     isDefaultDoc: true,
//     isTablePresent: false,
//     documentType: 'PAN',
//     mapping: [
//       {
//         key: 'Date of Birth',
//         dataType: 'date',
//         isRequired: true,
//       },
//       {
//         key: 'Father Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'PAN Number',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//     ],
//   },
//   {
//     docCategory: 'GOVT',
//     isDefaultDoc: true,
//     isTablePresent: false,
//     documentType: "Drivers' License",
//     mapping: [
//       {
//         key: 'Address',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//       {
//         key: 'D/L No',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//       {
//         key: 'Date of Birth',
//         dataType: 'date',
//         isRequired: true,
//       },
//       {
//         key: 'Expiry Date',
//         dataType: 'date',
//         isRequired: true,
//       },
//       {
//         key: 'Father Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'Issue Date',
//         dataType: 'date',
//         isRequired: true,
//       },
//       {
//         key: 'name\n\n\nName\nName',
//         dataType: 'string',
//         isRequired: true,
//       },
//     ],
//   },
//   {
//     docCategory: 'GOVT',
//     isDefaultDoc: true,
//     isTablePresent: false,
//     documentType: 'Passport',
//     mapping: [
//       {
//         key: 'Address',
//         dataType: 'alphanumeric',
//         isRequired: true,
//       },
//       {
//         key: 'Expiry Date',
//         dataType: 'date',
//         isRequired: true,
//       },
//       {
//         key: 'Father Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'Issue Date',
//         dataType: 'date',
//         isRequired: true,
//       },
//       {
//         key: 'Mother Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//       {
//         key: 'Spouse Name',
//         dataType: 'string',
//         isRequired: true,
//       },
//     ],
//   },
// ]
// /* eslint-disable-no-unused-vars camelcase */

// eslint-disable-next-line no-unused-vars
const GLOBAL_MAPPING_MOCK = [
  // {
  //   docCategory: 'INVOICE',
  //   isDefaultDoc: true,
  //   isTablePresent: true,
  //   documentType: 'Invoices',
  //   seedId: "seedId_1",
  //   mapping: [
  //     {
  //       key: 'Invoice Number',
  //       dataType: 'alphanumeric',
  //       isRequired: true,
  //       description: 'Series/ string of numbers or numbers and alphabets that serves as a unique identification for the document'
  //     },
  //     {
  //       key: 'Invoice Date',
  //       dataType: 'date',
  //       isRequired: true,
  //       description: 'Date on which the invoice was generated'
  //     },
  //     {
  //       key: 'Total Invoice Amount',
  //       dataType: 'number',
  //       isRequired: true,
  //     },
  //     {
  //       key: 'Supplier Name',
  //       dataType: 'string',
  //       isRequired: false,
  //       description: 'Name of the company, seller or organisation that generates the invoice'
  //     },
  //     {
  //       key: 'Buyer Name',
  //       dataType: 'string',
  //       isRequired: false,
  //       description: 'Name of the customer or recipient that is liable to pay the amount on the invoice'
  //     },
  //     {
  //       key: 'Total Tax Amount',
  //       dataType: 'number',
  //       isRequired: false,
  //     },
  //     {
  //       key: 'Supplier Unique Identification Number',
  //       dataType: 'alphanumeric',
  //       isRequired: false,
  //     },
  //     {
  //       key: 'Buyer Unique Identification Number',
  //       dataType: 'alphanumeric',
  //       isRequired: false,
  //     }
  //   ],
  //   columns: ['Description', 'Quantity', 'Tax', 'Amount']
  // },
  { // done Bank Statement
    docCategory: 'TRANSACTION_STATEMENT',
    isDefaultDoc: true,
    isTablePresent: true,
    documentType: 'Bank Statement',
    seedId: "seedId_2",
    mapping: [
      {
        key: 'Customer Name',
        dataType: 'string',
        isRequired: true,
        description: 'Name of the account holder'
      },
      {
        key: 'Account Number',
        dataType: 'number',
        isRequired: true,
        description: 'String of numbers to identify a bank account'
      },
      {
        key: 'Bank',
        dataType: 'string',
        isRequired: true,
        description: 'Name of the banking institution'
      },
      {
        key: 'Start Date',
        dataType: 'date',
        isRequired: false,
      },
      {
        key: 'End Date',
        dataType: 'date',
        isRequired: false,
      },
      {
        key: 'Branch',
        dataType: 'string',
        isRequired: false,
      },
      {
        key: 'Closing Balance',
        dataType: 'number',
        isRequired: false,
      },
      {
        key: 'Opening Balance',
        dataType: 'number',
        isRequired: false,
      }
    ],
  },
  { // done Onboarding form
    docCategory: 'OTHER',
    isDefaultDoc: true,
    isTablePresent: false,
    documentType: 'Onboarding Form',
    seedId: "seedId_3",
    mapping: [
      {
        key: 'Name',
        dataType: 'string',
        isRequired: true,
        description: 'Name of the customer, employee or proposer'
      },
      {
        key: 'Date of Birth',
        dataType: 'date',
        isRequired: true,
        description: 'Month, Date and year of birth of the individual'
      },
      {
        key: 'Address',
        dataType: 'string',
        isRequired: true,
        description: 'Details of the place where the individual lives'
      },
      {
        key: 'Phone Number',
        dataType: 'alphanumeric',
        isRequired: true,
        description: 'String of specific numbers that can be called to reach the individual'
      },
      {
        key: 'Unique Identification Number',
        dataType: 'alphanumeric',
        isRequired: false,
      },
    ],
  },
  { // done Motor Insurance Policy
    docCategory: 'INSURANCE',
    isDefaultDoc: true,
    isTablePresent: false,
    documentType: 'Motor Insurance Policy',
    seedId: "seedId_4",
    mapping: [
      {
        key: 'Insured Name',
        dataType: 'string',
        isRequired: true,
        description: 'Owner of the vehicle'
      },
      {
        key: 'Engine Number',
        dataType: 'alphanumeric',
        isRequired: true,
        description: 'Series or string of numbers and alphabets that serves as a unique identifier of the vehicle'
      },
      {
        key: 'Policy Number',
        dataType: 'alphanumeric',
        isRequired: true,
        description: 'Reference number and a unique identifier that attaches a Motor Insurance Policy to a specific individual'
      },
      {
        key: 'Policy Expiry Date',
        dataType: 'date',
        isRequired: true,
        description: 'Date when the insurance policy lapses'
      },
      {
        key: 'Year of manufacture',
        dataType: 'number',
        isRequired: true,
        description: 'Year when the vehicle was made'
      },
      {
        key: 'Registration Number',
        dataType: 'alphanumeric',
        isRequired: true,
        description: 'Unique identifier number representing a vehicle'
      },
      {
        key: 'Insured Declared Value',
        dataType: 'number',
        isRequired: false,
      },
      {
        key: 'Chassis Number',
        dataType: 'alphanumeric',
        isRequired: false,
      }
    ],
  },
  { // done salary
    docCategory: 'SALARY',
    isDefaultDoc: true,
    isTablePresent: false,
    documentType: 'Salary Slip',
    seedId: "seedId_5",
    mapping: [
      {
        key: 'Employee Name',
        dataType: 'string',
        isRequired: true,
        description: 'Name of the employee'
      },
      {
        key: 'Employee code',
        dataType: 'number',
        isRequired: true,
        description: 'Unique code that is an identification of the employee in the company'
      },
      {
        key: 'Date of joining',
        dataType: 'date',
        isRequired: true,
        description: 'Date when the employee joined the organisation/company'
      },
      {
        key: 'Net Salary',
        dataType: 'number',
        isRequired: true,
        description: 'Amount that the employee earns as his take-home salary after deducting all taxes'
      },
      {
        key: 'Income Tax',
        dataType: 'number',
        isRequired: true,
        description: 'Final amount after subtracting all the available tax-saving provisions and deductions'
      },
      {
        key: 'PAN number',
        dataType: 'number',
        isRequired: false,
      },
      {
        key: 'PF account number',
        dataType: 'alphanumeric',
        isRequired: false,
      }
    ],
  },
  { // done Dl
    docCategory: 'GOVT',
    isDefaultDoc: true,
    isTablePresent: false,
    documentType: "DL",
    seedId: "seedId_6",
    mapping: [
      {
        key: 'Name',
        dataType: 'string',
        isRequired: true,
        description: 'Name of the cardholder'
      },
      {
        key: 'DL Number',
        dataType: 'alphanumeric',
        isRequired: true,
        description: 'String of digits and alphabets on the card'
      },
      {
        key: 'Date of Birth',
        dataType: 'date',
        isRequired: true,
        description: 'Month, Date and year of birth of the cardholder'
      },
      {
        key: 'Issue Date',
        dataType: 'date',
        isRequired: true,
        description: 'Date when the license was issued'
      },
      {
        key: 'Expiry Date',
        dataType: 'date',
        isRequired: true,
        description: 'Date when the license validity expires'
      },
      {
        key: 'Father Name',
        dataType: 'string',
        isRequired: false,
      },
    ],
  },
  { // done Passport
    docCategory: 'GOVT',
    isDefaultDoc: true,
    isTablePresent: false,
    documentType: 'Passport',
    seedId: "seedId_7",
    mapping: [
      {
        key: 'Given Name',
        dataType: 'string',
        isRequired: true,
        description: 'First Name of the cardholder'
      },
      {
        key: 'Surname',
        dataType: 'string',
        isRequired: true,
        description: 'Last Name of the cardholder'
      },
      {
        key: 'Passport Number',
        dataType: 'alphanumeric',
        isRequired: true,
        description: 'String of digits and/ or alphabets on the card'
      },
      {
        key: 'Date of Birth',
        dataType: 'date',
        isRequired: true,
        description: 'Month, Date and year of birth of the Passport cardholder'
      },
      {
        key: 'Father Name',
        dataType: 'string',
        isRequired: false,
      },
      {
        key: 'Mother Name',
        dataType: 'string',
        isRequired: false,
      },
      {
        key: 'Spouse Name',
        dataType: 'string',
        isRequired: false,
      },
    ],
  },
  { // done voter Id
    docCategory: 'GOVT',
    isDefaultDoc: true,
    isTablePresent: false,
    documentType: 'Voter Id',
    seedId: "seedId_8",
    mapping: [
      {
        key: 'Name',
        dataType: 'string',
        isRequired: true,
        description: 'Name of the cardholder'
      },
      {
        key: 'Voter Id Number',
        dataType: 'number',
        isRequired: true,
        description: 'Voter Identification number issued by the election commission'
      },
      {
        key: 'Address',
        dataType: 'alphanumeric',
        isRequired: true,
        description: 'Details of the place where the voter or the cardholder lives'
      },
      {
        key: 'Date of Birth',
        dataType: 'date',
        isRequired: true,
        description: 'Month, Date and year of birth of the cardholder'
      },
      {
        key: 'Father/Spouse Name',
        dataType: 'string',
        isRequired: false,
      },
    ],
  },
  { // done Aadhar
    docCategory: 'GOVT',
    isDefaultDoc: true,
    isTablePresent: false,
    documentType: 'Aadhaar',
    seedId: "seedId_9",
    mapping: [
      {
        key: 'Name',
        dataType: 'string',
        isRequired: true,
        description: 'Name of the cardholder'
      },
      {
        key: 'Aadhaar Number',
        dataType: 'alphanumeric',
        isRequired: true,
        description: 'Unique identification number issued to a citizen by the government of India'
      },
      {
        key: 'Date of Birth',
        dataType: 'date',
        isRequired: true,
        description: 'Month, Date and year of birth of the cardholder'
      },
      {
        key: 'Address',
        dataType: 'alphanumeric',
        isRequired: true,
        description: 'Details of the place where the citizen or the cardholder lives'
      },
    ]
  },
  {
    docCategory: 'INVOICE',
    isDefaultDoc: true,
    isTablePresent: true,
    documentType: 'Invoices Static',
    seedId: "seedId_10",
    static: true,
    mapping: [
      {
        key: 'Invoice Number',
        dataType: 'alphanumeric',
        isRequired: true,
        description: 'Unique ID made up of number and alphabets'
      },
      {
        key: 'Invoice Date',
        dataType: 'date',
        isRequired: true,
        description: 'Date on which the invoice was generated'
      },
      {
        key: 'Supplier Name',
        dataType: 'string',
        isRequired: true,
        description: 'Name of supplier'
      },
      {
        key: 'Total Invoice Amount',
        dataType: 'number',
        isRequired: true,
        description: 'Total Amount that is due or to be paid'
      },
      {
        key: 'Total Tax Amount',
        dataType: 'number',
        isRequired: false,
        description: 'Total Tax Amount'
      },
      {
        key: 'Supplier Address',
        dataType: 'alphanumeric',
        isRequired: false,
        description: 'Numeric or alphanumeric code'
      },
    ],
    columns: ['Description', 'Quantity', 'Amount']
  },
  {
    docCategory: 'GOVT',
    isDefaultDoc: true,
    isTablePresent: false,
    documentType: 'PAN',
    seedId: "seedId_11",
    mapping: [
      {
        key: 'Name',
        dataType: 'string',
        isRequired: true,
      },
      {
        key: 'PAN Number',
        dataType: 'alphanumeric',
        isRequired: true,
      },
      {
        key: 'Date of Birth',
        dataType: 'date',
        isRequired: true,
      },
      {
        key: 'Father Name',
        dataType: 'string',
        isRequired: true,
      },
    ],
  },
]
const GLOBAL_MAPPING_MARK = [{
  docCategory: 'INVOICE',
  isDefaultDoc: true,
  isTablePresent: true,
  documentType: 'Invoices Custom',
  seedId: "seedId_10",
  static: true,
  mapping: [
    {
      "key": "Vendor ID",
      "dataType": "alphanumeric",
      "isRequired": true,
      "description": "Vendor ID"
    },
    {
      "key": "Vendor Name",
      "dataType": "string",
      "isRequired": true,
      "description": "Vendor Name"
    },
    {
      "key": "Vendor Address",
      "dataType": "alphanumeric",
      "isRequired": true,
      "description": "Vendor Address"
    },
    {
      "key": "Purchase Order Number",
      "dataType": "alphanumeric",
      "isRequired": false,
      "description": ""
    },
    {
      "key": "Job Number",
      "dataType": "alphanumeric",
      "isRequired": false,
      "description": ""
    },
    {
      "key": "Invoice Number",
      "dataType": "alphanumeric",
      "isRequired": true,
      "description": "Invoice Number"
    },
    {
      "key": "Invoice Date",
      "dataType": "date",
      "isRequired": true,
      "description": "Invoice Date"
    },
    {
      "key": "Invoice Sub Total",
      "dataType": "number",
      "isRequired": false,
      "description": ""
    },
    {
      "key": "Total Tax Amount",
      "dataType": "number",
      "isRequired": false,
      "description": ""
    },
    {
      "key": "Invoice Freight",
      "dataType": "number",
      "isRequired": false,
      "description": ""
    },
    {
      "key": "Total Invoice Amount",
      "dataType": "number",
      "isRequired": true,
      "description": "Total Invoice Amount"
    },
    {
      "key": "Account Number",
      "dataType": "alphanumeric",
      "isRequired": false,
      "description": ""
    },
    {
      "key": "Purchase Order Date",
      "dataType": "date",
      "isRequired": false,
      "description": ""
    },
    {
      "key": "Loan Number",
      "dataType": "alphanumeric",
      "isRequired": false,
      "description": ""
    },
    {
      "key": "Sub Contract Number",
      "dataType": "alphanumeric",
      "isRequired": false,
      "description": ""
    },
    {
      "key": "Vendor Registration Number",
      "dataType": "alphanumeric",
      "isRequired": false,
      "description": ""
    }
  ],
  columns: ['Description', 'Quantity', 'Amount']
}]
module.exports = {
  // eslint-disable-next-line import/prefer-default-export
  GLOBAL_MAPPING_MOCK: GLOBAL_MAPPING_MARK,
};
