'use strict';

const {
	concurrent: { async, promisifyAll, spawn, sleep, timeout, },
	dom: { clickElement, createElement, CreationObserver, notify, once, saveAs, },
	format: { hhMmSsToSeconds, numberToRoundString, timeToRoundString, QueryObject, },
	functional: { noop, Logger, log, },
	object: { copyProperties, },
	network: { HttpRequest, },
} = require('es6lib');

const { storage: { sync: Storage }, runtime: { sendMessage, }, } = require('common/chrome');
const { simplify, } = require('options/utils');
const preferences = require('options/defaults');

function setButtonDisabled(element) {
	const container = element.querySelector('.values-container');
	const add = element.querySelector('.add-value-entry');
	if (!add) { return; }
	const min = +add.dataset.minLength, length = container.children.length;
	add.disabled = length >= +add.dataset.maxLength;
	Array.prototype.forEach.call(container.querySelectorAll('.remove-value-entry'), remove => remove.disabled = length <= min);
}

document.addEventListener('click', function({ target, button, }) {
	if (button || !target.matches) { return; }
	if (target.matches('.remove-value-entry')) {
		const element = target.parentNode.parentNode.parentNode;
		target.parentNode.remove();
		setButtonDisabled(element);
	} else
	if (target.matches('.add-value-entry')) {
		const element = target.parentNode;
		const container = element.querySelector('.values-container');
		container.appendChild(cloneInput(element.input, ''));
		setButtonDisabled(element);
	} else
	if (target.matches('.value-input') && target.dataset.type === 'control') {
		console.log('button clicked', target);
	}
});
document.addEventListener('submit', function(event) {
	event.preventDefault(); event.stopPropagation();
	console.log('submitting ...');
	const invalid = document.querySelector('.invalid');
	if (invalid) {
		invalid.scrollIntoViewIfNeeded();
		sendMessage({ name: 'alert', args: [ 'Saving failed because at least one field holds an invalid value: "'+ invalid.title +'"', ], })
		.then(value => console.log('... failed'));
	} else {
		Array.prototype.forEach.call(document.querySelectorAll('.pref-container'), element => {
			element.pref.value = Array.isArray(element.pref.value)
			? Array.prototype.map.call(element.querySelectorAll('.value-container'), getInputValue)
			: getInputValue(element.querySelector('.value-container'));
		});
		console.log('saving', preferences);
		console.log('as', simplify(preferences));
		Storage.set({ options: simplify(preferences), })
		.then(() => window.close());
	}
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

function validate(target, value = target.value) {
	if (target.type === 'checkbox') { return; }
	const { pref, } = target.parentNode;
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
		case "menulist":
			Array.prototype.map.call(field, option => (option.selected = false) || option)
			.find(option => option.value == value).selected = true;
			break;
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

		const element = Object.assign(host.appendChild(createElement('form', {
			input,
			className: 'pref-container',
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
					className: 'pref-children'+ (values[pref.name] || pref.type == 'label' ? '' : 'disabled'),
				}),
				pref
			),
		])), { pref, });

		setButtonDisabled(element);
	});
	return host;
}

Storage.get('options').then(({ options, }) => displayPreferences(
	preferences, options,
	document.body.appendChild(createElement('form'))
).appendChild(createElement('button', {
	textContent: 'Save',
	type: 'submit',
})));

