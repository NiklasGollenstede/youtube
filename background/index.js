'use strict';

const {
	concurrent: { async, },
} = require('es6lib');
const { tabs: Tabs, storage: Storage, extension: Extension, applications: { gecko, chromium, }, } = require('common/chrome');

if (!Storage.sync) {
	console.log('chrome.storage.sync is unavailable, fall back to chrome.storage.local');
	Storage.sync = Storage.local;
}


Promise.all([
	require('db/meta-data'),
	require('common/options')({
		defaults: require('options/defaults'),
		prefix: 'options',
		storage: Storage.sync || Storage.local,
		addChangeListener: listener => Storage.onChanged
		.addListener(changes => Object.keys(changes).forEach(key => key.startsWith('options') && listener(key, changes[key].newValue))),
	}),
]).then(([ db, options, ]) => {
window.db = db; window.options = options;

const Tab = window.Tab = new require('background/tab');

const playlist = window.playlist = new (require('background/playlist'))({
	onSeek(index) {
		console.log('onSeek', index);
		panel.emit('playlist_seek', index);
	},
	onAdd(index, value) {
		panel.lastSortCriterium = false;
	},
});

const commands = window.commands = {
	play() {
		playlist.is(tab => tab.play());
	},
	pause() {
		Tab.pauseAllBut(null);
	},
	toggle() {
		const tab = playlist.get();
		tab && !tab.playing ? commands.play() : commands.pause();
	},
	next() {
		playlist.next() ? commands.play() : commands.pause();
	},
	prev() {
		playlist.prev() ? commands.play() : commands.pause();
	},
	loop(value = !playlist.loop) {
		playlist.loop = !!value;
		panel.emit('state_change', { looping: playlist.loop, });
	},
};

const panel = window.panel = new (require('background/panel'))({ tabs: Tab.actives, playlist, commands, data: db, });

chrome.commands.onCommand.addListener(command => ({
	MediaPlayPause: commands.toggle,
	MediaNextTrack: commands.next,
	MediaPrevTrack: commands.prev,
}[command]()));

chrome.runtime.onConnect.addListener(port => { switch (port.name) {
	case 'panel': {
		panel.add(port);
	} break;
	case 'tab': {
		new Tab({ port, playlist, commands, panel, data: db, });
	} break;
	default: {
		console.error('connection with unknown name:', port.name);
	}
} });

const getWindow = (windowId) => chromium ? window : Extension.getViews({ type: 'tab', windowId, })[0];

// asynchronously respond to all kind of messages: Object{ (function) name, (function) args, } =async=> Object{ value or error, }
chrome.runtime.onMessage.addListener((message, sender, reply) => (Promise.resolve({

	// alert etc. doesn't work in the options panel in chrome
	alert, confirm, prompt,

	openOptionsTab() { Tabs.create({ url: chrome.extension.getURL('options/index.html'), }); },

	// handle clicks on control buttons on the options page
	control: async(function*(type) { switch (type) {
		case 'export': {
			const data = gecko ? db : db.transaction();
			const ids = (yield data.ids());
			const json = JSON.stringify((yield Promise.all(ids.map(id => data.get(id)))), null, '\t');
			if (chromium) {
				(yield require('es6lib/dom').writeToClipboard({ 'application/json': json, 'text/plain': json, }));
				alert('The JSON data has been put into your clipboard');
			} else {
				getWindow(sender.tab.windowId).prompt('Please copy the JSON from the field below', json);
			}
		} break;
		case 'import': {
			const infos = JSON.parse(getWindow(sender.tab.windowId).prompt('Please paste your JSON data below', ''));
			console.log('import', infos);
			if (!Array.isArray(infos)) { throw new Error('The import data must be an Array'); }
			const corrupt = infos.findIndex(info => !info || !(/^[A-z0-9_-]{11}$/).test(info.id));
			if (corrupt !== -1) { throw new Error('The object at index '+ corrupt +' must have an "id" property set to a valid YouTube video id: "'+ JSON.stringify(infos[corrupt]) +'"'); }
			const data = db.transaction(true);
			(yield Promise.all(infos.map(info => data.set(info))));
		} break;
		case 'clear': {
			const window = getWindow(sender.tab.windowId);
			if (window.prompt('If you really mean to delete all your user data type "yes" below') !== 'yes') { return window.alert('Canceled. Nothing was deleted'); }
			(yield db.clear());
			window.alert('Done. It\'s all gone ...');
		} break;
		case 'reset': {
			if (!getWindow(sender.tab.windowId).confirm('Are you sure that you want to reset all options to their default values?')) { return; }
			(function reset(options) {
				options.forEach(option => {
					option.values.reset();
					reset(option.children);
				});
			})(options);
		} break;

		default: {
			throw new Error('Unhandled command "'+ type +'"');
		}
	} }),

	// Firefox only: respond to the chrome.storage shim in context scripts
	storage(area, method, query) {
		console.log('storage', area, method, query);
		return query ? Storage[area][method](query) : Storage[area][method]();
	},
}[message.name].apply(window, message.args)).then(
	value => reply({ value, }),
	error => reply({ error: error && { message: error.message || error, stack: error.stack, }, })
), true));

// report location changes to the content scripts
Tabs.onUpdated.addListener((id, { url, }) => url && Tab.instances.has(id) && Tab.instances.get(id).emit('navigated', { url, }));

// Firefox only: feed the chrome.storage shim in context scripts with updates (excluding changes due to the indexDB workaround in db/meta-data.js)
gecko && Storage.onChanged.addListener((change, area) => {
	const keep = Object.keys(change).filter(key => !(/^[A-z0-9_-]{11}\$\w+$/).test(key));
	if (!keep.length) { return; }
	const _change = { };
	keep.forEach(key => _change[key] = { newValue: change[key].newValue, });
	// BUG: FF47 oldValues are (often) dead already
	const message = { name: 'storage.onChanged', change: _change, area, };
	Tab.instances.forEach(tab => chrome.tabs.sendMessage(tab.id, message));
});

// load the content_scripts into all existing tabs
Tabs.query({ }).then(tabs => {
	console.log(tabs);
	chrome.runtime.getManifest().content_scripts.forEach(({ js, css, matches, exclude_matches, }) => {
		const include = !matches ? (/(?!)/) : new RegExp('^('+ matches.map(s => s.replace(/[\-\[\]\{\}\(\)\*\+\?\.\,\\\^\$\|\#]/g, '\\$&').replace(/\\\*/g, '.*')).join('|') +'$)');
		const exclude = !exclude_matches ? (/(?!)/) : new RegExp('^('+ exclude_matches.map(s => s.replace(/[\-\[\]\{\}\(\)\*\+\?\.\,\\\^\$\|\#]/g, '\\$&').replace(/\\\*/g, '.*')).join('|') +'$)');
		Promise.all(tabs.map(({ id, url, }) =>
			url && !Tab.instances.has(id) && (include).test(url) && !(exclude).test(url)
			&& Tabs.executeScript(id, { file: '/content/cleanup.js', })
			.then(() => {
				css.forEach(file => chrome.tabs.insertCSS(id, { file, }));
				js.forEach(file => chrome.tabs.executeScript(id, { file, }));
				return true;
			})
			.catch(error => console.log('skipped tab', error)) // not allowed to execute, i.e. not YouTube
		)).then(success => console.log('attached to', success.filter(x=>x).length, 'tabs'));
	});
});

}).catch(error => console.error('Error during startup', error));
