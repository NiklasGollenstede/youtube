(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Tabs, Windows, },
	'node_modules/web-ext-utils/browser/messages': messages,
	'node_modules/web-ext-utils/browser/version': { fennec, gecko, },
	'node_modules/web-ext-utils/loader/': { ContentScript, },
	'node_modules/web-ext-utils/utils/files': { readdir, },
	'node_modules/web-ext-utils/utils/notify': notify,
	'node_modules/es6lib/concurrent': { sleep, },
	'common/options': options,
	utils: { windowIsIdle, },
	VideoInfo,
}) => {

const content = new ContentScript({
	runAt: 'document_start',
	include: [ 'https://www.youtube.com/*', 'https://gaming.youtube.com/*', ],
	modules: [
		// every script in the /content/ folder
		...readdir('content').filter(_=>_.endsWith('.js')).map(name => 'content/'+ name.slice(0, -3)),

		// and their dependencies (this is just for a slight performance increase)
		'node_modules/es6lib/concurrent', // check for removal
		'node_modules/es6lib/dom',
		'node_modules/es6lib/functional',
		'node_modules/es6lib/object',
		'node_modules/es6lib/observer',
		'node_modules/es6lib/string',
		'node_modules/multiport/',
		'node_modules/web-ext-utils/browser/index',
		'node_modules/web-ext-utils/browser/messages',
		'node_modules/web-ext-utils/browser/storage',
		'node_modules/web-ext-utils/browser/version',
		'node_modules/web-ext-utils/options/index',
		'node_modules/web-ext-utils/utils/event',
		'common/event-emitter',
	],
});

options.incognito.whenChange(([ value, ]) => {
	content.incognito = value;
});

content.onMatch(async frame => {
	const port = (await frame.connect('VideoInfo')).addHandlers(VideoInfo);
	frame.onUnload(() => port.destroy());
});

// allow content to show notifications
messages.addHandlers('notify.', Object.assign({ }, notify));

messages.addHandlers({
	replyAfter(ms) { return sleep(ms); }, // setTimeout doesn't work reliably in background tabs
	async   muteTab() { (await !fennec && Tabs.update(this.tab.id, { muted: true, })); },
	async unmuteTab() { (await !fennec && Tabs.update(this.tab.id, { muted: false, })); },
	async focusTabTemporary() { // in chrome (and probably other browsers) YouTube refuses to/can't play until the tab was active once
		if (gecko) { return; } // let's not do this in Firefox until it becomes necessary again
		const tabId = this.tab.id, { index, windowId, active, pinned, } = (await Tabs.get(tabId));
		console.log('focus_temporary', { index, windowId, active, pinned, });
		if (active) { return; } // moving the tab won't do anything positive

		// avoid moving the tab if not necessary
		if ((await windowIsIdle(windowId))) { (await Tabs.update(tabId, { active: true, })); return; } // playing the video would do this anyway
		console.log('focus_temporary the long way');

		(await Windows.create({ tabId: tabId, state: 'minimized', type: 'popup', })); // move into own window ==> focuses
		(await Tabs.move(tabId, { index, windowId, })); // move back into original window
		(await Tabs.update(tabId, { active, pinned, })); // need to pin again if it was pinned
		(await Tabs.move(tabId, { index, windowId, })); // move to the correct position within (the pinned tabs of) the window
	},
});

// report location changes to the content scripts
Tabs.onUpdated.addListener(async (tabId, { url, }) => {
	if (!url || !(await content.appliedToFrame(tabId))) { return; }
	messages.post({ tabId, }, 'navigated', url);
}, ...(gecko ? [ { urls: content.include, }, ] : [ ]));

return content;

}); })(this);
