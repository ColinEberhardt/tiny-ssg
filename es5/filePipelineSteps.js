'use strict';

exports.__esModule = true;
exports.renderLayout = exports.writePost = exports.addPageMetadata = exports.mergeGlobalData = undefined;
exports.markCurrentPage = markCurrentPage;
exports.renderTemplate = renderTemplate;
exports.renderMarkdown = renderMarkdown;

var _curry = require('curry');

var _curry2 = _interopRequireDefault(_curry);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _q = require('q');

var _q2 = _interopRequireDefault(_q);

var _grayMatter = require('gray-matter');

var _grayMatter2 = _interopRequireDefault(_grayMatter);

var _memoizee = require('memoizee');

var _memoizee2 = _interopRequireDefault(_memoizee);

var _marked = require('marked');

var _marked2 = _interopRequireDefault(_marked);

var _handlebars = require('handlebars');

var _handlebars2 = _interopRequireDefault(_handlebars);

var _util = require('./util');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var handlebarsCompile = (0, _memoizee2.default)(_handlebars2.default.compile);

var mergeGlobalData = exports.mergeGlobalData = (0, _curry2.default)(function (globalData, postMatter) {
    return (0, _util.merge)(postMatter, { data: globalData });
});

// create a page variable that contains filepath information'
var addPageMetadata = exports.addPageMetadata = (0, _curry2.default)(function (filePath, postMatter) {
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

function markCurrentPage(postMatter) {
    //TODO: This mutates!
    postMatter.data.pages.find(function (p) {
        return p.page.path === postMatter.data.page.path;
    }).isCurrentPage = true;
    return postMatter;
}

// renders the template in the 'content' property with the 'data' into a 'rendered' property
function renderTemplate(postMatter) {
    var compiledTemplate = handlebarsCompile(postMatter.content);
    var templatedPost = compiledTemplate(postMatter.data);
    return (0, _util.merge)(postMatter, { rendered: templatedPost });
}

// if the file has a '.md' extensions, the 'rendered' property is markdown rendered
function renderMarkdown(postMatter) {
    var rendered = postMatter.data.page.ext === '.md' ? (0, _marked2.default)(postMatter.rendered) : postMatter.rendered;
    return (0, _util.merge)(postMatter, { rendered: rendered });
}

var writePost = exports.writePost = (0, _curry2.default)(function (destinationFolder, postMatter) {
    var dest = _path2.default.join(destinationFolder, postMatter.data.page.destination);
    console.log('writing file', dest);
    return (0, _util.writeFile)(dest, postMatter.rendered).then(function () {
        return postMatter;
    });
});

var renderLayout = exports.renderLayout = (0, _curry2.default)(function (postMatter) {
    return renderNamedLayout(postMatter, postMatter.data.layout);
});

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