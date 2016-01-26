'use strict';

var process = require('process');
var matter = require('gray-matter');
var marked = require('marked');
var handlebars = require('handlebars');
var path = require('path');
var fs = require('fs-extra');
var Q = require('q');
var memoize = require('memoizee');
var yaml = require('js-yaml');
var curry = require('curry');

var _require = require('./util');

var merge = _require.merge;
var chainPromises = _require.chainPromises;
var writeFile = _require.writeFile;
var readFile = _require.readFile;
var mapFilePaths = _require.mapFilePaths;
var mapFiles = _require.mapFiles;

var handlebarsCompile = memoize(handlebars.compile);

marked.setOptions({
    highlight: function highlight(code) {
        return require('highlight.js').highlightAuto(code).value;
    }
});

function renderIfMarkdown(extname, contents) {
    return extname === '.md' ? marked(contents) : contents;
}

var loadHandlebarsPartials = curry(function loadHandlebarsPartials(includesPattern, globalData) {
    return mapFilePaths(includesPattern, function (file) {
        var extname = path.extname(file);
        var templateName = path.basename(file, extname);
        var template = fs.readFileSync(file, 'utf8');
        handlebars.registerPartial(templateName, renderIfMarkdown(extname, template));
    }).then(function () {
        return globalData;
    });
});

var renderLayout = curry(function renderLayout(postMatter) {
    return renderNamedLayout(postMatter, postMatter.data.layout);
});

function resolveExternals(postMatter) {
    var externals = postMatter.data.externals || [];

    var resolve = Object.keys(externals).map(function (key) {
        var file = postMatter.data.page.dirname + '/' + externals[key];
        return readFile(file).then(function (fileData) {
            return postMatter.data[key] = fileData;
        });
    });

    return Q.all(resolve).then(function () {
        return postMatter;
    });
}

function renderNamedLayout(postMatter, layoutName) {
    var layoutFile = '_layouts/' + layoutName + '.hbs';
    return readFile(layoutFile).then(function (file) {
        return matter(file);
    }).then(function (layoutMatter) {
        var layoutTemplate = handlebarsCompile(layoutMatter.content);
        // merge the data from the page and the layout - and add a special 'body' property
        // for the transclusion
        var mergedData = merge(layoutMatter.data, postMatter.data, { body: postMatter.rendered });
        var rendered = layoutTemplate(mergedData);
        var newMatter = merge(postMatter, { rendered: rendered });
        if (layoutMatter.data.layout) {
            return renderNamedLayout(newMatter, layoutMatter.data.layout);
        } else {
            return newMatter;
        }
    });
}

// create a page variable that contains filepath information'
var addPageMetadata = curry(function addPageMetadata(filePath, postMatter) {
    // '/foo/bar/baz/asdf/quux.md'
    var page = {
        path: filePath, // '/foo/bar/baz/asdf/quux.md'
        basename: path.basename(filePath, path.extname(filePath)), // 'quux'
        dirname: path.dirname(filePath), // '/foo/bar/baz/asdf'
        ext: path.extname(filePath), // '.md'
        destination: path.join('/', filePath.substring(0, filePath.length - path.extname(filePath).length) + '.html') // '/foo/bar/baz/asdf/quux.html'
    };
    return merge(postMatter, { data: { page: page } });
});

// renders the template in the 'content' property with the 'data' into a 'rendered' property
function renderTemplate(postMatter) {
    var compiledTemplate = handlebarsCompile(postMatter.content);
    var templatedPost = compiledTemplate(postMatter.data);
    return merge(postMatter, { rendered: templatedPost });
}

// if the file has a '.md' extensions, the 'rendered' property is markdown rendered
function renderMarkdown(postMatter) {
    var rendered = renderIfMarkdown(postMatter.data.page.ext, postMatter.rendered);
    return merge(postMatter, { rendered: rendered });
}

var writePost = curry(function writePost(destinationFolder, postMatter) {
    var dest = path.join(destinationFolder, postMatter.data.page.destination);
    console.log('writing file', dest);
    return writeFile(dest, postMatter.rendered);
});

var mergeGlobalData = curry(function mergeGlobalData(globalData, postMatter) {
    return merge(postMatter, { data: globalData });
});

var addGlobalData = curry(function addGlobalData(globalData, current) {
    return merge(current, globalData);
});

function markCurrentPage(postMatter) {
    //TODO: This mutates!
    postMatter.data.pages.find(function (p) {
        return p.page.path === postMatter.data.page.path;
    }).isCurrentPage = true;
    return postMatter;
}

var collectPagesFrontMatter = curry(function collectPagesFrontMatter(filePattern, globalData) {
    return mapFilePaths(filePattern, function (filePath) {
        return readFile(filePath).then(function (file) {
            return matter(file);
        }).then(function (postMatter) {
            return addPageMetadata(filePath, postMatter);
        })
        // filter out everything other than the data property
        .then(function (postMatter) {
            return postMatter.data;
        });
    }).then(function (pages) {
        return merge(globalData, { pages: pages });
    });
});

var loadGlobalData = curry(function loadGlobalData(filePattern, globalData) {
    return mapFiles(filePattern, function (file, filePath) {
        var _ref;

        return _ref = {}, _ref[path.basename(filePath, path.extname(filePath))] = yaml.safeLoad(file), _ref;
    }).then(function (globals) {
        return merge.apply(undefined, [globalData].concat(globals));
    });
});

var defaultConfig = {
    includesPattern: ['_includes/*.*'],
    globalPattern: [],
    filePattern: ['**/*.md'],
    destinationFolder: '_site',
    globalData: {}
};

function build(config) {
    config = merge(defaultConfig, config || {});

    var workingDirectory = process.cwd();
    if (config.sourceFolder) {
        process.chdir(config.sourceFolder);
    }

    return chainPromises({}, [loadHandlebarsPartials(config.includesPattern), loadGlobalData(config.globalPattern), collectPagesFrontMatter(config.filePattern), addGlobalData(config.globalData)]).then(function (globalData) {
        return mapFiles(config.filePattern, function (file, filePath) {
            return chainPromises(matter(file), [mergeGlobalData(globalData), addPageMetadata(filePath), markCurrentPage, resolveExternals, renderTemplate, renderMarkdown, renderLayout(), writePost(config.destinationFolder)]);
        });
    }).then(function () {
        return process.chdir(workingDirectory);
    });
}

module.exports = {
    // export modules that have global configuration
    handlebars: handlebars,
    marked: marked,
    build: build
};