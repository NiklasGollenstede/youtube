(function() { 'use strict'; define(function*({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	exports,
}) {

const types = {
	id: 'string',
	meta: { title: 'string', published: 'number', duration: 'number', },
	private: { lastPlayed: 'number', /*...TBD,*/ },
	rating: { views: 'number', likes: 'number', dislikes: 'number', timestamp: 'number', },
	viewed: 'number', // seconds
};

const defaultKeys = Object.keys(types);
const allKeys = defaultKeys.concat([
	'thumb', // Blob
]);

class TransactionBase {
	constructor(write, keys, tmp) {
		this.keys = keys || allKeys;
		this.write = !!write;
		this.done = !tmp && Promise.resolve();
	}
	get isIDB() { return false; }
	modify(id, modifier, keys = this.keys) {
		return this.get(id, keys).then(modifier).then(this.set.bind(this, id));
	}
	increment(id, key, by = 1) {
		return this.modify(id, data => ({ [key]: (data[key] || 0) + (by || 0), }), [ key, ]);
	}
	assign(id, key, props) {
		return this.modify(id, data => ({ [key]: typeof data[key] !== 'object' ? props : Object.assign(data[key], props), }), [ key, ]);
	}
}

let Transaction;
try {
	let db = window.indexedDB.open('videoInfo', 6); // throws in firefox if cookies are disabled
	db.onupgradeneeded = ({ target: { result: db, }, }) => {
		const existing = db.objectStoreNames;
		const includes = existing.includes ? 'includes' : 'contains';
		allKeys.forEach(store => !existing[includes](store) && db.createObjectStore(store, { }));
	};
	db = (yield getResult(db)); // throws in firefox if ???

	Transaction = class Transaction extends TransactionBase {
		constructor(write, keys, tmp) {
			super(write, keys, true);
			this._ = db.transaction(this.keys, write ? 'readwrite' : 'readonly');
			this.done = !tmp && getResult(this);
		}
		get isIDB() { return true; }
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
	};

} catch(error) {
	console.warn('indexedDB is unavailable, fall back to chrome.storage.local:', error);

	const Storage = (yield require.async('node_modules/web-ext-utils/chrome/')).Storage.local;

	Transaction = class Fallback extends TransactionBase {
		ids() {
			return Storage.get().then(data => {
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
			return Storage.get().then(_data => {
				const entries = [ ];
				Object.keys(_data).forEach(key => {
					const match = (/^[A-z0-9_-]{11}\$(\w+)$/).exec(key);
					match && keys.includes(match[1]) && entries.push(key);
				});
				return Storage.remove(entries);
			});
		}
		get(id, keys = this.keys) {
			keys = keys.map(key => id +'$'+ key);
			return Storage.get(keys).then(_data => {
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
			return Storage.set(_data);
		}
	};
}

const memStore = { }; allKeys.forEach(key => memStore[key] = { });
class InMemory extends TransactionBase {
	ids() {
		return new Promise(_=>_(Object.keys[memStore.meta]));
	}
	clear(keys = this.keys) {
		allKeys.forEach(key => memStore[key] = { });
		return Promise.resolve();
	}
	get(id, keys = this.keys) {
		const data = { id, };
		keys.forEach(key => id in memStore[key] && (data[key] = memStore[key][id]));
		return Promise.resolve(data);
	}
	set(id, data = id) {
		if (!this.write) { return Promise.reject('Transaction is readonly'); }
		(id === data) && (id = data.id);
		Object.keys(data).forEach(key => key !== 'id' && (memStore[key][id] = data[key]));
		return Promise.resolve();
	}
}

const makeDb = Transaction => ({
	transaction(write, keys) {
		return new Transaction(write, keys);
	},
	get isIDB() {
		return Transaction.name === 'Transaction';
	},
	ids() {
		return new Transaction(false, [ 'meta', ], true).ids();
	},
	clear(keys = allKeys) {
		return new Transaction(true, keys, true).clear(keys);
	},
	get(id, keys = defaultKeys) {
		return new Transaction(false, keys, true).get(id, keys);
	},
	set(id, data = id) {
		return new Transaction(true, Object.keys(data), true).set(id, data);
	},
	modify(id, modifier, keys = defaultKeys) {
		return new Transaction(true, keys, true).modify(id, modifier, keys);
	},
	increment(id, key, by = 1) {
		return new Transaction(true, [ key, ], true).increment(id, key, by);
	},
	assign(id, key, props) {
		return new Transaction(true, [ key, ], true).assign(id, key, props);
	},
	import(datas) {
		const action = this.transaction(true);
		return Promise.all(datas.map(data => action.modify(data.id, current => {
			Object.keys(data).forEach(key => {
				if (key === 'id') { return; }
				const value = data[key], old = current[key];
				current[key] = value == null ? null : typeof types[key] === 'object' ? Object.assign(old || { }, value) : value;
			});
			return current;
		}, Object.keys(data))));
	},
	validate(data) {
		if (data === null || typeof data !== 'object') { return { message: `Must be a non-null object`, }; }
		if (typeof data.id !== 'string' || !(/^[A-z0-9_-]{11}$/).test(data.id)) {
			return { key: 'id', message: `The 'id' must be a YouTube video id (string)`, };
		}

		for (let key of Object.keys(data)) {
			const should = types[key], value = data[key];
			if (!should) { return { message: `Should not have a property '${ key }'`, }; }
			if (typeof should === 'string') {
				if (typeof value !== should) { return { key, message: `The type of '${ key }' should be '${ should }' but is '${ typeof value }'`, }; }
				continue;
			}
			if (typeof value !== 'object') { return { key, message: `'${ key }' should be an object but is a ${ typeof value }`, }; }
			for (let sub of Object.keys(value)) {
				if (typeof value[sub] !== should[sub]) { return { key, sub, message: `The type of '${ key }.${ sub}' should be '${ should[sub] }' but is '${ typeof value[sub] }'`, }; }
			}
		}
		return null;
	},
});

const db = makeDb(Transaction);
db.inMemory = makeDb(InMemory);
return db;

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

}); })();
