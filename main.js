/**
 * Listens for the app launching then creates the window
 *
 * @see http://developer.chrome.com/apps/app.window.html
 */

var win;
function createNewWindow(show) {
	chrome.app.window.create('index.html', {
		id: "mainWin",
		frame: "none",
		width: 500,
		height: 700,
		hidden: !show
	}, function(_win){
		win = _win;
		win.onClosed.addListener(function() {
			win = null;
		});
	});
};
createNewWindow(false);
chrome.app.runtime.onLaunched.addListener(function() {
	if (win != null) {
		win.show();
	} else {
		createNewWindow(true);
	}
});


