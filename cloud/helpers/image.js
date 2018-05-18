'use strict'
const sharp = require('sharp')

module.exports = {
    resize:           resize,
    resizeUrl:        resizeUrl,
    saveImage:        saveImage,
    progressive:      progressive,
    base64toBuffer:   base64toBuffer,
    ParseHttpRequest: ParseHttpRequest,
}
const _QUALITY = 80;
const _BLUR    = 20;
const _EXT     = 'jpeg';

function base64toBuffer(base64) {
    return new Buffer.from(base64, 'base64').toString('ascii')
}

function bufferToBase64(buffer) {
    console.log('converte buffer', buffer)
    return buffer.toString('base64')
}

function ParseHttpRequest(url) {
    return Parse.Cloud.httpRequest({url: url})
}

function resizeUrl(url, width) {
    return ParseHttpRequest(url)
        .then(body => {
            console.log('request', body)
            if (body.code !== 141) {
                return resize(body.buffer, width)
            } else {
                return Parse.Promise.error()
            }
        })
}

function resize(buffer, width) {
    return new Promise((resolve, reject) => {
        sharp(buffer)
            .resize(width)
            .embed()
            .raw()
            .webp({quality: _QUALITY})
            .toFormat(sharp.format[_EXT])
            .toBuffer((error, buffer) => {
                if (error) {
                    reject(error)
                } else {
                    resolve(bufferToBase64(buffer))
                }
            })
    })
}

function progressive(url, width) {
    return new Promise((resolve, reject) => {
        Parse.Cloud.httpRequest({url: url}).then(body => {
            sharp(body.buffer)
                .resize(width)
                .embed()
                .raw()
                .blur(_BLUR)
                .webp({quality: _QUALITY})
                .toFormat(sharp.format[_EXT])
                .toBuffer((error, buffer) => {
                    if (error) {
                        reject(error)
                    } else {
                        resolve(bufferToBase64(buffer))
                    }
                })
        })
    })
}

function saveImage(base64) {
    return new Parse.File('image.jpeg', {base64: base64}).save()
}