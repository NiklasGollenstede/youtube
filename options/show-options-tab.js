'use strict';
chrome.runtime.sendMessage({ name: 'showOptionsTab', args: [ '', ], }, ({ error, }) => !error && window.close());
