import process from 'process';
import matter from 'gray-matter';
import path from 'path';

import { merge, chainPromises, writeFile, readFile, mapFilePaths, mapFiles } from './util';
import { mergeGlobalData, addPageMetadata, markCurrentPage, resolveExternals, renderTemplate, renderMarkdown, renderLayout, writePost } from './filePipelineSteps';
import { loadGlobalData, collectPagesFrontMatter, addGlobalData, loadHandlebarsPartials } from './globalPipelineSteps';
import { defaultConfig } from './defaultConfig';

export function build(config) {
    config = merge(defaultConfig, config || {});

    const workingDirectory = process.cwd();
    if (config.sourceFolder) {
        process.chdir(config.sourceFolder);
    }

    return chainPromises({}, [
        loadHandlebarsPartials(config.includesPattern),
        loadGlobalData(config.globalPattern),
        collectPagesFrontMatter(config.filePattern),
        addGlobalData(config.globalData)
    ])
    .then((globalData) => {
        return mapFiles(config.filePattern, (file, filePath) => {
            return chainPromises(matter(file), [
                mergeGlobalData(globalData),
                addPageMetadata(filePath),
                markCurrentPage,
                resolveExternals,
                renderTemplate,
                renderMarkdown,
                renderLayout,
                writePost(config.destinationFolder)
            ]);
        });
    })
    .then(() => process.chdir(workingDirectory));
}
