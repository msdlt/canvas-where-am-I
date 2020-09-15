/**** TODO LIST ****/
// TODO Check that we have added icons for all itemTypes
// TODO Functionise a bit more - a lot of work done in ou_getModules to avoid having multiple for loops steping through Modules/Items
// TODO Check that we haven't lost any of Canvas's accessibility features
// TODO investigate whether we could limit Module titles in LH menu to e.g two lines
// TODO can we refresh menu when editing Modules?

(async function () {  //method from: https://community.canvaslms.com/thread/22500-mobile-javascript-development

    /****************************************/
    /**** Start of Configuration Section ****/
    /****************************************/

    /* Amazon S3 bucket URL, this URL is needed to retrieve the course presentation and navigation settings */
    const amazonS3bucketUrl = `https://oxctl-modules.s3-eu-west-1.amazonaws.com`;

    const noOfColumnsPerRow = 4;  //no of columns per row of tiles at top of Modules page - 1, 2, 3, 4, 6 or 12 - ONLY USE 4 for the moment
    /* colours for Module tiles mostly randomly selected from: https://www.ox.ac.uk/public-affairs/style-guide/digital-style-guide */
    const moduleColours = [
        '#e8ab1e','#91b2c6','#517f96','#1c4f68',
        '#400b42','#293f11','#640D14','#b29295',
        '#002147','#cf7a30','#a79d96','#aab300',
        '#872434','#043946','#fb8113','#be0f34',
        '#a1c4d0','#122f53','#0f7361','#3277ae',
        '#44687d','#517fa4','#177770','#be0f34',
        '#d34836','#70a9d6','#69913b','#d62a2a',
        '#5f9baf','#09332b','#44687d','#721627',
        '#9eceeb','#330d14','#006599','#cf7a30',
        '#a79d96','#be0f34','#001c3d','#ac48bf',
        '#9c4700','#c7302b','#ebc4cb','#1daced'
    ];

    // var showItemLinks = 1; //whether or not to show drop-down links to items within Modules in tiles NOTE: Currently disabled - need to read this: https://www.w3.org/WAI/tutorials/menus/application-menus-code/ for how to do it accessibly

    const widthOfButton = 42;  //width of a Progress bar button //TODO - calculate this
    const widthOfCentreColPadding = 72; //used to calculate whether enough room to show Progress bar buttons //TODO - calculate this
    // const widthOfPositionWords = 134; //used to calculate whether enough room to show Progress bar buttons //TODO - calculate this
    const allowMultilineModuleTitles = false; //whether to allow LH menu Module links to be multiline

    /* DOM elements to check for */
    // The structure hierarchy in Canvas is content > course_home_content > context_modules_sortable_container
    const divCourseHomeContent = document.getElementById('course_home_content');  //is this page Home
    const divContent = document.getElementById('content');
    const divContextModulesContainer = document.getElementById('context_modules_sortable_container');  //are we on the Modules page
    // Contains the Modules link in the LHS Menu (left hand side).
    // This doesn't match if the modules page is hidden for the students.
    // Gets the modules link by class, more optimal than the text content if the course language is not english <a class='modules' href="xxx"/>
    const lhsModulesLink = document.querySelector('li.section a.modules');
    const lhsModulesListItem = lhsModulesLink ? lhsModulesLink.parentNode : null

    /* Global variables */
    var divFooterContent;

    /* Working out and storing where we are in Course */
    var moduleIdByModuleItemId = []; //used to store moduleIds using the ModuleItemId (as shown in url for pages, etc) so we can show active sub-modules {moduleId: x, moduleName: x, progress: x}
    var moduleItemsForProgress = []; //used to store details of module items so can show as dots, if enough space, at bottom of page {href: string, title: string: icon: string, current: bool} - keyed first by module

    /* Context variables */
    const initCourseId = ou_getCourseId();  //which course are we in ONLY WORKS ON WEB
    const initDomainId = ou_getDomainRootAccountId(); // The domain ID.
    const initModuleItemId = ou_getModuleItemId();  //0 or module_item_id from URL (ie only if launched through Modules)
    const initModuleId = ou_getModuleId();  //0 or module being viewed within Modules page

    /****************************************/
    /**** End of Configuration Section ******/
    /****************************************/

    /****************************************/
    /***** Start function main thread *******/
    /****************************************/

    // We must abort if the script cant get the initCourseId or the initDomainId.
    if (!initCourseId || !initDomainId) {
      return;
    }

    const isTileViewEnabled = await ou_CheckSettings(initDomainId, initCourseId);
    // Only perform the course presentation and navigation logic if it is enabled in the course CPN settings.
    if (!isTileViewEnabled) {
      return;
    }

    // We're inside a specific modules, hide the other Modules
    if(initModuleId) {
        ou_hideOtherModules(initModuleId);
    }

    const courseModules = await ou_getModules(initCourseId);
    const isCourseHome = divContextModulesContainer && !initModuleId && divCourseHomeContent;
    // If the user is in the course home and contains modules, replace the standard view by the tile view.
    if (isCourseHome) {
      ou_replaceStandardByTileView(courseModules, divContent, divCourseHomeContent);
    }

    // Add the submenu of modules to the LHS menu if the modules list item is visible.
    if (lhsModulesListItem) {
      ou_buildModulesSubmenu(courseModules, lhsModulesListItem, initCourseId, initModuleId, initModuleItemId, allowMultilineModuleTitles);
    }

    ou_performLogic(courseModules, isCourseHome);


    /****************************************/
    /***** End function main thread *********/
    /****************************************/

    /****************************************/
    /***** Start of function definitions ****/
    /****************************************/

    /*
     * Checks if the CPN view is enabled requesting the CPN settings from the Amazon S3 bucket.
     */
    async function ou_CheckSettings(initDomainId, initCourseId) {
      const settingsFileRequestUrl = `${amazonS3bucketUrl}/${initDomainId}/${initCourseId}.json`;
      const isTileViewEnabled = await fetch(settingsFileRequestUrl)
        .then(ou_json)
        .then(function(json) {
            const isTileViewEnabled = json['modules-navigation'];
            console.log('Modules Navigation Enabled: ' + isTileViewEnabled);
            return isTileViewEnabled;
        })
        .catch(function(error) {
            console.log('Failed to load settings');
            return false;
        });
        return isTileViewEnabled;
    }

    /*
     * Gets the module objects for a courseId querying the Canvas API.
     * https://canvas.instructure.com/doc/api/modules.html#Module
     */
    async function ou_getModules(courseId) {
      // Added &per_page=100, otherwise only returns the first 10
      const moduleRequest = `/api/v1/courses/${courseId}/modules?include=items&per_page=100`;
      const courseModules = await fetch(moduleRequest, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        }
      }).then(ou_status)
      .then(ou_json)
      .then((moduleArray) => {return moduleArray;})
      .catch(function(error) {
        console.log('Failed to get course modules', error);
        return [];
      });
      return courseModules
    }

    /*
     * Replaces the standard view of the course home modules by the tile view.
     */
    function ou_replaceStandardByTileView(moduleArray, contentDiv, homeContentDiv) {
      // Hide the current home content div.
      homeContentDiv.style.display = 'none';

      const moduleNavId = 'module_nav';
      //First delete any existing nav container
      let existingModuleNav = document.getElementById(moduleNavId);
      if (existingModuleNav) {
          existingModuleNav.parentNode.removeChild(existingModuleNav);
      }
      //Create our nav container
      let moduleNav = document.createElement('div');
      moduleNav.id = moduleNavId;
      moduleNav.className = 'ou-ModuleCard__box';
      moduleNav.innerHTML = '<a id="module_nav_anchor"></a>';
      // Insert moduleNav onto page
      contentDiv.insertBefore(moduleNav, contentDiv.childNodes[0]);

      let newRow;
      moduleArray.forEach((module, mindex) => {
        //create row for card
        if (mindex % noOfColumnsPerRow === 0) {
            newRow = document.createElement('div');
            newRow.className = 'grid-row center-sm';
            moduleNav.appendChild(newRow);
        }

        var newColumn = document.createElement('div');

        // create column wrapper
        newColumn.className = 'col-xs-12 col-sm-6 col-lg-3'; //TODO work out classes for noOfColumnsPerRow != 4
        newRow.appendChild(newColumn);

        //create module div
        let moduleTile = document.createElement('div');
        moduleTile.className = 'ou-ModuleCard';
        moduleTile.title = module.name;

        let moduleTileLink = document.createElement('a');
        moduleTileLink.href = `/courses/${initCourseId}/modules/${module.id}`;

        let moduleTileHeader = document.createElement('div');
        moduleTileHeader.className = 'ou-ModuleCard__header_hero_short';
        moduleTileHeader.style.backgroundColor = moduleColours[mindex];

        let moduleTileContent = document.createElement('div');
        moduleTileContent.className = 'ou-ModuleCard__header_content';

        var moduleTileTitle = document.createElement('div');
        moduleTileTitle.classList.add('ou-ModuleCard__header-title');
        moduleTileTitle.classList.add('ellipsis');
        moduleTileTitle.title = module.name;
        moduleTileTitle.style.color = moduleColours[mindex];
        moduleTileTitle.innerHTML = module.name;

        // Only leave space for actions if we're adding them
        moduleTileTitle.classList.add('ou-no-actions');

        moduleTileContent.appendChild(moduleTileTitle);
        moduleTileLink.appendChild(moduleTileHeader);
        moduleTileLink.appendChild(moduleTileContent);
        moduleTile.appendChild(moduleTileLink);
        newColumn.appendChild(moduleTile);

      });

    }

    /*
     * Builds the modules submenu adding all the modules as children of the Modules tool.
     */
    function ou_buildModulesSubmenu(moduleArray, moduleListItem, courseId, moduleId, moduleItemId, allowMultipleModuleTitles) {
      // The containing element for the modules sub-menu
      let moduleSubmenuList = document.createElement('ul');
      moduleSubmenuList.className = 'ou-section-tabs-sub';

      moduleArray.forEach((module, mindex) => {
        // Create a new item for the submodule list.
        let newItem = document.createElement('li');
        newItem.className = 'ou-section-sub';

        // Create a new Link for the submodule item.
        let newLink = document.createElement('a');
        newLink.className = 'ou-section-link-sub';
        newLink.title = module.name;
        newLink.href = `/courses/${courseId}/modules/${module.id}`;
        newLink.innerHTML = module.name;
        if (allowMultipleModuleTitles) {
            newLink.classList.add('ou-multiline');
        }

        // Check if the moduleItemId belongs to this module.
        const currentModuleItem = module.items.find(item => item.id === parseInt(moduleItemId))
        // Check if we need to make one of our sub-menu modules active
        if (module.id === parseInt(moduleId) || currentModuleItem) {
            // Remove the 'active' class of the current menu option.
            const activeOptionMenu = document.querySelector('li.section > a.active');
            activeOptionMenu.classList.remove('active');
            // Make the current Module active
            newLink.classList.add('active');
        }

        // Append the link to the submenu item.
        newItem.appendChild(newLink);
        // Append the submenu item to the submenu list.
        moduleSubmenuList.appendChild(newItem);
      });

      moduleListItem.appendChild(moduleSubmenuList);

    }

    function ou_performLogic(moduleArray, isCourseHome) {
      // moduleArray contains an array of Module objects
      // note - combining creation of lh modules sub-menu and Module tiles on Modules page to avoid repeated loops through data
      // set up some things before we begin going through Modules

      //run through each module
      moduleArray.forEach(function(module, mindex) {

          moduleItemsForProgress[module.id] = [];

          //If we're on a page launched via Modules, initModuleItemId != 0 so or if we have launched the whole Modules page (ie need menu at top)
          if (initModuleItemId || isCourseHome) {
              module.items.forEach( function(item, iindex){
                  if (item.type !== 'SubHeader') { //don't want these represented anywhere - on Modules tiles dropdowns OR in progress buttons
                      //TODO factor in the number of Text Headers before calculating % complete
                      //var progressAsPercentage = Math.round(((iindex+1)/module.items.length)*100);

                      var tempObj = {
                          moduleId: item.module_id,
                          moduleName: module.name/*,
                          progress: progressAsPercentage */
                      };

                      moduleIdByModuleItemId[parseInt(item.id)] = tempObj; //for deciding which sub-module on lh menu is active

                      // var itemTitle = item.title;
                      var itemId = item.id;
                      var itemType = item.type;
                      var iconType = ou_getItemTypeIcon(itemType);

                      var listItem = document.createElement('li');
                      listItem.className = 'ou-menu-item-wrapper';

                      const listItemDest = `/courses/${initCourseId}/modules/items/${itemId}`;
                      // note only want to do this for current module
                      var isCurrentItem = parseInt(initModuleItemId) == parseInt(item.id);
                      var tempNavObj = {
                          href: listItemDest,
                          title: item.title,
                          icon: iconType,
                          current: isCurrentItem
                      };

                      moduleItemsForProgress[module.id][iindex] = tempNavObj;

                      /*
                      var listItemLink = document.createElement('a');
                      listItemLink.className = iconType;
                      listItemLink.href = listItemDest;
                      listItemLink.text = itemTitle;
                      listItemLink.tabindex = -1;
                      listItemLink.setAttribute('role', 'menuitem');
                      listItemLink.title = itemTitle;

                      listItem.appendChild(listItemLink);

                      if(divContextModulesContainer && showItemLinks) {
                          moduleTileList.appendChild(listItem);
                      } else {
                          //note only want to do this for current module
                          var isCurrentItem = parseInt(initModuleItemId) == parseInt(item.id);
                          var tempNavObj = {
                              href: listItemDest,
                              title: item.title,
                              icon: iconType,
                              current: isCurrentItem
                          };
                          moduleItemsForProgress[module.id][iindex] = tempNavObj;
                      }
                      */
                  }
              });
          }
      });


      //now add Progress Bar
      setTimeout(ou_showProgressBar, 100); //timeout to ensure all elements have really loaded before running

      //click event listener for module tile buttons
      /*
      document.addEventListener('click', function (event) {
          if (!event.target.getAttribute('menu-to-show')) return;
          // Don't follow the link
          event.preventDefault();
          ou_handleArrowPress(event.target);

      }, false);

      document.addEventListener('keydown', function (event) {
          if (event.target.getAttribute('menu-to-show')) {
              if (event.keyCode == 13 || event.keyCode == 32 || event.keyCode == 38 || event.keyCode == 40) {
                  event.preventDefault();
                  event.stopPropagation();
                  ou_handleArrowPress(event.target);
                  return false;
              }
          }
      }, false);
      */
    }

    /*
     * Function which shows progress bar between Next and Previous buttons IF item shown as part of Module
     */
    function ou_showProgressBar() {
        //can't get footer too early as getElementsByClassName doesn't seem to work as arly as byId
        var footerContents = document.getElementsByClassName('module-sequence-footer-content');
        if (footerContents.length > 0) {
            divFooterContent = footerContents[0];
        }

        if(divFooterContent && initModuleItemId) {
            //we have a footer and we're viewing via Modules
            var progressBarContainer = document.createElement('div');
            progressBarContainer.classList.add('ou-ProgBarContainer');
            var divProgLeftCol = document.createElement('div');
            divProgLeftCol.classList.add('ou-ProgLeftCol');
            var divProgRightCol = document.createElement('div');
            divProgRightCol.classList.add('ou-ProgRightCol');
            progressBarContainer.appendChild(divProgLeftCol);
            progressBarContainer.appendChild(divProgRightCol);

            //Progress bar itself

            //Now create flexible divs to pop progress bar and next and previous buttons into
            //1. Ceate div with one flexible and two inflexible divs at either end
            var divColContainer = document.createElement('div');
            divColContainer.classList.add('ou-ColContainer');
            var divLeftCol = document.createElement('div');
            divLeftCol.classList.add('ou-LeftCol');
            var divCentreCol = document.createElement('div');
            divCentreCol.classList.add('ou-CentreCol');
            var divRightCol = document.createElement('div');
            divRightCol.classList.add('ou-RightCol');
            //2. Move buttons if present - awkwardly, pevious is just a link and next sits in span -  into the two inflexible ends
            divColContainer.appendChild(divLeftCol);
            divColContainer.appendChild(divCentreCol);
            divColContainer.appendChild(divRightCol);
            //3. Place new progressBarContainer in the middle flexible div
            divFooterContent.appendChild(divColContainer);

            //first work out whether have enough room for the progress buttons - if not, show bar
            var progressIconsLarge = true;
            if ((moduleItemsForProgress[moduleIdByModuleItemId[initModuleItemId].moduleId].length * widthOfButton) > (divCentreCol.offsetWidth - widthOfCentreColPadding)) {
                progressIconsLarge = false;
            }

            //create individual progress buttons version
            var divProgressIcons = document.createElement('div');
            divProgressIcons.className = 'ou-progress-icons';
            var noOfItems = moduleItemsForProgress[moduleIdByModuleItemId[initModuleItemId].moduleId].length;
            var divProgressItems = document.createElement('ul');
            divProgressItems.className = 'ou-progress-items';
            /*
            if (progressIconsLarge) {
                divProgressItems.className = 'ou-progress-items';
            } else {
                divProgressItems.className = 'ou-progress-items small';
            }
            */

            moduleItemsForProgress[moduleIdByModuleItemId[initModuleItemId].moduleId].forEach( function(item, index) {
                var listItem = document.createElement('li');
                var listItemLink = document.createElement('a');
                if (progressIconsLarge) {
                    listItem.className = 'ou-progress-item';
                    listItemLink.classList.add(item.icon);
                } else {
                    listItem.className = 'ou-progress-item small';
                    //calculate % size
                    var itemWidth = (divCentreCol.offsetWidth - widthOfCentreColPadding) / noOfItems;
                    if (itemWidth > 30) { //keeps it sqaure
                        itemWidth = 30;
                    }
                    listItem.style.width = itemWidth + 'px';
                    //listItemLink.classList.add(item.icon);
                }
                if(item.current) {
                    listItemLink.classList.add('active');
                }
                listItemLink.href = item.href;
                listItemLink.setAttribute('role', 'menuitem');
                listItemLink.title = item.title;
                listItem.appendChild(listItemLink);
                divProgressItems.appendChild(listItem);
            });

            divProgressIcons.appendChild(divProgressItems);

            //create bar version
            /*
            var divProgressBar = document.createElement('div');
            divProgressBar.classList.add('ou-ProgressBar');
            divProgressBar.setAttribute('aria-valuemax', 100);
            divProgressBar.setAttribute('aria-valuemin', 0);
            divProgressBar.setAttribute('aria-valuenow', moduleIdByModuleItemId[initModuleItemId].progress);
            var divProgressBarBar = document.createElement('div');
            divProgressBarBar.classList.add('ou-ProgressBarBar');
            divProgressBarBar.style.width = moduleIdByModuleItemId[initModuleItemId].progress +'%';
            divProgressBar.setAttribute('title', 'Position in: ' + moduleIdByModuleItemId[initModuleItemId].moduleName + ' = ' + moduleIdByModuleItemId[initModuleItemId].progress +'%');
            //divProgressBar.setAttribute('data-html-tooltip-title', moduleIdByModuleItemId[initModuleItemId].moduleName + ': ' + moduleIdByModuleItemId[initModuleItemId].progress +'%');
            divProgressBar.appendChild(divProgressBarBar);
            //Wording
            var divProgressLabel = document.createElement('div');
            divProgressLabel.textContent = 'Position in module: '
            */


            //look for Previous button
            var previousButton = document.querySelector('a.module-sequence-footer-button--previous');
            // var previousButtonTop;  //disabled at the moment as Canvas had very non-standard headers
            if (previousButton) {
                divLeftCol.appendChild(previousButton);
                /*
                previousButtonTop = previousButton.cloneNode(true);
                previousButtonTop.classList.add('ou-PreviousTop'); //make space on right
                */
            }
            //look for Next button
            var nextButton = document.querySelector('span.module-sequence-footer-button--next');
            //var nextButtonTop; //disabled at the moment as Canvas had very non-standard headers
            if (nextButton) {
                divRightCol.appendChild(nextButton);
                //nextButtonTop = nextButton.cloneNode(true);
                //nextButtonTop.classList.add('ou-NextTop'); //make space on right
            }

            divCentreCol.appendChild(divProgressIcons);

            //Now work out whether have enough room for the progress buttons - if not, show bar
            /*
            if((moduleItemsForProgress[moduleIdByModuleItemId[initModuleItemId].moduleId].length * widthOfButton) < (divCentreCol.offsetWidth - widthOfCentreColPadding)) {
                divCentreCol.appendChild(divProgressIcons);
            } else {
                if((widthOfPositionWords * 2) < (divCentreCol.offsetWidth - widthOfCentreColPadding)) {
                    //only show label if enough room - ie > 2 x width of label
                    divProgLeftCol.appendChild(divProgressLabel);
                }
                divProgRightCol.appendChild(divProgressBar);
                divCentreCol.appendChild(progressBarContainer);
            }
            */

            /*
             * Cloning prevous and next and adding to appropriate parts of header
             *
             * Note that .header-left-flex and .header-right-flex don't exist on several content types (below)
             * so, thinking to chcek first for Page header, then work through:
             * - Discussion = div#keyboard-shortcut-modal-info (left should be OK if we append into that after accessibility spans) and div.pull-right(right- float:right)
             * - Quizzes = div.header-bar-right (right - float:right) inside div.header-bar - left would have to be inserted into div.header-bar
             * - Assignment = div.assignment_title contains - left: div.title-content and right: div.assignment-buttons
             * If none of those clases are present, assume no header and insert as immediate child of div#content which would deal with below
             * - File = no header - could add as immediate child of div#content
             * - External URL = no header - could add as immediate child of div#content
             * - External tool = no header - could add immedioately below div#content
             */

            /*
            if(previousButtonTop) {
                var divHeaderLefts = document.getElementsByClassName('header-left-flex'); //this is the left header element for Pages
                if(divHeaderLefts.length > 0) {
                    var divHeaderLeft = divHeaderLefts[0];
                    divHeaderLeft.insertBefore(previousButtonTop, divHeaderLeft.firstChild);
                } else {
                    //var discussionManageBar = document.getElementById('discussion-managebar');
                    //if(discussionManageBar) {
                        //we should be in a discussion
                    }
                }
            }

            if(nextButtonTop) {
                var divHeaderRights = document.getElementsByClassName('header-right-flex'); //this is the right header element for Pages
                if(divHeaderRights.length > 0) {
                    var divHeaderRight = divHeaderRights[0];
                    //divHeaderRight.insertBefore(nextButtonTop, divHeaderRight.firstChild);
                    divHeaderRight.appendChild(nextButtonTop);
                } else {
                    //var discussionManageBar = document.getElementById('discussion-managebar');
                    //if(discussionManageBar) {
                        //we should be in a discussion
                    //}
                }
            }
            */
        }
    }

    /*
     * Hides all the modules except the module which id is the function's argument.
     */
    function ou_hideOtherModules(moduleId) {
      var otherModuleDivs = document.querySelectorAll(`div.context_module:not([data-module-id='${moduleId}'])`);
      otherModuleDivs.forEach(module => module.style.display = 'none');
    }

    /*
     * Function which returns a promise (and error if rejected) if response status is OK
     * @param {Object} response
     * @returns {Promise} either error or response
     */
    function ou_status(response) {
        if (response.status >= 200 && response.status < 300) {
            return Promise.resolve(response);
        } else {
            return Promise.reject(new Error(response.statusText));
        }
    }

    /*
     * Function which returns json from response
     * @param {Object} response
     * @returns {string} json from response
     */
    function ou_json(response) {
        return response.json();
    }

    /**
     * Gets the domain root account ID.
     */
    function ou_getDomainRootAccountId() {
        return ENV.DOMAIN_ROOT_ACCOUNT_ID;
    }

    /**
     * Function which gets find course id from wherever it is available - currently ONLY ON WEB
     * @returns {string} id of course
     */
    function ou_getCourseId() {
        var courseId = ENV.COURSE_ID || ENV.course_id;
        if (!courseId) {
            var urlPartIncludingCourseId = window.location.href.split('courses/')[1];
            if (urlPartIncludingCourseId) {
                courseId = urlPartIncludingCourseId.split('/')[0];
            }
        }
        return courseId;
    }

    /**
     * Function which gets find module_item_id from URL - currently ONLY ON WEB
     * @returns {int} id of module_item or 0 for not found
     */
    function ou_getModuleItemId() {
        const moduleRequestUrl = new URL(window.location.href);
        const moduleRequestParams = new URLSearchParams(moduleRequestUrl.search);
        // Get the module item id from the request
        const moduleItemId = moduleRequestParams.get('module_item_id');
        // If the module item id is in the request, return it.
        // Otherwise return 0
        return moduleItemId ? moduleItemId : 0;
    }

    /**
     * Function which finds the module id from location hash - currently ONLY ON WEB
     * Example /courses/28277/modules#module_545
     * @returns {int} id of module or 0 for not found
     */
    function ou_getModuleId() {
        const moduleHash = window.location.hash.substr(1);
        const moduleHashPrefix = 'module_';
        // If the module hash starts with the module_ prefix, remove the prefix to get the Id.
        // Otherwise return 0, moduleId not found
        return moduleHash.startsWith(moduleHashPrefix) ? moduleHash.replace(moduleHashPrefix, '') : 0;
    }

    /**
     * Assigns an icon depending on the type of the item.
     */
    function ou_getItemTypeIcon(itemType) {
      switch (itemType) {
          case 'Page':
              return 'icon-document';
          case 'File':
              return 'icon-paperclip';
          case 'Discussion':
              return 'icon-discussion';
          case 'Quiz':
              return 'icon-quiz';
          case 'Assignment':
              return 'icon-assignment';
          case 'ExternalUrl':
              return 'icon-link';
          default:
              return'icon-document';
      }
    }

    /****************************************/
    /***** End of function definitions ******/
    /****************************************/

})();
