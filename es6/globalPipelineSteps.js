import curry from 'curry';
import path from 'path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import marked from 'marked';
import handlebars from 'handlebars';
import Q from 'q';

import { merge, mapFiles, mapFilePaths, readFile } from './util';
import { addPageMetadata } from './filePipelineSteps';

export const loadGlobalData = curry((filePattern, globalData) => {
    return mapFiles(filePattern, (file, filePath) => {
        return {
            [path.basename(filePath, path.extname(filePath))]: yaml.safeLoad(file)
        };
    }).then(globals => merge(globalData, ...globals));
});

export const collectPagesFrontMatter = curry((filePattern, globalData) => {
    return mapFiles(filePattern, (file, filePath) => {
        return Q(matter(file))
            .then(postMatter => addPageMetadata(filePath, postMatter))
            // filter out everything other than the data property
            .then(postMatter => postMatter.data);
    }).then(pages => merge(globalData, { pages }));
});

export const addGlobalData = curry((globalData, current) => {
    return merge(current, globalData);
});

export const loadHandlebarsPartials = curry((includesPattern, globalData) => {
    return mapFiles(includesPattern, (file, filePath) => {
        const extname = path.extname(filePath);
        const templateName = path.basename(filePath, extname);
        const rendered = extname === '.md' ? marked(file) : file;
        handlebars.registerPartial(templateName, rendered);
    }).then(() => globalData);
});
