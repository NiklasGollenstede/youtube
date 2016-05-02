'use strict';
const { tabs: Tabs, storage: Storage, } = require('common/chrome');

if (!Storage.sync) {
	console.log('chrome.storage.sync is unavailable, fall back to chrome.storage.local');
	Storage.sync = Storage.local;
}

Promise.all([
	require('db/meta-data'),
	Storage.sync.get('options').then(({ options, }) => {
		if (options) { return options; }
		options = require('options/utils').simplify(require('options/defaults'));
		Storage.sync.set({ options, });
		return options;
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

chrome.runtime.onMessage.addListener((message, sender, reply) => (Promise.resolve({
	alert, confirm, prompt,
	openOptionsTab() { Tabs.create({ url: chrome.extension.getURL('options/index.html'), }); },
	control(type) { switch (type) {
		case 'export': {
			const data = db.transaction();
			return data.ids().then(ids => Promise.all(ids.map(id => data.get(id))))
			.then(result => {
				const data = JSON.stringify(result);
				return require('es6lib/dom').writeToClipboard({ 'application/json': data, 'text/plain': data, });
			}).then(() => alert('The JSON data has been put into your clipboard'));
		} break;
		case 'import': {
			return Promise.resolve().then(() => {
				const infos = JSON.parse(prompt('Please paste your JSON data below', ''));
				console.log('import', infos);
				if (!Array.isArray(infos)) { throw new Error('The import data must be an Array'); }
				const corrupt = infos.findIndex(info => !info || !(/^[A-z0-9_-]{11}$/).test(info.id));
				if(corrupt !== -1) {throw new Error('The object at index '+ corrupt +' must have an "id" property set to a valid YouTube video id: "'+ JSON.stringify(infos[corrupt]) +'"'); }
				const data = db.transaction(true);
				return Promise.all(infos.map(info => data.set(info)));
			});
		} break;
		case 'clear': {
			if (prompt('If you really mean to delete all your user data type "yes" below') !== 'yes') { return alert('Canceled. Nothing was deleted'); }
			return db.clear().then(() => alert('Done. It\'s all gone ...'));
		} break;
	} },
	storage(area, method, query) {
		console.log('storage', area, method, query);
		return query ? Storage[area][method](query) : Storage[area][method]();
	},
}[message.name].apply(window, message.args)).then(
	value => reply({ value, }),
	error => reply({ error: error && { message: error.message || error, stack: error.stack, }, })
), true));

chrome.storage.onChanged.addListener(({ options: o, }, sync) => (Storage.sync === Storage.local || sync === 'sync') && o && Object.assign(options, o) && console.log('options changed', o.newValue));

Tabs.query({ }).then(tabs => {
	console.log(tabs);
	const { js, css, } = chrome.runtime.getManifest().content_scripts[0];
	Promise.all(tabs.map(({ id, url, }) =>
		url && !Tab.instances.has(id) && Tabs.executeScript(id, { file: './content/cleanup.js', })
		.then(() => {
			css.forEach(file => chrome.tabs.insertCSS(id, { file: './'+ file, }));
			js.forEach(file => chrome.tabs.executeScript(id, { file: './'+ file, }));
			return true;
		})
		.catch(error => console.log('skipped tab', error)) // not allowed to execute, i.e. not YouTube
	)).then(success => console.log('attached to', success.filter(x=>x).length, 'tabs'));
});

}).catch(error => console.error('Error during startup', error));
