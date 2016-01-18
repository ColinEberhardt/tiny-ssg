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

const handlebarsCompile = memoize(handlebars.compile);

marked.setOptions({
    highlight: function(code) {
        return require('highlight.js').highlightAuto(code).value;
    }
});

// writes a file, optionally creating any required folders.
function writeFile(filepath, contents) {
    return Q.nfcall(mkdirp, path.dirname(filepath))
        .then(Q.nfcall(fs.writeFile, filepath, contents));
}

function readFile(filepath) {
    return Q.nfcall(fs.readFile, filepath, 'utf8');
}

function mapFiles(filePattern, mapping) {
    return globby(filePattern).then(files => {
        return Q.all(files.map(mapping));
    });
}

// load any partials and helpers that are reuqired by handlebars
function configureHandlebars() {
    return Q.fcall(() => {
        require('handlebars-helpers/lib/helpers/helpers-miscellaneous').register(handlebars);
        require('handlebars-helpers/lib/helpers/helpers-comparisons').register(handlebars);
        require('handlebars-group-by').register(handlebars);

        require('./handlebars-helpers/dynamic-include').register(handlebars);
        require('./handlebars-helpers/escape').register(handlebars);
        require('./handlebars-helpers/codeblock').register(handlebars);
        require('./handlebars-helpers/json').register(handlebars);
    });
}

function loadHandlebarsPartials() {
    return mapFiles('_includes/*.hbs', file => {
        const templateName = path.basename(file, '.hbs');
        const template = fs.readFileSync(file, 'utf8');
        handlebars.registerPartial(templateName, template);
    });
}

// if the front-matter contains an 'externals' map, this function loads the externals
// into the front-matter data
function resolveExternals(postMatter) {
    const externals = postMatter.data.externals || [];

    const resolve = Object.keys(externals)
      .map(key => {
          const file = postMatter.page.dirname + '/' + externals[key];
          return readFile(file)
            .then(fileData => postMatter.data[key] = fileData);
      });

    return Q.all(resolve)
        .then(() => postMatter);
}

// renders the given post with the given layout - if the layout itself references
// a named layout, this function will recurse
function renderWithLayoutSync(post, layoutName) {
    const layoutFile = `_layouts/${layoutName}.hbs`;
    const layoutMatter = matter.read(layoutFile);
    const layoutTemplate = handlebarsCompile(layoutMatter.content);
    const mergedData = extend({}, layoutMatter.data, post.data, {body: post.rendered});
    const output = layoutTemplate(mergedData);

    if (layoutMatter.data.layout) {
        return renderWithLayoutSync({
            rendered: output,
            data: mergedData
        }, layoutMatter.data.layout);
    }
    return output;
}


// create a page variable that contains filepath information'
function addPageMetadata(postMatter, filePath) {
    // '/foo/bar/baz/asdf/quux.md'
    postMatter.page = {
        path: filePath, // '/foo/bar/baz/asdf/quux.md'
        basename: path.basename(filePath, path.extname(filePath)), // 'quux'
        dirname: path.dirname(filePath),  // '/foo/bar/baz/asdf'
        ext: path.extname(filePath), // '.md'
        destination: path.join('/', filePath.substring(0, filePath.length - path.extname(filePath).length) + '.html') // '/foo/bar/baz/asdf/quux.md.html'
    };
    return postMatter;
}

function renderTemplate(postMatter) {
    const compiledTemplate = handlebars.compile(postMatter.content);
    const templatedPost = compiledTemplate(postMatter.data);
    postMatter.rendered = postMatter.page.ext === '.md' ? marked(templatedPost) : templatedPost;
    return postMatter;
}

function applyLayout(postMatter) {
    postMatter.html = renderWithLayoutSync(postMatter, postMatter.data.layout);
    return postMatter;
}

function writePost(postMatter, destinationPath) {
    const dest = path.join(destinationPath, postMatter.page.destination);
    console.log('writing file', dest);
    return writeFile(dest, postMatter.html);
}

function addAllPageMetadata(postMatter, pagesMetadata) {
    const clonedMetadata = pagesMetadata.map(p => extend(true, {}, p));
    clonedMetadata.find(p => p.page.path === postMatter.page.path).page.isCurrentPage = true;
    postMatter.data.pages = clonedMetadata;
    return postMatter;
}

function addGlobalData(postMatter, globalData) {
    postMatter.data = extend(postMatter.data, globalData);
    return postMatter;
}

function collectPagesFrontMatter(filePattern) {
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
    });
}

function build(filePattern, destinationPath, globalData) {
    return configureHandlebars()
        .then(() => loadHandlebarsPartials())
        .then(() => collectPagesFrontMatter(filePattern))
        .then((pagesMetadata) => {
            return mapFiles(filePattern, filePath => {
                return readFile(filePath)
                    .then(fileContents => matter(fileContents))
                    .then(postMatter => addGlobalData(postMatter, globalData))
                    .then(postMatter => addPageMetadata(postMatter, filePath))
                    .then(postMatter => addAllPageMetadata(postMatter, pagesMetadata))
                    .then(postMatter => resolveExternals(postMatter))
                    .then(postMatter => renderTemplate(postMatter))
                    .then(postMatter => applyLayout(postMatter))
                    .then(postMatter => writePost(postMatter, destinationPath));
            });
        });
}

module.exports = build;
