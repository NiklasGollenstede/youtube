'use strict'; define('content/port', [
	'common/event-emitter', 'es6lib',
], function(
	EventEmitter,
	{
		object: { Class, },
	}
) {

const Port = new Class({
	extends: { public: EventEmitter, },

	constructor: (Super, Private, Protected) => (function() {
		Super.call(this);
		const self = Private(this);
		const _this = self._this = Protected(this);
		self.requests = new Map;
		self.nextId = 1;
		self.port = chrome.runtime.connect({ name: 'tab', });
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
				self.requests.set(self.nextId, [ resolve, reject, ]);
				self.postMessage({ name, method, id: self.nextId++, args, });
			});
		},
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
				if (message.hasOwnProperty('value')) {
					this.requests.get(id)[0](message.value);
				} else {
					this.requests.get(id)[1](message.error);
				}
				this.requests.delete(id);
			} else {
				this._this.emitSync(message.name, message.value);
			}
		},
	}),
});

return (Port.Port = Port);

});
