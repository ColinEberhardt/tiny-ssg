const tinySSG = require('.');

tinySSG.build('*.md', '_site', '_data/*.yml')
    .then(() => console.log('done'))
    .catch((e) => console.error(e));
