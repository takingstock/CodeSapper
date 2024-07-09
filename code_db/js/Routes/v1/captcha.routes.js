const config = require('config');
const Joi = require('joi');
Joi.objectId = require('joi-objectid')(Joi);

const { BoomCustomError } = require('../../Utils/universal-functions.util');
const captchaController = require('../../Controllers/recaptcha-controller')

const V1 = config.get('API.V1');

const generateCaptcha = () => {
    return new Promise((resolve, reject) => {
        captchaController.generateCaptcha((err, result) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(result);
        })
    })
};
const verifyReCaptcha = (request) => {
    //  TODO ADD BRUTEFORCE CHECKER
    return new Promise((resolve, reject) => {
        const payload = {
            clientResponse: request.payload.clientResponse,
        }
        captchaController.verifyCaptchaToken(payload, (err, result) => {
            if (err) {
                return reject(BoomCustomError(err));
            }
            return resolve(result);
        })
    })
};

module.exports = [
    {
        method: 'POST',
        path: `${V1}verifyReCaptcha`,
        options: {
            timeout: { server: 1000 * 60 * 5 },
            handler: verifyReCaptcha,
            validate: {
                payload: {
                    clientResponse: Joi.string().required().min(5),
                }
            },
            tags: ['captcha', 'api'],
            description: 'Verify Recaptcha token'
        }
    },
    {
        method: 'POST',
        path: `${V1}generateCaptcha`,
        options: {
            timeout: { server: 1000 * 60 * 5 },
            handler: generateCaptcha,
            tags: ['captcha', 'api'],
            description: 'Generate Captcha'
        }
    }
];
