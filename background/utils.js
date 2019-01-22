(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/browser/': { Windows, },
	'node_modules/web-ext-utils/browser/version': { fennec, gecko, },
	'node_modules/web-ext-utils/loader/views': { getViews, },
	'node_modules/es6lib/functional': { debounce, },
}) => {


/// returns true, if a tab in the window can be activated without interrupting the user because the window is actively used
async function windowIsIdle(windowId) {
	if (fennec) { return false; } // only one "window"
	if (hasFocusedSidebar()) { return true; }
	if (gecko) { return hasPanel() || hasFocusedSidebar() || !(await hasFocus()); }
	return !(await hasFocus()) && !hasPanel();

	function hasFocus() { return Windows.get(windowId).then(_=>_.focused); }
	function hasPanel() { return getViews().some(_=>_.type === 'panel'); }
	function hasFocusedSidebar() { return getViews().some(_=>_.type === 'sidebar' && _.view.document.hasFocus()); }
}

const Self = new WeakMap;

/// redirects all writing to use `this.splice()`
/* abstract */ class SpliceArray extends Array {
	push() { this.splice(Infinity, 0, ...arguments); return this.length; }
	pop() { return this.splice(-1, 1)[0]; }
	shift() { return this.splice(0, 1)[0]; }
	unshift() { this.splice(0, 0, ...arguments); return this.length; }
	sort() { this.splice(0, Infinity, ...slice(this).sort(...arguments)); return this; }
	reverse() { this.splice(0, Infinity, ...slice(this).reverse()); return this; }
	copyWithin(at, ...range) { const insert = slice(this).slice(...range); this.splice(at, insert.length, ...insert); return this; }
}  Object.defineProperty(SpliceArray, Symbol.species, { value: Array, configurable: true, });
function slice(s) { s = Self.get(s) || s; const l = s.length, t = new Array(l); for (let i = 0; i < l; ++i) { t[i] = s[i]; } return t; }

SpliceArray.proxySet = function(self, { privateKey = () => false, } = { }) {
	const props = propsFor(Object.getPrototypeOf(self));
	const proxy = new Proxy(self, { set(self, key, value) {
		// console.log('set', key, value);
		if (privateKey(key)) { throw new Error(`key can not be written`); }
		if (typeof key === 'string' && (/^\d+$/).test(key)) {
			self.splice(+key, 1, value);
		} else if (key === 'length') {
			value -= 0; if (value !== value|0 || value < 0) { new Array(value); /* throws */ }
			else { self.splice(value, Infinity); }
		} self[key] = value; return true; // this invokes setters
	}, get(self, key) {
		// console.log('get', key);
		if (privateKey(key)) { throw new Error(`key can not be read`); }
		return Object.hasOwnProperty.call(self, key) ? self[key] // get own properties
		: Reflect.get(props, key, self); // return a method that unwraps the proxy, or invoke copied getters with the unwrapped `this` (or return any other non-function property)
	}, }); Self.set(proxy, self); return proxy;
};
function propsFor(proto) {
	if (Self.get(proto)) { return Self.get(proto); }
	const props = { __proto__: null, }, chain = [ ];
	let p = proto; while (p) { chain.push(p); p = Object.getPrototypeOf(p); }
	chain.reverse().forEach(obj => {
		Object.getOwnPropertyNames(obj).forEach(copy);
		Object.getOwnPropertySymbols(obj).forEach(copy);
		function copy(key) {
			const desc = Object.getOwnPropertyDescriptor(obj, key); desc.configurable = true;
			if (typeof desc.value === 'function') {
				const { value: method, } = desc;
				desc.value = function() {
					return method.apply(Self.get(this), arguments);
				};
			} Object.defineProperty(props, key, desc);
		}
	}); Self.set(proto, props); return props;
}

/**
 * `UndoArray`: Mixin class that overwrites the `Array#splice()` method to record modifications
 * and make them undoable via the added `.undo()` and `.redo()` methods.
 * Since only calls to `.splice()` are intercepted, other modifying actions should use or be redirected to `.splice()`.
 * Therefore `UndoArray` does by default and probably always should inherit from `SpliceArray`.
 * Changes aggregated into groups. A group is committed a configurable time after the most recent modification.
 */
const UndoArray = makeUndoArray(SpliceArray); function makeUndoArray(SpliceArray) { let Self, options; {
	Self = arguments[1] && arguments[1].mapPrivateProperties || new WeakMap;
	options = arguments[1] && arguments[1].instanceOptions;
} return class UndoArray extends SpliceArray {
	/**
	 * Applies the Mixin to the given base class, creating a new class.
	 * Can optionally predefine the constructor options (see `#constructor`).
	 * @param  {class}   Base                   Base class to extend.
	 * @param  {object}  .mapPrivateProperties  Optional. Object { get, set, } methods used to store the private properties per instance, defaults to a new `WeakMap`.
	 * @param  {object}  .instanceOptions       Optional. Predefined alternative instance options.
	 */
	static for() { return makeUndoArray.apply(null, arguments); }
	/**
	 * Extended constructor. Expects an options object and forwards all other parameters to `super()`.
	 * Alternatively the options object can also be supplied as second parameter during the mixin creation.
	 * @param {number}   .limit   Maximum number of `.undo()` actions to record.
	 * @param {natural}  .commit  Number of ms to wait before committing an undo step.
	 */
	constructor(...args) {
		const { limit = Infinity, commit = 0, } = options || args.shift() || { };
		super(...args); const undo = [ [ ], ]; Self.set(this, {
			undo, redo: [ ], limit, commit: debounce(() => {
				undo[undo.length - 1].length && undo.push([ ]);
				undo.length > limit && undo.shift();
			}, commit),
		});
	}
	/**
	 * Intercepts `.splice()` calls, forwards them to `super` and records the values to be able to undo the change later.
	 * The change will either be added to the current uncommitted change group or initialize a new group.
	 * Every call clears the redo stack and resets the commit timeout.
	 */
	splice() {
		let at = Math.floor(arguments[0]); at = Math.min(Math.max(0, at < 0 ? this.length - at : at), this.length);
		const { undo, redo, commit, } = Self.get(this);
		const removed = super.splice(...arguments); // `super.splice()` shouldn't recursively call `this.splice()` again
		undo[undo.length - 1].push([ at, arguments.length - 2, ...removed, ]);
		redo.length = 0; commit(); return removed;
	}
	/**
	 * Un-does all changes in the current or most recent change group, adds the reverse changes to the redo stack and removes the change group.
	 * @return {bool}  `true` iff there was a non-empty change group to undo.
	 */
	undo() {
		const { undo, redo, } = Self.get(this);
		!undo[undo.length - 1].length && undo.pop();
		const calls = undo.pop(); undo.push([ ]); if (!calls) { return false; }
		redo.push(applySplices(this, super.splice, calls)); return true;
	}
	/**
	 * Re-does the most recent undo and makes it available as undo again.
	 * @return {bool}  `true` iff there was anything to redo.
	 */
	redo() {
		const { undo, redo, } = Self.get(this);
		const calls = redo.pop(); if (!calls) { return false; }
		undo[undo.length - 1] = applySplices(this, super.splice, calls);
		undo.push([ ]); return true;
	}
	static get [Symbol.species]() { return SpliceArray[Symbol.species]; } /// Redirects to `Super` class.
	/**
	 * Implementation: Invariants (between calls):
	 * * `undo` is never empty
	 * * either a commit is pending, or `undo[undo.length - 1]` is empty
	 * * if `redo` is not empty, `undo[undo.length - 1]` is empty
	 */
}; }
function applySplices(array, splice, calls) {
	return calls.reverse().map(args => {
		const removed = splice.apply(array, args);
		return [ args[0], args.length - 2, ...removed, ];
	}); // .reverse() again?
}

return { windowIsIdle, SpliceArray, UndoArray, };

}); })(this);
