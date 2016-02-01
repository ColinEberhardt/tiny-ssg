'use strict';

exports.__esModule = true;
exports.build = build;

var _process = require('process');

var _process2 = _interopRequireDefault(_process);

var _grayMatter = require('gray-matter');

var _grayMatter2 = _interopRequireDefault(_grayMatter);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _util = require('./util');

var _filePipelineSteps = require('./filePipelineSteps');

var _globalPipelineSteps = require('./globalPipelineSteps');

var _defaultConfig = require('./defaultConfig');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function build(config) {
    config = (0, _util.merge)(_defaultConfig.defaultConfig, config || {});

    var workingDirectory = _process2.default.cwd();
    if (config.sourceFolder) {
        _process2.default.chdir(config.sourceFolder);
    }

    return (0, _util.chainPromises)({}, [(0, _globalPipelineSteps.loadHandlebarsPartials)(config.includesPattern), (0, _globalPipelineSteps.loadGlobalData)(config.globalPattern), (0, _globalPipelineSteps.collectPagesFrontMatter)(config.filePattern), (0, _globalPipelineSteps.addGlobalData)(config.globalData)]).then(function (globalData) {
        return (0, _util.mapFiles)(config.filePattern, function (file, filePath) {
            return (0, _util.chainPromises)((0, _grayMatter2.default)(file), [(0, _filePipelineSteps.mergeGlobalData)(globalData), (0, _filePipelineSteps.addPageMetadata)(filePath), _filePipelineSteps.markCurrentPage, _filePipelineSteps.renderTemplate, _filePipelineSteps.renderMarkdown, _filePipelineSteps.renderLayout, (0, _filePipelineSteps.writePost)(config.destinationFolder)]);
        });
    }).then(function () {
        return _process2.default.chdir(workingDirectory);
    });
}