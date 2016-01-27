import curry from 'curry';
import path from 'path';
import Q from 'q';
import matter from 'gray-matter';
import memoize from 'memoizee';
import marked from 'marked';
import handlebars from 'handlebars';

import { merge, readFile, writeFile } from './util';

const handlebarsCompile = memoize(handlebars.compile);

export const mergeGlobalData = curry((globalData, postMatter) => {
    return merge(postMatter, { data: globalData});
});

// create a page variable that contains filepath information'
export const addPageMetadata = curry((filePath, postMatter) => {
    // '/foo/bar/baz/asdf/quux.md'
    const page = {
        path: filePath, // '/foo/bar/baz/asdf/quux.md'
        basename: path.basename(filePath, path.extname(filePath)), // 'quux'
        dirname: path.dirname(filePath),  // '/foo/bar/baz/asdf'
        ext: path.extname(filePath), // '.md'
        destination: path.join('/', filePath.substring(0, filePath.length - path.extname(filePath).length) + '.html') // '/foo/bar/baz/asdf/quux.html'
    };
    return merge(postMatter, { data: {page} });
});

export function markCurrentPage(postMatter) {
    //TODO: This mutates!
    postMatter.data.pages.find(p => p.page.path === postMatter.data.page.path).isCurrentPage = true;
    return postMatter;
}

export function resolveExternals(postMatter) {
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

// renders the template in the 'content' property with the 'data' into a 'rendered' property
export function renderTemplate(postMatter) {
    const compiledTemplate = handlebarsCompile(postMatter.content);
    const templatedPost = compiledTemplate(postMatter.data);
    return merge(postMatter, { rendered: templatedPost });
}

// if the file has a '.md' extensions, the 'rendered' property is markdown rendered
export function renderMarkdown(postMatter) {
    const rendered = postMatter.data.page.ext === '.md' ? marked(postMatter.rendered) : postMatter.rendered;
    return merge(postMatter, { rendered });
}

export const writePost = curry((destinationFolder, postMatter) => {
    const dest = path.join(destinationFolder, postMatter.data.page.destination);
    console.log('writing file', dest);
    return writeFile(dest, postMatter.rendered)
      .then(() => postMatter);
});

export const renderLayout = curry((postMatter) => {
    return renderNamedLayout(postMatter, postMatter.data.layout);
});

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
