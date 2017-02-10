(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/dom': { loadFile, saveAs, readBlob, writeToClipboard, },
	'node_modules/web-ext-utils/browser/': { extension, },
	'node_modules/web-ext-utils/browser/version': { blink, current: currentBrowser, version: browserVersion, },
	'node_modules/web-ext-utils/options/editor/': Editor,
	'node_modules/web-ext-utils/options/editor/about': aboutSection,
	'node_modules/web-ext-utils/utils': { reportError, },
	'common/options': options,
}) => {

(window.browser || window.chrome).tabs.getCurrent(tab => tab && (window.tabId = tab.id));
window.options = options;
const { db, } = extension.getBackgroundPage() || { };

async function onCommand({ name, parent, }, button) { try {
	if (!db && parent.name === 'storage') { throw new Error(`Database is not available, please make sure to open the settings in a not-private window!`); }

	switch (name) {
		case 'export': {
			const data = !db.isIDB ? db : db.transaction();
			const ids = (await data.ids());
			let infos = (await Promise.all(ids.map(id => data.get(id))));
			if (button.startsWith('viewed only')) {
				infos = infos.filter(_=>_.viewed || _.private);
				infos.forEach(info => delete info.rating);
			}
			const json = JSON.stringify(infos, null, '\t');
			if (button.endsWith('file')) {
				saveAs(new Blob([ json, ], { type: 'application/json', }), 'data.json');
			} else if (blink) { // prompt has a limited output length in chromium
				(await writeToClipboard({ 'application/json': json, 'text/plain': json, }));
				alert('The JSON data has been put into your clipboard');
			} else { // writeToClipboard doesn't work in Firefox // TODO: it probably does by now
				prompt('Please copy the JSON from the field below', json);
			}
		} break;
		case 'import': {
			let string = '';
			if (button.endsWith('file')) {
				const file = (await loadFile({ accept: 'application/json, text/json, .json', }))[0];
				if (!file) { console.log('empty selection'); return; }
				string = (await readBlob(file));
			} else {
				string = prompt('Please paste your JSON data below', '');
			}
			if (!string) { return; }
			let infos; try { infos = JSON.parse(string); } catch (error) { throw new Error('Failed to parse JSON: '+ error.message); }
			console.log('import', infos);
			if (!Array.isArray(infos)) { throw new TypeError('The import data must be an Array (as JSON)'); }
			infos.forEach((info, index) => {
				const error = db.validate(info);
				if (error) { throw new TypeError(`The object at index ${ index } is invalid: ${ error.message }`); }
			});
			(await db.import(infos));
			alert(`Imported ${ infos.length } items`);
		} break;
		case 'getSize': {
			const data = !db.isIDB ? db : db.transaction();
			const ids = (await data.ids());
			const infos = (await Promise.all(ids.map(id => data.get(id))));
			const thumbs = (await Promise.all(ids.map(id => data.get(id, [ 'thumb', ]))))
			.map(_=>_.thumb).filter(_=>_);
			const size = thumbs.reduce((size, blob) => size + blob.size, 0);
			const json = JSON.stringify(infos);

			const round = (await require.async('node_modules/es6lib/string')).numberToRoundString;

			alert(`
				Total #: ${ ids.length }
				Data size: ~${ round(json.length) }B
				Thumbs #: ${ thumbs.length }
				Thumbs size: ~${ round(size) }B
			`.split(/^/gm).map(_=>_.trim()).join('\n'));
		} break;
		case 'clear': {
			if (prompt('If you really mean to delete all your user data type "yes" below') !== 'yes') { return void alert('Canceled. Nothing was deleted'); }
			(await db.clear());
			if ((await db.ids()).length === 0) {
				alert('Done. It\'s all gone ...');
			} else {
				throw new TypeError(`Failed to delete all data`);
			}
		} break;
		case 'reset': {
			if (!confirm('Are you sure that you want to reset all options to their default values?')) { return; }
			options.resetAll();
		} break;

		default: {
			throw new Error('Unhandled command "'+ name +'"');
		}
	}
} catch (error) { reportError(error); throw error; } }

new Editor({
	options,
	host: document.querySelector('#options'),
	onCommand,
});

const manifest = (global.browser || global.chrome).runtime.getManifest();

global.document.title = 'Options - '+ manifest.name;

aboutSection({
	manifest,
	host: document.querySelector('#about'),
	browser: { name: currentBrowser.replace(/^./, c => c.toUpperCase()), version: browserVersion, },
});

}); })(this);
