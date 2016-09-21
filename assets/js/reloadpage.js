/**
console.log("/LiquiZ2/WebContent/demos/QuizDemo_ajax.jsp");

function reqListener() {
  console.log(this.responseText);
}

var oReq = new XMLHttpRequest();
oReq.addEventListener("load", reqListener);
oReq.open("GET", "http://localhost/LiquiZ2/WebContent/demos/QuizDemo_ajax.jsp");
oReq.send();
*/
var AppInternals = {};
AppInternals.reload = function (e) {
  var key = e.which || e.keyCode;
  if (key == 82 && (e.metaKey || e.ctrlKey))
    chrome.runtime.reload();
};

AppInternals.onLoad = function(){
  var reloadLink = document.getElementById("reload-title");
  reloadLink.onclick = function(){
    chrome.runtime.reload();
    return false;
  };
};

window.addEventListener("keydown", AppInternals.reload);
window.addEventListener("load", AppInternals.onLoad);