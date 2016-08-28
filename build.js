'use strict'; /* globals __dirname, process */ // license: MPL-2.0

require('es6lib/require');

const {
	concurrent: { spawn, promisify, },
	functional: { log, },
	fs: { FS, },
	process: { execute, },
} = require('es6lib');

spawn(function*() {

const { join, relative, resolve, dirname, basename, } = require('path');

const [ _package, _manifest, ] = (yield Promise.all([ FS.readFile('package.json', 'utf8'), FS.readFile('manifest.json', 'utf8'), ])).map(JSON.parse);
[ 'title', 'version', 'author', ]
.forEach(key => {
	if (_manifest[key] && _package[key] !== _manifest[key]) { throw new Error('Key "'+ key +'" mismatch (package.json, manifest.json)'); }
});

const outputName = _package.title.toLowerCase().replace(/["\/\\|<>?*\x00-\x19 ]/g, '_') +'-'+ _package.version;

const include = {
	'.': [
		'background/',
		'common/',
		'content/',
		'ui/',
		'update/',
		'icon.png',
		'LICENSE',
		'manifest.json',
		'README.md',
	],
	node_modules: {
		es6lib: [
			'template/escape.js',
			'require.js',
			'namespace.js',
			'object.js',
			'format.js',
			'functional.js',
			'concurrent.js',
			'dom.js',
			'network.js',
			'index.js',
		],
		'web-ext-utils': [
			'utils.js',
			'chrome/',
			'options/',
			'update/',
		],
		sortablejs: [
			'Sortable.min.js',
		],
	},
};

(yield promisify(require('fs-extra').writeJson)(
	'./update/versions.json',
	(yield FS.readdir(resolve(__dirname, 'update')))
	.map(path => basename(path))
	.filter(name => (/^\d+\.\d+\.\d+\.js$/).test(name))
	.map(_=>_.slice(0, -3))
));

const paths = [ ];
function addPaths(prefix, module) {
	if (Array.isArray(module)) { return paths.push(...module.map(file => join(prefix, file))); }
	Object.keys(module).forEach(key => addPaths(join(prefix, key), module[key]));
}

addPaths('.', include);

const copy = promisify(require('fs-extra').copy);
const remove = promisify(require('fs-extra').remove);
(yield Promise.all(paths.map(path => copy(path, join('build', path)).catch(error => console.error('Skipping missing file/folder "'+ path +'"')))));

// (yield execute('node '+ resolve(...'/node_modules/web-ext/bin/web-ext'.split(/\//g)) +' build --source-dir ./build --artifacts-dir ./build'));
(yield promisify(require('zip-dir'))('./build', { filter: path => !(/\.(?:zip|xpi)$/).test(path), saveTo: `./build/${ outputName }.zip`, }));


})
.then(() => console.log('Build done'))
.catch(error => console.error('Error during build:', error.stack || error) === process.exit(-1));
