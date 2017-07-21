(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Commands, browserAction, manifest, rootUrl, },
	'node_modules/web-ext-utils/browser/version': { fennec, },
	'node_modules/web-ext-utils/loader/views': { getUrl, openView, },
	'node_modules/web-ext-utils/update/': updated,
	'common/options': options,
	content,
	Downloader,
	Player,
	require,
	module,
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


// apply content script to existing tabs (don't await the result because that currently doesn't always resolve on Firefox ...)
content.applyNow().then(frames => options.debug.value && console.log(`Attached to ${ frames.size } tabs:`, frames));


// debug stuff
Object.assign(global, module.exports = {
	Browser: require('node_modules/web-ext-utils/browser/'),
	content,
	Downloader,
	options,
	Player,
	background: global,
});

}); })(this);
