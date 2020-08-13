/**
 * This adds additional javascript/css from a web server on local to a Canvas instance.
 * This is useful when doing theme development as you can edit the themes locally and see the changes
 * straight away without having to upload the changed files to a Canvas Theme.
 */
(function(){
  // The URL of the development web-server
  var url = "https://localhost:3000";
  var appendTo = document.getElementsByTagName('body');
  if (appendTo && appendTo.length !== 0) {
    var script = document.createElement("script");
    script.setAttribute("src", url+ "/canvas-where-am-I.js");
    script.setAttribute("type", "text/javascript");
    script.setAttribute("async",true);
    appendTo[0].appendChild(script);

    var link = document.createElement("link");
    link.setAttribute("href", url+ "/canvas-where-am-I.css");
    link.setAttribute("rel", "stylesheet");
    link.setAttribute("media", "all");
    appendTo[0].appendChild(link);
    console.log("Adding dynamic theme, this should never be enabled in a production theme.")
  }
})();