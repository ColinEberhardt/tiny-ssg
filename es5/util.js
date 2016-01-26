'use strict';

exports.__esModule = true;
exports.merge = merge;
exports.chainPromises = chainPromises;
exports.writeFile = writeFile;
exports.readFile = readFile;
exports.mapFilePaths = mapFilePaths;
exports.mapFiles = mapFiles;

var _q = require('q');

var _q2 = _interopRequireDefault(_q);

var _node = require('node.extend');

var _node2 = _interopRequireDefault(_node);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _globby = require('globby');

var _globby2 = _interopRequireDefault(_globby);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function merge() {
    for (var _len = arguments.length, data = Array(_len), _key = 0; _key < _len; _key++) {
        data[_key] = arguments[_key];
    }

    return _node2.default.apply(undefined, [true, {}].concat(data));
}

function chainPromises(initial, promises) {
    return promises.reduce(_q2.default.when, (0, _q2.default)(initial));
}

// writes a file, optionally creating any required folders.
function writeFile(filepath, contents) {
    return _q2.default.nfcall(_mkdirp2.default, _path2.default.dirname(filepath)).then(_q2.default.nfcall(_fsExtra2.default.writeFile, filepath, contents));
}

// reads a file and returnd a promise
function readFile(filepath) {
    return _q2.default.nfcall(_fsExtra2.default.readFile, filepath, 'utf8');
}

// applies the given mapping for all filepaths that matches the given patterns
function mapFilePaths(filePattern, mapping) {
    return (0, _globby2.default)(filePattern).then(function (files) {
        return _q2.default.all(files.map(mapping));
    });
}

// applies the given mapping tothe contents of all the files that match the given pattern
function mapFiles(filePattern, mapping) {
    return mapFilePaths(filePattern, function (filePath) {
        return readFile(filePath).then(function (file) {
            return mapping(file, filePath);
        });
    });
}