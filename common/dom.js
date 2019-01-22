(function(global) { 'use strict'; define(({ }) => { // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

// TODO: should check if window is visible (skip animation if not) and abort after some time (duration? duration*2?)
function scrollToCenter(element, { ifNeeded = true, duration = 250, } = { }) { return new Promise((resolve) => {
	const scroller = element.offsetParent;
	// const scroller = element.closest('.scroll-inner'); // firefox bug: .offsetParent is the closest element with a CSS filter.
	if (ifNeeded && element.offsetTop >= scroller.scrollTop && element.offsetTop + element.offsetHeight <= scroller.scrollTop + scroller.offsetHeight) { resolve(); return; }
	const to = Math.min(Math.max(0, element.offsetTop + element.offsetHeight / 2 - scroller.offsetHeight / 2), scroller.scrollHeight);
	if (!duration || element.closest('.no-transitions')) { scroller.scrollTop = to; resolve(); return; }
	const from = scroller.scrollTop, diff = to - from;

	const { requestAnimationFrame, performance, } = element.ownerDocument.defaultView;
	const start = performance.now(), end = start + duration;
	/// time in [start; end], coefficients from https://github.com/mietek/ease-tween/blob/master/src/index.js (MIT)
	const pos = time => from + diff * 1.0042954579734844 * Math.exp(-6.4041738958415664 * Math.exp(-7.2908241330981340 * (time - start) / duration));
	requestAnimationFrame(function step(now) {
		if (now >= end) { scroller.scrollTop = to; resolve(); }
		else { scroller.scrollTop = pos(now); requestAnimationFrame(step); }
	});
}); }

return { scrollToCenter, };

}); })(this);
