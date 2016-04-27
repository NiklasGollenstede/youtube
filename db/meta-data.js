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


const db = window.indexedDB.open('videoInfo', 5);
db.onupgradeneeded = ({ target: { result: db, }, }) => {
	const existing = db.objectStoreNames;
	const includes = existing.includes ? 'includes' : 'contains';
	allKeys.forEach(store => !existing[includes](store) && db.createObjectStore(store, { }));
};

class Transaction {
	constructor(db, write, keys, tmp) {
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
		return this.modify(id, data => ({ [key]: (data[key] || 0) + by, }), [ key, ]);
	}
	assign(id, key, props) {
		return this.modify(id, data => ({ [key]: typeof data[key] !== 'object' ? props : Object.assign(data[key], props), }), [ key, ]);
	}
}

return getResult(db).then(db => ({
	transaction(write, keys) {
		return new Transaction(db, write, keys);
	},
	ids() {
		return new Transaction(db, false, [ 'meta', ], true).ids();
	},
	clear(keys = this.keys) {
		return new Transaction(db, true, keys, true).clear(keys);
	},
	get(id, keys = allKeys) {
		return new Transaction(db, false, keys, true).get(id, keys);
	},
	set(id, data = id) {
		return new Transaction(db, true, Object.keys(data), true).set(id, data);
	},
	modify(id, modifier, keys = allKeys) {
		return new Transaction(db, true, keys, true).modify(id, modifier, keys);
	},
	increment(id, key, by = 1) {
		return new Transaction(db, true, [ key, ], true).increment(id, key, by);
	},
	assign(id, key, props) {
		return new Transaction(db, true, [ key, ], true).assign(id, key, props);
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
