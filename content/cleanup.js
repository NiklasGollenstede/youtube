
// on the next load new modules need to be loaded
console.log('deleting require');
delete window.require;
delete window.define;
