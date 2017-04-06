(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/functional': { debounce, },
	'node_modules/web-ext-utils/browser/': { Tabs, },
	'node_modules/web-ext-utils/browser/version': { gecko, },
	'common/options': options,
	playlist,
	require,
	module,
}) => {
let Tab; module.ready.then(() => require.async('./tab').then(_ => (Tab = _)));

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
		play && next ? commands.play() : commands.pause();
		next && playlist.index === playlist.length - 1 && loadNextTab();
	},
	prev(play = playlist.is(_=>_.playing)) {
		const prev = playlist.prev();
		play && prev ? commands.play() : commands.pause();
	},
	loop(value = !options.playlist.children.loop.value) {
		playlist.loop = options.playlist.children.loop.value = !!value;
	},
	loadNextTab() { loadNextTab(); },
};

const loadNextTab = !gecko ? () => void 0 : debounce(async () => {
	let tab = playlist.get() || playlist[playlist.length - 1]; if (!tab) { return; } tab = (await tab.tab());
	const tabs = (await Tabs.query({ url: [ 'https://www.youtube.com/watch?*', 'https://gaming.youtube.com/*', ], windowId: tab.windowId, }))
	.filter(({ id, }) => !Tab.instances.has(id));
	for (let i = 0; i < 5; i++) {
		const tab = tabs[Math.random() * tabs.length |0];
		if ((await Tabs.executeScript(tab.id, { code: 'true', }).catch(() => false))) { continue; }
		if ((await Tabs.reload(tab.id).then(() => true, () => false))) { return; }
	}
}, 3000);

return commands;

}); })(this);
