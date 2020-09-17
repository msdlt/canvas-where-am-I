/**** TODO LIST ****/
// TODO Check that we have added icons for all itemTypes
// TODO Check that we haven't lost any of Canvas's accessibility features
// TODO investigate whether we could limit Module titles in LH menu to e.g two lines
// TODO can we refresh menu when editing Modules?

// All the logic should be performed after the load event so we have all the elements loaded.
window.addEventListener('load', async (event) => {

    /****************************************/
    /**** Start of Configuration Section ****/
    /****************************************/

    /* Amazon S3 bucket URL, this URL is needed to retrieve the course presentation and navigation settings */
    const amazonS3bucketUrl = `https://oxctl-modules.s3-eu-west-1.amazonaws.com`;

    /* DOM elements to check for */
    // The structure hierarchy in Canvas is content > course_home_content > context_modules_sortable_container
    const divCourseHomeContent = document.getElementById('course_home_content');  //is this page Home
    const divContent = document.getElementById('content');
    const divContextModulesContainer = document.getElementById('context_modules_sortable_container');  //are we on the Modules page

    // Contains the Modules link in the LHS Menu (left hand side).
    // This doesn't match if the modules page is hidden for the students.
    // Gets the modules link by class, more optimal than the text content if the course language is not english <a class='modules' href="xxx"/>
    const lhsModulesLink = document.querySelector('li.section a.modules');
    const lhsModulesListItem = lhsModulesLink ? lhsModulesLink.parentNode : null;

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
    if (initModuleId) {
        ou_removeOtherModules(initModuleId);
    }

    const courseModules = await ou_getModules(initCourseId);
    const isCourseHome = divContextModulesContainer && !initModuleId && divCourseHomeContent;
    // If the user is in the course home and contains modules, replace the standard view by the tile view.
    if (isCourseHome) {
      // Remove the current home content instead of hiding it.
      divCourseHomeContent.remove();
      const tileViewDiv = ou_buildModulesTileView(initCourseId, courseModules);
      // Insert the modules div into the content
      divContent.appendChild(tileViewDiv);
    }

    // Add the submenu of modules to the LHS menu if the modules list item is visible.
    if (lhsModulesListItem) {
      const moduleSubmenuList = ou_buildModulesSubmenu(initCourseId, courseModules, initModuleId, initModuleItemId);
      // Append the module list to the modules tool item in the LHS menu.
      lhsModulesListItem.appendChild(moduleSubmenuList);
    }

    if (initModuleItemId) {
      // Get the footer by id, in many pages the id is sequence_footer, in the last page the id is module_navigation_target
      const divFooter = document.querySelector('#module_navigation_target, #sequence_footer');
      const divFooterContent = divFooter.querySelector('.module-sequence-footer-content');
      if (divFooterContent) {
        const currentModule = courseModules.find(module => module.items.find(moduleItem => moduleItem.id === initModuleItemId));
        const moduleItemsForProgress = ou_getModuleItemsForProgress(initCourseId, initModuleItemId, currentModule);
        const progressBarDiv = ou_buildProgressBar(moduleItemsForProgress);
        // Place new progressBarContainer in the middle flexible div
        divFooterContent.appendChild(progressBarDiv);
      }
    }


    /****************************************/
    /***** End function main thread *********/
    /****************************************/

    /****************************************/
    /***** Start of function definitions ****/
    /****************************************/

    /*
     * Checks if the CPN view is enabled requesting the CPN settings from the Amazon S3 bucket.
     */
    async function ou_CheckSettings(domainId, courseId) {
      const settingsFileRequestUrl = `${amazonS3bucketUrl}/${domainId}/${courseId}.json`;
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
      return courseModules;
    }

    /*
     * Builds the tile view for the course modules home.
     */
    function ou_buildModulesTileView(courseId, moduleArray) {

      //no of columns per row of tiles at top of Modules page - 1, 2, 3, 4, 6 or 12 - ONLY USE 4 for the moment
      const noOfColumnsPerRow = 4;

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

      // Create our nav container
      let moduleNav = document.createElement('div');
      moduleNav.id = 'module_nav';
      moduleNav.className = 'ou-ModuleCard__box';
      let moduleNavAnchorLink = document.createElement('a');
      moduleNavAnchorLink.id = 'module_nav_anchor';
      moduleNav.appendChild(moduleNavAnchorLink);

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
        // TODO work out classes for noOfColumnsPerRow != 4
        newColumn.className = 'col-xs-12 col-sm-6 col-lg-3';
        newRow.appendChild(newColumn);

        //create module div
        let moduleTile = document.createElement('div');
        moduleTile.className = 'ou-ModuleCard';
        moduleTile.title = module.name;

        let moduleTileLink = document.createElement('a');
        moduleTileLink.href = `/courses/${courseId}/modules/${module.id}`;

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
        moduleTileTitle.appendChild(document.createTextNode(module.name));

        // Only leave space for actions if we're adding them
        moduleTileTitle.classList.add('ou-no-actions');

        moduleTileContent.appendChild(moduleTileTitle);
        moduleTileLink.appendChild(moduleTileHeader);
        moduleTileLink.appendChild(moduleTileContent);
        moduleTile.appendChild(moduleTileLink);
        newColumn.appendChild(moduleTile);

      });

      return moduleNav;

    }

    /*
     * Builds the modules submenu adding all the modules as children of the Modules tool.
     */
    function ou_buildModulesSubmenu(courseId, moduleArray, moduleId, moduleItemId) {

      // Whether to allow LH menu Module links to be multiline
      const allowMultilineModuleTitles = false;

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
        newLink.appendChild(document.createTextNode(module.name));
        if (allowMultilineModuleTitles) {
            newLink.classList.add('ou-multiline');
        }

        // Check if the moduleItemId belongs to this module.
        const currentModuleItem = module.items.find(item => item.id === moduleItemId);
        // Check if we need to make one of our sub-menu modules active
        if (module.id === moduleId || currentModuleItem) {
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

      return moduleSubmenuList;

    }

    function ou_getModuleItemsForProgress(courseId, moduleItemId, currentModule) {
      let moduleItemsForProgress = [];

      currentModule.items.forEach(item => {
          //don't want these represented anywhere - on Modules tiles dropdowns OR in progress buttons
          if (item.type === 'SubHeader') {
            return;
          }

          let itemId = item.id;
          let itemType = item.type;
          let iconType = ou_getItemTypeIcon(itemType);

          const listItemDest = `/courses/${courseId}/modules/items/${itemId}`;
          // note only want to do this for current module
          let isCurrentItem = moduleItemId === item.id;
          let itemNavObject = {
              href: listItemDest,
              title: item.title,
              icon: iconType,
              current: isCurrentItem
          };

          moduleItemsForProgress.push(itemNavObject);

        });

        return moduleItemsForProgress;

    }

    /*
     * Function which builds progress bar between Next and Previous buttons IF item shown as part of Module
     */
    function ou_buildProgressBar(moduleItemsForProgress) {

        // Now create flexible divs to pop progress bar and next and previous buttons into
        // 1. Ceate div with one flexible and two inflexible divs at either end
        let divColContainer = document.createElement('div');
        divColContainer.classList.add('ou-ColContainer');
        // Left col will contain the previous button if exists.
        let divLeftCol = document.createElement('div');
        divLeftCol.classList.add('ou-LeftCol');
        // Centre col will contain the module item links.
        let divCentreCol = document.createElement('div');
        divCentreCol.classList.add('ou-CentreCol');
        // Right col will contain the next button if exists
        let divRightCol = document.createElement('div');
        divRightCol.classList.add('ou-RightCol');

        // 2. Move buttons if present - awkwardly, pevious is just a link and next sits in span -  into the two inflexible ends
        divColContainer.appendChild(divLeftCol);
        divColContainer.appendChild(divCentreCol);
        divColContainer.appendChild(divRightCol);

        // 3. Place the existing navigation buttons into the right and left columns
        // Look for Previous button
        const previousButton = document.querySelector('a.module-sequence-footer-button--previous');
        if (previousButton) {
            divLeftCol.appendChild(previousButton);
        }
        // Look for Next button
        const nextButton = document.querySelector('span.module-sequence-footer-button--next');
        if (nextButton) {
            divRightCol.appendChild(nextButton);
        }

        // Create individual progress buttons version
        let divProgressIcons = document.createElement('div');
        divProgressIcons.className = 'ou-progress-icons';
        let divProgressItems = document.createElement('ul');
        divProgressItems.className = 'ou-progress-items';

        moduleItemsForProgress.forEach(item => {
            let listItem = document.createElement('li');
            let listItemLink = document.createElement('a');
            listItem.className = 'ou-progress-item';
            listItemLink.classList.add(item.icon);
            if (item.current) {
                listItemLink.classList.add('active');
            }
            listItemLink.href = item.href;
            listItemLink.setAttribute('role', 'menuitem');
            listItemLink.title = item.title;
            // Add the link to the item
            listItem.appendChild(listItemLink);
            // Add the item to the list of items
            divProgressItems.appendChild(listItem);
        });

        // Add the list of items to the items DIV
        divProgressIcons.appendChild(divProgressItems);
        // Add the items DIV to the centre column
        divCentreCol.appendChild(divProgressIcons);

        return divColContainer;

    }

    /*
     * Removed all the modules except the module which id is the function's argument.
     */
    function ou_removeOtherModules(moduleId) {
      var otherModuleDivs = document.querySelectorAll(`div.context_module:not([data-module-id='${moduleId}'])`);
      otherModuleDivs.forEach(module => module.remove());
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
        return moduleItemId ? parseInt(moduleItemId) : 0;
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
        return moduleHash.startsWith(moduleHashPrefix) ? parseInt(moduleHash.replace(moduleHashPrefix, '')) : 0;
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

});
