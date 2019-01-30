(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Runtime, Tabs, Windows, Bookmarks, },
	'node_modules/web-ext-utils/loader/views': { getViews, showView, locationFor, },
	'node_modules/web-ext-utils/utils/notify': notify,
	'node_modules/es6lib/string': { fuzzyIncludes, },
	'node_modules/es6lib/dom': { createElement: _createElement, saveAs, writeToClipboard, },
	'background/player': Player,
	'background/playlist': Playlist,
	'background/playlist-tools': { addVideosFromText, replaceVideosWithFiles, toHtml, sortPlaylist, },
	'common/context-menu': ContextMenu,
	'common/dom': { scrollToCenter, },
}) => {

/**
 * exports
 */

function register(window) {
	Object.entries(listeners).forEach(([ name, listener, ]) =>
		window.document.addEventListener(name, listener, !!listener.capturing)
	);
}

const listeners = { contextmenu, dblclick, click, keydown, input, selectionchange, mouseup, cut, copy, paste, drop, dragover, };
const _helpers = { highlight, positionInParent, findElement, forEachElement, focusTab, openTab, closeUnloadedTab, };


/**
 * event listeners
 */

function contextmenu(event) {
	event.preventDefault(); ContextMenu.remove();
	const { target, clientX: x, clientY: y, } = event;
	if (!target.matches) { return; }
	const document = event.target.ownerDocument;
	const others = document.querySelector('#groups');
	const playlist = document.querySelector('#playlist .tiles');
	const items = [ ];
	const tile = target.closest('media-tile');
	const group = target.closest('.group');
	const inList = !!target.closest('#playlist');
	if (tile) {
		const id = tile.videoId;
		const tab = Player.frameFor(id);
		const inTabs = target.closest('#group-tabs, #group-unloaded');
		const bmkId = Array.from(others.querySelectorAll(`media-tile[video-id="${id}"]`), _=>_.dataset.bookmarkId).find(_=>_);
		const addBmk = inList && !bmkId;
		items.push(
			           { icon: '▶',		label: 'Play video',       action: () => { Player.current = id; Player.play(); }, default: tile.matches('#playlist :not(.active)') && !target.closest('.remove, .icon'), },
			 tab    && { icon: '👁',	label: 'Show tab',         action: () => focusTab(id), default: tile.matches('#group-tabs *, .active') && !target.closest('.remove, .icon'), },
			!tab    && { icon: '◳',		label: 'Open in tab',      action: () => openTab(id), },
			 inList && { icon: '❏',		label: 'Duplicate',        action: () => Playlist.splice(positionInParent(tile), 0, id), },
			 inList && { icon: '⨉',		label: 'Remove entry',     action: () => Playlist.splice(positionInParent(tile), 1), default: target.matches('#playlist .remove'), },
			 inTabs && { icon: '⨉',		label: 'Close tab',        action: () => inTabs.closest('#group-tabs') ? Tabs.remove(tab.tabId) : closeUnloadedTab(tile), default: !!target.closest('#group-tabs .remove'), },
			 bmkId  && { icon: '🗑',	label: 'Delete bookmark',  action: () => Bookmarks.remove(bmkId), default: !!target.closest('media-tile[data-bookmark-id] .remove'), },
			 addBmk && { icon: '➕',	label: 'Add bookmark',     action: () => Bookmarks.create({ title: tile.querySelector('.title').textContent, url: 'https://www.youtube.com/watch?v='+ tile.videoId, }), },
			           { icon: '🔍',	label: 'Highlight',        action: () => highlight((inList ? others : playlist).querySelector(`media-tile[video-id="${id}"]`)), },
			           { icon: '📋',	label: 'Copy ID',          action: () => writeToClipboard(id).then(() => notify.success('Copied video ID', id)), },
			!inList && { icon: '➕',	label: 'Add video',        action: () => Playlist.splice(Infinity, 0, id), },
		);
	}
	if (inList) {
		items.push(
			{ icon: '⇵',	 label: 'Sort by',                      type: 'menu', children: [
				{ icon: '⌖',	 label: 'position',                     action: () => sortPlaylist('position').catch(notify.error.bind(null, 'Sorting failed')), },
				{ icon: '👓',	 label: 'views',                        type: 'menu', children: [
					{ icon: '🌐',	 label: 'global',                       action: () => sortPlaylist('viewsGlobal').catch(notify.error.bind(null, 'Sorting failed')), },
					{ icon: '⏱',	 label: 'yours in total duration',      action: () => sortPlaylist('viewsDuration').catch(notify.error.bind(null, 'Sorting failed')), },
					{ icon: '↻',	 label: 'yours in times viewed',        action: () => sortPlaylist('viewsTimes').catch(notify.error.bind(null, 'Sorting failed')), },
				], },
				{ icon: '🔀',	 label: 'Shuffle',                      action: () => sortPlaylist('random').catch(notify.error.bind(null, 'Sorting failed')), },
			], },
			{ icon: '🛇',	 label: 'Clear list',                   action: () => Playlist.splice(0, Infinity), },
			Playlist.undoable && { icon: '↶',	 label: 'Undo', action: () => Playlist.undo(), }, // ↶ ↫ ⎌
			Playlist.redoable && { icon: '↷',	 label: 'Redo', action: () => Playlist.redo(), }, // ↷ ↬
		);
	}
	if (target.closest('.group .header .title')) {
		const box = document.querySelector('#'+ target.htmlFor);
		items.push(
			{ icon: '⇳',	 label: (box.checked ? 'Expand' : 'Collapse') +' tab list', action: () => (box.checked = !box.checked), default: true, }
		);
	}
	if (group) {
		const tiles = Array.from(group.querySelectorAll(document.body.classList.contains('searching') ? 'media-tile.found' : 'media-tile'));
		tiles.length > 1 && items.push(
			{ icon: '⋯',	 label: 'Add all '+   tiles.length, action: () => Playlist.splice(0, Infinity, ...tiles.map(_=>_.videoId)), },
		);
	}
	// ' 🔉 🔈 🔇 🔂 🔁 🔜 🌀 🔧 ⫶ 🔞 '; // some more icons

	if (!items.length) { return; }
	new ContextMenu({ x, y, items, host: document.body, });
}

async function dblclick({ target, button, }) {
	if (button || !target.matches) { return; }
	const document = target.ownerDocument;

	// focus tab (windows) or play tab on dblclick
	const tile = target.closest('media-tile');
	if (tile && tile.closest('#playlist')) {
		if (tile.matches('.active')) {
			focusTab(tile.videoId);
		} else {
			Playlist.index = positionInParent(tile);
		}
	} else if (tile) {
		if (tile.dataset.tabId) {
			(await Tabs.update(tile.dataset.tabId, { active: true, }));
		} else {
			focusTab(tile.videoId);
		}
	} else { const video = target.closest('video'); if (video) {
		video.matches(':fullscreen') ? document.exitFullscreen() : video.requestFullscreen();
		if (pendingToggle) { // doubleclick was to slow, second toggle is still pending
			clearTimeout(pendingToggle); pendingToggle = 0; Player.toggle(); // toggle now
		}
	} }
	document.defaultView.getSelection().removeAllRanges();
}

function click({ target, button, }) {
	if (button || !target.closest) { return; }
	const document = target.ownerDocument;

	const tile = target.closest('media-tile'); if (tile && target.closest('.remove')) {
		// remove tab on left click on ".remove"
		if (tile.closest('#playlist')) {
			Playlist.splice(positionInParent(tile), 1);
		} else if ('tabId' in tile.dataset) {
			Tabs.remove(+tile.dataset.tabId);
		} else if ('bookmarkId' in tile.dataset) {
			Bookmarks.remove(tile.dataset.bookmarkId);
		}
	} else if (target.closest('#searchbox .remove')) {
		const box = document.querySelector('#searchbox>input');
		box.value = ''; box.blur();
		document.body.classList.remove('searching');
	} else if (target.closest('video')) {
		if (pendingToggle) {
			clearTimeout(pendingToggle); pendingToggle = 0; // omit both
		} else {
			pendingToggle = setTimeout(() => { pendingToggle = 0; Player.toggle(); }, 135);
		}
	}
} let pendingToggle = 0;

function keydown(event) {
	const document = event.target.ownerDocument;
	const key = (event.target.matches('TEXTAREA, input:not([type="range"])') ? 'Input+' : '')
	+ (event.ctrlKey ? 'Ctrl+' : '') + (event.altKey ? 'Alt+' : '') + (event.shiftKey ? 'Shift+' : '') + event.code;
	let retVal; done: { switch (key) {
		case 'Escape': {
			const selected = document.querySelectorAll('media-tile.selected');
			if (selected.length) { selected.forEach(_=>_.classList.remove('selected')); break done; }
			const toBeCut = document.querySelectorAll('media-tile.cut');
			if (toBeCut.length) { toBeCut.forEach(tile => { tile.classList.remove('cut'); delete tile.dataset.cutId; }); }
			return;
		} break; // eslint-disable-line
		case 'Ctrl+KeyF': {
			if (!findElement(event, '#searchbox>input', (box, window) => {
				window.focus(); box.focus(); box.select(); return true;
			})) { return; }
		} break;
		case 'KeyF': {
			for (const { document, window, } of event.views) { if (document.fullscreen) {
				document.exitFullscreen(); break done;
			} else if (document.querySelector('video')) {
				window.focus(); document.querySelector('video').requestFullscreen();  break done;
			} } return;
		} break; // eslint-disable-line
		case 'Ctrl+KeyZ': case 'Ctrl+KeyY': {
			if (locationFor(document.defaultView).name !== 'playlist') { return; }
			const undo = event.code === 'KeyZ', action = undo ? 'undo' : 'redo';
			if (Playlist[action]()) {
				notify.success(undo ? 'Undid' : 'Redid' +' last change', `Press Ctrl + ${ undo ? 'Y' : 'Z' } to revert`);
			} else { notify.info(`Nothing to ${action}`, 'Playlist was not modified'); }
		} break;
		case 'Ctrl+KeyS': {
			retVal = saveAs.call(document.defaultView, new global.Blob(
				[ toHtml(Playlist), ], { type: 'text/html', }
			), `yto-${ (new Date).toISOString().replace(/:(?:\d\d\..*$)?/g, '') }.html`);
		} break;
		case 'Ctrl+KeyO': {
			Object.assign(document.createElement('input'), {
				type: 'file', accept: 'text/html, text/plain, .html, .txt',
				onchange() { if (this.files.length) { replaceVideosWithFiles(this.files); } },
			}).click();
		} break;
		case 'Input+Escape': {
			if (!event.target.matches('#searchbox>input')) { return; }
			event.target.value = ''; event.target.blur();
			document.body.classList.remove('searching');
		} break;
		case 'Input+Enter': {
			if (!event.target.matches('#searchbox>input') || !document.body.classList.contains('searching')) { return; }
			const lTerm = event.target.value.trim().toLowerCase();
			const tiles = Array.from(document.querySelectorAll('#playlist media-tile'));
			highlight(tiles.find(tile => fuzzyIncludes(tile.querySelector('.icon').title.toLowerCase(), lTerm, 3) > 0.6));
		} break;
		case 'Delete': { Player.pause(); Player.seekTo(0); } break;
		case 'Space': { Player.toggle(); } break;
		case 'KeyP': { Player.prev(); } break;
		case 'KeyN': { Player.next(); } break;
		case 'KeyL': { Player.loop(); } break;
		case 'ArrowLeft': { Player.prev(); } break;
		case 'ArrowRight': { Player.next(); } break;
		case 'Ctrl+Shift+KeyR': { Runtime.reload(); } break;
		default: return;
	} }
	event.preventDefault(); event.stopPropagation();
	return retVal; // eslint-disable-line
}

function input({ target, }) {
	const document = target.ownerDocument;
	if (target.matches('#searchbox>input')) {
		const term = target.value.trim();
		const lTerm = term.toLowerCase();
		const tiles = Array.from(document.querySelectorAll('#groups media-tile'));
		tiles.forEach(_=>_.classList.remove('found'));

		if (term.length < 3) { document.body.classList.remove('searching'); return; }
		else { document.body.classList.add('searching'); }

		// looking for trigrams makes it quite unlikely to match just anything, but a typo will have quite an impact
		const found = tiles.filter(tile => fuzzyIncludes(tile.querySelector('.icon').title.toLowerCase(), lTerm, 3) > 0.6);
		term.length === 11 && found.push(...tiles.filter(_=>_.videoId === term));
		found.forEach(_=>_.classList.add('found'));
	} else if (target.matches('#progress>input')) {
		Player.seekTo(target.value);
	}
}

let selectionChanged = false; function selectionchange() { selectionChanged = true; }

function mouseup(event) {
	if (event.button) { return; }
	if (event.ctrlKey) { const tile = event.target.closest('media-tile'); tile && tile.classList.toggle('selected'); }
	if (!selectionChanged) { return; } selectionChanged = false;
	const document = event.target.ownerDocument, selection = document.getSelection();
	!event.ctrlKey && document.querySelectorAll('media-tile.selected').forEach(_=>_.classList.remove('selected'));
	const count = selection.rangeCount; if (count <= 1) { return; }
	const tiles = new Set; for (let i = 0; i < count; ++i) {
		let node = selection.getRangeAt(i).commonAncestorContainer;
		if (!node.closest) { node = node.parentNode; }
		const tile = node.closest('media-tile'); if (tile) { tiles.add(tile); }
		else { node.querySelectorAll('media.tile').forEach(t => tiles.add(t)); }
	} tiles.forEach(_=>_.classList.add('selected'));
	tiles.size && selection.removeAllRanges();
}

function copy(event) {
	forEachElement(event, 'media-tile.cut', tile => { tile.classList.remove('cut'); delete tile.dataset.cutId; });
	if (event.target.matches('TEXTAREA, input:not([type="range"])')) { return null; }
	if (event.target.ownerDocument.getSelection().type === 'Range') { return null; }
	const selected = event.target.ownerDocument.querySelectorAll('media-tile.selected');
	const tile = !selected.length && findElement(event, '[video-id]:hover'); if (tile) {
		const url = 'https://www.youtube.com/watch?v='+ tile.getAttribute('video-id');
		event.clipboardData.setData('text/plain', url);
		event.clipboardData.setData('text/uri-list', url);
		notify.success('Copied video URL', url);
	} else {
		const ids = selected.length ? Array.from(selected, _=>_.getAttribute('video-id')) : Playlist;
		if (!ids.length) { notify.warn('Not copied', 'There is nothing selected, hovered or in the playlist.'); return null; }
		const urls = ids.map(id => 'https://www.youtube.com/watch?v='+ id).join('\n');
		const html = toHtml(ids, 'ytO '+ (selected.length ? 'Selected' : 'Playlist'));
		event.clipboardData.setData('text/plain', html);
		event.clipboardData.setData('text/uri-list', urls);
		event.clipboardData.setData('text/html', html);
		notify.success('Copied playlist', `The IDs of the current ${ids.length} videos were placed in the clipboard`);
	} event.preventDefault();
	return selected.length ? Array.from(selected) : tile ? [ tile, ] : null;
}

function cut(event) {
	const cutIds = (copy(event) || [ ]).filter(_=>_.closest('#playlist')).map(tile => {
		tile.classList.add('cut'); return (tile.dataset.cutId = Math.random().toString(32).slice(2));
	}).reduce((o, k) => ((o[k] = 1), o), { });
	event.clipboardData.setData('<yTO-internal>', JSON.stringify({ cut: cutIds, }));
}

function paste(event) {
	const cutIds = JSON.parse(event.clipboardData.getData('<yTO-internal>') || '{}').cut || { };
	forEachElement(event, 'media-tile.cut', tile => { if (cutIds[tile.dataset.cutId]) {
		Playlist.splice(positionInParent(tile), 1);
	} else {
		tile.classList.remove('cut'); delete tile.dataset.cutId;
	} });
	if (event.target.matches('TEXTAREA, input:not([type="range"])')) { return; }
	addVideosFromText(event.clipboardData);
	event.preventDefault();
}

async function drop(event) {
	event.preventDefault(); // never navigate
	if (!event.dataTransfer) { return; }
	if (event.dataTransfer.getData('<yTO-internal>')) { return; }
	if (event.dataTransfer.files.length) {
		(await replaceVideosWithFiles(event.dataTransfer.files));
	} else {
		addVideosFromText(event.dataTransfer, positionInParent(event.target.closest('#playlist media-tile')));
	}
}

function dragover(event) {
	listeners.dragover.x = event.clientX; listeners.dragover.y = event.clientY;
	event.preventDefault(); // cause drop to fire
}
dragover.capturing = true;


/**
 * module initialization
 */

let lastEvent = null;
Object.entries(listeners).forEach(([ name, listener, ]) => { (listeners[name] = async function(event) { try {
	let views; Object.defineProperty(event, 'views', { get() {
		if (views) { return views; }
		const view = (event.target.ownerDocument || event.target).defaultView;
		const locs = getViews(), { windowId, } = locs.find(_=>_.view === view);
		views = locs.filter(_=>_.windowId === windowId).map(_=>_.view)
		.filter(_ => _ !== view && _.document.hidden === false); views.unshift(view); return views;
	}, enumerable: true, configurable: true, });
	lastEvent = event; try {
		(await listener.apply(this, arguments));
	} finally { lastEvent === event && (lastEvent = null); }
} catch (error) { notify.error(error); } }).capturing = listener.capturing || false; });

return { listeners, register, _helpers, };


/**
 * helpers
 */

function highlight(element) {
	if (!element) { return; }

	scrollToCenter(element);

	element.animate([
		{ transform: 'translateX(-10px)', },
		{ transform: 'translateX( 10px)', },
	], {
		direction: 'alternate',
		easing: 'cubic-bezier(0, 0.3, 1, 0.7)',
		duration: 70,
		iterations: 8,
	});
	element.animate([
		{ filter: 'contrast(0.5)', },
		{ filter: 'contrast(2.0)', },
	], {
		direction: 'alternate',
		easing: 'cubic-bezier(0, 0.3, 1, 0.7)',
		duration: 140,
		iterations: 4,
	});
}

function positionInParent(element) {
	if (!element) { return -1; }
	return Array.prototype.indexOf.call(element.parentNode.children, element);
}

function findElement(event, selector, action) {
	for (const view of event.views || [ event.target.ownerDocument, ]) {
		const element = view.document.querySelector(selector);
		if (element) { return action ? action(element, view) : element; }
	} return null;
}
function forEachElement(event, selector, action) {
	for (const view of event.views || [ event.target.ownerDocument, ]) {
		view.document.querySelectorAll(selector).forEach(element => action(element, view));
	} return null;
}

async function focusTab(videoId) {
	const frame = Player.frameFor(videoId);
	if (!frame) { (await showView('video', 'tab')); return; }
	(await Tabs.update(frame.tabId, { active: true, }));
	const { windowId, } = (await Tabs.get(frame.tabId));
	(await Windows.update(windowId, { focused: true, }));
}

async function openTab(id) {
	const [ tab, ] = (await Tabs.query({ url: [ `https://www.youtube.com/watch?*v=${id}*`, `https://gaming.youtube.com/watch?*v=${id}*`, ], }));
	if (!tab) { return Tabs.create({ url: 'https://www.youtube.com/watch?v='+ id, }); }
	(await Tabs.update(tab.id, { active: true, }));
	(await Windows.update(tab.windowId, { focused: true, }));
	return tab;
}

async function closeUnloadedTab(tile) {
	const id = tile.videoId;
	const tabs = (await Tabs.query({ url: [ `https://www.youtube.com/watch?*v=${id}*`, `https://gaming.youtube.com/watch?*v=${id}*`, ], }));
	const exclude = Player.frameFor(id);
	const tab = tabs.find(tab => tab.id !== (exclude && exclude.tabId));
	if (!tab) { return; } (await Tabs.remove(tab.id)); tile.remove();
}

}); })(this);
