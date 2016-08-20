define('background/main', [
	'web-ext-utils/update/result',
	'es6lib',
	'web-ext-utils/chrome',
	'web-ext-utils/utils',
	'db/meta-data',
	'common/options',
	'background/tab',
	'background/panel',
], function(
	_,
	{
		concurrent: { async, },
	}, {
		Tabs, Windows, Storage, Extension, Messages, applications: {
			gecko, chromium,
		},
	},
	{ attachAllContentScripts, showExtensionTab, },
	db,
	options,
	Tab,
	PanelHandler
) {

window.Chrome = require('web-ext-utils/chrome');
window.db = db; window.options = options;
Messages.isExclusiveMessageHandler = true;

if (!Storage.sync) {
	console.log('chrome.storage.sync is unavailable, fall back to chrome.storage.local');
	Storage.sync = Storage.local;
}


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

const panel = window.panel = new PanelHandler({ tabs: Tab.actives, playlist, commands, data: db, });

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

// Firefox can't alert etc. in the background window
const getWindow = () => chromium ? window : Extension.getViews({ type: 'tab', }).find(window => (/options\/index\.html$/).test(window.local.href));

// open or focus the options view in a tab.
Messages.addHandler('openOptions', () => showExtensionTab('/options/index.html'));
Messages.addHandler('openPlaylist', () => showExtensionTab('/panel/index.html'));

// handle clicks on control buttons on the options page
Messages.addHandler('control', async(function*(type, subtype) {
	const window = getWindow();
	switch (type) {
		case 'export': {
			const data = gecko ? db : db.transaction();
			const ids = (yield data.ids());
			const json = JSON.stringify((yield Promise.all(ids.map(id => data.get(id)))), null, '\t');
			if (chromium) {
				(yield require('es6lib/dom').writeToClipboard({ 'application/json': json, 'text/plain': json, }));
				alert('The JSON data has been put into your clipboard');
			} else {
				window.prompt('Please copy the JSON from the field below', json);
			}
		} break;
		case 'import': {
			const string = window.prompt('Please paste your JSON data below', '');
			if (!string) { return; }
			let infos; try { infos = JSON.parse(string); } catch (error) { }
			console.log('import', infos);
			if (!Array.isArray(infos)) { return window.alert('The import data must be an Array (as JSON)'); }
			const corrupt = infos.findIndex(info => !info || !(/^[A-z0-9_-]{11}$/).test(info.id));
			if (corrupt !== -1) { return window.alert('The object at index '+ corrupt +' must have an "id" property set to a valid YouTube video id: "'+ JSON.stringify(infos[corrupt]) +'"'); }
			const data = db.transaction(true);
			(yield Promise.all(infos.map(info => data.set(info))));
		} break;
		case 'clear': {
			if (window.prompt('If you really mean to delete all your user data type "yes" below') !== 'yes') { return window.alert('Canceled. Nothing was deleted'); }
			(yield db.clear());
			window.alert('Done. It\'s all gone ...');
		} break;
		case 'reset': {
			if (!window.confirm('Are you sure that you want to reset all options to their default values?')) { return; }
			options.resetAll();
		} break;

		default: {
			throw new Error('Unhandled command "'+ type +'"');
		}
	}
}));

// Firefox only: respond to the chrome.storage shim in context scripts
gecko && Messages.addHandler('storage', (area, method, query) => {
	console.log('storage', area, method, query);
	return query ? Storage[area][method](query) : Storage[area][method]();
});

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
return attachAllContentScripts({ cleanup: () => {
	delete window.require;
	delete window.define;
}, });

});
