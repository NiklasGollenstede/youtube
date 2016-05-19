'use strict'; define('db/meta-data', [
], function(
) {

const allKeys = [
	'id', // <dummi>
	'meta', // { title: string, published: natural, duration: float, }
	'private', // { ...TBD, }
	'rating', // { views: natural, likes: natural, dislikes: natural, timestamp: natural, }
	'viewed', // float (seconds)
];
// e.g.:
// db.set(1, { meta: { title: 'Awesome title', published: Date.now(), duration: 213.4, }, private: { rating: 0.6, }, rating: { views: 301, likes: 5, dislikes: 1, }, viewCount: 1.7, })
// db.modify(1, ({ viewCount, }) => ({ viewCount: viewCount + 1, }), [ 'viewCount', ])

const promise = (() => { try {

const db = window.indexedDB.open('videoInfo', 5);
db.onupgradeneeded = ({ target: { result: db, }, }) => {
	const existing = db.objectStoreNames;
	const includes = existing.includes ? 'includes' : 'contains';
	allKeys.forEach(store => !existing[includes](store) && db.createObjectStore(store, { }));
};

return getResult(db).then(db => class Transaction {
	constructor(write, keys, tmp) {
		this.keys = keys || allKeys;
		this._ = db.transaction(this.keys, write ? 'readwrite' : 'readonly');
		this.done = !tmp && getResult(this);
	}
	ids() {
		return getResult(this._.objectStore('meta').getAllKeys());
	}
	clear(keys = this.keys) {
		return Promise.all(keys.map(key => getResult(this._.objectStore(key).clear())));
	}
	get(id, keys = this.keys) {
		return new Promise((resolve, reject) => {
			get(this._, id, keys, resolve, reject);
		}).catch(this._.onerror);
	}
	set(id, data = id) {
		return new Promise((resolve, reject) => {
			(id === data) && (id = data.id);
			set(this._, id, data, resolve, reject);
		}).catch(this._.onerror);
	}
	modify(id, modifier, keys = this.keys) {
		return new Promise((resolve, reject) => {
			get(this._, id, keys, data => {
				try {
					data = modifier(data);
					set(this._, id, data, resolve, reject);
				} catch (error) { reject(error); this._.onerror(error); }
			}, reject);
		}).catch(this._.onerror);
	}
	increment(id, key, by = 1) {
		return this.modify(id, data => ({ [key]: (data[key] || 0) + (by || 0), }), [ key, ]);
	}
	assign(id, key, props) {
		return this.modify(id, data => ({ [key]: typeof data[key] !== 'object' ? props : Object.assign(data[key], props), }), [ key, ]);
	}
});

} catch(error) {
	if (!(error && error instanceof DOMException && error.name === 'SecurityError')) { throw error; }
	console.log('indexedDB is unavailable, fall back to chrome.storage.local');

	const storage = require('web-ext-utils/chrome').storage.local;
	return Promise.resolve(class Storage {
		constructor(write, keys, tmp) {
			this.keys = keys || allKeys;
			this.write = write;
			this.done = !tmp && Promise.resolve();
		}
		ids() {
			return storage.get().then(data => {
				const ids = new Set;
				Object.keys(data).forEach(key => {
					const match = (/^([A-z0-9_-]{11})\$\w+$/).exec(key);
					match && ids.add(match[1]);
				});
				return Array.from(ids);
			});
		}
		clear(keys = this.keys) {
			if (!this.write) { return Promise.reject('Transaction is readonly'); }
			return storage.get().then(_data => {
				const entries = [ ];
				Object.keys(_data).forEach(key => {
					const match = (/^[A-z0-9_-]{11}\$(\w+)$/).exec(key);
					match && keys.includes(match[1]) && entries.push(key);
				});
				return storage.remove(entries);
			});
		}
		get(id, keys = this.keys) {
			keys = keys.map(key => id +'$'+ key);
			return storage.get(keys).then(_data => {
				const data = { id, };
				Object.keys(_data).forEach(key => data[key.replace(/^.*?\$/, '')] = _data[key]);
				return data;
			});
		}
		set(id, data = id) {
			if (!this.write) { return Promise.reject('Transaction is readonly'); }
			(id === data) && (id = data.id);
			const _data = { };
			Object.keys(data).forEach(key => key !== 'id' && (_data[id +'$'+ key] = data[key]));
			return storage.set(_data);
		}
		modify(id, modifier, keys = this.keys) {
			return this.get(id, keys).then(modifier).then(this.set.bind(this, id));
		}
		increment(id, key, by = 1) {
			return this.modify(id, data => ({ [key]: (data[key] || 0) + (by || 0), }), [ key, ]);
		}
		assign(id, key, props) {
			return this.modify(id, data => ({ [key]: typeof data[key] !== 'object' ? props : Object.assign(data[key], props), }), [ key, ]);
		}
	});
} })();

return promise.then(Transaction => ({
	transaction(write, keys) {
		return new Transaction(write, keys);
	},
	ids() {
		return new Transaction(false, [ 'meta', ], true).ids();
	},
	clear(keys = this.keys) {
		return new Transaction(true, keys, true).clear(keys);
	},
	get(id, keys = allKeys) {
		return new Transaction(false, keys, true).get(id, keys);
	},
	set(id, data = id) {
		return new Transaction(true, Object.keys(data), true).set(id, data);
	},
	modify(id, modifier, keys = allKeys) {
		return new Transaction(true, keys, true).modify(id, modifier, keys);
	},
	increment(id, key, by = 1) {
		return new Transaction(true, [ key, ], true).increment(id, key, by);
	},
	assign(id, key, props) {
		return new Transaction(true, [ key, ], true).assign(id, key, props);
	},
}));

function get(transaction, id, keys, resolve, reject) {
	const data = { id, }; let missing = keys.length;
	keys.forEach(key => {
		if (key === 'id') { return --missing; }
		const get = transaction.objectStore(key).get(id);
		get.onerror = error => (missing = Infinity) === error.stopPropagation() === reject(error);
		get.onsuccess = () => (data[key] = get.result) === (--missing <= 0 && resolve(data));
	});
}

function set(transaction, id, data, resolve, reject) {
	const keys = Object.keys(data); let missing = keys.length;
	keys.forEach(key => {
		if (key === 'id') { return --missing; }
		const put = transaction.objectStore(key).put(data[key], id);
		put.onerror = error => (missing = Infinity) === error.stopPropagation() === reject(error);
		put.onsuccess = () => (--missing <= 0 && resolve(data));
	});
}

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

});
