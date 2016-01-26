import process from 'process';
import matter from 'gray-matter';
import marked from 'marked';
import handlebars from 'handlebars';
import path from 'path';
import fs from 'fs-extra';
import Q from 'q';
import memoize from 'memoizee';
import yaml from 'js-yaml';
import curry from 'curry';
import { merge, chainPromises, writeFile, readFile, mapFilePaths, mapFiles } from './util';

const handlebarsCompile = memoize(handlebars.compile);

marked.setOptions({
    highlight: function(code) {
        return require('highlight.js').highlightAuto(code).value;
    }
});

function renderIfMarkdown(extname, contents) {
    return extname === '.md' ? marked(contents) : contents;
}

const loadHandlebarsPartials = curry(
    function loadHandlebarsPartials(includesPattern, globalData) {
        return mapFilePaths(includesPattern, file => {
            const extname = path.extname(file);
            const templateName = path.basename(file, extname);
            const template = fs.readFileSync(file, 'utf8');
            handlebars.registerPartial(templateName, renderIfMarkdown(extname, template));
        }).then(() => globalData);
    }
);

const renderLayout = curry(
    function renderLayout(postMatter) {
        return renderNamedLayout(postMatter, postMatter.data.layout);
    }
);

function resolveExternals(postMatter) {
    const externals = postMatter.data.externals || [];

    const resolve = Object.keys(externals)
      .map(key => {
          const file = postMatter.data.page.dirname + '/' + externals[key];
          return readFile(file)
            .then(fileData => postMatter.data[key] = fileData);
      });

    return Q.all(resolve)
        .then(() => postMatter);
}

function renderNamedLayout(postMatter, layoutName) {
    const layoutFile = `_layouts/${layoutName}.hbs`;
    return readFile(layoutFile)
        .then(file => matter(file))
        .then(layoutMatter => {
            const layoutTemplate = handlebarsCompile(layoutMatter.content);
            // merge the data from the page and the layout - and add a special 'body' property
            // for the transclusion
            const mergedData = merge(layoutMatter.data, postMatter.data, {body: postMatter.rendered});
            const rendered = layoutTemplate(mergedData);
            const newMatter = merge(postMatter, { rendered });
            if (layoutMatter.data.layout) {
                return renderNamedLayout(newMatter, layoutMatter.data.layout);
            } else {
                return newMatter;
            }
        });
}

// create a page variable that contains filepath information'
const addPageMetadata = curry(
    function addPageMetadata(filePath, postMatter) {
        // '/foo/bar/baz/asdf/quux.md'
        const page = {
            path: filePath, // '/foo/bar/baz/asdf/quux.md'
            basename: path.basename(filePath, path.extname(filePath)), // 'quux'
            dirname: path.dirname(filePath),  // '/foo/bar/baz/asdf'
            ext: path.extname(filePath), // '.md'
            destination: path.join('/', filePath.substring(0, filePath.length - path.extname(filePath).length) + '.html') // '/foo/bar/baz/asdf/quux.html'
        };
        return merge(postMatter, { data: {page} });
    }
);

// renders the template in the 'content' property with the 'data' into a 'rendered' property
function renderTemplate(postMatter) {
    const compiledTemplate = handlebarsCompile(postMatter.content);
    const templatedPost = compiledTemplate(postMatter.data);
    return merge(postMatter, { rendered: templatedPost });
}

// if the file has a '.md' extensions, the 'rendered' property is markdown rendered
function renderMarkdown(postMatter) {
    const rendered = renderIfMarkdown(postMatter.data.page.ext, postMatter.rendered);
    return merge(postMatter, { rendered });
}

const writePost = curry(
    function writePost(destinationFolder, postMatter) {
        const dest = path.join(destinationFolder, postMatter.data.page.destination);
        console.log('writing file', dest);
        return writeFile(dest, postMatter.rendered);
    }
);

const mergeGlobalData = curry(
    function mergeGlobalData(globalData, postMatter) {
        return merge(postMatter, { data: globalData});
    }
);

const addGlobalData = curry(
    function addGlobalData(globalData, current) {
        return merge(current, globalData);
    }
);

function markCurrentPage(postMatter) {
    //TODO: This mutates!
    postMatter.data.pages.find(p => p.page.path === postMatter.data.page.path).isCurrentPage = true;
    return postMatter;
}

const collectPagesFrontMatter = curry(
    function collectPagesFrontMatter(filePattern, globalData) {
        return mapFilePaths(filePattern, filePath => {
            return readFile(filePath)
                .then(file => matter(file))
                .then(postMatter => addPageMetadata(filePath, postMatter))
                // filter out everything other than the data property
                .then(postMatter => postMatter.data);
        }).then(pages => merge(globalData, { pages }));
    }
);

const loadGlobalData = curry(
    function loadGlobalData(filePattern, globalData) {
        return mapFiles(filePattern, (file, filePath) => {
            return {
                [path.basename(filePath, path.extname(filePath))]: yaml.safeLoad(file)
            };
        }).then(globals => merge(globalData, ...globals));
    }
);

const defaultConfig = {
    includesPattern: ['_includes/*.*'],
    globalPattern: [],
    filePattern: ['**/*.md'],
    destinationFolder: '_site',
    globalData: {}
};

function build(config) {
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
                renderLayout(),
                writePost(config.destinationFolder)
            ]);
        });
    })
    .then(() => process.chdir(workingDirectory));
}

module.exports = {
    // export modules that have global configuration
    handlebars,
    marked,
    build
};
