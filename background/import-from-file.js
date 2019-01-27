(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Tabs, },
	'node_modules/web-ext-utils/browser/messages': messages,
	'node_modules/web-ext-utils/loader/': { ContentScript, runInFrame, },
	'background/playlist-tools': { addVideosFromText, replaceVideosWithFiles, },
}) => {

/**
 * Listens for playlist backup files to be opened in tabs and inserts buttons to import the backup.
 * The HTML backup contain a tiny script that appends the `'#is-yto-backup'` fragment id to the URL.
 * If a `'file:///'` url with that fragment is opened, the buttons are inserted at the top of the page.
 */

const matcher = new ContentScript({
	include: [ 'file:///*', ],
	runAt: 'document_end', incognito: false, frames: 'top',
});
matcher.onMatch(async ({ tabId, }) => {
	const { url, } = (await Tabs.get(tabId));
	if (!url.endsWith('#is-yto-backup')) { return; } // can't directly filter by #hash
	(await runInFrame(tabId, 0, () => { define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
		'node_modules/web-ext-utils/browser/': { manifest, },
		'node_modules/web-ext-utils/browser/messages': messages,
		'node_modules/es6lib/dom': { createElement: $, },
	}) => { /* global document */
		document.body.insertBefore($('h1', [ manifest.name +':',
			' ', $('button', { onclick: _=>/*!_.button &&*/ add(false), }, 'Add all to Playlist'),
			' ', $('button', { onclick: _=>/*!_.button &&*/ add(true), }, 'Replace Playlist with:'),
		]), document.body.firstChild);
		function add(replace) { messages.post('importPlaylist', document.body.innerHTML, replace); }
	}); }));
});
messages.addHandler(async function importPlaylist(html, replace) {
	replace ? replaceVideosWithFiles([ html, ]) : addVideosFromText(html);
});

return matcher;

}); })(this);
