const tinySSG = require('.');

tinySSG('*.md', '_site', {})
    .then(() => console.log('done'))
    .catch((e) => console.error(e));
