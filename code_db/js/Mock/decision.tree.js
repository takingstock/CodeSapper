const mockDecisionTreeUseCase1 = {
  input: {
    primary: 'invoice',
    pan: {
      mappingId: '61d50f52718ccef949ec3403',
      storeAsVariable: '@panMapping',
    },
    aadhar: {
      mappingId: '61d50f52718ccef949ec3408',
      storeAsVariable: '@aadhaarMapping',
    },
    invoice: {
      mappingId: '61d50f52718ccef949ec3403',
      storeAsVariable: '@invoiceMapping',
    },
  },
  backendJSON: {
    // mandatory key for decision tree
    startNode: {
      next: 'node_1',
    },
    node_1: {
      nodeType: 'RULE_DO_OCR',
      storeAsVariable: '@ocrOutput',
      next: 'node_2',
    },
    node_2: {
      nodeType: 'RULE_LOGICAL_COMPARISION',
      logic: [
        {
          operator: 'EQUAL_TO',
          lhs: {
            key: '@pan.name',
            type: 'variable', // variable or external_data
          },
          rhs: {
            key: '@onboarding_form.name',
            type: 'variable',
          },
          static: null,
          data: {},
        },
        {
          operator: 'EQUAL_TO',
          lhs: {
            key: '@aadhaar.aadhaar_number',
            type: 'variable',
          },
          rhs: {
            key: '@onboarding_form.aadhaar_number',
            type: 'variable',
          },
          data: {},
          static: null,
        },
      ],
      storeAsVariable: '@derivedMatchName',
      next: 'endNode',
    },
    endNode: {
      nodeType: 'WORKFLOW_END',
      textToDisplay: 'WOFKFLOW have been executed',
    },
  },
  output: {
    variableMapping: [
      {
        source: '@panOCR.Customer Name',
        alias: '@panOCRName',
      },
      {
        source: '@panOCR.Father Name',
        alias: '@panOCRFatherName',
      },
      {
        source: '@aadhaarOCR.PAN Number',
        alias: '@aadhaarOCRPan',
      },
      {
        source: '@aadhaarOCR.Customer Name',
        alias: '@aadhaarOCRName',
      },
      {
        source: '@aadhaarOCR.PAN Number',
        alias: '@aadhaarOCRNumb',
      },
      {
        source: '@derivedMatchName',
        alias: '@derivedMatchName',
      },
    ],
    storeAsVariable: '@outputResult',
  },
};

module.exports = {
  // eslint-disable-next-line import/prefer-default-export
  mockDecisionTreeUseCase1,
};
