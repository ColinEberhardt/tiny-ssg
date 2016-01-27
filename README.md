# tiny-ssg

ting-ssg is a very small, hackable, static site generator that is built around handlebars.

I created tiny-ssg due to a number of frustrating experiences with Jekyll and Assemble. Both are fine static site generators, however, as soon as you want to do something out of the ordinary, it becomes something of a battle. My aim with tiny-ssg is to make the static site generator so simple that it is easy to 'hack' it, so that you can easily add custom transformation steps, rather than battling with a templating engine.

## Installation

Install via npm as follows:

```
npm install --save tiny-ssg handlebars marked
```

Both handlebars and marked are [peer dependencies](https://nodejs.org/en/blog/npm/peer-dependencies/), allowing you to configure them from your project.

## Command line

If installed globally, you can use tiny-ssg via a command line interface:

```
$ tiny-ssg --help

  Usage: cli [options] <files ...>

  Options:

    -h, --help                         output usage information
    -V, --version                      output the version number
    -i, --includes-pattern [pattern]   File pattern for handlebars partials, defaults to '_includes/*.*'
    -g, --global-pattern [pattern]     File pattern for files that provide global data, default to 'config.yml'
    -d, --destination-folder [folder]  Folder for the generated output, defaults to '_site'
```

## JavaScript

tiny-ssg exposes a `build` function that allows the same configuration as the command line interface above. Typically this will be used to integrate with grunt or gulp:

```
const tinySSG = require('tiny-ssg');

gulp.task('build', () => {
  const config = {
      filePattern: ['index.html', '_posts/**/*.md'],
      globalPattern: ['site.yml'],
      // provide additional global data
      globalData: {site: {baseurl: 'http://localhost:8080'}},
      sourceFolder: 'src'
    };
  return tinySSG.build(config);
});
```

The config object supports the same configuration options as the command-line interface. In addition, you can also specify the source folder, and supply additional global data.
