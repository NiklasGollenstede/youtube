(function(global) { 'use strict'; define(function({  // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/web-ext-utils/options/editor': Editor,
	'node_modules/es6lib/concurrent': { async, },
	'node_modules/web-ext-utils/chrome/': { Tabs, Windows, Storage, Extension, Runtime, applications: { gecko, blink, }, },
	'common/options': options,
}) {

window.options = options;

const onCommand = async(function*({ name, }, button) {
	const { db, } = (yield Runtime.getBackgroundPage());
	switch (name) {
		case 'export': {
			const data = !db.isIDB ? db : db.transaction();
			const ids = (yield data.ids());
			let infos = (yield Promise.all(ids.map(id => data.get(id))));
			if (button === 'viewed only') {
				infos = infos.filter(_=>_.viewed || _.private);
				infos.forEach(info => delete info.rating);
			}
			const json = JSON.stringify(infos, null, '\t');
			if (blink) { // prompt has a limited output length in chromium
				(yield (yield require.async('node_modules/es6lib/dom')).writeToClipboard({ 'application/json': json, 'text/plain': json, }));
				alert('The JSON data has been put into your clipboard');
			} else { // writeToClipboard doesn't work in Firefox
				prompt('Please copy the JSON from the field below', json);
			}
		} break;
		case 'import': {
			const string = prompt('Please paste your JSON data below', '');
			if (!string) { return; }
			let infos; try { infos = JSON.parse(string); } catch (error) { throw new Error('Failed to parse JSON: '+ error.message); }
			console.log('import', infos);
			if (!Array.isArray(infos)) { throw new TypeError('The import data must be an Array (as JSON)'); }
			infos.forEach((info, index) => {
				const error = db.validate(info);
				if (error) { throw new TypeError(`The object at index ${ index } is invalid: ${ error.message }`); }
			});
			(yield db.import(infos));
			alert(`Imported ${ infos.length } items`);
		} break;
		case 'getSize': {
			const data = !db.isIDB ? db : db.transaction();
			const ids = (yield data.ids());
			const infos = (yield Promise.all(ids.map(id => data.get(id))));
			const thumbs = (yield Promise.all(ids.map(id => data.get(id, [ 'thumb', ]))))
			.map(_=>_.thumb).filter(_=>_);
			const size = thumbs.reduce((size, blob) => size + blob.size, 0);
			const json = JSON.stringify(infos);

			const round = (yield require.async('node_modules/es6lib/string')).numberToRoundString;

			alert(`
				Total #: ${ ids.length }
				Data size: ~${ round(json.length) }B
				Thumbs #: ${ thumbs.length }
				Thumbs size: ~${ round(size) }B
			`.split(/^/gm).map(_=>_.trim()).join('\n'));
		} break;
		case 'clear': {
			if (prompt('If you really mean to delete all your user data type "yes" below') !== 'yes') { return alert('Canceled. Nothing was deleted'); }
			(yield db.clear());
			if ((yield db.ids()).length === 0) {
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
}, error => { alert('The operation failed with '+ (error && (error.name +': '+ error.message))); throw error; });

new Editor({
	options,
	host: document.querySelector('#options'),
	onCommand,
});

}); })();

(window.browser || window.chrome).tabs.getCurrent(tab => tab && (window.tabId = tab.id));