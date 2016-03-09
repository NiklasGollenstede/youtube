'use strict';

const {
	concurrent: { async, promisifyAll, spawn, sleep, timeout, },
	dom: { clickElement, createElement, CreationObserver, notify, once, saveAs, },
	format: { hhMmSsToSeconds, numberToRoundString, timeToRoundString, QueryObject, },
	functional: { noop, Logger, log, },
	object: { copyProperties, },
	network: { HttpRequest, },
} = require('es6lib');

const { storage, } = require('common/chrome');

function setButtonDisabled(element) {
	const container = element.querySelector('.values-container');
	const add = element.querySelector('.add-value-entry');
	if (!add) { return; }
	const min = +add.dataset.minLength, length = container.children.length;
	add.disabled = length >= +add.dataset.maxLength;
	Array.prototype.forEach.call(container.querySelectorAll('.remove-value-entry'), remove => remove.disabled = length <= min);
}

document.addEventListener('click', function({ target, button, }) {
	if (button) { return; }
	if (target.matches && target.matches('.remove-value-entry')) {
		const element = target.parentNode.parentNode.parentNode;
		target.parentNode.remove();
		setButtonDisabled(element);
	} else
	if (target.matches && target.matches('.add-value-entry')) {
		const element = target.parentNode;
		const container = element.querySelector('.values-container');
		container.appendChild(cloneInput(element.input, ''));
		setButtonDisabled(element);
	} else
	if (target.matches && target.matches('.value-entry-input') && target.dataset.type === 'control') {
		console.log('button clicked', target);
	}
});
document.addEventListener('keypress', function(event) {
	const { target, } = event;
	if (!target.matches || !target.matches('.value-entry-input') || target.dataset.type !== 'keybordKey') { return; }
	event.stopPropagation(); event.preventDefault();
	const key = (event.ctrlKey ? 'Ctrl' : '') + (event.altKey ? 'Alt' : '') + (event.shiftKey ? 'Shift' : '') + event.code;
	target.value = key;
});

function createInput(pref) {
	return createElement('div', {
		pref,
		className: 'value-entry-container',
	}, [
		pref.type === 'menulist'
		? createElement('select', {
			name: pref.name,
			className: 'value-entry-input',
			dataset: {
				type: pref.type,
			},
		}, (pref.options || [ ]).map(option => createElement('option', {
			value: option.value,
			textContent: option.label,
		})))
		: createElement('input', {
			name: pref.name,
			className: 'value-entry-input',
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
	]);
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
	return input;
}

function cloneInput(input, value) {
	const clone = input.cloneNode(true);
	clone.pref = input.pref;
	setInputValue(clone, value);
	return clone;
}

function displayPreferences(preferences, values, parent = document.body) {
	parent.textContent = '';
	parent.classList.add('preferences-container');

	preferences.forEach(pref => {
		if (pref.type === 'hidden') { return; }

		const input = createInput(pref);
		const valueEntries = Array.isArray(values[pref.name]) ? values[pref.name] : [ values[pref.name], ];

		const element = parent.appendChild(createElement('div', {
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
			pref.children && createElement('div', { }, [
				displayPreferences(
					pref.children,
					values[pref.name],
					createElement('fieldset', {
						className: values[pref.name] || pref.type == 'label' ? '' : 'disabled',
					})
				),
			]),
		]));

		setButtonDisabled(element);
	});
	return parent;
}


Promise.all([
	storage.local.get('defaultOptions'),
	storage.sync.get('options'),
]).then(([ { defaultOptions, }, { options, }, ]) => displayPreferences(defaultOptions, options));


