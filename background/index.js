(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/functional': { debounce, },
	'node_modules/es6lib/port': Port,
	'node_modules/web-ext-utils/browser/': { Commands, Runtime, Tabs, },
	'node_modules/web-ext-utils/browser/version': { gecko, },
	'node_modules/web-ext-utils/loader/': { ContentScript, },
	'node_modules/web-ext-utils/update/': updated,
	'common/options': options,
	db,
	Tab,
	Playlist,
	require,
}) => {
options.debug.value && console.info('Ran updates', updated);

const playlist = new Playlist({ });

const commands = {
	play() {
		playlist.get() || (playlist.index = 0);
		playlist.is(tab => tab.play());
	},
	pause() {
		Tab.pauseAllBut(null);
	},
	toggle() {
		const tab = playlist.get();
		tab && !tab.playing ? commands.play() : commands.pause();
	},
	next(play = playlist.is(_=>_.playing)) {
		const next = playlist.next();
		play ? commands.play() : commands.pause();
		next && playlist.index === playlist.length - 1 && loadNextTab();
	},
	prev(play = playlist.is(_=>_.playing)) {
		playlist.prev();
		play ? commands.play() : commands.pause();
	},
	loop(value = !options.playlist.children.loop.value) {
		playlist.loop = options.playlist.children.loop.value = !!value;
	},
};

const loadNextTab = !gecko ? () => void 0 : debounce(async () => {
	let tab = playlist.get() || playlist[playlist.length - 1]; if (!tab) { return; } tab = (await tab.tab());
	const tabs = (await Tabs.query({ url: [ 'https://www.youtube.com/watch?*', 'https://gaming.youtube.com/*', ], }))
	.filter(({ id, }) => !Tab.instances.has(id))
	.sort((a, b) => Math.abs(a.index - tab.index) + (a.windowId === tab.windowId) * 1024 - Math.abs(b.index - tab.index) + (b.windowId === tab.windowId) * 1024)
	.slice(0, 5);
	for (const tab of tabs) { try {
		(await Tabs.executeScript(tab.id, { code: 'true', }));
		continue;
	} catch (_) { try {
		(await Tabs.reload(tab.id));
		break;
	} catch (_) { } } }
}, 3000);

Commands && Commands.onCommand.addListener(command => ({
	MediaPlayPause: commands.toggle,
	MediaNextTrack: commands.next,
	MediaPrevTrack: commands.prev,
}[command]()));

Runtime.onConnect.addListener(port => { switch (port.name) {
	case 'tab': {
		new Tab({ tab: port.sender.tab, port: new Port(port, Port.web_ext_Port), });
	} break;
	case 'require.scriptLoader': break;
	default: {
		console.error('connection with unknown name:', port.name);
	}
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
	loadNextTab,
	commands,
	content,
});

return {
	content,
	commands,
	playlist,
};

}); })(this);
