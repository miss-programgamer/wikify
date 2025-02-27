// -- gulp -- //
import { src, dest, task, series, parallel, watch } from "gulp";

// -- plugins -- //
import gulpTs from 'gulp-typescript';
import gulpSass from 'gulp-sass';
import * as sassCompiler from 'sass';

const plug = {
	ts: gulpTs.createProject("tsconfig.json"),
	sass: gulpSass(sassCompiler),
};

const paths = {
	ts: ["src/*.ts", "!src/*.d.ts"],
	sass: ["src/*.scss"],
};

// -- builders -- //
function ts() {
	return src(paths.ts)
		.pipe(plug.ts())
		.pipe(dest("lib"));
}

function sass() {
	return src(paths.sass)
		.pipe(plug.sass().on('error', plug.sass.logError))
		.pipe(dest("lib"));
}

// -- tasks -- //
task("build", done => {
	series(parallel(ts, sass))(done);
});

task("watcher", done => {
	for (const [builder, path] of Object.entries(paths)) {
		watch(path, { ts, sass }[builder]);
	}

	done();
});

task("dev", done => {
	series("build", "watcher")(done);
});
