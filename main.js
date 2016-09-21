chrome.app.runtime.onLaunched.addListener(function (launchData) {
  chrome.app.window.create('index.html',{frame:'none',width:854,height:480}, function(win) {
//    chrome.app.window.create('index.html',{frame:'none',left:0,top:0,width:640,height:360}, function(win) {
    win.contentWindow.launchData = launchData;
    
  });
});
