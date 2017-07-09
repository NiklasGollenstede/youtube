(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/dom': { DOMContentLoaded, },
	'node_modules/es6lib/observer': { InsertObserver, },
	'node_modules/web-ext-utils/loader/content': { onUnload, },
}) => { /* global document, */

(await DOMContentLoaded);
const observer = new InsertObserver(document);
onUnload.addListener(() => observer.removeAll());
return observer;

}); })(this);
