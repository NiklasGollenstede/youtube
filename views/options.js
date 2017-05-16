(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/dom': { loadFile, saveAs, readBlob, writeToClipboard, },
	'node_modules/web-ext-utils/browser/version': { blink, },
	'node_modules/web-ext-utils/options/editor/inline': OptionsPage,
	'node_modules/web-ext-utils/utils/': { reportError, reportSuccess, },
	'common/options': options,
	'background/db': db,
	require,
}) => window => {

window.document.head.insertAdjacentHTML('beforeend', `<link href="/node_modules/web-ext-utils/options/editor/dark.css" rel="stylesheet">`);

OptionsPage({ onCommand, document: window.document, });

async function onCommand({ name, parent, }, buttonId) { try {
	if (!db && parent.name === 'storage') { throw new Error(`Database is not available, please make sure to open the settings in a not-private window!`); }
	const data = db.isIDB && blink ? db.transaction() : db;

	switch (name) {
		case 'export': {
			const ids = (await data.ids());
			let infos = (await Promise.all(ids.map(id => data.get(id))));
			if (buttonId.startsWith('viewed-')) {
				infos = infos.filter(_=>_.viewed || _.private);
				infos.forEach(info => delete info.rating);
			}
			const json = JSON.stringify(infos, null, '\t');
			if (buttonId.endsWith('-file')) {
				saveAs.call(window, new window.Blob([ json, ], { type: 'application/json', }), 'data.json');
			} else {
				(await writeToClipboard({ 'application/json': json, 'text/plain': json, }));
				reportSuccess('Copied', 'The JSON data has been put into your clipboard');
			}
		} break;
		case 'import': {
			let string = '';
			if (buttonId.endsWith('file')) {
				const file = (await loadFile({ accept: 'application/json, text/json, .json', }))[0];
				if (!file) { console.log('empty selection'); return; }
				string = (await readBlob(file));
			} else {
				string = window.prompt('Please paste your JSON data below', '');
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
			reportSuccess('Import done', `Imported ${ infos.length } items`);
		} break;
		case 'getSize': {
			const ids = (await data.ids());
			const infos = (await Promise.all(ids.map(id => data.get(id))));
			const thumbs = (await Promise.all(ids.map(id => data.get(id, [ 'thumb', ]))))
			.map(_=>_.thumb).filter(_=>_);
			const size = thumbs.reduce((size, blob) => size + blob.size, 0);
			const json = JSON.stringify(infos);

			const round = (await require.async('node_modules/es6lib/string')).numberToRoundString;

			window.alert(`
				Total #: ${ ids.length }
				Data size: ~${ round(json.length) }B
				Thumbs #: ${ thumbs.length }
				Thumbs size: ~${ round(size) }B
			`.split(/^/gm).map(_=>_.trim()).join('\n'));
		} break;
		case 'clear': {
			if (window.prompt('If you really mean to delete all your user data type "yes" below') !== 'yes') {
				return void reportSuccess('Canceled', 'Nothing was deleted');
			}
			(await db.clear());
			if ((await db.ids()).length === 0) {
				reportSuccess('Data cleared', `It's all gone ...`);
			} else {
				throw new Error(`Failed to delete all data`);
			}
		} break;
		case 'reset': {
			if (!window.confirm('Are you sure that you want to reset all options to their default values?')) { return; }
			options.resetAll();
		} break;

		default: {
			throw new Error('Unhandled command "'+ name +'"');
		}
	}
} catch (error) { reportError(error); } }

}); })(this);
