const axios = require('axios');
const assert = require('assert');
const dotenv = require('dotenv');

dotenv.config();
jest.setTimeout(1200000);

// This needs to be a pre-created course.
// It should contain several modules, the more the better.
// It should contain several items inside the modules, the more the better.
let courseId = process.env.TEST_COURSE_ID;
let courseObject = null;
let emptyCourseId = process.env.EMPTY_TEST_COURSE_ID;
let emptyCourseObject = null;
let courseModules = null;

// Configuration parameters, see .env.example for more information.
const token = process.env.OAUTH_TOKEN;
const host = process.env.CANVAS_HOST;
const account = process.env.ACCOUNT_ID;
const productionHost = process.env.CANVAS_PRODUCTION_HOST;

goToCourse = async (page, host, courseId) => {
  await page.goto(`${host}/courses/${courseId}`);
}

// Get the course modules using the API, support 100 modules maximum, enough for testing.
getCourseModules = async (host, courseId) => {
  return await axios({
    method: 'GET',
    url: `${host}/api/v1/courses/${courseId}/modules?include=items&per_page=100`,
    headers: {'Authorization': 'Bearer ' + token}
  }).then((response) => {
    return response.data;
  });
}

// Gets a random element from an array
getRandomArrayElement = (array) => {
  return array[Math.floor(Math.random() * array.length)];
}

// Gets a random module from a module array.
getRandomModule = (moduleArray) => {
  return getRandomArrayElement(moduleArray);
}

// Gets a module that contains items.
getNotEmptyModule = (moduleArray) => {
  return moduleArray.find(module => module.items.length > 0);
}

// Filters items by type, SubHeader items are not represented in the progress bar.
filterModuleItems = (itemArray) => {
  return itemArray.filter(item => item.type !== 'SubHeader');
}

// Gets a random module item, excluding SubHeader items.
getRandomModuleItem = (module) => {
  return getRandomArrayElement(filterModuleItems(module.items));
}

checkTileView = async (page, host) => {
  await goToCourse(page, host, courseId);
  // The script replaces the course_home_content by module_nav.
  const selector = '#module_nav';
  await page.waitForSelector(selector);
  const moduleNav = await page.$(selector);
  await expect(moduleNav).not.toBeNull();
  const courseHomeContent = await page.$('#course_home_content');
  await expect(courseHomeContent).toBeNull();
}

checkTileViewCards = async (page, host) => {
  await goToCourse(page, host, courseId);
  // The script replaces the course_home_content by module_nav.
  await page.waitForSelector('#module_nav');
  // Check the modules have been replaced by cards.
  const modules = await page.$$('.ou-ModuleCard');
  await expect(modules.length).toBeGreaterThan(0);
  await expect(courseModules.length).toBeGreaterThan(0);
  // Pick a random module from the module objects.
  const randomModule = getRandomModule(courseModules);
  // Query a random module and check it's displayed as a ModuleCard.
  const cardModule = await page.$(`.ou-ModuleCard[title="${randomModule.name}"]`);
  await expect(cardModule).not.toBeNull();
  // Query the standard view of the module is not visible
  const standardViewModule = await page.$(`[data-module-id="${randomModule.id}"]`);
  await expect(standardViewModule).toBeNull();
}

checkSelectedModule = async (page, host) => {
  // Pick a random module from the module objects.
  const randomModule = getRandomModule(courseModules);
  await page.goto(`${host}/courses/${courseId}/modules/${randomModule.id}`);
  await page.waitForSelector('.ou-section-tabs-sub');
  // The script replaces the course_home_content by module_nav.
  const selectedLHSItem = await page.$('li.section a.active');
  const selectedModuleName = await page.evaluate(selectedLHSItem => selectedLHSItem.textContent, selectedLHSItem);
  await expect(selectedModuleName).toBe(randomModule.name);
}

checkSelectedModuleInCurrentItem = async (page, host) => {
  // Pick a not empty module
  const notEmptyModule = getNotEmptyModule(courseModules);
  // Pick a random item from the module objects.
  const randomModuleItem = getRandomModuleItem(notEmptyModule);
  await page.goto(`${host}/courses/${courseId}/modules/items/${randomModuleItem.id}`);
  await page.waitForSelector('.ou-section-tabs-sub');
  // The script replaces the course_home_content by module_nav.
  const selectedLHSItem = await page.$('li.section a.active');
  const selectedModuleName = await page.evaluate(selectedLHSItem => selectedLHSItem.textContent, selectedLHSItem);
  await expect(selectedModuleName).toBe(notEmptyModule.name);
}

checkProgressBar = async (page, host) => {
  // Pick a not empty module
  const notEmptyModule = getNotEmptyModule(courseModules);
  // Pick a random item from the module objects.
  const randomModuleItem = getRandomModuleItem(notEmptyModule);
  await page.goto(`${host}/courses/${courseId}/modules/items/${randomModuleItem.id}`);
  // The progress bar is added to the footer.
  const footerContainerSelector = '.ou-ColContainer';
  await page.waitForSelector(footerContainerSelector);
  const footerContainerElement = await page.$(footerContainerSelector);
  await expect(footerContainerElement).not.toBeNull();
  const progressBarItems = await page.$$('li.ou-progress-item');
  await expect(progressBarItems.length).toBe(filterModuleItems(notEmptyModule.items).length);
}

checkSelectedItemInProgressBar = async (page, host) => {
  // Pick a not empty module
  const notEmptyModule = getNotEmptyModule(courseModules);
  // Pick a random item from the module objects.
  const randomModuleItem = getRandomModuleItem(notEmptyModule);
  await page.goto(`${host}/courses/${courseId}/modules/items/${randomModuleItem.id}`);
  const footerContainerSelector = '.ou-ColContainer';
  await page.waitForSelector(footerContainerSelector);
  // Query the selected item and check it's the same moduleItem.
  const selectedProgressBarItem = await page.$('li.ou-progress-item a.active');
  const selectedModuleItemName = await (await selectedProgressBarItem.getProperty('title')).jsonValue();
  await expect(selectedModuleItemName).toBe(randomModuleItem.title);
}

checkUnalteredModuleTool = async (page, host) => {
  await page.goto(`${host}/courses/${courseId}/modules`);
  const modulesSelector = 'div.context_module';
  await page.waitForSelector(modulesSelector);
  const modules = await page.$$(modulesSelector);
  await expect(modules.length).toBeGreaterThan(0);
}

checkFilteringSelectedModule = async (page, host) => {
  // Pick a not empty module
  const notEmptyModule = getNotEmptyModule(courseModules);
  // Pick a random item from the module objects.
  const randomModuleItem = getRandomModuleItem(notEmptyModule);
  await page.goto(`${host}/courses/${courseId}/modules/${notEmptyModule.id}`);
  const modulesSelector = 'div.context_module';
  await page.waitForSelector(modulesSelector);
  const modules = await page.$$(modulesSelector);
  await expect(modules.length).toBe(1);
}

checkUnalteredHomePage = async (page, host) => {
  // Replaces the course home by modules.
  await axios({
    method: 'PUT',
    url: `${host}/api/v1/courses/${emptyCourseId}`,
    headers: {'Authorization': 'Bearer ' + token},
    data: 'course[default_view]=modules'
  });
  await goToCourse(page, host, emptyCourseId);
  // Check the message that there are no courses
  const noModulesMessage = await page.$('#no_context_modules_message');
  await expect(noModulesMessage).not.toBeNull();
  // Check the course_home_content div is not removed
  const divHomeContent = await page.$('#course_home_content');
  await expect(divHomeContent).not.toBeNull();
  // Check the module_nav div does not exist
  const moduleNav = await page.$('#module_nav');
  await expect(moduleNav).toBeNull();
  // Check the ability to add modules
  const addModuleLink = await page.$('.add_module_link');
  await expect(addModuleLink).not.toBeNull();
}

checkUnalteredHomeFeed = async (page, host) => {
  // Replaces the course home by a different tool.
  await axios({
    method: 'PUT',
    url: `${host}/api/v1/courses/${emptyCourseId}`,
    headers: {'Authorization': 'Bearer ' + token},
    data: 'course[default_view]=feed'
  });

  await goToCourse(page, host, emptyCourseId);
  // Check the home page is feed and not modules
  const noModulesMessage = await page.$('#no_context_modules_message');
  await expect(noModulesMessage).toBeNull();
  const recentActivityElement = await page.$('.recent_activity');
  await expect(recentActivityElement).not.toBeNull();
  // Check the course_home_content div is not removed
  const divHomeContent = await page.$('#course_home_content');
  await expect(divHomeContent).not.toBeNull();
  // Check the module_nav div does not exist
  const moduleNav = await page.$('#module_nav');
  await expect(moduleNav).toBeNull();
}

checkUnalteredSubmenu = async (page, host) => {
  await goToCourse(page, host, emptyCourseId);
  const modulesToolLink = await page.$$('li.section a.modules');
  await expect(modulesToolLink).not.toBeNull();
  const submenuElement = await page.$('.ou-section-tabs-sub');
  await expect(submenuElement).toBeNull();
}

describe('Beta Environment: Test the deployed CPN script against pre-created courses.', () => {

  beforeAll(async () => {
    assert(token, 'You must set the environmental variable OAUTH_TOKEN');
    assert(host, 'You must set the environmental variable CANVAS_HOST');
    assert(account, 'You must set the environmental variable ACCOUNT_ID');
    assert(courseId, 'The test need a pre-created course in Canvas, you must set the environmental variable TEST_COURSE_ID');
    assert(emptyCourseId, 'The test need a pre-created course in Canvas, you must set the environmental variable EMPTY_TEST_COURSE_ID');
    assert(productionHost, 'You must set the environmental variable CANVAS_PRODUCTION_HOST');

    // Check the API returns the modules
    courseModules = await getCourseModules(host, courseId);
    assert(courseModules, 'Unable to get the course modules from the API, create some modules in that course.');
  });

  beforeEach(async () => {
    // We should always have more than 60 seconds as we sometimes see a 60 second stall.
    await page.setDefaultTimeout(90000);
    await Promise.all([
      page.waitForNavigation(),
      axios.get(`${host}/login/session_token`, {headers: {'Authorization': 'Bearer ' + token}})
      .then((response) => {
        return page.goto(response.data.session_url);
      })
    ]);
  });

  it('Tile View: Check the standard view has been replaced by the tile view.', async () => {
    await checkTileView(page, host);
  });

  it('Tile View: Check the standard view of the modules have been replaced by cards.', async () => {
    await checkTileViewCards(page, host);
  });

  it('Modules submenu: Check the selected module is highlighted in the LHS menu.', async () => {
    await checkSelectedModule(page, host);
  });

  it('Modules submenu: Check the selected module is highlighted in the LHS menu when accessing an item.', async () => {
    await checkSelectedModuleInCurrentItem(page, host);
  });

  it('Progress bar: Check progress bar is rendered after performing the script.', async () => {
    await checkProgressBar(page, host);
  });

  it('Progress bar: Check the right item is selected in the progress bar.', async () => {
    await checkSelectedItemInProgressBar(page, host);
  });

  it('Modules list: Check the script does not perform changes to modules.', async () => {
    await checkUnalteredModuleTool(page, host);
  });

  it('Modules list: Check the script filters the other modules when accessing a module.', async () => {
    await checkFilteringSelectedModule(page, host);
  });

  it('Empty Course - Tile View: Check the script does not make any changes in the home page.', async () => {
    await checkUnalteredHomePage(page, host);
  });

  it('Empty Course - Tile View: Ensure the script does not perform any action in other course homes.', async () => {
    await checkUnalteredHomeFeed(page, host);
  });

  it('Empty Course - Modules submenu: Check the script does not make any changes in LHS menu.', async () => {
    await checkUnalteredSubmenu(page, host);
  });

});

describe('Production Environment: Test the deployed CPN script against pre-created courses.', () => {

  beforeAll(async () => {
    assert(token, 'You must set the environmental variable OAUTH_TOKEN');
    assert(productionHost, 'You must set the environmental variable CANVAS_PRODUCTION_HOST');
    assert(account, 'You must set the environmental variable ACCOUNT_ID');
    assert(courseId, 'The test need a pre-created course in Canvas, you must set the environmental variable TEST_COURSE_ID');
    assert(emptyCourseId, 'The test need a pre-created course in Canvas, you must set the environmental variable EMPTY_TEST_COURSE_ID');

    // Check the API returns the modules
    courseModules = await getCourseModules(productionHost, courseId);
    assert(courseModules, 'Unable to get the course modules from the API, create some modules in that course.');
  });

  beforeEach(async () => {
    // We should always have more than 60 seconds as we sometimes see a 60 second stall.
    await page.setDefaultTimeout(90000);
    await Promise.all([
      page.waitForNavigation(),
      axios.get(`${productionHost}/login/session_token`, {headers: {'Authorization': 'Bearer ' + token}})
      .then((response) => {
        return page.goto(response.data.session_url);
      })
    ]);
  });

  it('Tile View: Check the standard view has been replaced by the tile view.', async () => {
    await checkTileView(page, productionHost);
  });

  it('Tile View: Check the standard view of the modules have been replaced by cards.', async () => {
    await checkTileViewCards(page, productionHost);
  });

  it('Modules submenu: Check the selected module is highlighted in the LHS menu.', async () => {
    await checkSelectedModule(page, productionHost);
  });

  it('Modules submenu: Check the selected module is highlighted in the LHS menu when accessing an item.', async () => {
    await checkSelectedModuleInCurrentItem(page, productionHost);
  });

  it('Progress bar: Check progress bar is rendered after performing the script.', async () => {
    await checkProgressBar(page, productionHost);
  });

  it('Progress bar: Check the right item is selected in the progress bar.', async () => {
    await checkSelectedItemInProgressBar(page, productionHost);
  });

  it('Modules list: Check the script does not perform changes to modules.', async () => {
    await checkUnalteredModuleTool(page, productionHost);
  });

  it('Modules list: Check the script filters the other modules when accessing a module.', async () => {
    await checkFilteringSelectedModule(page, productionHost);
  });

  it('Empty Course - Tile View: Check the script does not make any changes in the home page.', async () => {
    await checkUnalteredHomePage(page, productionHost);
  });

  it('Empty Course - Tile View: Ensure the script does not perform any action in other course homes.', async () => {
    await checkUnalteredHomeFeed(page, productionHost);
  });

  it('Empty Course - Modules submenu: Check the script does not make any changes in LHS menu.', async () => {
    await checkUnalteredSubmenu(page, productionHost);
  });

});
