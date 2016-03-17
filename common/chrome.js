'use strict'; define('common/chrome', function() {

const cache = new WeakMap;

return {
	wrapApi: wrap,
	get storage() { return wrap(chrome.storage); },
	get tabs() { return wrap(chrome.tabs); },
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
		desc.value;
		if (typeof desc.value === 'function') {
			const method = desc.value;
			desc.value = function() {
				return new Promise((resolve, reject) => {
					method.call(api, ...arguments, function() {
						const error = chrome.extension.lastError || chrome.runtime.lastError;
						return error ? reject(error) : resolve(...arguments);
					});
				});
			};
		} else if (desc.value && typeof desc.value === 'object') {
			desc.value = wrap(desc.value);
		}
		return Object.defineProperty(clone, key, desc);
	});
	return clone;
}

});
