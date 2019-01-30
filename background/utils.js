(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Windows, },
	'node_modules/web-ext-utils/browser/version': { fennec, gecko, },
	'node_modules/web-ext-utils/loader/views': { getViews, },
}) => {


/// returns `true`, if a tab in the window can be activated without interrupting the user because the window is actively used
async function windowIsIdle(windowId) {
	if (fennec) { return false; } // only one "window"
	if (hasFocusedSidebar()) { return true; }
	if (gecko) { return hasPanel() || hasFocusedSidebar() || !(await hasFocus()); }
	return !(await hasFocus()) && !hasPanel();

	function hasFocus() { return Windows.get(windowId).then(_=>_.focused); }
	function hasPanel() { return getViews().some(_=>_.type === 'panel'); }
	function hasFocusedSidebar() { return getViews().some(_=>_.type === 'sidebar' && _.view.document.hasFocus()); }
}

return { windowIsIdle, };

}); })(this);
