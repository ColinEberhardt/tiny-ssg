// used for including example code into the website. If teh code has '//START' and '//END' comments
// only the code within those comments is included.
function register(handlebars) {
    handlebars.registerHelper('codeblock', function(text) {
        const matches = text.match(/\/\/START[\r\n]*((.|[\r\n])*)\/\/END/);
        return matches ? matches[1] : text;
    });
}

module.exports = {
    register: register
};
