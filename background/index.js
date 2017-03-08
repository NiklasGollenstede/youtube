(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/functional': { debounce, },
	'node_modules/es6lib/port': Port,
	'node_modules/web-ext-utils/browser/': { Commands, Runtime, Tabs, },
	'node_modules/web-ext-utils/browser/version': { gecko, },
	'node_modules/web-ext-utils/loader/': { ContentScript, },
	'node_modules/web-ext-utils/update/': updated,
	'common/options': options,
	commands,
	db,
	Tab,
	playlist,
	require,
}) => {
options.debug.value && console.info('Ran updates', updated);

// global hotkeys
Commands && Commands.onCommand.addListener(command => ({
	MediaPlayPause: commands.toggle,
	MediaNextTrack: commands.next,
	MediaPrevTrack: commands.prev,
}[command]()));

// port connections
Runtime.onConnect.addListener(port => { switch (port.name) {
	case 'tab': {
		new Tab({ tab: port.sender.tab, port: new Port(port, Port.web_ext_Port), });
	} break;
	case 'require.scriptLoader': break;
	default: console.error('connection with unknown name:', port.name);
} });

// report location changes to the content scripts
Tabs.onUpdated.addListener((id, { url, }) => {
	const tab = Tab.instances.get(id);
	if (!url || !tab || tab.url === url) { return; }
	tab.url = url;
	tab.port.post('page.navigated');
});

// attach ContentScript
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
	],
});
options.incognito.whenChange(value => {
	content.incognito = value;
});
const attachedTo = (await content.applyNow());

options.debug.value && console.log(`attached to ${ attachedTo.size } tabs:`, attachedTo);

Object.assign(global, {
	Browser: require('node_modules/web-ext-utils/browser/'),
	db,
	playlist,
	commands,
	content,
});

return {
	content,
};

}); })(this);
