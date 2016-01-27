'use strict';

var _defaultConfig = require('./defaultConfig');

var tinySSG = require('.');
var fs = require('fs');
var path = require('path');
var program = require('commander');

var packageConfig = fs.readFileSync(path.join(__dirname, '../package.json'));

program.version(JSON.parse(packageConfig).version).usage('[options] <files ...>').option('-i, --includes-pattern [pattern]', 'File pattern for handlebars partials, defaults to \'' + _defaultConfig.defaultConfig.includesPattern + '\'').option('-g, --global-pattern [pattern]', 'File pattern for files that provide global data, default to \'' + _defaultConfig.defaultConfig.globalPattern + '\'').option('-d, --destination-folder [folder]', 'Folder for the generated output, defaults to \'' + _defaultConfig.defaultConfig.destinationFolder + '\'').parse(process.argv);

function asArray(val) {
    return !Array.isArray(val) ? [val] : val;
}

var config = {
    filePattern: program.args
};

if (program.includesPattern) {
    config.includesPattern = asArray(program.includesPattern);
}
if (program.globalPattern) {
    config.globalPattern = asArray(program.globalPattern);
}
if (program.destinationFolder) {
    config.destinationFolder = program.destinationFolder;
}

tinySSG.build(config).then(function () {
    return console.log('done');
}).catch(function (e) {
    return console.error(e);
});