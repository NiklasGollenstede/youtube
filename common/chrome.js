'use strict'; define('common/chrome', function() {

const cache = new WeakMap;

return {
	wrapApi: wrap,
	get runtime() { return wrap(chrome.runtime); },
	get storage() { return wrap(chrome.storage); },
	get tabs() { return wrap(chrome.tabs); },
	get windows() { return wrap(chrome.windows); },
};

function wrap(api) {
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

});
