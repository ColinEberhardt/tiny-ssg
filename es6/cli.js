const tinySSG = require('.');
const fs = require('fs');
const path = require('path');
const program = require('commander');

const packageConfig = fs.readFileSync(path.join(__dirname, '../package.json'));
import {defaultConfig} from './defaultConfig';

program
    .version(JSON.parse(packageConfig).version)
    .usage('[options] <files ...>')
    .option('-i, --includes-pattern [pattern]', `File pattern for handlebars partials, defaults to '${defaultConfig.includesPattern}'`)
    .option('-g, --global-pattern [pattern]', `File pattern for files that provide global data, default to '${defaultConfig.globalPattern}'`)
    .option('-d, --destination-folder [folder]', `Folder for the generated output, defaults to '${defaultConfig.destinationFolder}'`)
    .parse(process.argv);

function asArray(val) {
    return !Array.isArray(val) ? [val] : val;
}

const config = {
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

tinySSG.build(config)
     .then(() => console.log('done'))
     .catch(e => console.error(e));
