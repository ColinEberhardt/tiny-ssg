'use strict';

var Q = require('q');
var extend = require('node.extend');
var path = require('path');
var mkdirp = require('mkdirp');
var fs = require('fs-extra');
var globby = require('globby');

function merge() {
    for (var _len = arguments.length, data = Array(_len), _key = 0; _key < _len; _key++) {
        data[_key] = arguments[_key];
    }

    return extend.apply(undefined, [true, {}].concat(data));
}

function chainPromises(initial, promises) {
    return promises.reduce(Q.when, Q(initial));
}

// writes a file, optionally creating any required folders.
function writeFile(filepath, contents) {
    return Q.nfcall(mkdirp, path.dirname(filepath)).then(Q.nfcall(fs.writeFile, filepath, contents));
}

// reads a file and returnd a promise
function readFile(filepath) {
    return Q.nfcall(fs.readFile, filepath, 'utf8');
}

// applies the given mapping for all filepaths that matches the given patterns
function mapFilePaths(filePattern, mapping) {
    return globby(filePattern).then(function (files) {
        return Q.all(files.map(mapping));
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

module.exports = { merge: merge, chainPromises: chainPromises, writeFile: writeFile, readFile: readFile, mapFilePaths: mapFilePaths, mapFiles: mapFiles };