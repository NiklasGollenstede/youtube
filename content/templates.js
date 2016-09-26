(() => { 'use strict'; define(function({ // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.
	'node_modules/es6lib/string': { secondsToHhMmSs, numberToRoundString, timeToRoundString, encodeHtml, },
	utils: { getVideoIdFromImageSrc, },
}) {

const transformVars = transformer => function urlToHtml(strings, ...vars) {
	const ret = Array(vars.length);
	for (let i = 0; i < vars.length; ++i) {
		ret[i] = strings[i] + transformer(vars[i]);
	}
	return ret.join('') + strings[strings.length - 1];
};

const urlToHtml = transformVars(value => encodeHtml(decodeURI(value).replace(/\+/g, ' ')));

const stringToHtml = transformVars(encodeHtml);

const Templates = ({

	commentsIframe: (videoId, onLoad) => (stringToHtml`
<iframe
	id="external_comments"
	data-video-id="${ videoId }"
	class="yt-card yt-card-has-padding"
	type="text/html"
	frameborder="0"
	style="
		position: relative;
		height: 100%;
		width: 100%;
		margin-bottom: 0px !important;
	"
	src="https://www.youtube.com/all_comments?v=${ videoId }"
/>`
	),

	youtubeIframe: videoId => (stringToHtml`
<iframe
	id="external_player"
	data-videoid="${ videoId }"
	class="player-width player-height"
	type="text/html"
	frameborder="0"
	style="
		position: relative;
		height: 100%;
		width: 100%;
	"
	src="//www.youtube.com/embed/${ videoId }?autoplay=1"
	allowfullscreen
/>`
	),

	relatedVideoList: items => (`
<div class="watch-sidebar-section">
	<div class="watch-sidebar-body">
		<ul id="watch-related" class="video-list">
			${ typeof items === 'string' ? items : items.join('') }
		</ul>
	</div>
</div>
`	),

	relatedVideoListItem: ({ id, title, author, length_seconds, video_id, list, playlist_length, playlist_title, playlist_author }) => (
			id ? (urlToHtml`
<li class="video-list-item related-list-item">
	<div class="content-wrapper">
		<a href="/watch?v=${ id }" class=" content-link spf-link  yt-uix-sessionlink" rel="spf-prefetch" title="${ title }">
			<span dir="ltr" class="title">${ title }</span>
			<span class="stat attribution">
				<span class="g-hovercard">
					<span class=" g-hovercard" data-name="">${ author }</span>
				</span>
			</span>
		</a>
	</div>
	<div class="thumb-wrapper">
		<a href="/watch?v=${ id }" class=" thumb-link spf-link  yt-uix-sessionlink" tabindex="-1" rel="spf-prefetch" aria-hidden="true">
			<span class="yt-uix-simple-thumb-wrap yt-uix-simple-thumb-related" tabindex="0" data-vid="${ id }">
				<img alt="" aria-hidden="true" src="//i.ytimg.com/vi/${ id }/default.jpg" width="120" height="90">
			</span>
		</a>
		<span class="video-time">${ secondsToHhMmSs(length_seconds) }</span>
	</div>
</li>`
		) : (urlToHtml`
<li class="video-list-item related-list-item show-video-time">
	<a href="/watch?v=${ video_id }&amp;list=${ list }" class="related-playlist yt-pl-thumb-link  spf-link  yt-uix-sessionlink" rel="spf-prefetch">
		<span class="yt-pl-thumb  is-small yt-mix-thumb">
			<span class="video-thumb  yt-thumb yt-thumb-120">
				<span class="yt-thumb-default">
					<span class="yt-thumb-clip">
						<img aria-hidden="true" alt="" src="//i.ytimg.com/vi/${ video_id }/default.jpg" width="120">
						<span class="vertical-align"></span>
					</span>
				</span>
			</span>
			<span class="sidebar">
				<span class="yt-pl-sidebar-content yt-valign">
					<span class="yt-valign-container">
						<span class="formatted-video-count-label">
							<b>${ playlist_length }</b> Videos
						</span>
						<span class="yt-pl-icon yt-pl-icon-reg yt-sprite"></span>
					</span>
				</span>
			</span>
			<span class="yt-pl-thumb-overlay">
				<span class="yt-pl-thumb-overlay-content">
					<span class="play-icon yt-sprite"></span>
					<span class="yt-pl-thumb-overlay-text">
						Play all
					</span>
				</span>
			</span>
		</span>
		<span dir="ltr" class="title">${ playlist_title }</span>
		<span class="stat attribution">
			by <span class=" g-hovercard" data-name="">${ playlist_author }</span>
		</span>
	</a>
</li>`
		)
	),

	ratingsBar: (likes, dislikes, total = ((likes + dislikes) || 1)) => (stringToHtml`
<div class="video-extras-sparkbarks inserted-ratings">
	<div class="video-extras-sparkbar-likes" style="
		width: ${ ((100 * likes) / total) }%
	"></div>
	<div class="video-extras-sparkbar-dislikes" style="
		width: ${ ((100 * dislikes) / total) }%
	"></div>
</div>`
	),

	videoInfoTitle: (likes, dislikes, views, published, viewed, duration) => (
		  numberToRoundString(views, 2) +': '
		+ likes.toLocaleString() +' \uD83D\uDC4D, '
		+ dislikes.toLocaleString() +' \uD83D\uDC4E '
		+ (published ? '['+ timeToRoundString(Date.now() - published, 1.7) +' \uD83D\uDD52] ' : '')
		+ (viewed ? (duration ? (viewed / duration).toFixed(1).replace('.0', '') +' \u21bb ' : timeToRoundString(viewed * 1000, 1.7) +' ') : '')
	),

});

return (Templates.Templates = Templates);

}); })();
