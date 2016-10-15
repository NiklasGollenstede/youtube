define(`

/*
* always
*/


.watchpage #top>#player,
.watchpage #external_player
{
    position: fixed !important;
    z-index: 999;
    margin: 0px !important;
    padding: 0px !important;
    left: 0px !important;
    top: 0px !important;
    height: 100% !important;
    width: calc(100% - 350px) !important;
}

.watchpage #top>#player #player-container ,
.watchpage #player-container .html5-video-player,
.watchpage #player-container .html5-video-container,
.watchpage #player-container video
{
    width: 100% !important;
    height: 100% !important;
}
.ytp-chrome-bottom {
    display: table;
    margin: 0 auto;
}

.watchpage.fullscreen #container
{ display: none; }

.watchpage.fullscreen #top>#player,
.watchpage.fullscreen #external_player
{
    width: 100% !important;
}

.watchpage.fullscreen #top
{ top: 0 !important; }

paper-toolbar
{
    width: 350px !important;
    left: calc(100% - 350px) !important;
    right: 0 !important;
    top: 0px !important;
    position: fixed !important;
    z-index: 99999 !important;
}
ytd-masthead #end { display: none !important; }
ytd-masthead #search,
ytd-masthead #menu-button
 {
    margin: 0 !important;
}
ytd-masthead #container {
    padding: 0 !important;
}

#top {
    position: fixed !important;
    top: 50px !important;
    left: 0 !important;
    bottom: 0 !important;
    right: 0 !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow-y: auto !important;
    overflow-x: hidden !important;
}

#main {
    display: table !important;
    right: 0 !important;
    top: 0 !important;
    position: absolute !important;
    padding: 200px 0px 0px 0px !important;
}
#main, #main>* {
    width: 344px !important;
}
#main>#meta    { display: table-header-group !important; } /* put to top */
#main>#info {
    position: absolute;
    top: 0;
}
#main>#related {
    width: 100% !important;
    padding: 0 !important;
}

`);