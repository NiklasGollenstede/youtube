(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { BrowserAction, Commands, ContextMenus, Runtime, SidebarAction, manifest, rootUrl, },
	'node_modules/web-ext-utils/browser/version': { fennec, },
	'node_modules/web-ext-utils/loader/': Content,
	'node_modules/web-ext-utils/loader/views': { getUrl, showView, openView, },
	'node_modules/web-ext-utils/update/': updated,
	'node_modules/keep-tabs-open/': keepExtTabsOpen,
	'common/options': options,
	content,
	Downloader,
	Player,
	require,
	module,
}) => {
let debug; options.debug.whenChange(([ value, ]) => { debug = value; Content.debug = debug >= 2; });
debug && console.info('Ran updates', updated);


// browser_action (could not be set in manifest due to fennec incompatibility) TODO: that is probably fixed
BrowserAction.setIcon({ path: manifest.icons[1], });
BrowserAction.setPopup({ popup: getUrl({ name: 'panel', }).slice(rootUrl.length - 1), });
fennec && BrowserAction.onClicked.addListener(() => showView('panel'));

ContextMenus.create({ contexts: [ 'browser_action', ], id: 'restart', title: 'Restart', });
ContextMenus.create({ contexts: [ 'browser_action', ], id: 'pllTab', title: 'Show in tab', });
ContextMenus.create({ contexts: [ 'browser_action', ], id: 'pllPopup', title: 'Open in popup', });
SidebarAction && SidebarAction.open &&
ContextMenus.create({ contexts: [ 'browser_action', ], id: 'pllSB', title: 'Open sidebar', });
ContextMenus.create({ contexts: [ 'browser_action', ], id: 'videoTab', title: 'Show video', });
ContextMenus.create({ contexts: [ 'browser_action', ], id: 'settings', title: 'Settings', });
ContextMenus.onClicked.addListener(({ menuItemId, }) => { switch (menuItemId) {
	case 'restart': Runtime.reload(); break;
	case 'pllTab': showView('playlist', 'tab'); break;
	case 'pllPopup': openView('playlist', 'popup', { width: 450, height: 600, }); break;
	case 'pllSB': SidebarAction.open(); break;
	case 'videoTab': showView('video', 'tab'); break;
	case 'settings': showView('options', 'tab'); break;
} });


// global hotkeys
Commands && Commands.onCommand.addListener(command => ({
	MediaPlayPause: Player.toggle,
	MediaNextTrack: Player.next,
	MediaPrevTrack: Player.prev,
}[command]()));


// apply content script to existing tabs (don't await the result because that currently doesn't always resolve in Firefox ...)
content.applyNow().then(frames => debug && console.info(`Attached to ${ frames.size } tabs:`, frames));


// allow extension tabs to stay open when calling `browser.runtime.reload()`
keepExtTabsOpen({ browser: global.browser, iconUrl: '/icon.png', title: 'Reloading: '+ manifest.name, message: `
	<style> :root { background: #424F5A; filter: invert(1) hue-rotate(180deg); font-family: Segoe UI, Tahoma, sans-serif; } </style>
	<h1>Reloading ${manifest.name}</h1><p>This tab should close in a few seconds ...</p>
`, });


// debug stuff
Object.assign(global, module.exports = {
	Browser: require('node_modules/web-ext-utils/browser/'),
	Content,
	content,
	Downloader,
	options,
	Player,
	background: global,
});

}); })(this);
