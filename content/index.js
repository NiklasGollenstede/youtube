(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/messages': messages,
	dom,
	require,
}) => {

dom.on(global, 'unload', () => 'disable BF-cache');

Promise.all(Object.keys(require.cache).filter(_=>_.startsWith('content/')).map(id => require.cache[id].ready))
.then(() => console.log('all modules loaded'))
.catch(error => messages.post('notify.error', 'Content failed to load', error));

}); })(this);
