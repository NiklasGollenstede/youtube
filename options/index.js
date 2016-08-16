'use strict';

const { request, } = require('web-ext-utils/chrome').messages;

require.async('common/options').then(options => {
	window.options = options;
	require('web-ext-utils/options/editor')({
		options,
		host: document.querySelector('#options'),
		onCommand({ name, }, button) {
			request('control', name, button);
		},
	});
});

chrome.tabs.getCurrent(tab => window.tabId = tab.id);
