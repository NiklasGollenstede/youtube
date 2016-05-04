'use strict';

const {
	concurrent: { async, promisifyAll, spawn, sleep, timeout, },
	dom: { clickElement, createElement, CreationObserver, notify, once, saveAs, },
	format: { hhMmSsToSeconds, numberToRoundString, timeToRoundString, QueryObject, },
	functional: { noop, Logger, log, },
	object: { copyProperties, },
	network: { HttpRequest, },
} = require('es6lib');

const { runtime: { sendMessage, }, applications: { gecko, chromium, }, } = require('common/chrome');
const Storage = chrome.storage.sync ? require('common/chrome').storage.sync : require('common/chrome').storage.local;
const { simplify, } = require('options/utils');
const preferences = copyProperties(require('options/defaults'), [ ]);

const handleResponse = promise => promise.then(({ error, value, }) => { if (error) { throw error; } return value; });
const alert = gecko ? window.alert : message => handleResponse(sendMessage({ name: 'alert', args: [ message, ], }));
const confirm = gecko ? window.confirm : message => handleResponse(sendMessage({ name: 'confirm', args: [ message, ], }));
const prompt = gecko ? window.prompt : (message, value) => handleResponse(sendMessage({ name: 'prompt', args: [ message, value, ], }));

Storage.get('options').then(({ options, }) => {
	displayPreferences(preferences, options, document.querySelector('#options'));
});

document.addEventListener('click', function({ target, button, }) {
	if (button || !target.matches) { return; }
	target.className.split(/\s+/).every(_class => { switch (_class) {
		case 'remove-value-entry': {
			const element = target.parentNode.parentNode.parentNode;
			target.parentNode.remove();
			setButtonDisabled(element);
		} break;
		case 'add-value-entry': {
			const element = target.parentNode;
			const container = element.querySelector('.values-container');
			container.appendChild(cloneInput(element.input, ''));
			setButtonDisabled(element);
		} break;
		case 'value-input': {
			if (target.dataset.type !== 'control') { return; }
			console.log('button clicked', target);
			const { name, } = target.parentNode.pref;
			handleResponse(sendMessage({ name: 'control', args: [ name, ], }))
			.catch(error => { console.error(error); return alert(name +' failed: '+ error.message); });
		} break;
		case 'submit-button': {
			({ save, reset, cancel, })[target.id]()
			.catch(error => { console.error(error); return alert(target.id +' failed: '+ error.message); });
		} break;
		default: { return true; }
	} });
});

document.addEventListener('keypress', function(event) {
	const { target, } = event;
	if (!target.matches || !target.matches('.value-input') || target.dataset.type !== 'keybordKey') { return; }
	event.stopPropagation(); event.preventDefault();
	const key = (event.ctrlKey ? 'Ctrl+' : '') + (event.altKey ? 'Alt+' : '') + (event.shiftKey ? 'Shift+' : '') + event.code;
	target.value = key;
	validate(target);
});
document.addEventListener('change', function({ target, }) {
	if (!target.matches || !target.matches('.value-input')) { return; }
	validate(target);
});

const save = async(function*() {
	console.log('submitting ...');
	const invalid = document.querySelector('.invalid');
	if (invalid) {
		invalid.scrollIntoViewIfNeeded ? invalid.scrollIntoViewIfNeeded() : invalid.scrollIntoView();
		throw new Error('At least one field holds an invalid value: "'+ invalid.title +'"');
	} else {
		Array.prototype.forEach.call(document.querySelectorAll('.pref-container'), element => {
			element.pref.value = Array.isArray(element.pref.value)
			? Array.prototype.map.call(element.querySelectorAll('.value-container'), getInputValue)
			: getInputValue(element.querySelector('.value-container'));
		});
		(yield Storage.set({ options: simplify(preferences), }));
		(yield window.close());
	}
});

const reset = async(function*() {
	if (!(yield confirm('Are you shure that you want to reset all options to their default values?'))) { return; }
	(yield Storage.set({ options: simplify(require('options/defaults')), }));
	location.reload();
});

const cancel = async(function*() {
	(yield window.close());
});

function setButtonDisabled(element) {
	const container = element.querySelector('.values-container');
	const add = element.querySelector('.add-value-entry');
	if (!add) { return; }
	const min = +add.dataset.minLength, length = container.children.length;
	add.disabled = length >= +add.dataset.maxLength;
	Array.prototype.forEach.call(container.querySelectorAll('.remove-value-entry'), remove => remove.disabled = length <= min);
}

function validate(target, value = target.value) {
	const { pref, } = target.parentNode;
	if (target.type === 'checkbox' || pref.type === 'label') { return; }
	const message = pref.validate(value);
	target.title = message;
	target.classList[message ? 'add' : 'remove']('invalid');
}

function createInput(pref) {
	return Object.assign(createElement('div', {
		className: 'value-container',
	}, [
		pref.type === 'menulist'
		? createElement('select', {
			name: pref.name,
			className: 'value-input',
			dataset: {
				type: pref.type,
			},
		}, (pref.options || [ ]).map(option => createElement('option', {
			value: option.value,
			textContent: option.label,
		})))
		: createElement('input', {
			name: pref.name,
			className: 'value-input',
			dataset: {
				type: pref.type,
			},
			type: {
				control: 'button',
				bool: 'checkbox',
				boolInt: 'checkbox',
				integer: 'number',
				string: 'text',
				keybordKey: 'text',
				color: 'color',
				label: 'hidden',
			}[pref.type] || pref.type,
		}),
		pref.unit && createElement('span', {
			textContent: pref.unit,
		}),
		pref.maxLength > 1 && createElement('input', {
			type: 'button',
			value: '-',
			className: 'remove-value-entry',
		}),
	]), {
		pref,
	});
}

function setInputValue(input, value) {
	const { pref, firstChild: field, } = input;
	switch (pref.type) {
		case "control":
			field.value = pref.label;
			break;
		case "bool":
			field.checked = value;
			break;
		case "boolInt":
			field.checked = (value === pref.on);
			break;
		case "menulist": {
			const options = Array.from(field);
			options.forEach(option => option.selected = false);
			const selected = options.find(option => option.value == value);
			selected && (selected.selected = true);
		} break;
		case "label":
			break;
		default:
			field.value = value;
			break;
	}
	validate(field, value);
	return input;
}

function getInputValue(input) {
	const { pref, firstChild: field, } = input;
	switch (pref.type) {
		case "control":
			return undefined;
		case "bool":
			return field.checked;
		case "boolInt":
			return field.checked ? pref.on : pref.off;
		case "integer":
			return +field.value;
		case "label":
			return undefined;
		default:
			return field.value;
	}
}

function cloneInput(input, value) {
	const clone = input.cloneNode(true);
	clone.pref = input.pref;
	setInputValue(clone, value);
	return clone;
}
function createValidator({ restrict, parent, }) {
	if (!restrict) { return () => ''; }
	if (restrict === 'inherit') { return parent.validate; }
	return function(value) {
		if ('from' in restrict && value < restrict.from) { return 'This value must be at least '+ restrict.from; }
		if ('to' in restrict && value > restrict.to) { return 'This value can be at most '+ restrict.to; }
		if ('match' in restrict && !restrict.match.test(value)) { return restrict.message ? restrict.message : ('This value must match '+ restrict.match); }
		return '';
	};
}

function displayPreferences(prefs, values, host = document.body, parent = null) {

	prefs.forEach(pref => {
		pref.parent = parent;
		pref.validate = createValidator(pref);
		if (pref.type === 'hidden') { return; }

		const input = createInput(pref);
		const valueEntries = Array.isArray(values[pref.name]) ? values[pref.name] : [ values[pref.name], ];

		const element = Object.assign(host.appendChild(createElement('div', {
			input,
			className: 'pref-container type-'+ pref.type,
		}, [
			createElement('h1', {
				textContent: pref.title || pref.name,
			}),
			pref.description && createElement('h3', {
				textContent: pref.description,
			}),
			createElement('div', {
				className: 'values-container',
			}, valueEntries.map(entry => cloneInput(input, entry))),
			pref.maxLength > 1 && createElement('input', {
				type: 'button',
				value: '+',
				className: 'add-value-entry',
				dataset: {
					maxLength: pref.maxLength,
					minLength: pref.minLength || 0,
				},
			}),
			pref.children && displayPreferences(
				pref.children,
				values[pref.name],
				createElement('fieldset', {
					className: 'pref-children'+ (values[pref.name] || pref.type === 'label' ? '' : 'disabled'),
				}),
				pref
			),
		])), { pref, });

		setButtonDisabled(element);
	});
	return host;
}
