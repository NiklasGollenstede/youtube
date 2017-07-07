(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/port': Port,
	'node_modules/web-ext-utils/browser/': { Commands, Runtime, Tabs, browserAction, manifest, },
	'node_modules/web-ext-utils/browser/version': { fennec, },
	'node_modules/web-ext-utils/loader/views': { getUrl, openView, },
	'node_modules/web-ext-utils/update/': updated,
	'common/options': options,
	commands,
	content,
	db,
	Downloader,
	Tab,
	playlist,
	require,
}) => {
options.debug.value && console.info('Ran updates', updated);


// browser_action (could not be set in manifest due to fennec incompatibility)
browserAction.setIcon({ path: manifest.icons, });
browserAction.setPopup({ popup: getUrl({ name: 'panel', }), });
fennec && browserAction.onClicked.addListener(() => openView('panel'));

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


// apply content script to existing tabs
const attachedTo = (await content.applyNow());
options.debug.value && console.log(`attached to ${ attachedTo.size } tabs:`, attachedTo);


// debug stuff
Object.assign(global, {
	Browser: require('node_modules/web-ext-utils/browser/'),
	db,
	playlist,
	commands,
	content,
	Downloader,
});

return {
	content,
};

}); })(this);
