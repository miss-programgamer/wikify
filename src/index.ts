import { readFileSync, readdirSync, writeFile, mkdirSync, PathLike } from "fs";
import { URL } from "url";

import {
	parse as parsePath,
	format as formatPath,
	join, basename, extname
} from "path";

import marked, { Tokens, Renderer, MarkedExtension } from "marked";
import { markedHighlight } from "marked-highlight";
import mustache from "mustache";
import hljs from "highlight.js";

// -- types -- //

export type InPage = {
	path: string;
	content: string;
};

export type InSection = {
	label: string;
	path: string;
	index?: InPage;
	pages: InPage[];
};

export type OutPage = {
	path: string;
	href: string;
	html: string;
};

export type OutSection = {
	path: string;
	index?: OutPage;
	pages: OutPage[];
};

export type Tocs = {
	label: string;
	href?: string;
	links: {
		name: string;
		href: string;
	}[];
}[];

export type View = {
	name: string;
	body: string;
	tocs: Tocs;
	style: string;
	mdstyle: string;
};

export type Options = {
	shell?: string;
	style?: string;
	mdstyle?: string;
	ext?: string;
	base?: string;
	tags?: [string, string];
	partials?: any;
};

// -- main class -- //

export class Wiki {
	// the marked renderer instance
	private _renderer: Renderer = new Renderer();

	// sections that should be rendered later
	private _sections: InSection[] = [];

	// for _link to know what section we're on when it filters hrefs
	private _link_sectionpath: string;

	// for _link to know what this section's index name is
	private _link_indexname: string;

	// mustache partials
	public partials: any;

	// mustache tags
	public tags?: [string, string];

	// path to the mustache template to use as the shell for all pages
	public shell?: string;

	// the style used to format the wiki pages
	public style: string;

	// the style used to structure the markdown itself
	public mdstyle: string;

	// the extension used to determine which files to parse
	public ext: string;

	// the base url on which the wiki will be served
	public base: URL;

	/**
	 * To get started, create a `Wiki`, `add` sections to it, then `save` it to a folder of your choice
	 * @param {Options} options for specifying the mustache template shell, the markdown extension, and the base url
	 */
	public constructor(public name: string, options: Options = {}) {
		this.shell = options.shell ?? join(__dirname, "shell.mst");
		this.style = options.style ?? join(__dirname, "wikify.css");
		this.mdstyle = options.mdstyle ?? join(__dirname, "markdown.css");
		this.ext = options.ext ?? ".md";
		this.base = new URL(options.base ?? "http://localhost:8080/wiki");
		this.tags = options.tags;
		this.partials = options.partials;

		// configure the renderer
		marked.use({ renderer: { link: this._link } }, markedHighlight({ highlight: this._highlight }) as unknown as MarkedExtension);
	}

	/**
	 * Adds a section to the wiki
	 * @param {string} label of this section
	 * @param {string} dir where to look for markdown files
	 * @param {string} index path to this sections' main markdown file (usually a README)
	 */
	public add(label: string, dir?: string, index?: string): void {
		this._sections.push({
			label: label,
			path: label.replace(" ", "-").toLowerCase(),
			index: index != null ? {
				path: index,
				content: readFileSync(index).toString("utf-8"),
			} : null,
			pages: dir != null ? this._readmdSync(dir).map(path => {
				return {
					path: path,
					content: readFileSync(join(dir, path)).toString("utf-8"),
				};
			}) : [],
		});
	}

	/**
	 * saves the wiki to a given directory
	 * @param {string} out folder where to put the wiki
	 * @param {any} partials mustache partials
	 * @param {string[]} tags mustache tags
	 */
	public save(out: string): void {
		mkdirSync(out, { recursive: true });

		for (const section of this.renderSections(this._sections, this.getTocs(this._sections))) {
			if (section.pages.length > 0 || section.index != null) {
				mkdirSync(join(out, section.path), { recursive: true });
			}

			const pages = section.index != null ? section.pages.concat([section.index]) : section.pages;
			for (const page of pages) {
				writeFile(join(out, section.path, page.path), page.html, err => {
					if (err) console.error(err.message);
				});
			}
		}
	}

	/**
	 * @returns {Tocs} the table of contents for this wiki's sections
	 */
	public getTocs(sections: InSection[]): Tocs {
		return sections.map(section => {
			return {
				label: section.label,
				href: section.index != null ? this._hrefFilter(section.index.path, section.path, section.index?.path) : null,
				links: section.pages.map(page => {
					return {
						name: basename(page.path),
						href: this._hrefFilter(page.path, section.path, section.index?.path),
					};
				}),
			};
		});
	}

	/**
	 * renders the wiki's sections to an array of objects
	 * @param {InSection[]} sections to render out to an object
	 * @param {Tocs} tocs table of contents object
	 * @param {any} partials mustache partials
	 * @param {string[]} tags mustache tags
	 * @returns {OutSection[]} sections that can be served in a custom way
	 */
	public renderSections(sections: InSection[], tocs: Tocs): OutSection[] {
		const shell = readFileSync(this.shell).toString("utf-8");
		const style = readFileSync(this.style).toString("utf-8");
		const mdstyle = readFileSync(this.mdstyle).toString("utf-8");

		return sections.map(section => {
			return {
				label: section.label,
				path: section.path,
				pages: section.pages.map(page => this.renderPage(page, section, shell, style, mdstyle, tocs)),
				index: section.index != null ? this.renderPage(section.index, section, shell, style, mdstyle, tocs) : null,
			};
		});
	}

	/**
	 * renders a single page of a section of the wiki
	 * @param {InPage} page the page to render
	 * @param {InSection} section the section this page belongs to
	 * @param {string} path the given section's pathname
	 * @param {string} shell the mustache template to render
	 * @param {string} style the style to inline into the page
	 * @param {Tocs} tocs the table of content object
	 */
	public renderPage(page: InPage, section: InSection, shell: string, style: string, mdstyle: string, tocs: Tocs): OutPage {
		this._link_sectionpath = section.path;
		this._link_indexname = section.index?.path;

		const body = marked.parse(page.content, { renderer: this._renderer, async: false });
		const view = this._view(this.name, body, tocs, style, mdstyle);
		const name = this._pathFilter(page.path, section.index?.path);

		return {
			href: join(this.base.href, section.path, name),
			path: name,
			html: mustache.render(shell, view, this.partials, this.tags),
		};
	}

	/** filter hrefs inside markdown files so they point to the right place */
	private _link = ({ href, title, text }: Tokens.Link): string => {
		return marked.Renderer.prototype.link.call(this._renderer, this._hrefFilter(href, this._link_sectionpath, this._link_indexname), title, text);
	};

	/** syntax highlighting support */
	private _highlight = (code: string, lang: string): string => {
		return hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang }).value : code;
	};

	/** filters hrefs to be relative to the given base */
	private _hrefFilter(href: string, sectionpath: string, indexpath?: string): string {
		if (href.startsWith("#")) return href;

		const url = new URL(href, this.base);

		if (url.origin === this.base.origin) {
			const parsed = parsePath(this.base.pathname + "/" + sectionpath + url.pathname);

			if (parsed.base === indexpath) {
				parsed.base = "index.html";
			} else {
				parsed.ext += ".html";
				delete parsed.base;
			}

			url.pathname = formatPath(parsed);
		}

		return url.href;
	}

	/** filters paths to be html file paths */
	private _pathFilter(path: string, indexpath?: string): string {
		const parsed = parsePath(path);

		if (parsed.root === parsed.dir && parsed.base === indexpath) {
			parsed.base = "index.html";
		} else {
			parsed.ext += ".html";
			delete parsed.base;
		}

		delete parsed.dir;
		delete parsed.root;

		return formatPath(parsed);
	}

	/** build a view object */
	private _view(name: string, body: string, tocs: Tocs, style: string, mdstyle: string): View {
		return { name, body, tocs, style, mdstyle };
	}

	/** reads all markdown files in a directory, non-recursively */
	private _readmdSync(path: PathLike): string[] {
		return readdirSync(path, { withFileTypes: true }).filter(entry => {
			return !entry.isDirectory() && extname(entry.name) == this.ext;
		}).map(entry => {
			return entry.name;
		});
	}
}
