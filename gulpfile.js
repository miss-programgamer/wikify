// -- gulp -- //
const { src, dest, task, series, parallel, watch } = require("gulp");

// -- plugins -- //
const plug = {
	ts:   require("gulp-typescript").createProject("tsconfig.json"),
	sass: require("gulp-sass"),
};

const paths = {
	ts:   ["src/*.ts", "!src/*.d.ts"],
	sass: ["src/*.scss"],
};

// -- builders -- //
function ts() {
	return src(paths.ts)
		.pipe(plug.ts())
		.pipe(dest("src"));
}

function sass() {
	return src(paths.sass)
		.pipe(plug.sass().on('error', plug.sass.logError))
		.pipe(dest("src"));
}

const builders = { ts, sass };

// -- tasks -- //
task(function build(done) {
	series(parallel(ts, sass))(done);
});

task(function watcher(done) {
	for (const [builder, path] of Object.entries(paths))
		watch(path, builders[builder]);
	
	done();
});

task(function dev(done) {
	series("build", "watcher")(done);
});
