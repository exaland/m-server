module.exports = function translate(i18n, string) {
    let filename = __dirname + '/../../i18n/' + i18n + '.json';
    //console.log(filename)
    const lang = require('./loadJson')(filename);
    //return lang;
    return lang[string];
}