const globby = require('globby');
const process = require('process');
const matter = require('gray-matter');
const marked = require('marked');
const handlebars = require('handlebars');
const path = require('path');
const fs = require('fs-extra');
const extend = require('node.extend');
const mkdirp = require('mkdirp');
const Q = require('q');
const memoize = require('memoizee');
const yaml = require('js-yaml');

const handlebarsCompile = memoize(handlebars.compile);

marked.setOptions({
    highlight: function(code) {
        return require('highlight.js').highlightAuto(code).value;
    }
});

function merge(...data) {
    return extend(true, {}, ...data);
}

// writes a file, optionally creating any required folders.
function writeFile(filepath, contents) {
    return Q.nfcall(mkdirp, path.dirname(filepath))
        .then(Q.nfcall(fs.writeFile, filepath, contents));
}

function readFile(filepath) {
    return Q.nfcall(fs.readFile, filepath, 'utf8');
}

// applies the given mapping for all filepaths that matches the given patterns
function mapFiles(filePattern, mapping) {
    return globby(filePattern).then(files => {
        return Q.all(files.map(mapping));
    });
}

// applies the given mapping tothe contents of all the files that match the given pattern
function readFiles(filePattern, mapping) {
    return mapFiles(filePattern, filePath => {
        return readFile(filePath).then(file => mapping(file, filePath));
    });
}

function loadHandlebarsPartials() {
    return mapFiles('_includes/*.hbs', file => {
        const templateName = path.basename(file, '.hbs');
        const template = fs.readFileSync(file, 'utf8');
        handlebars.registerPartial(templateName, template);
    });
}

function renderLayout(postMatter, layoutName) {
    layoutName = layoutName || postMatter.data.layout;
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
                return renderLayout(newMatter, layoutMatter.data.layout);
            } else {
                return newMatter;
            }
        });
}



// create a page variable that contains filepath information'
function addPageMetadata(postMatter, filePath) {
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

function applyLayout(postMatter) {
    const rendered = renderWithLayoutSync(postMatter, postMatter.data.layout);
    return merge(postMatter, { rendered });
}

function writePost(postMatter, destinationPath) {
    const dest = path.join(destinationPath, postMatter.data.page.destination);
    console.log('writing file', dest);
    return writeFile(dest, postMatter.rendered);
}

function addGlobalData(postMatter, globalData) {
    return merge(postMatter, { data: globalData});
}

function collectPagesFrontMatter(filePattern, globalData) {
    return mapFiles(filePattern, filePath => {
        return readFile(filePath)
            .then(file => matter(file))
            .then(postMatter => addPageMetadata(postMatter, filePath))
            .then(postMatter => {
                return {
                    page: postMatter.page,
                    data: postMatter.data
                };
            });
    }).then(pages => merge(globalData, { pages }));
}

function loadGlobalData(filePattern, globalData) {
    return readFiles(filePattern, (file, filePath) => {
        return {
            [path.basename(filePath, path.extname(filePath))]: yaml.safeLoad(file)
        };
    }).then(globals => merge(globalData, ...globals));
}

function build(filePattern, destinationPath, globalPattern) {
    return loadHandlebarsPartials()
        .then(() => loadGlobalData(globalPattern, {}))
        .then((globalData) => collectPagesFrontMatter(filePattern, globalData))
        .then((globalData) => {
            return readFiles(filePattern, (file, filePath) => {
                return Q.fcall(() => matter(file))
                    .then(postMatter => addGlobalData(postMatter, globalData))
                    .then(postMatter => addPageMetadata(postMatter, filePath))
                    .then(postMatter => renderTemplate(postMatter))
                    .then(postMatter => renderMarkdown(postMatter))
                    .then(postMatter => renderLayout(postMatter))
                    .then(postMatter => writePost(postMatter, destinationPath));
            });
        });
}

module.exports = {
    // export modules that have global configuration
    handlebars: handlebars,
    marked: marked,
    build: build
};
