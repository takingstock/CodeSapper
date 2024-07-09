const Axios = require('axios');
const FormData = require('form-data');

const trialRequest = ({ firstName = '', lastName = '', emailId, companyName = '', jobTitle = '', phoneNumber = '' }) => {
    const formData = new FormData();
    formData.append('962123_4000pi_962123_4000', firstName);
    formData.append('962123_4002pi_962123_4002', lastName);
    formData.append('962123_4004pi_962123_4004', emailId);
    formData.append('962123_4006pi_962123_4006', companyName);
    formData.append('962123_10348pi_962123_10348', jobTitle);
    formData.append('962123_10350pi_962123_10350', phoneNumber);

    const requestConfig = {
        method: 'POST',
        url: "http://go.pardot.com/l/962123/2022-02-03/8x1",
        headers: {
            ...formData.getHeaders(),
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: formData
    };
    Axios(requestConfig)
        .then((response) => {
            if (response && response.status === 200) {
                console.log("saLES IDP USER CREATION RESPONSE:", response.statusText, response.data);
            }
        })
        .catch((err) => {
            if (err) {
                console.error("saLES IDP USER CREATION ERR:", err);
            }
        })
}
module.exports = {
    trialRequest
};
