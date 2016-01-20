const Q = require('q');
const extend = require('node.extend');
const path = require('path');
const mkdirp = require('mkdirp');
const fs = require('fs-extra');
const globby = require('globby');

function merge(...data) {
    return extend(true, {}, ...data);
}

function chainPromises(initial, promises) {
    return promises.reduce(Q.when, Q(initial));
}

// writes a file, optionally creating any required folders.
function writeFile(filepath, contents) {
    return Q.nfcall(mkdirp, path.dirname(filepath))
        .then(Q.nfcall(fs.writeFile, filepath, contents));
}

// reads a file and returnd a promise
function readFile(filepath) {
    return Q.nfcall(fs.readFile, filepath, 'utf8');
}

// applies the given mapping for all filepaths that matches the given patterns
function mapFilePaths(filePattern, mapping) {
    return globby(filePattern).then(files => {
        return Q.all(files.map(mapping));
    });
}

// applies the given mapping tothe contents of all the files that match the given pattern
function mapFiles(filePattern, mapping) {
    return mapFilePaths(filePattern, filePath => {
        return readFile(filePath).then(file => mapping(file, filePath));
    });
}

module.exports = { merge, chainPromises, writeFile, readFile, mapFilePaths, mapFiles };
