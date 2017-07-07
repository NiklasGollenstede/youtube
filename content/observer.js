(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/dom': { DOMContentLoaded, },
	'node_modules/es6lib/observer': { InsertObserver, },
}) => { /* global document, location, window, */

(await DOMContentLoaded);
return new InsertObserver(document);

}); })(this);
