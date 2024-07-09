// eslint-disable-next-line import/no-unresolved
const Captchapng = require('captchapng');
const config = require('config');
const axios = require('axios');
const {
    v1: cuid
} = require('uuid');
const CAPTCHA = require('../Models/captcha.model');

const HTTP_ERROR_MESSAGES = config.get('STATUS_MSG.ERROR');
const secret = process.env.GOOGLE_SECRET || "6LcprN8ZAAAAAJ8SoX4bu6h-IR1hhIscy3S4q8V7";

function verifyCaptchaToken(payload, callback) {
    const axiosConfig = {
        method: 'POST',
        timeout: 5000,
        url: `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${payload.clientResponse}`
    }
    console.log('axiosConfig', axiosConfig)
    axios(axiosConfig)
        .then((response) => {
            if (response && response.data) {
                console.log('captcha responsedata', response.data)
                if (response.data) {
                    if (response.data.hasOwnProperty('success')) {
                        callback(null, response.data.success)
                    } else {
                        callback(null, false)
                    }
                } else {
                    const customError = { ...HTTP_ERROR_MESSAGES.GOOGLE_ERROR }
                    customError.message += 'Google Server Down'
                    callback(customError);
                }
            }
        }).catch(e => {
            console.log('e', e)
            const customError = { ...HTTP_ERROR_MESSAGES.GOOGLE_ERROR }
            customError.message += 'Google Server Down'
            callback(customError);
        })
}

function verifyLocalCaptcha(payload, callback) {
    const criteria = {
        randomNumber: payload.randomNumber,
        uniqueId: payload.uniqueId,
        verified: false
    }
    CAPTCHA.countDocuments(criteria, (err, count) => {
        if (err) {
            callback(HTTP_ERROR_MESSAGES.INVALID_CAPTCHA)
        } else {
            if (count) {
                CAPTCHA.findOneAndUpdate(criteria, { verified: true }, { new: true }, (err, data) => {
                    console.log('updated captcha', err, data)
                })
            }
            callback(null, !!count)
        }
    })
}

function generateCaptcha(callback) {
    const randomNumber = parseInt(Math.random() * 9000 + 1000, 10);

    const uniqueId = cuid();
    CAPTCHA.create({ randomNumber, uniqueId }, (err, done) => {
        console.log('data inserted', err, done)
    })
    const p = new Captchapng(80, 30, randomNumber); // width,height,numeric captcha
    p.color(0, 0, 0, 0); // First color: background (red, green, blue, alpha)
    p.color(80, 80, 80, 255); // Second color: paint (red, green, blue, alpha)

    const img = p.getBase64();
    const imgSrc = `data:image/png+xml;base64,${img}`;

    callback(null, { imgSrc, uniqueId })
}

module.exports = {
    verifyCaptchaToken,
    verifyLocalCaptcha,
    generateCaptcha
}
