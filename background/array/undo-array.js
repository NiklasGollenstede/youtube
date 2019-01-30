(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	SpliceArray,
}) => {

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
	 * @param  {class}   Base                   Base class to extend. `Base#splice()` should not recursively call `SpliceArray#splice()`.
	 * @param  {object}  .mapPrivateProperties  Optional. Object { get, set, } methods used to store the private properties per instance, defaults to a new `WeakMap`.
	 * @param  {object}  .instanceOptions       Optional. Predefined alternative instance options.
	 */
	static extends() { return makeUndoArray.apply(null, arguments); }
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
		let at = Math.floor(arguments[0]) || 0; at = Math.min(Math.max(0, at < 0 ? this.length - at : at), this.length);
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
	/// Returns how many steps and be un-/redone, i.e. on how many consecutive calls the respective method would return `true`.
	get undoable() { const { undo, } = Self.get(this); return undo[undo.length - 1].length ? undo.length : undo.length - 1; }
	get redoable() { return Self.get(this).redo.length; }
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
	});
}
function debounce(callback, time) { // ignores `this` and `arguments`
	let timer = 0; return () => {
		timer && clearTimeout(timer);
		return (timer = setTimeout(() => {
			timer = 0; callback();
		}, time));
	};
}

return UndoArray;

}); })(this);
