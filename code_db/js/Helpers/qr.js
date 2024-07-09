const _customizeQr = async (pageArray, qr) => {
  if (!pageArray.length) {
    return qr.map((item, index) => ({
      dimension: item.dimension || null,
      pageNo: (item.page) || index + 1,
      pageImageLink: item.s3_path || null,
      qrDetected: item.QR_DETECTED || false,
      qrContent: {
        qr: item.QR,
        status: item.status,
        extractedData: null,
      },
    }));
  }
  return pageArray.map((page) => {
    const { pageNo = 0, dimension = null, pageImageLink = null } = page;
    const qrPage = qr.find((item) => item.page === pageNo) || {};
    return {
      ...page,
      qrDetected: qrPage.QR_DETECTED || false,
      dimension: dimension || qrPage.dimension || null,
      pageImageLink: pageImageLink || qrPage.s3_path || null,
      qrContent: {
        qr: qrPage.QR || null,
        status: qrPage.status || null,
        extractedData: null,
      },
    };
  });
};

module.exports = {
  // eslint-disable-next-line import/prefer-default-export
  _customizeQr,
};
