const process = require('process');
const matter = require('gray-matter');
const marked = require('marked');
const handlebars = require('handlebars');
const path = require('path');
const fs = require('fs-extra');
const Q = require('q');
const memoize = require('memoizee');
const yaml = require('js-yaml');
const curry = require('curry');
const {
    merge, chainPromises, writeFile, readFile, mapFilePaths, mapFiles
} = require('./util');

const handlebarsCompile = memoize(handlebars.compile);

marked.setOptions({
    highlight: function(code) {
        return require('highlight.js').highlightAuto(code).value;
    }
});

const loadHandlebarsPartials = curry(
    function loadHandlebarsPartials(includesFolder, globalData) {
        return mapFilePaths(`${includesFolder}/*.hbs`, file => {
            const templateName = path.basename(file, '.hbs');
            const template = fs.readFileSync(file, 'utf8');
            handlebars.registerPartial(templateName, template);
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
    const rendered = postMatter.data.page.ext === '.md' ? marked(postMatter.rendered) : postMatter.rendered;
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

function markCurrentPage(postMatter) {
    //TODO: This mutates!
    postMatter.data.pages.find(p => p.data.page.path === postMatter.data.page.path).isCurrentPage = true;
    return postMatter;
}

const collectPagesFrontMatter = curry(
    function collectPagesFrontMatter(filePattern, globalData) {
        return mapFilePaths(filePattern, filePath => {
            return readFile(filePath)
                .then(file => matter(file))
                .then(postMatter => addPageMetadata(filePath, postMatter))
                // filter out everything other than the data property
                .then(postMatter => { return { data: postMatter.data }; });
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
    includesFolder: '_includes',
    globalPattern: [],
    filePattern: ['**/*.md'],
    destinationFolder: '_site',
    globalData: {}
};

function build(config) {
    config = merge(defaultConfig, config || {});

    return chainPromises(config.globalData, [
        loadHandlebarsPartials(config.includesFolder),
        loadGlobalData(config.globalPattern),
        collectPagesFrontMatter(config.filePattern)
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
    });
}

module.exports = {
    // export modules that have global configuration
    handlebars,
    marked,
    build
};
