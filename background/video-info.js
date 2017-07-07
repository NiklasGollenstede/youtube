(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/dom': { createElement, },
	'node_modules/es6lib/string': { secondsToHhMmSs, },
	'node_modules/web-ext-utils/browser/version': { gecko, opera, },
	'common/options': options,
	Downloader,
}) => {

const db = (await (() => {
	const db = global.indexedDB.open('video-info', 4); // throws in firefox if cookies are disabled
	const props = { // 0: save and export, 1: save, 2: cache (immutable), 3: cache (mutable), 4: cache (special), 5: don't save
		title: { type: 'string', level: 2, },
		published: { type: 'number', level: 2, },
		duration: { type: 'number', level: 2, },
		lastPlayed: { type: 'number', level: 0, },
		viewed: { type: 'number', level: 0, },
		views: { type: 'number', level: 3, },
		rating: { type: 'number', level: 3, },
		audioUrl: { type: 'string', level: 4, }, // only refresh if no audioData
		audioData: { type: 'blob', level: 1, },
		thumbUrl: { type: 'string', level: 5, },
		thumbData: { type: 'blob', level: 2, },
		fetched: { type: 'number', level: 1, },
	};
	db.onupgradeneeded = ({ target: { result: db, }, }) => {
		const existing = db.objectStoreNames;
		const includes = existing.includes ? 'includes' : 'contains';
		Object.keys(props).forEach(store => !existing[includes](store) && db.createObjectStore(store, { }));
	};
	return getResult(db).then(db => {
		db.props = props;
		db.keys = Object.keys(props);
		return db;
	}); // throws in firefox if ???
})());

const handlers = new Map/*<id, InfoHandler>*/;

let relativeLifetime; options.content.children.displayRatings.children.relativeLifetime.whenChange(([ value, ]) => (relativeLifetime = value));
let totalLifetime; options.content.children.displayRatings.children.totalLifetime.whenChange(([ value, ]) => (totalLifetime = value));

class InfoHandler {
	constructor(id) { const done = (async () => {
		this.id = id;
		this.listeners = new Map;
		this.data = (await this.loadFromDb());
		if (!this.data.title) {
			this.set((await this.loadFromServer()));
		}
		// global.setInterval(() => this.set({ duration: this.data.duration + 1000, }), 500);
		return this;
	})(); handlers.set(id, done); return done; }

	subscribe(listener, filter) {
		this.listeners.set(listener, filter);
		console.log('subscribe', this.id, this.listeners.size, filter);

		const now = Date.now(), age = now - this.data.fetched;
		if (
			age > 1e4 && (!filter
				|| filter.some(key => db.props[key].level === 3)
			) && (
				age > totalLifetime * 36e5
				|| ('published' in this.data) && age > (now - this.data.published) * (relativeLifetime / 100)
			)
		) { this.loadFromServer().then(data => this.set(data)); }

		filter && filter.includes('thumbUrl') && !this.data.thumbData && this.fetchThumb();

		return this.data;
	}

	unsubscribe(listener) {
		this.listeners.delete(listener);
		console.log('unsubscribe', this.id, this.listeners.size);
		global.setTimeout(() => this.listeners && this.listeners.size === 0 && this.destroy(), 100);
	}

	fire(update) {
		if (!this.listeners.size) { return; }
		update = Object.assign({ }, update);
		/*false &&*/ Object.keys(update).forEach(key => (!db.props[key] || db.props[key].level === 2) && delete update[key]);
		const keys = Object.keys(update);
		this.listeners.forEach((filter, listener) => { try {
			(!filter || filter.some(key => keys.includes(key))) && listener(update);
		} catch (error) { console.log(error); } });
	}

	async set(update) {
		Object.keys(update).forEach(key => update[key] === this.data[key] && delete update[key]);
		Object.assign(this.data, update);
		Promise.resolve().then(() => this.fire(update));
		return this.save(update);
	}

	async refresh() {
		this.set((await this.loadFromServer()));
		return this.data;
	}

	async fetchThumb() {
		const blob = (await global.fetch(this.data.thumbUrl).then(_=>_.blob()));
		this.set({
			thumbData: blob,
			thumbUrl: global.URL.createObjectURL(blob),
		});
	}

	async loadFromServer() {
		const info = (await Downloader.getInfo(this.id));
		console.log('fetched', info);
		console.log('info', info);
		const data = { id: this.id, fetched: Date.now(), };
		('title' in info) && (data.title = info.title);
		('published' in info) && (data.published = info.published);
		('length_seconds' in info) && (!this.data || !this.data.duration) && (data.duration = info.length_seconds * 1000);
		('view_count' in info) && (data.views = +info.view_count);
		('avg_rating' in info) && (data.rating = (info.avg_rating - 1) / 4);
		('formats' in info) && (!this.data || !this.data.audioData)
		&& (data.audioUrl = (info.formats.find(({ bitrate, audioBitrate, }) => !bitrate && audioBitrate) || { }).url);
		console.log('extracted', data);
		return data;
	}

	async loadFromDb() { return new Promise((resolve, reject) => {
		const transaction = db.transaction(db.keys, 'readonly');
		const data = { id: this.id, fetched: 0, }; let missing = db.keys.length;
		db.keys.forEach(key => {
			const get = transaction.objectStore(key).get(this.id);
			get.onerror = error => (missing = Infinity) === error.stopPropagation() === reject(error);
			get.onsuccess = () => (data[key] = get.result) === (--missing <= 0 && resolve(data));
		});
	}).then(data => {
		data.audioUrl = data.audioData ? global.URL.createObjectURL(data.audioData) : '';
		data.thumbUrl = data.thumbData ? global.URL.createObjectURL(data.thumbData) : `https://i.ytimg.com/vi/${ this.id }/default.jpg`;
		return data;
	}); }

	async save(update) { return new Promise((resolve, reject) => {
		update = Object.assign({ }, update); delete update.id;
		const keys = Object.keys(update); let missing = keys.length;
		if (!missing) { return; }
		const transaction = db.transaction(keys, 'readwrite');
		keys.forEach(key => {
			if (key === 'id') { return void --missing; }
			const put = transaction.objectStore(key).put(update[key], this.id);
			put.onerror = error => (missing = Infinity) === error.stopPropagation() === reject(error);
			put.onsuccess = () => (--missing <= 0 && resolve());
		});
	}); }

	destroy() {
		console.log('destroy InfoHanlder', this.id);
		handlers.delete(this.id);
		this.listeners = this.data = null;
	}
}

async function subscribe(id, listener, keys) {
	const handler = (await (handlers.get(id) || new InfoHandler(id)));
	return handler.subscribe(listener, keys);
}

async function unsubscribe(id, listener) {
	const handler = handlers.get(id);
	handler && (await handler).unsubscribe(listener);
}

async function setData(id, data) {
	const handler = (await (handlers.get(id) || new InfoHandler(id)));
	const done = handler.set(data);
	unsubscribe(id, null);
	return done;
}

async function refresh(id) {
	const handler = (await handlers.get(id) || new InfoHandler(id));
	const done = handler.refresh();
	unsubscribe(id, null);
	return done;
}


const tabChildren = [
	createElement('div', { classList: 'icon', }),
	createElement('div', { classList: 'description', }, [
		createElement('div', { classList: 'title', textContent: '...', }),
		createElement('div', { classList: 'duration', textContent: '-:--', }),
		createElement('div', { classList: 'remove', textContent: '⨉', }),
	]),
];

const Self = new WeakMap;

const makeTabTileClass = window => window.document.registerElement('tab-tile', { prototype: {
	__proto__: window.HTMLDivElement.prototype,
	createdCallback() { // constructor in v1
		// super();
		new _TabTile(this);
	},
	set videoId(v) { this.setAttribute('video-id', v); }, get videoId() { return this.getAttribute('video-id'); },
	attachedCallback() { // connectedCallback in v1
		Self.get(this).attach();
	},
	detachedCallback() { // disconnectedCallback in v1
		Self.get(this).detach(true);
	},
	attributeChangedCallback(name, old, now) {
		if (name === 'video-id' && old !== now) {
			old && Self.get(this).detach();
			now && Self.get(this).attach();
		}
	},
}, });

class _TabTile {
	constructor(self) {
		Self.set(self, this);
		this.public = self;
		this.videoId = '';
		this.onChange = this.onChange.bind(this);
		this.rand = Math.random().toString(32).slice(2);
	}
	onChange(data) {
		const self = this.public;
		('title' in data) && (self.querySelector('.title').textContent = data.title);
		('duration' in data) && (self.querySelector('.duration').textContent = data.duration ? secondsToHhMmSs(data.duration / 1000) : '-:--');
		('thumbUrl' in data) && (self.querySelector('.icon').style.backgroundImage = `url("${ data.thumbUrl }")`);
	}
	attach() {
		const self = this.public;
		const videoId = self.videoId;
		if (!videoId || this.videoId === videoId || !self.parentNode) { return; }
		if (this.videoId) { this.detach(); }
		this.videoId = videoId;
		console.log('attach', this.videoId, this.rand);
		!self.children.length && tabChildren.forEach(node => self.appendChild(node.cloneNode(true)));
		subscribe(this.videoId, this.onChange, [ 'title', 'duration', 'thumbUrl', ]).then(this.onChange);
	}
	async detach() {
		if (!this.videoId) { return; }
		console.log('detach', this.videoId, this.rand);
		unsubscribe(this.videoId, this.onChange);
		this.videoId = '';
	}
}

return (global.VideoInfo = {
	setData,
	subscribe,
	unsubscribe,
	refresh,
	makeTabTileClass,
});

function getResult(request) {
	return new Promise((resolve, reject) => {
		request.onsuccess = ({ target: { result, }, }) => resolve(result);
		request.onerror = error => {
			reject(error);
			error.stopPropagation && error.stopPropagation();
			request.abort && request.abort();
		};
	});
}

}); })(this);




//
//	let relativeLifetime; options.content.children.displayRatings.children.relativeLifetime.whenChange(([ value, ]) => (relativeLifetime = value));
//	let totalLifetime; options.content.children.displayRatings.children.totalLifetime.whenChange(([ value, ]) => (totalLifetime = value));
//
//	async function getRating(id) {
//		if (totalLifetime < 0) {
//			return loadRatingFromServer(id);
//		}
//		const stored = (await db.get(id, [ 'meta', 'rating', 'viewed', ]));
//		const now = Date.now(); let age;
//		if (
//			stored.meta && stored.rating
//			&& (age = now - stored.rating.timestamp) < totalLifetime * 36e5
//			&& age < (now - stored.meta.published) * (relativeLifetime / 100)
//		) {
//			return stored;
//		}
//		const loaded = (await loadRatingFromServer(id));
//		!loaded.meta.title && (delete loaded.meta.title); !loaded.meta.published && (delete loaded.meta.published);
//		db.set(id, { rating: loaded.rating, });
//		db.assign(id, 'meta', loaded.meta);
//		return loaded;
//	}
//
