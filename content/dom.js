(function(global) { 'use strict'; define(async ({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/dom': { createElement, },
	'node_modules/es6lib/object': { MultiMap, },
	'node_modules/web-ext-utils/loader/content': { onUnload, },
}) => { /* global document, */


{ const old = document.querySelector('#yt-overhaul-styles'); old && old.remove(); } // Firefox + content unload => -.-
const styles = document.head.appendChild(createElement('span', { id: 'yt-overhaul-styles', }));
const nodesCapture = new Map/*<Node, MultiMap<event, listener>*/;
const nodesBubble = new Map/*<Node, MultiMap<event, listener>*/;

onUnload.addListener(() => {
	styles.remove();

	[ nodesCapture, nodesBubble, ]
	.forEach(nodeMap => {
		const capture = nodeMap === nodesCapture;
		nodeMap.forEach((listeners, node) => {
			listeners.forEach((range, type) => range.forEach(listener => {
				node.removeEventListener(type, listener, capture);
			}));
			listeners.clear();
		});
		nodeMap.clear();
	});
});

return {
	setStyle(id, css) {
		let style = styles.querySelector('#'+ id);
		if (!style) {
			if (css == null) { return null; }
			style = styles.appendChild(createElement('style', { id, }));
		} else if (css == null) { style.remove(); return null; }
		style.textContent = css;
		return style;
	},
	on(node, type, listener, capture) {
		const nodeMap = (capture ? nodesCapture : nodesBubble);
		let listeners = nodeMap.get(node); if (!listeners) { listeners = new MultiMap; nodeMap.set(node, listeners); }
		listeners.add(type, listener);
		node.addEventListener(type, listener, !!capture);
		return listener;
	},
	off(node, type, listener, capture) {
		const nodeMap = (capture ? nodesCapture : nodesBubble);
		const listeners = nodeMap.get(node);
		listeners && listeners.delete(type, listener);
		node.removeEventListener(type, listener, !!capture);
		return node;
	},
};

}); })(this);
