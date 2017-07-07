(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/loader/': { ContentScript, },
	'node_modules/web-ext-utils/utils/files': { readdir, },
	'common/options': options,
	VideoInfo,
}) => {

const content = new ContentScript({
	runAt: 'document_start',
	include: [ 'https://www.youtube.com/*', 'https://gaming.youtube.com/*', ],
	modules: [
		'node_modules/es6lib/concurrent',
		'node_modules/es6lib/dom',
		'node_modules/es6lib/functional',
		'node_modules/es6lib/namespace',
		'node_modules/es6lib/network',
		'node_modules/es6lib/object',
		'node_modules/es6lib/observer',
		'node_modules/es6lib/port',
		'node_modules/es6lib/string',
		'node_modules/web-ext-utils/browser/index',
		'node_modules/web-ext-utils/browser/version',
		'node_modules/web-ext-utils/options/index',
		'common/event-emitter',

		// these need to be in dependency order
		'content/options',
		'content/layout-new.css',
		'content/layout-old.css',
		'content/player.js',
		'content/utils',
		'content/templates',
		'content/player',
		'content/ratings',
		'content/passive',
		'content/actions',
		'content/layout',
		'content/control',
		'content/index',
		// ...readdir('content').filter(_=>_.endsWith('.js')).map(name => 'content/'+ name.slice(0, -3)), // this can be used once the loader keeps track of loaded scripts in the background
	],
});

options.incognito.whenChange(([ value, ]) => {
	content.incognito = value;
});

content.onMatch(async frame => {
	(await frame.connect('VideoInfo')).addHandlers(VideoInfo);
});

/*content.onMatch(async frame => {
	const get = frame.connect('player'); frame.connect('player');
	const port = (await get);
	port.addHandler(function hello(sender) {
		console.log('background got hello from', sender);
	});
	const reply = (await port.request('hello', 'background'));
	console.log('background got reply', reply);
});*/

return content;

}); })(this);
