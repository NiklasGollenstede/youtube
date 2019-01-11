(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/concurrent': { sleep, },
	'common/options': options,
	Downloader,
}) => {

const db = (await (() => {
	const db = global.indexedDB.open('video-info', 8); // throws in firefox if cookies are disabled
	const props = { // 0: save and export, 1: save, 2: cache (immutable), 3: cache (mutable), 4: cache (special), 5: don't save
		title: { type: 'string', level: 2, },
		published: { type: 'number', level: 2, },
		duration: { type: 'number', level: 2, },
		lastPlayed: { type: 'number', level: 0, },
		viewed: { type: 'number', level: 0, },
		views: { type: 'number', level: 3, },
		// viewed: { type: 'number', level: 0, },
		rating: { type: 'number', level: 3, },
		related: { type: 'array', level: 3, },
		audioUrl: { type: 'string', level: 5, },
		// audioData: { type: 'blob', level: 1, },
		loudness: { type: 'number', level: 2, },
		thumbUrl: { type: 'string', level: 5, },
		thumbData: { type: 'blob', level: 2, },
		fetched: { type: 'number', level: 1, },
		error: { type: 'string', level: 5, },
	};
	db.onupgradeneeded = ({ target: { result: db, }, }) => {
		const has = Array.from(db.objectStoreNames);
		const should = Object.keys(props).filter(key => props[key].level !== 5);
		should.forEach(store => !has.includes(store) && db.createObjectStore(store, { }));
		has.forEach(store => !should.includes(store) && db.deleteObjectStore(store));
	};
	return getResult(db).then(db => {
		db.props = props;
		const keys = Object.keys(props).filter(key => props[key].level !== 5);
		db.keys = new Set(keys);
		db.keys.array = keys;
		return db;
	});
})());

const handlers = new Map/*<id, InfoHandler>*/;

let relativeLifetime; options.content.children.displayRatings.children.relativeLifetime.whenChange(([ value, ]) => (relativeLifetime = value / 100));
let totalLifetime; options.content.children.displayRatings.children.totalLifetime.whenChange(([ value, ]) => (totalLifetime = value * 36e5));

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
		// console.log('subscribe', this.id, this.listeners.size, filter);

		const now = Date.now(), age = now - this.data.fetched;
		if (
			age > 1e4 && (!filter
				|| filter.some(key => db.props[key].level === 3)
			) && (
				age > totalLifetime || ('published' in this.data) && age > (now - this.data.published) * relativeLifetime
			)
		) { this.loadFromServer().then(data => this.set(data)); }

		filter && filter.includes('thumbUrl') && !this.data.thumbData && this.fetchThumb();

		return this.data;
	}

	unsubscribe(listener) {
		this.listeners.delete(listener);
		// console.log('unsubscribe', this.id, this.listeners.size);
		global.setTimeout(() => this.listeners && this.listeners.size === 0 && this.destroy(), 5000);
	}

	fire(update) {
		if (!this.listeners.size) { return; }
		update = Object.assign({ }, update);
		/*false &&*/ Object.keys(update).forEach(key => (!db.props[key] || db.props[key].level === 2) && delete update[key]);
		const keys = Object.keys(update);
		this.listeners.forEach((filter, listener) => { try {
			(!filter || filter.some(key => keys.includes(key))) && listener(update);
		} catch (error) { console.error(error); } });
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
		let info; while (true) { try {
			info = (await Downloader.getInfo(this.id)); break;
		} catch (error) { if (
			error && (/^Failed to fetch$/).test(error.message)
		) {
			(await sleep(2000));
		} else {
			return { error: error.message, };
		} } }
		// console.log('fetched', info);
		const data = { id: this.id, fetched: Date.now(), };
		('title' in info) && (data.title = info.title);
		('published' in info) && (data.published = info.published);
		('length_seconds' in info) && (!this.data || !this.data.duration) && (data.duration = info.length_seconds * 1000);
		('view_count' in info) && (data.views = +info.view_count);
		('avg_rating' in info) && (data.rating = (info.avg_rating - 1) / 4);
		('formats' in info) && (!this.data || !this.data.audioData) && (data.audioUrl = getPreferredAudio(info.formats));
		('formats' in info) && (data.video = getPreferredVideo(info.formats));
		('relative_loudness' in info) && (data.loudness = +info.relative_loudness);
		(data.related = (info.related_videos || [ ]).map(_=>_.id).filter(_=>_));
		(this.data && this.data.error) && (data.error = null);
		// console.log('extracted', data);
		return data;
	}

	async loadFromDb() { return new Promise((resolve, reject) => {
		const transaction = db.transaction(db.keys.array, 'readonly');
		const data = { id: this.id, fetched: 0, }; let missing = db.keys.size;
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
		const keys = Object.keys(update).filter(key => db.keys.has(key)); let missing = keys.length;
		if (!missing) { return; }
		const transaction = db.transaction(keys, 'readwrite');
		keys.forEach(key => {
			const put = transaction.objectStore(key).put(update[key], this.id);
			put.onerror = error => (missing = Infinity) === error.stopPropagation() === reject(error);
			put.onsuccess = () => (--missing <= 0 && resolve());
		});
	}); }

	destroy() {
		// console.log('destroy InfoHanlder', this.id);
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

const getData = withHandler(_=>_.data);
const setData = withHandler((handler, data) => handler.set(Object.assign({ }, data)));
const refresh = withHandler(_=>_.refresh());

function withHandler(run) { return async function(id, ...args) {
	const handler = (await (handlers.get(id) || new InfoHandler(id)));
	function dummy() { }
	handler.listeners.set(dummy, null);
	const done = run(handler, ...args);
	unsubscribe(id, dummy);
	return done;
}; }

function getPreferredAudio(formats) {
	const itags = [
		251, // webm/opus 160
		140, // m4a/aac 128
		171, // webm/vorbis 128
		250, // webm/opus 64
		239, // webm/opus 48
		139, // m4a/aac 48
		// 18,  // mp4/aac+H.264 96
		// 43,  // webm/vorbis+VP8 128
	];
	for (const itag of itags) {
		const format = formats.find(_=>+_.itag === itag);
		if (format) { return format.url; }
	}
	return null;
}

function getPreferredVideo(formats) {
	let score = 0, ret = null; formats.forEach(({
		url, type, size, fps, resolution, container, encoding, bitrate,
	}) => {
		if (!(true
			// there are some (old?) formats (with itag < 100 || itag > 390 ?) that are missing some of these:
			&& size // e.g. `2560x1440` which is the exact resolution (which can sometimes have rather odd dimensions)
			&& fps // natural number (as string)
			&& resolution // e.g. `1440p HDR, HFR` where [144p,240p,360p,480p,720p,1080p,1440p,2160p] is the smallest upper limit for the vertical resolution (another possible token is `15fps`, but the fps for that is not 15)
			&& (container === 'mp4' /*|| container === 'webm'*/) // firefox tends to get stuck stuttering around with webm
			&& encoding // (video), e.g. `H.264` or `VP9`
			&& bitrate // <fload>(-<float>)? bitrate (range) in (MB/minute?)
		)) { return; }
		const { 0:x, 1:y, } = size.split('x');
		const s = x * y * (fps**.5|0) * (resolution.includes('HRD') ? 1.5 : 1);
		if (s > score) { ret = { type, x: +x, y: +y, fps: +fps, resolution, bitrate, url, }; score = s; }
	}); return ret;
}


return (global.VideoInfo = {
	getData,
	setData,
	subscribe,
	unsubscribe,
	refresh,
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
