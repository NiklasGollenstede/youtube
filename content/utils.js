(function(global) { 'use strict'; define(({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
}) => {

function getVideoIdFromImageSrc(element) {
	return (
		element.nodeName === "IMG" && element.src
		&& (element.src.match(/(vi\/|vi_webp\/)([\w-_]{11})(?=\/)/) || [ ])[2]
	) || (
		element.style && element.style.backgroundImage
		&& (element.style.backgroundImage.match(/^url.*(vi\/|vi_webp\/)([\w-_]{11})(?=\/)/) || [ ])[2]
	);
}

return { getVideoIdFromImageSrc, };

}); })(this);
