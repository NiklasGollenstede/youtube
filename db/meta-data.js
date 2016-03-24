'use strict'; define('db/meta-data', [
], function(
) {

const allKeys = [
	'id', // <dummi>
	'meta', // { title: string, published: natural, duration: float, }
	'private', // { ...TBD, }
	'rating', // { views: natural, likes: natural, dislikes: natural, timestamp: natural, }
	'viewCount', // float
];
// e.g.:
// db.set(1, { meta: { title: 'Awesome title', published: Date.now(), duration: 213.4, }, private: { rating: 0.6, }, rating: { views: 301, likes: 5, dislikes: 1, }, viewCount: 1.7, })
// db.modify(1, ({ viewCount, }) => ({ viewCount: viewCount + 1, }), [ 'viewCount', ])


const db = window.indexedDB.open('videoInfo', 3);
db.onupgradeneeded = ({ target: { result: db, }, }) => {
	allKeys.forEach(store => { try {
		db.createObjectStore(store, { });
	} catch (error) {
		console.log('ignoring', error); // TODO: only catch '[...]already exists[...]'
	} });
};

return getResult(db).then(db => ({
	get(id, keys = allKeys) {
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(keys);
			get(transaction, id, keys, resolve, reject);
		});
	},
	set(id, data = id) {
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(Object.keys(data), 'readwrite');
			try {
				(id === data) && (id = data.id);
				set(transaction, id, data, resolve, reject);
			} catch (error) { reject(error); transaction.abort(); }
		});
	},
	modify(id, modifier, keys = allKeys) {
		return new Promise((resolve, reject) => {
			const transaction = db.transaction(keys, 'readwrite');
			get(transaction, id, keys, data => {
				try {
					data = modifier(data);
					set(transaction, id, data, resolve, reject);
				} catch (error) { reject(error); transaction.abort(); }
			}, reject);
		});
	},
	increment(id, key, by = 1) {
		return this.modify(id, data => ({ [key]: data[key] + by, }), [ key, ]);
	},
	assign(id, key, props) {
		return this.modify(id, data => ({ [key]: typeof data[key] !== 'object' ? props : Object.assign(data[key], props), }), [ key, ]);
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
		request.onerror = error => error.stopPropagation() === reject(error);
	});
}

});
