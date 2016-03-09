'use strict'; define('content/utils', function() {

function getVideoIdFromImageSrc(element) {
	return (
		element.nodeName == "IMG" && element.src
		&& (element.src.match(/(vi\/|vi_webp\/)([\w-_]{11})(?=\/)/) || [ ])[2]
	) || (
		element.style && element.style.backgroundImage
		&& (element.style.backgroundImage.match(/^url.*(vi\/|vi_webp\/)([\w-_]{11})(?=\/)/) || [ ])[2]
	);
}

return { getVideoIdFromImageSrc, };

});
