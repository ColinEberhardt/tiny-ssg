import Q from 'q';
import extend from 'node.extend';
import path from 'path';
import mkdirp from 'mkdirp';
import fs from 'fs-extra';
import globby from 'globby';

export function merge(...data) {
    return extend(true, {}, ...data);
}

export function chainPromises(initial, promises) {
    return promises.reduce(Q.when, Q(initial));
}

// writes a file, optionally creating any required folders.
export function writeFile(filepath, contents) {
    return Q.nfcall(mkdirp, path.dirname(filepath))
        .then(Q.nfcall(fs.writeFile, filepath, contents));
}

// reads a file and returnd a promise
export function readFile(filepath) {
    return Q.nfcall(fs.readFile, filepath, 'utf8');
}

// applies the given mapping for all filepaths that matches the given patterns
export function mapFilePaths(filePattern, mapping) {
    return globby(filePattern).then(files => {
        return Q.all(files.map(mapping));
    });
}

// applies the given mapping tothe contents of all the files that match the given pattern
export function mapFiles(filePattern, mapping) {
    return mapFilePaths(filePattern, filePath => {
        return readFile(filePath).then(file => mapping(file, filePath));
    });
}
