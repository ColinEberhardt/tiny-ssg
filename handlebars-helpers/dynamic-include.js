var matter = require('gray-matter');
var extend = require('node.extend');

// allows a template to be included where the data supplied to the template is specified
// at the point of template invocation (rather than just inheriting the current data context)
function register(handlebars, sourceFolder) {
    handlebars.registerHelper('dynamic-include', function(templateName, context) {
        const templateFile = `_includes/${templateName}.hbs`;
        const templateMatter = matter.read(templateFile);
        const compiledTemplate = handlebars.compile(templateMatter.content);
        const data = extend({}, context.hash);
        Object.keys(data)
            .forEach(key => {
                if (context.data.root[data[key]]) {
                    data[key] = context.data.root[data[key]];
                }
            });
        return compiledTemplate(data);
    });
}

module.exports = {
    register: register
};
