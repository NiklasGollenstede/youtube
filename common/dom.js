(function(global) { 'use strict'; define(({ }) => { // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

/**
 * Smoothly scrolls an element to center it within the visible area of its `.offsetParent`.
 * @param  {Element}   element     The element to make visible.
 * @param  {natural?}  .duration   Time in ms over which to ease animate the scrolling. The animation is skipped if the parent document is `.hidden`.
 * @param  {boolean?}  .ifNeeded   If `true`, only scrolls the element if it is not already visible.
 * @param  {number?}   .tolerance  Tolerance around the center of the visible area of the `.offsetParent` when deciding whether scrolling `.isNeeded`.
 * @return {boolean}               Whether, under consideration of `.ifNeeded` and `.tolerance`, the element was scrolled.
 */
async function scrollToCenter(element, { ifNeeded = true, duration = 250, tolerance = 1, } = { }) { return new Promise(scrolled => {
	const scroller = element.offsetParent; tolerance = (scroller.clientHeight || scroller.offsetHeight) * (1 - tolerance) || 0;
	if (ifNeeded
		&& element.offsetTop >= scroller.scrollTop + tolerance
		&& element.offsetTop + element.offsetHeight <= scroller.scrollTop + scroller.offsetHeight - tolerance
	) { scrolled(false); return; }
	const to = Math.min(Math.max(0, element.offsetTop + element.offsetHeight / 2 - scroller.offsetHeight / 2), scroller.scrollHeight);
	if (!(duration > 0) || element.closest('.no-transitions') || element.ownerDocument.hidden) { scroller.scrollTop = to; scrolled(true); return; }
	const from = scroller.scrollTop, diff = to - from;

	const { requestAnimationFrame, performance, } = element.ownerDocument.defaultView;
	const start = performance.now(), end = start- -duration;
	/// time in [start; end], coefficients from https://github.com/mietek/ease-tween/blob/master/src/index.js (MIT)
	const pos = time => from + diff * 1.0042954579734844 * Math.exp(-6.4041738958415664 * Math.exp(-7.2908241330981340 * (time - start) / duration));
	requestAnimationFrame(function step(now) {
		if (now >= end) { scroller.scrollTop = to; scrolled(true); }
		else { scroller.scrollTop = pos(now); requestAnimationFrame(step); }
	});
}); }

return { scrollToCenter, };

}); })(this);
