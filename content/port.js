(() => { 'use strict'; define(function({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/chrome/': { runtime, applications: { gecko, }, },
	'node_modules/es6lib/object': { Class, },
	'common/event-emitter': EventEmitter,
}) {

const Port = new Class({
	extends: { public: EventEmitter, },

	constructor: (Super, Private, Protected) => (function() {
		Super.call(this);
		const self = Private(this), _this = self._this = Protected(this);
		self.requests = new Map;
		self.nextId = 1;
		self.port = runtime.connect({ name: 'tab', });
		self.port.onMessage.addListener(self.onMessage.bind(self));
		self.port.onDisconnect.addListener(() => _this.destroy());
	}),

	public: (Private, Protected, Public) => ({
		emit(name, value) {
			const self = Private(this);
			self.postMessage({ name, value, });
		},
		request(name, method, ...args) {
			const self = Private(this);
			return new Promise((resolve, reject) => {
				self.requests.set(self.nextId, { resolve, reject, });
				self.postMessage({ name, method, id: self.nextId++, args, });
			});
		},
		destroy() {
			const self = Private(this);
			self.port.disconnect();
		}
	}),

	private: (Private, Protected, Public) => ({
		postMessage(message) {
			try {
				this.port.postMessage(message);
			} catch (error) {
				console.error('Error in emit, destroying Port instance', error);
				Protected(this).destroy();
			}
		},
		onMessage(message) {
			const { id, } = message;
			if (id) {
				if (message.threw) {
					this.requests.get(id).reject(fromJson(message.error));
				} else {
					this.requests.get(id).resolve(message.value);
				}
				this.requests.delete(id);
			} else {
				this._this.emitSync(message.name, message.value);
			}
		},
	}),
});

function fromJson(string) {
	if (typeof string !== 'string') { return string; }
	return JSON.parse(string, (key, value) => {
		if (!value || typeof value !== 'string' || !value.startsWith('$_ERROR_$')) { return value; }
		const object = JSON.parse(value.slice(9));
		const Constructor = object.name ? window[object.name] || Error : Error;
		const error = gecko ? Object.create(Constructor.prototype) : new Constructor; // Firefox (49) won't log any properties of actual Error instances to the web pages console
		Object.assign(error, object);
		return error;
	});
}

return (Port.Port = Port);

}); })();
