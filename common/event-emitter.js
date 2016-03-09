'use strict'; define('common/event-emitter', [
	'es6lib',
], function({
	object: { Class, },
}) {


const now = Promise.resolve();


const EventEmitter = new Class({
	constructor: (x, Private) => (function() {
		const self = Private(this);
		self.on = { };
		self.once = { };
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
			self.on[name] && self.on[name].delete(cb);
			return this;
		},
		onceBefore(name, cancel, cb) {
			const self = Private(this);
			var canceled = false;
			const good = value => { self.on[cancel].delete(bad); !canceled && cb(value); };
			const bad = value => { self.on[name].delete(good); canceled = true; };
			self.add(name, good, true);
			self.add(cancel, bad, true);
			return cb;
		},
	}),

	protected: Private => ({
		emit(name, value) {
			const on = Private(this).on[name];
			on && on.forEach((once, cb) => {
				now.then(() => cb(value)).catch(error => {
					console.error('"'+ name +'" event handler threw: '+ error);
				});
				once && on.delete(cb);
			});
		},
		emitSync(name, value) {
			const on = Private(this).on[name];
			const cbs = [ ];
			on && on.forEach((once, cb) => {
				cbs.push(cb);
				once && on.delete(cb);
			});
			return cbs.map(cb => { try { return cb(value); } catch (error) {
				console.error('"'+ name +'" event handler threw: '+ error);
				return Promise.reject(error);
			} });
		},
	}),

	private: () => ({
		add(key, value, once) {
			if (this.on[key]) { return this.on[key].set(value, once); }
			this.on[key] = new Map([ [ value, once, ], ]);
		}
	}),
});

return (EventEmitter.EventEmitter = EventEmitter);

});
