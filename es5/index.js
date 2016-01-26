'use strict';

var _process = require('process');

var _process2 = _interopRequireDefault(_process);

var _grayMatter = require('gray-matter');

var _grayMatter2 = _interopRequireDefault(_grayMatter);

var _marked = require('marked');

var _marked2 = _interopRequireDefault(_marked);

var _handlebars = require('handlebars');

var _handlebars2 = _interopRequireDefault(_handlebars);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fsExtra = require('fs-extra');

var _fsExtra2 = _interopRequireDefault(_fsExtra);

var _q = require('q');

var _q2 = _interopRequireDefault(_q);

var _memoizee = require('memoizee');

var _memoizee2 = _interopRequireDefault(_memoizee);

var _jsYaml = require('js-yaml');

var _jsYaml2 = _interopRequireDefault(_jsYaml);

var _curry = require('curry');

var _curry2 = _interopRequireDefault(_curry);

var _util = require('./util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var handlebarsCompile = (0, _memoizee2.default)(
// export modules that have global configuration
_handlebars2.default.compile);

_marked2.default.setOptions({
    highlight: function highlight(code) {
        return require('highlight.js').highlightAuto(code).value;
    }
});

function renderIfMarkdown(extname, contents) {
    return extname === '.md' ? (0, _marked2.default)(contents) : contents;
}

var loadHandlebarsPartials = (0, _curry2.default)(function loadHandlebarsPartials(includesPattern, globalData) {
    return (0, _util.mapFilePaths)(includesPattern, function (file) {
        var extname = _path2.default.extname(file);
        var templateName = _path2.default.basename(file, extname);
        var template = _fsExtra2.default.readFileSync(file, 'utf8');
        _handlebars2.default.registerPartial(templateName, renderIfMarkdown(extname, template));
    }).then(function () {
        return globalData;
    });
});

var renderLayout = (0, _curry2.default)(function renderLayout(postMatter) {
    return renderNamedLayout(postMatter, postMatter.data.layout);
});

function resolveExternals(postMatter) {
    var externals = postMatter.data.externals || [];

    var resolve = Object.keys(externals).map(function (key) {
        var file = postMatter.data.page.dirname + '/' + externals[key];
        return (0, _util.readFile)(file).then(function (fileData) {
            return postMatter.data[key] = fileData;
        });
    });

    return _q2.default.all(resolve).then(function () {
        return postMatter;
    });
}

function renderNamedLayout(postMatter, layoutName) {
    var layoutFile = '_layouts/' + layoutName + '.hbs';
    return (0, _util.readFile)(layoutFile).then(function (file) {
        return (0, _grayMatter2.default)(file);
    }).then(function (layoutMatter) {
        var layoutTemplate = handlebarsCompile(layoutMatter.content);
        // merge the data from the page and the layout - and add a special 'body' property
        // for the transclusion
        var mergedData = (0, _util.merge)(layoutMatter.data, postMatter.data, { body: postMatter.rendered });
        var rendered = layoutTemplate(mergedData);
        var newMatter = (0, _util.merge)(postMatter, { rendered: rendered });
        if (layoutMatter.data.layout) {
            return renderNamedLayout(newMatter, layoutMatter.data.layout);
        } else {
            return newMatter;
        }
    });
}

// create a page variable that contains filepath information'
var addPageMetadata = (0, _curry2.default)(function addPageMetadata(filePath, postMatter) {
    // '/foo/bar/baz/asdf/quux.md'
    var page = {
        path: filePath, // '/foo/bar/baz/asdf/quux.md'
        basename: _path2.default.basename(filePath, _path2.default.extname(filePath)), // 'quux'
        dirname: _path2.default.dirname(filePath), // '/foo/bar/baz/asdf'
        ext: _path2.default.extname(filePath), // '.md'
        destination: _path2.default.join('/', filePath.substring(0, filePath.length - _path2.default.extname(filePath).length) + '.html') // '/foo/bar/baz/asdf/quux.html'
    };
    return (0, _util.merge)(postMatter, { data: { page: page } });
});

// renders the template in the 'content' property with the 'data' into a 'rendered' property
function renderTemplate(postMatter) {
    var compiledTemplate = handlebarsCompile(postMatter.content);
    var templatedPost = compiledTemplate(postMatter.data);
    return (0, _util.merge)(postMatter, { rendered: templatedPost });
}

// if the file has a '.md' extensions, the 'rendered' property is markdown rendered
function renderMarkdown(postMatter) {
    var rendered = renderIfMarkdown(postMatter.data.page.ext, postMatter.rendered);
    return (0, _util.merge)(postMatter, { rendered: rendered });
}

var writePost = (0, _curry2.default)(function writePost(destinationFolder, postMatter) {
    var dest = _path2.default.join(destinationFolder, postMatter.data.page.destination);
    console.log('writing file', dest);
    return (0, _util.writeFile)(dest, postMatter.rendered);
});

var mergeGlobalData = (0, _curry2.default)(function mergeGlobalData(globalData, postMatter) {
    return (0, _util.merge)(postMatter, { data: globalData });
});

var addGlobalData = (0, _curry2.default)(function addGlobalData(globalData, current) {
    return (0, _util.merge)(current, globalData);
});

function markCurrentPage(postMatter) {
    //TODO: This mutates!
    postMatter.data.pages.find(function (p) {
        return p.page.path === postMatter.data.page.path;
    }).isCurrentPage = true;
    return postMatter;
}

var collectPagesFrontMatter = (0, _curry2.default)(function collectPagesFrontMatter(filePattern, globalData) {
    return (0, _util.mapFilePaths)(filePattern, function (filePath) {
        return (0, _util.readFile)(filePath).then(function (file) {
            return (0, _grayMatter2.default)(file);
        }).then(function (postMatter) {
            return addPageMetadata(filePath, postMatter);
        })
        // filter out everything other than the data property
        .then(function (postMatter) {
            return postMatter.data;
        });
    }).then(function (pages) {
        return (0, _util.merge)(globalData, { pages: pages });
    });
});

var loadGlobalData = (0, _curry2.default)(function loadGlobalData(filePattern, globalData) {
    return (0, _util.mapFiles)(filePattern, function (file, filePath) {
        var _ref;

        return _ref = {}, _ref[_path2.default.basename(filePath, _path2.default.extname(filePath))] = _jsYaml2.default.safeLoad(file), _ref;
    }).then(function (globals) {
        return _util.merge.apply(undefined, [globalData].concat(globals));
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
    config = (0, _util.merge)(defaultConfig, config || {});

    var workingDirectory = _process2.default.cwd();
    if (config.sourceFolder) {
        _process2.default.chdir(config.sourceFolder);
    }

    return (0, _util.chainPromises)({}, [loadHandlebarsPartials(config.includesPattern), loadGlobalData(config.globalPattern), collectPagesFrontMatter(config.filePattern), addGlobalData(config.globalData)]).then(function (globalData) {
        return (0, _util.mapFiles)(config.filePattern, function (file, filePath) {
            return (0, _util.chainPromises)((0, _grayMatter2.default)(file), [mergeGlobalData(globalData), addPageMetadata(filePath), markCurrentPage, resolveExternals, renderTemplate, renderMarkdown, renderLayout(), writePost(config.destinationFolder)]);
        });
    }).then(function () {
        return _process2.default.chdir(workingDirectory);
    });
}

module.exports = { handlebars: _handlebars2.default,
    marked: _marked2.default,
    build: build
};