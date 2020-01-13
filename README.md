# Wikify

Wikify is a small and convenient module that converts a group of markdown files in a directory into html files to create a wiki. It uses [Marked](https://www.npmjs.com/package/marked) to convert markdown into html and embeds that into a customizable [Mustache](https://www.npmjs.com/package/mustache) template. It then uses [Highlight.js](https://www.npmjs.com/package/highlight.js) to do syntax highlighting on code blocks.

**Table of contents**
- [Installation](#installation)
- [Usage](#usage)
- [Options](#options)
- [View Format](#view-format)
- [Shortcomings](#shortcomings)
- [API](#api)

## Installation

You can install Wikify using npm. Don't forget to either `--save` or `--save-dev`!

```cmd
$ npm install wikify
```

## Usage

You use wikify by creating a `Wiki`, giving it a name, and `add`ing sections to it. Each section must have a label, an optional folder path, and an optional index file. Finally, to save your wiki as a folder, you use the `save` method.

```js
const { Wiki } = require("wikify");

const wiki = new Wiki("My Local Doc Wiki");
wiki.add("Documentation", "docs", "README.md");
wiki.save("wiki");
```

## Options

The default `Wiki` constructor only requires that you name your wiki. However, you may use more advanced options by creating it with an additional options object as a second argument. The options that can be specified are a mustache template to use instead of the default, the CSS style that will be inlined into each page, the extension used to find markdown files, and the base URL on which you'll serve your wiki. The following example configures a `Wiki` with more advanced options.

```js
const { Wiki } = require("wikify");

const wiki = new Wiki("More Advanced Wiki", {
	shell:   "template.mst",
	style:   "layout.css",
	mdstyle: "markdown.css",
	ext:     ".markdown",
	base:    "http://localhost:8080/wiki",
});
```

The option you're most likely to set yourself is `base`. This lets you specify the domain, port, and path on which your wiki will be served. Note that wikify doesn't actually serve your wiki for you, and you'll need to use a separate tool for this. Luckily, a very simple command-line tool is available via NPM called [http-server](https://www.npmjs.com/package/http-server) which lets you quickly turn any folder into a localhost fileserver.

By default, wikify uses the same base address as the example above, so all you need to do to get started is `save` your `Wiki` to the `wiki` folder inside your project and run `http-server` without any options! All you need to do after that is navigate to a page, which will be of the form `http://localhost:8080/wiki/section/index.html` if you specified an index file, or `http://localhost:8080/wiki/section/markdown.md.html` for any other markdown file in that section.

## View Format

The page "shell" will be given a view object of the following format.

```ts
type View = {
	name:    string;
	body:    string;
	toc:     Tocs;
	style:   string;
	mdstyle: string;
};
```

Where `Tocs` refers to the following type. Note that this type is an array.

```ts
type Tocs = {
	label: string;
	href?: string;
	links: {
		name: string;
		href: string;
	}[];
}[];
```

This is useful to know if you intend to provide your own mustache template instead of the default.

## Shortcomings

A few noteworthy things, in no meaningful order.

- Sections are flat. They do not currently look for markdown files in subdirectories recursively.
- Relative links to other markdown files will work, unless they span from one section to another.
- Wikify does not automatically start a fileserver, although the `http-server` package makes it very easy to do on your own.

## API

### Class `Wiki`

This is the only class exported from this package. its constructor takes two arguments.

- `name: string` The name you wish to give your wiki, will appear at the bottom of the page.
- `options?: Options` An object used to override various default behaviors.
	- `shell: string = __dirname + "shell.mst"` Path to a mustache template file.
	- `style: string = __dirname + "wikify.css"` Path to the wiki layout styling file.
	- `mdstyle: string = __dirname + "markdown.css"` Path to the markdown styling file.
	- `ext: string = ".md"` The extension that markdown files are expected to have. Needs to start with a period.
	- `base: string` The base URL on which you intend to serve your wiki later.
	- `tags: string[]` The mustache tags to pass down to the renderer.
	- `partials: any` The mustache partials to pass down to the renderer.

### Method `add`

This is the function that adds sections to your wiki. It can take three arguments. The third argument is useful because it lets you link your project's README to this section's label.

- `label: string` The name of this section and the text of the link that points to that section's `index.html`.
- `dir?: string` A path to a folder of markdown files which you want to convert into a wiki.
- `index?: string` A path to a file that will be this section's index. Does not have to be inside `dir`.

### Method `save`

Saves your wiki's files to a folder. Each section has a subfolder in the directory you give it, and all of a section's files are in those subdirectories. This method takes one argument.

- `out: string` The path to the directory where your wiki should be saved.
