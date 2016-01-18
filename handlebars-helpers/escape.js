function register(handlebars) {
    handlebars.registerHelper('escape', function(variable) {
        return variable.replace(/['"]/g, '\\"').replace(/[\n]/g, '\\n');
    });
}

module.exports = {
    register: register
};
