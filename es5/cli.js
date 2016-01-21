'use strict';

var tinySSG = require('.');

tinySSG.build({ globalPattern: ['_data/*.yml'] }).then(function () {
    return console.log('done');
}).catch(function (e) {
    return console.error(e);
});