(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/loader/views': { getViews, },
	'node_modules/web-ext-utils/utils/notify': notify,
	'node_modules/es6lib/string': { unescapeHtml, encodeHtml, },
	'node_modules/es6lib/dom': { createElement: _createElement, readBlob, },
	'background/player': Player,
}) => {

/**
 * exports
 */

const Tools = {
	/**
	 * Creates an HTML backup of the video IDs.
	 * The backup can be saved as file or written to the clipboard.
	 * Either way, it is designed to be importable again.
	 * @see ./import-from-file.js
	 * @param  {[videoId]?}  ids    Optional. List of IDs to save. Defaults to the current playlist.
	 * @param  {string?}     title  Optional. Name of the backup. Defaults to `'ytO Playlist'`.
	 * @return {string}             HTML document with a list of links to the videos.
	 */
	toHtml,
	/**
	 * Parses a text and adds all detected video IDs to the playlist.
	 * @param {string|DataTransfer}  text   Text to parse. Can be a paste or drop events `DataTransfer` to allow more precise parsing based on mime types.
	 * @param {naturlal?}            index  Optional. Index in the playlist after which to insert. Defaults to the hovered element or the current index.
	 */
	addVideosFromText,
	/**
	 * Parses files for video IDs and, if any are found, replaces the playlist with their content.
	 * @param {[Blob]}  files  File/Blob objects to read and parse.
	 */
	replaceVideosWithFiles,
};

/**
 * implementation
 */

function toHtml(ids, title) { return (`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${ title || 'ytO Playlist' } @ ${ (new Date).toISOString().replace(/T|:\d\d\..*/g, ' ').trim() }</title></head><body><pre>
	${ (ids || Player.playlist).map(id => `<a href="https://www.youtube.com/watch?v=${id}">${ encodeHtml(getBasicInfoSync(id).title || id) }</a>`).join('\n\t') }
</pre></body><script>with(location)!hash&&replace('#is-yto-backup')</script></html>`); }

function addVideosFromText(text, index) {
	const ids = parseVideosText(text);
	if (!(index >= 0)) {
		const view = getViews().map(_=>_.view).find(_=>_.document.body.matches(':hover'));
		const hovered = view && view.document.querySelector('#playlist media-tile:hover');
		index = hovered ? Array.prototype.indexOf.call(hovered.parentNode.children, hovered) : Player.playlist.index;
	}
	Player.playlist.splice(index + 1, 0, ...ids);
	notify.success(`Added ${ids.length} video${ ids.length === 1 ? '' : 's' }:`, ids.join(' '));
}

async function replaceVideosWithFiles(files) {
	const ids = parseVideosText((await Promise.all(Array.from(files, file => typeof file === 'string' ? file : readBlob(file)))).join('\n'));
	if (!ids.length) { notify.warn('Nothing to import', `Couldn't find any video IDs to import.`); return; }
	Player.playlist.splice(0, Infinity, ...ids);
	notify.success(`Imported ${ids.length} video${ ids.length === 1 ? '' : 's' }`, `from ${files.length} file${ files.length === 1 ? '' : 's' }, and replaced previous list.`);
}

function parseVideosText(text) {
	let ids; if (typeof text === 'object') {
		ids = parseLinkList(text.getData('text/uri-list'))
		|| parseHtml(text.getData('text/html'))
		|| parseHtml(text.getData('text/plain'))
		|| parseLinkList(text.getData('text/plain'))
		|| parseIdList(text.getData('text/plain'));
	} else {
		ids = parseHtml(text) || parseLinkList(text) || parseIdList(text);
	} return ids;

	function parseHtml(text) {
		const links = [ ]; text.replace(/<a\b[^<>]*?href="(.*?)"/g, (_, l) => (links.push(unescapeHtml(l)), ''));
		const ids = links.filter((l, i, a) => !i || a[i-1] !== l).map(parseLink).filter(_=>_); // filter & deduplicate sequences
		return ids.length ? ids : null;
	}
	function parseLinkList(text) { const ids = text.trim().split(/[\s,;]+/g).map(parseLink).filter(_=>_); return ids.length ? ids : null; }
	function parseIdList(text) { const ids = text.trim().split(/[\s,;]+/g).map(parseId).filter(_=>_); return ids.length ? ids : null; }
	function parseLink(url) { let id = null; switch (true) {
		case url.startsWith('https://www.youtube.com/watch'): id = new URL(url).searchParams.get('v'); break;
		case url.startsWith('https://youtu.be/'): id = new URL(url).pathname; break; // e.g.: https://youtu.be/FM7MFYoylVs?list=PLMC9KNkIncKtPzgY-5rmhvj7fax8fdxoj
	} return parseId(id); }
	function parseId(id) { return id && (/^[\w-]{11}$/).test(id) ? id : null; }
}

let views; function getBasicInfoSync(id) { // TODO: have a proper library function for this
	if (!views) { views = getViews().map(_=>_.view); setTimeout(() => (views = null)); }
	const tile = (() => { for (const view of views) {
		const element = view.document.querySelector(`media-tile[video-id="${id}"]`); if (element) { return element; }
	} return null; })();
	return tile ? { title: tile.querySelector('.icon').title, } : { };
}

return Tools;

}); })(this);
