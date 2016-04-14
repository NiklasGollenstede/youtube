'use strict'; define('common/event-emitter', [
	'es6lib',
], function({
	object: { Class, setConst, },
}) {


const now = Promise.resolve();


const EventEmitter = new Class({
	constructor: (x, Private) => (function() {
		const self = Private(this);
		self.on = { };
	}),

	public: Private => ({
		on(name, cb) {
			Private(this).add(name, cb, false);
			return cb;
		},
		once(name, cb) {
			Private(this).add(name, cb, true);
			return cb;
		},
		off(name, cb) {
			const self = Private(this);
			const on = self.on && self.on[name];
			if (!on) { return this; }
			on.delete(cb);
			!on.size && delete self.on[name];
			return this;
		},
		onceBefore(name, cancel, cb) {
			const self = Private(this);
			let canceled = false;
			const good = value => { self.on[cancel].delete(bad); !canceled && cb(value); };
			const bad = value => { self.on[name].delete(good); canceled = true; };
			self.add(name, good, true);
			self.add(cancel, bad, true);
			return cb;
		},
	}),

	protected: Private => ({
		emit(name, value) {
			if (name === EventEmitter.destroyed) { throw new Error('Cannot emit EventEmitter.destroyed'); }
			const self = Private(this);
			const on = self.on && self.on[name];
			if (!on) { return; }
			on.forEach((once, cb) => {
				now.then(() => cb(value)).catch(error => { console.error('"'+ name +'" event handler threw:', error); });
				once && on.delete(cb);
			});
			!on.size && delete self.on[name];
		},
		emitSync(name, value) {
			if (name === EventEmitter.destroyed) { throw new Error('Cannot emit EventEmitter.destroyed'); }
			const self = Private(this);
			const on = self.on && self.on[name];
			const cbs = [ ];
			if (!on) { return cbs; }
			on.forEach((once, cb) => {
				cbs.push(cb);
				once && on.delete(cb);
			});
			!on.size && delete self.on[name];
			return cbs.map(cb => { try { return cb(value); } catch (error) {
				console.error('"'+ name +'" event handler threw:', error);
				return null;
			} });
		},
		clear(name) {
			const self = Private(this);
			const on = self.on && self.on[name];
			if (!on) { return 0; }
			const size = on.size;
			on.clear();
			delete self.on[name];
			return size;
		},
		destroy() {
			const self = Private(this);
			if (!self.on) { return; }
			const on = self.on[EventEmitter.destroyed];
			self.on = null;
			on && on.forEach((once, cb) => {
				try { return cb(); } catch (error) { console.error('EventEmitter.destroyed event handler threw:', error); }
			});
		},
	}),

	private: () => ({
		add(key, value, once) {
			if (!this.on) { return; }
			let on = this.on[key];
			if (!on) { on = this.on[key] = new Map; }
			on.set(value, once);
		}
	}),
});
setConst(EventEmitter, 'destroyed', Symbol.for('destroyed'));

return (EventEmitter.EventEmitter = EventEmitter);

});
