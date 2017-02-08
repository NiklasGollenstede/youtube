(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	require,
	'node_modules/es6lib/functional': { debounce, },
	'node_modules/es6lib/port': _, // for browser/Messages
	'node_modules/web-ext-utils/browser/': { Commands, Runtime, Tabs, Messages, },
	'node_modules/web-ext-utils/browser/version': { gecko, },
	'node_modules/web-ext-utils/update/': updated,
	'node_modules/web-ext-utils/utils/': { attachAllContentScripts, showExtensionTab, },
	'common/options': options,
	db,
	Tab,
	PanelHandler,
	Playlist,
}) => {
console.log('Ran updates', updated);

window.Browser = require('node_modules/web-ext-utils/browser/');
window.db = db; window.options = options;

const playlist = window.playlist = new Playlist({
	onSeek(index) {
		console.log('onSeek', index);
		panel.emit('playlist_seek', index);
	},
	// onAdd(index, value) { },
});

const commands = window.commands = {
	play() {
		playlist.is(tab => tab.play());
	},
	pause() {
		Tab.pauseAllBut(null);
	},
	toggle() {
		const tab = playlist.get();
		tab && !tab.playing ? commands.play() : commands.pause();
	},
	next() {
		if (playlist.next()) {
			commands.play();
			playlist.index === playlist.length - 1 && loadNextTab();
		} else {
			commands.pause();
		}
	},
	prev() {
		playlist.prev() ? commands.play() : commands.pause();
	},
	loop(value = !playlist.loop) {
		playlist.loop = !!value;
		panel.emit('state_change', { looping: playlist.loop, });
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
global.loadNextTab = loadNextTab;

const panel = window.panel = new PanelHandler({ tabs: Tab.actives, playlist, commands, });

Commands && Commands.onCommand.addListener(command => ({
	MediaPlayPause: commands.toggle,
	MediaNextTrack: commands.next,
	MediaPrevTrack: commands.prev,
}[command]()));

Runtime.onConnect.addListener(port => { switch (port.name) {
	case 'panel': {
		panel.add(port);
	} break;
	case 'tab': {
		new Tab({ port, playlist, commands, panel, data: db, });
	} break;
	case 'require.scriptLoader': break;
	default: {
		console.error('connection with unknown name:', port.name);
	}
} });

// open or focus the options view in a tab.
Messages.addHandler('openOptions', window.openOptions = () => showExtensionTab('/ui/options/index.html'));
Messages.addHandler('openPlaylist', window.openPlaylist = () => showExtensionTab('/ui/panel/index.html?theme='+ options.children.panel.children.theme.value, '/ui/panel/index.html'));

// allow content_scripts to ping
Messages.addHandler('ping', () => true);

// report location changes to the content scripts
Tabs.onUpdated.addListener((id, { url, }) => url && Tab.instances.has(id) && Tab.instances.get(id).port.post('page.navigated'));

// load the content_scripts into all existing tabs
const [ count, ] = (await attachAllContentScripts({ cleanup: () => {
	delete window.require;
	delete window.define;
}, }));

console.log(`attached to ${ count } tabs`);

}); })(this);
