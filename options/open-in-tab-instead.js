'use strict'; // temporary fix because select dropdowns sometimes don't show up in chrome 50 Win64
chrome.runtime.sendMessage({ name: 'openOptionsTab', args: [ '', ], }, () => window.close());
