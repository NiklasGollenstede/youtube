(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Windows, },
	'node_modules/web-ext-utils/browser/version': { fennec, gecko, },
	'node_modules/web-ext-utils/loader/views': { getViews, },
	'node_modules/web-ext-utils/utils/event': { setEvent, },
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

function Mutex(cs) {
	let lastCall = null;
	return async function Lock() {
		const wait = lastCall; let ret; lastCall = (async () => {
			try { (await wait); } catch (_) { } // wait for previous lastCall to finish
			ret = (await cs ? cs.apply(this, arguments) : arguments[0]()); // add own call to lastCall
		})(); return ret;
	};
}

const Self = new WeakMap;

/**
 * Counts references to a set of keys and notifies when keys were added or removed.
 */
class RefCounter {
	constructor({ delay = 0, accumulate = false, suspended = false, }) {
		const self = { counts: new Map, fire: null, suspend: null, resume: null, };
		if (accumulate) {
			const fireChange = setEvent(this, 'onChanged');
			let added = new Set, removed = new Set, timer = 0;
			self.fire = (key, count) => { queue(); {
				if (count) { removed.has(key) ? removed.delete(key) : added.add(key); }
				else { added.has(key) ? added.delete(key) : removed.add(key); }
			} };
			function queue() { timer && clearTimeout(timer); timer = setTimeout(emit, delay); }
			function emit() {
				timer = 0; if (suspended || !added.size && !removed.size) { return; }
				fireChange([ added, removed, ]); added = new Set; removed = new Set;
			}
			self.suspend = () => { suspended = true; };
			self.resume = ()  => { if (suspended) { suspended = false; queue(); } };
		} else {
			const fireAdd = setEvent(this, 'onAdded');
			const fireDrop = setEvent(this, 'onDropped');
			const ctxs = new Map;
			self.fire = (key, count) => {
				const ctx = ctxs.get(key); if (ctx) {
					ctxs.delete(key); ctx.timer && clearTimeout(ctx.timer);
				} else {
					ctxs.set(key, { count, timer: suspended ? null : queue(key, count), });
				}
			};
			function queue(key, count) { return setTimeout(() => {
				ctxs.delete(key); (count ? fireAdd : fireDrop)([ key, ]);
			}, delay); }
			self.suspend = () => { if (!suspended) { suspended = true; ctxs.forEach(ctx => {
				ctx.timer && clearTimeout(ctx.timer); ctx.timer = null;
			}); } };
			self.resume = ()  => { if (suspended) { suspended = false; ctxs.forEach((ctx, key) => {
				ctx.timer = queue(key, ctx.count);
			}); } };
		} Self.set(this, self);
	}

	add(key) {
		const { counts, fire, } = Self.get(this);
		const count = (counts.get(key) || 0) + 1;
		count === 1 && fire(key, count);
		counts.set(key, count); return count;
	}

	drop(key) {
		const { counts, fire, } = Self.get(this);
		const count = (counts.get(key) || 0) - 1;
		count === 0 && fire(key, count);
		count === 0 && counts.delete(key);
		count > 0 && counts.set(key, count); return count;
	}

	get(key) { return Self.get(this).counts.get(key) || 0; }

	suspend() { Self.get(this).suspend(); }
	resume() { Self.get(this).resume(); }
}

return { windowIsIdle, Mutex, RefCounter, };

}); })(this);
