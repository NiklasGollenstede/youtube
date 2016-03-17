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
		const _this = Protected(this);
		self.port = chrome.runtime.connect();
		self.port.onMessage.addListener(({ type, value, }) => _this.emitSync(type, value));
		self.port.onDisconnect.addListener(() => _this.destroy());
	}),

	public: (Private, Protected, Public) => ({
		emit(type, value) {
			const self = Private(this);
			try {
				self.port.postMessage({ type, value, });
			} catch (error) { if ((/disconnected/).test(error.message)) {
				console.error('Error in emit, destroying Port instance', error);
				Protected(this).destroy();
			} else { throw error; } }
		},
		emitSoon(type, value) {
			clearTimeout(this.timeoutHandler);
			this.timeoutHandler = setTimeout(() => this.emit(type, value), 300);
		},
	}),

	private: (Private, Protected, Public) => ({
	}),
});

return (Port.Port = Port);

});
