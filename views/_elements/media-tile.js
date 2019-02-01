(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/dom': { createElement, },
	'node_modules/es6lib/string': { secondsToHhMmSs, },
	'background/video-info': { subscribe, unsubscribe, },
}) => {

/**
 * Exports a single function that defined the custom element `<media-tile>` for a given `window`
 * and returns the corresponding `MediaTile` class.
 * The class/element instances have a single custom property/attribute `videoId`/`video-id`.
 * While the elements are in the DOM ...
 */

function MediaTileClass(window) { return class MediaTile extends window.HTMLElement {
	constructor() { super(); new _MediaTile(this); }
	set videoId(v) { this.setAttribute('video-id', v); }
	get videoId() { return this.getAttribute('video-id'); }
	connectedCallback() { Self.get(this).attach(); }
	disconnectedCallback() { Self.get(this).detach(); }
	// no need to handle adoptedCallback
	attributeChangedCallback(name, old, now) { if (name === 'video-id') { Self.get(this).changeId(old, now); } }
	static get observedAttributes() { return [ 'video-id', ]; }
}; }

const children = [
	createElement('div', { className: 'icon', }),
	createElement('div', { className: 'description', }, [
		createElement('div', { className: 'title', textContent: '...', }),
		createElement('div', { className: 'duration', textContent: '-:--', }),
		createElement('div', { className: 'remove', textContent: '⨉', }),
	]),
];

const Self = new WeakMap;

class _MediaTile {
	constructor(self) {
		Self.set(self, this);
		this.public = self;
		this.videoId = '';
		this.onChange = this.onChange.bind(this);
		this.view = null;
		this.textContent = ''; // cloned elements already contain clones of the children. A better solution would be to use a shadow DOM, but styling that won't work until firefox implements the `:host-context()` CSS pseudo class function
		children.forEach(node => self.appendChild(node.cloneNode(true)));
	}
	onChange(data) {
		const self = this.public;
		('title' in data) && (self.querySelector('.title').textContent = self.querySelector('.icon').title = data.title);
		('duration' in data) && (self.querySelector('.duration').textContent = data.duration ? secondsToHhMmSs(data.duration / 1000) : '-:--');
		('thumbUrl' in data) && (self.querySelector('.icon').style.backgroundImage = `url("${ data.thumbUrl }")`);
		if ('error' in data) { if (data.error) {
			let error = self.querySelector('.error');
			!error && (error = self.querySelector('.description').insertBefore(createElement('span', { classList: 'error', }, [ '⚠', ]), self.querySelector('.description').firstChild));
			error.title = data.error;
		} else {
			const error = self.querySelector('.error'); error && error.remove();
		} }
	}
	changeId(oldId, videoId) {
		this.videoId = videoId; if (oldId === videoId || !this.view) { return; }
		oldId && this.unsubscribe();
		videoId && this.subscribe();
	}
	subscribe() { subscribe(this.videoId, this.onChange, [ 'title', 'duration', 'thumbUrl', 'error', ]).then(this.onChange); }
	unsubscribe() { unsubscribe(this.videoId, this.onChange); }
	attach() {
		if (this.view) { this.detach(); }
		this.view = this.public.ownerDocument.defaultView;
		this.view.addEventListener('unload', this);
		this.videoId && this.subscribe();
	}
	detach() {
		if (!this.view) { return; }
		this.videoId && this.unsubscribe();
		this.view.removeEventListener('unload', this);
		this.view = null;
	}
	handleEvent() { // unload
		this.detach();
	}
}

return MediaTileClass;

}); })(this);
