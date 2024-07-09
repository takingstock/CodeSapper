const mockVahanApi = Promise.resolve({
  name: 'test user',
  father_name: 'test father',
  address: '23, andheri west, mumbai',
  chasis_no: 'wwwwww132',
  engine_no: 'DL98686876',
  registration_no: 'HGDHDGD855757',
});

const mockPanApi = Promise.resolve({
  name: 'Foo.com',
  pan_no: '98676868768',
  dob: '29-01-1995',
});

module.exports = {
  mockVahanApi,
  mockPanApi,
};
