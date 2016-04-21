'use strict';
const { tabs: Tabs, storage: Storage, } = require('common/chrome');

Promise.all([
	require('db/meta-data'),
	Storage.sync.get('options').then(({ options, }) => {
		if (options) { return options; }
		options = require('options/utils').simplify(require('options/defaults'));
		Storage.sync.set({ options, });
		return options;
	}),
]).then(([ db, options, ]) => {

const Tab = new require('background/tab');

const playlist = new (require('background/playlist'))({
	onSeek(index) {
		console.log('onSeek', index);
		panel && panel.emit('playlist_seek', index);
	},
});

const commands = {
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

const panel = new (require('background/panel'))({ tabs: Tab.actives, playlist, commands, data: db, });

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
		new Tab({ port, playlist, panel, data: db, });
	} break;
	default: {
		console.error('connection with unknown name:', port.name);
	}
} });

chrome.runtime.onMessage.addListener((message, sender, reply) => reply({
	alert, confirm, prompt,
	openOptionsTab() { Tabs.create({ url: chrome.extension.getURL('options/index.html'), }); },
}[message.name].apply(window, message.args)));

chrome.storage.onChanged.addListener(({ options, }, sync) => sync === 'sync' && options && console.log('options changed', options.newValue));

Tabs.query({ }).then(tabs => {
	console.log(tabs);
	const { js, css, } = chrome.runtime.getManifest().content_scripts[0];
	Promise.all(tabs.map(({ id, url, }) =>
		url && Tabs.executeScript(id, { file: './content/cleanup.js', })
		.then(() => {
			css.forEach(file => chrome.tabs.insertCSS(id, { file: './'+ file, }));
			js.forEach(file => chrome.tabs.executeScript(id, { file: './'+ file, }));
			return true;
		})
		.catch(error => console.log('skipped tab', error)) // not allowed to execute, i.e. not YouTube
	)).then(success => console.log('attached to', success.filter(x=>x).length, 'tabs'));
});

}).catch(error => console.error('Error during startup', error));
