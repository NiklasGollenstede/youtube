'use strict'; define('common/options', [
	'web-ext-utils/chrome'
], function(
	{ storage: Storage, }
) {

return require('web-ext-utils/options')({
	defaults: require('common/defaults'),
	prefix: 'options',
	storage: Storage.sync || Storage.local,
	addChangeListener: listener => Storage.onChanged
	.addListener(changes => Object.keys(changes).forEach(key => key.startsWith('options') && listener(key, changes[key].newValue))),
});

});
