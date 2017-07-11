(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Commands, Tabs, Windows, browserAction, manifest, rootUrl, },
	'node_modules/web-ext-utils/loader/': { getFrame, },
	'node_modules/web-ext-utils/browser/messages': messages,
	'node_modules/web-ext-utils/browser/version': { fennec, gecko, opera, },
	'node_modules/web-ext-utils/loader/views': { getUrl, openView, getViews, },
	'node_modules/web-ext-utils/update/': updated,
	'node_modules/web-ext-utils/utils/': { reportError, },
	'node_modules/es6lib/concurrent': { sleep, },
	'common/options': options,
	content,
	Downloader,
	Player,
	require,
}) => {
options.debug.value && console.info('Ran updates', updated);


// browser_action (could not be set in manifest due to fennec incompatibility)
browserAction.setIcon({ path: manifest.icons, });
browserAction.setPopup({ popup: getUrl({ name: 'panel', }).slice(rootUrl.length - 1), });
fennec && browserAction.onClicked.addListener(() => openView('panel'));

// global hotkeys
Commands && Commands.onCommand.addListener(command => ({
	MediaPlayPause: Player.toggle,
	MediaNextTrack: Player.next,
	MediaPrevTrack: Player.prev,
}[command]()));


// messages
messages.addHandlers({
	reportError,
	replyAfter(ms) { return sleep(ms); },
	async   muteTab() { return void (await !fennec && Tabs.update(this.tab.id, { muted: true, })); },
	async unmuteTab() { return void (await !fennec && Tabs.update(this.tab.id, { muted: false, })); },
	async focusTabTemporary() { // TODO: move this somewhere else
		if (gecko) { return; } // let's not do Firefox until it becomes necessary again
		const tabId = this.tab.id;
		const { index, windowId, active, pinned, } = (await Tabs.get(tabId));
		console.log('focus_temporary', { index, windowId, active, pinned, });
		if (active) { return; } // moving the tab won't do anything positive

		// avoid moving the tab if not absolutely necessary (especially in firefox it doesn't perform well)
		if ((await activateTabIfWindowIsIdle(tabId, windowId))) { return; }
		console.log('focus_temporary the long way');

		// moving the tab back from a panel or pop-up window throws in FF54, opening a normal window is awfully slow (it also opens sidebars and such)
		(await Windows.create({ tabId: tabId, state: 'minimized', type: 'popup', })); // move into own window ==> focuses
		(await Tabs.move(tabId, { index, windowId, })); // move back into original window
		(await Tabs.update(tabId, { active, pinned, })); // need to pin again if it was pinned
		(await Tabs.move(tabId, { index, windowId, })); // move to the correct position within (the pinned tabs of) the window
	},
});
async function activateTabIfWindowIsIdle(tabId, windowId) {
	windowId == null && ({ windowId, } = (await Tabs.get(tabId)));

	if ( // the window is focused and the focus is not on one if the add-ons own UI elements
		fennec // no windows at all
		|| !(await Windows.get(windowId)).focused
		|| (gecko || opera) && getViews().some(({ type, view, }) =>
			gecko && type === 'panel' // in firefox, panels always have focus, but the active tab can change without closing them
			|| type === 'sidebar' && view.document.hasFocus() // sidebars are not considered part of the window for this
		)
	) {
		(await Tabs.update(tabId, { active: true, }));
		return true;
	}
	return false;
}


// report location changes to the content scripts
Tabs.onUpdated.addListener(async (tabId, { url, }) => {
	if (!url || !(await content.appliedToFrame(tabId))) { return; }
	messages.post({ tabId, }, 'navigated', url);
});


{ // apply content script to existing tabs
	const frames = (await content.applyNow());
	options.debug.value && console.log(`attached to ${ frames.size } tabs:`, frames);
}

// debug stuff
Object.assign(global, {
	Browser: require('node_modules/web-ext-utils/browser/'),
	content,
	Downloader,
	options,
	Player,
});

}); })(this);
