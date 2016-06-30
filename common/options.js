'use strict'; define('common/options', [
	'web-ext-utils/chrome',
	'web-ext-utils/options',
	'common/defaults',
], function(
	{ storage: Storage, },
	Options,
	defaults
) {

const listerners = new WeakMap;

return new Options({
	defaults,
	prefix: 'options',
	storage: Storage.sync || Storage.local,
	addChangeListener(listener) {
		const onChanged = changes => Object.keys(changes).forEach(key => key.startsWith('options') && listener(key, changes[key].newValue));
		listerners.set(listener, onChanged);
		Storage.onChanged.addListener(onChanged);
	},
	removeChangeListener(listener) {
		const onChanged = listerners.get(listener);
		listerners.delete(listener);
		Storage.onChanged.removeListener(onChanged);
	},
});

});
