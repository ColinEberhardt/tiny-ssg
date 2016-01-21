const tinySSG = require('.');

tinySSG.build({ globalPattern: ['_data/*.yml']})
    .then(() => console.log('done'))
    .catch((e) => console.error(e));
