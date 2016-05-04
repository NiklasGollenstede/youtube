'use strict'; define('common/chrome', function() {

const cache = new WeakMap;
let storageShim;

const urlPrefix = chrome.extension.getURL('.').slice(0, -1);

return {
	wrapApi: wrap,
	applications: {
		gecko: urlPrefix.startsWith('moz'),
		chromium: urlPrefix.startsWith('chrome'),
	},
	extension: chrome.extension,
	get runtime() { return wrap(chrome.runtime); },
	get storage() { return chrome.storage ? wrap(chrome.storage) : (storageShim || (storageShim = new StorageShim)); },
	get tabs() { return wrap(chrome.tabs); },
	get windows() { return wrap(chrome.windows); },
};

function wrap(api) {
	if (!api || (typeof api.addListener === 'function' && typeof api.removeListener === 'function')) { return api; }
	let clone = cache.get(api);
	if (clone) { return clone; }
	clone = promisifyAll(api);
	cache.set(api, clone);
	return clone;
}
function promisifyAll(api) {
	const clone = { };
	Object.keys(api).forEach(key => {
		const desc = Object.getOwnPropertyDescriptor(api, key);
		if (typeof desc.value === 'function') {
			desc.value = promisify(desc.value, api);
		} else if (desc.value && typeof desc.value === 'object') {
			desc.value = wrap(desc.value);
		}
		return Object.defineProperty(clone, key, desc);
	});
	return clone;
}

function promisify(method, thisArg) {
	return function() {
		return new Promise((resolve, reject) => {
			method.call(thisArg, ...arguments, function() {
				const error = chrome.extension.lastError || chrome.runtime.lastError;
				return error ? reject(error) : resolve(...arguments);
			});
		});
	};
}

function StorageShim() {
	console.log('chrome.storage is unavailable (in this context), fall back to sending messages to the background script');
	const sendMessage = promisify(chrome.runtime.sendMessage, chrome.runtime);
	const proxy = (area, method) => (query) => sendMessage({ name: 'storage', args: [ area, method, query, ], })
	.then(({ error, value, }) => { console.log('storageShim', error, value); if (error) { throw error; } return value; });
	const listeners = new Set;
	chrome.runtime.onMessage.addListener(message => message && message.name === 'storage.onChanged' && listeners.forEach(listener => {
		// console.log('got change', listener, message);
		try { listener(message.change, message.area); } catch (error) { console.error('error in chrome.storage.onChanged', error); }
	}));
	return {
		local: {
			get: proxy('local', 'get'),
			set: proxy('local', 'set'),
			remove: proxy('local', 'remove'),
			getBytesInUse: proxy('local', 'getBytesInUse'),
			clear: proxy('local', 'clear'),
		},
		sync: {
			get: proxy('sync', 'get'),
			set: proxy('sync', 'set'),
			remove: proxy('sync', 'remove'),
			getBytesInUse: proxy('sync', 'getBytesInUse'),
			clear: proxy('sync', 'clear'),
		},
		onChanged: {
			addListener: listeners.add.bind(listeners),
			removeListener: listeners.delete.bind(listeners),
			hasListener: listeners.has.bind(listeners),
			hasListeners: () => !! listeners.size
		},
	};
}

});
