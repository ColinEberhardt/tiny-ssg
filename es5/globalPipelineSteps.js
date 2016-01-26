'use strict';

exports.__esModule = true;
exports.loadHandlebarsPartials = exports.addGlobalData = exports.collectPagesFrontMatter = exports.loadGlobalData = undefined;

var _curry = require('curry');

var _curry2 = _interopRequireDefault(_curry);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _grayMatter = require('gray-matter');

var _grayMatter2 = _interopRequireDefault(_grayMatter);

var _jsYaml = require('js-yaml');

var _jsYaml2 = _interopRequireDefault(_jsYaml);

var _marked = require('marked');

var _marked2 = _interopRequireDefault(_marked);

var _handlebars = require('handlebars');

var _handlebars2 = _interopRequireDefault(_handlebars);

var _q = require('q');

var _q2 = _interopRequireDefault(_q);

var _util = require('./util');

var _filePipelineSteps = require('./filePipelineSteps');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var loadGlobalData = exports.loadGlobalData = (0, _curry2.default)(function (filePattern, globalData) {
    return (0, _util.mapFiles)(filePattern, function (file, filePath) {
        var _ref;

        return _ref = {}, _ref[_path2.default.basename(filePath, _path2.default.extname(filePath))] = _jsYaml2.default.safeLoad(file), _ref;
    }).then(function (globals) {
        return _util.merge.apply(undefined, [globalData].concat(globals));
    });
});

var collectPagesFrontMatter = exports.collectPagesFrontMatter = (0, _curry2.default)(function (filePattern, globalData) {
    return (0, _util.mapFiles)(filePattern, function (file, filePath) {
        return (0, _q2.default)((0, _grayMatter2.default)(file)).then(function (postMatter) {
            return (0, _filePipelineSteps.addPageMetadata)(filePath, postMatter);
        })
        // filter out everything other than the data property
        .then(function (postMatter) {
            return postMatter.data;
        });
    }).then(function (pages) {
        return (0, _util.merge)(globalData, { pages: pages });
    });
});

var addGlobalData = exports.addGlobalData = (0, _curry2.default)(function (globalData, current) {
    return (0, _util.merge)(current, globalData);
});

var loadHandlebarsPartials = exports.loadHandlebarsPartials = (0, _curry2.default)(function (includesPattern, globalData) {
    return (0, _util.mapFiles)(includesPattern, function (file, filePath) {
        var extname = _path2.default.extname(filePath);
        var templateName = _path2.default.basename(filePath, extname);
        var rendered = extname === '.md' ? (0, _marked2.default)(file) : file;
        _handlebars2.default.registerPartial(templateName, rendered);
    }).then(function () {
        return globalData;
    });
});