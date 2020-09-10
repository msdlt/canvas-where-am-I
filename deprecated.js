// This file contains deprecated functions of the canvas-where-am-I.js code
// We stored them in case we need them in the future.

/*
 * Function to work out when the DOM is ready: https://stackoverflow.com/questions/1795089/how-can-i-detect-dom-ready-and-add-a-class-without-jquery/1795167#1795167
 * and fire off ou_domReady
 */
// Mozilla, Opera, Webkit
/*if ( document.addEventListener ) {
    document.addEventListener( "DOMContentLoaded", function(){
        document.removeEventListener( "DOMContentLoaded", arguments.callee, false);
        ou_domReady();
    }, false );
// If IE event model is used
} else if ( document.attachEvent ) {
    // ensure firing before onload
    document.attachEvent("onreadystatechange", function(){
        if ( document.readyState === "complete" ) {
            document.detachEvent( "onreadystatechange", arguments.callee );
            ou_domReady();
        }
    });
}*/

/*
 * Function which inserts newNode after reeferenceNode From: https://stackoverflow.com/questions/4793604/how-to-insert-an-element-after-another-element-in-javascript-without-using-a-lib
 * @param {HTMLElement } newNode - the node to be inserted
 * @param {HTMLElement } referenceNode - the node after which newNode will be inserted
 */
/* - NOT CURRENTLY USED
function ou_insertAfter(newNode, referenceNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}
*/

/*
 * Get self id - actually only needed to show completion
 */
/* - NOT CURRENTLY USED
function ou_getSelfThenModules() {
    fetch('/api/v1/users/self',{
            method: 'GET',
            credentials: 'include',
            headers: {
                "Accept": "application/json",
            }
        })
        .then(ou_status)
        .then(ou_json)
        .then(function(data) {
            console.log(data);
            //ou_getTileFolder(initCourseId, data.id);
        })
        .catch(function(error) {
            console.log('getSelfId Request failed', error);
        }
    );
}
*/

/*
function ou_handleArrowPress(clickee) {
    // If the clicked element isn't a button which shows a menu

    var menuToShow = document.getElementById(clickee.getAttribute("menu-to-show"));
    if (menuToShow.style.maxHeight){
        menuToShow.style.maxHeight = null;
        console.log(clickee.tagName);
        if(clickee.tagName === "I") {
            clickee.classList.remove("open");
        } else if(clickee.tagName === "A") {
            clickee.children[0].classList.remove("open");
        }

    } else {
        //before we show this one, make sure all the others are closed
        var itemsMenus = document.getElementsByClassName("ou-items-menu");
        Array.prototype.forEach.call(itemsMenus, function(itemsMenu, index) {
            if (itemsMenu.style.maxHeight){
                itemsMenu.style.maxHeight = null;
            }
        });
        var menuButtons = document.getElementsByClassName("icon-mini-arrow-down");
        Array.prototype.forEach.call(menuButtons, function(menuButton, index) {
            menuButton.classList.remove("open");
        });
        menuToShow.style.maxHeight = menuToShow.scrollHeight + "px";
        if(clickee.tagName === "I") {
            clickee.classList.add("open");
        } else if(clickee.tagName === "A") {
            clickee.children[0].classList.add("open");
        }
        //event.target.classList.add("open");
    }
}*/
