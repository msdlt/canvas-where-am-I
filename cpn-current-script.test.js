const axios = require('axios');
const assert = require('assert');
const dotenv = require('dotenv');

dotenv.config();
jest.setTimeout(1200000);

// Contains the created course, reusable between tests.
let courseObject = {};
// Contains the modules created in that course.
let moduleArray = [];
// Contains the items created in one of the modules
let moduleItems = [];

// Configuration parameters, see .env.example for more information.
const token = process.env.OAUTH_TOKEN;
const host = process.env.CANVAS_HOST;
const account = process.env.ACCOUNT_ID;

getRandomArrayElement = (array) => {
  return array[Math.floor(Math.random() * array.length)];
}

getRandomModule = () => {
  return getRandomArrayElement(moduleArray);
}

getRandomModuleItem = () => {
  return getRandomArrayElement(moduleItems);
}

goToCourse = async (page) => {
  await page.goto(`${host}/courses/${courseObject.id}`);
}

appendCPNScript = async (page) => {
  await page.evaluate(() => ENV['FORCE_CPN'] = true);
  await Promise.all([
    page.addScriptTag({ path: './canvas-where-am-I.js' }),
    page.addStyleTag({ path: './canvas-where-am-I.css' }),
  ]);
}

describe('Test the CPN script against a course with some modules and items.', () => {

  beforeAll(async () => {
    assert(token, 'You must set the environmental variable OAUTH_TOKEN');
    assert(host, 'You must set the environmental variable CANVAS_HOST');
    assert(account, 'You must set the environmental variable ACCOUNT_ID');

    // Creates a course in the instance to check the navigation.
    const course = { course: { name: 'IGNORE: CPN TESTING', course_code: 'ignore_cpn_testing', default_view: 'modules' } };
    await axios({
      method: 'POST',
      url: `${host}/api/v1/accounts/${account}/courses`,
      headers: {'Authorization': 'Bearer ' + token},
      data: course
    }).then((response) => {
      courseObject = response.data;
    });

    // Create some modules for the specific course
    let promiseArray = [];
    for (let i = 0 ; i < 12 ; i++) {
      const newModule = { module: {name: `Module ${i}`, position: `${i + 1}` } };
      promiseArray.push(
        axios({
          method: 'POST',
          url: `${host}/api/v1/courses/${courseObject.id}/modules`,
          data: newModule,
          headers: {'Authorization': 'Bearer ' + token}
        }).then((response) => {
          moduleArray.push(response.data);
        })
      );
    }
    await Promise.all(promiseArray);

    // We want to insert some items on the first module.
    const firstModule = moduleArray[0];

    // Create an assignment item and attach it to the first module.
    let assignment = null;
    const newAssignment = { assignment: { name: 'Test Assignment' } };
    await axios({
      method: 'POST',
        url: `${host}/api/v1/courses/${courseObject.id}/assignments`,
      headers: {'Authorization': 'Bearer ' + token},
      data: newAssignment
    }).then((response) => {
      assignment = response.data;
    });

    const newAssignmentItem = { module_item: { title: newAssignment.name, type: 'assignment', content_id: assignment.id } };
    await axios({
      method: 'POST',
        url: `${host}/api/v1/courses/${courseObject.id}/modules/${firstModule.id}/items`,
      headers: {'Authorization': 'Bearer ' + token},
      data: newAssignmentItem
    }).then((response) => {
      moduleItems.push(response.data);
    });

    const newUrlItem = { module_item: { title: 'Test module item', type: 'ExternalUrl', external_url: 'https://www.ox.ac.uk' } };
    await axios({
      method: 'POST',
        url: `${host}/api/v1/courses/${courseObject.id}/modules/${firstModule.id}/items`,
      headers: {'Authorization': 'Bearer ' + token},
      data: newUrlItem
    }).then((response) => {
      moduleItems.push(response.data);
    });

  });

  afterAll(async () => {
    // Delete the course
    await axios({
      method: 'DELETE',
      url: `${host}/api/v1/courses/${courseObject.id}`,
      headers: {'Authorization': 'Bearer ' + token},
      data: { event: 'delete' }
    })
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
    await goToCourse(page);
    await appendCPNScript(page);
    // The script replaces the course_home_content by module_nav.
    const selector = '#module_nav';
    await page.waitForSelector(selector);
    const moduleNav = await page.$(selector);
    await expect(moduleNav).not.toBeNull();
    const courseHomeContent = await page.$('#course_home_content');
    await expect(courseHomeContent).toBeNull();
  });

  it('Tile View: Check the standard view of the modules have been replaced by cards.', async () => {
    await goToCourse(page);
    await appendCPNScript(page);
    // The script replaces the course_home_content by module_nav.
    await page.waitForSelector('#module_nav');
    const modules = await page.$$('.ou-ModuleCard');
    await expect(modules.length).toBe(moduleArray.length);
  });

  it('Modules submenu: Check the selected module is highlighted in the LHS menu.', async () => {
    const randomModule = getRandomModule();
    await page.goto(`${host}/courses/${courseObject.id}/modules/${randomModule.id}`);
    await appendCPNScript(page);
    await page.waitForSelector('.ou-section-tabs-sub');
    // The script replaces the course_home_content by module_nav.
    const selectedLHSItem = await page.$('li.section a.active');
    const selectedModuleName = await page.evaluate(selectedLHSItem => selectedLHSItem.textContent, selectedLHSItem);
    await expect(selectedModuleName).toBe(randomModule.name);
  });

  it('Modules submenu: Check the selected module is highlighted in the LHS menu when accessing an item.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}/modules/items/${moduleItems[0].id}`);
    await appendCPNScript(page);
    await page.waitForSelector('.ou-section-tabs-sub');
    // The script replaces the course_home_content by module_nav.
    const selectedLHSItem = await page.$('li.section a.active');
    const selectedModuleName = await page.evaluate(selectedLHSItem => selectedLHSItem.textContent, selectedLHSItem);
    await expect(selectedModuleName).toBe(moduleArray[0].name);
  });

  it('Progress bar: Check progress bar is rendered after performing the script.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}/modules/items/${moduleItems[0].id}`);
    await appendCPNScript(page);
    // The progress bar is added to the footer.
    const footerContainerSelector = '.ou-ColContainer';
    await page.waitForSelector(footerContainerSelector);
    const footerContainerElement = await page.$(footerContainerSelector);
    await expect(footerContainerElement).not.toBeNull();
    const progressBarItems = await page.$$('li.ou-progress-item');
    await expect(progressBarItems.length).toBe(moduleItems.length);
  });

  it('Progress bar: Check the right item is selected in the progress bar.', async () => {
    const randomModuleItem = getRandomModuleItem();
    await page.goto(`${host}/courses/${courseObject.id}/modules/items/${randomModuleItem.id}`);
    await appendCPNScript(page);
    const footerContainerSelector = '.ou-ColContainer';
    await page.waitForSelector(footerContainerSelector);
    // Query the selected item and check it's the same moduleItem.
    const selectedProgressBarItem = await page.$('li.ou-progress-item a.active');
    const selectedModuleItemName = await (await selectedProgressBarItem.getProperty('title')).jsonValue();
    await expect(selectedModuleItemName).toBe(randomModuleItem.title);
  });


  it('Modules list: Check the script does not perform changes to modules.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}/modules`);
    await appendCPNScript(page);
    const modulesSelector = 'div.context_module';
    await page.waitForSelector(modulesSelector);
    const modules = await page.$$(modulesSelector);
    // We add one because Canvas also returns an extra blank module with id context_module_blank
    await expect(modules.length).toBe(moduleArray.length + 1);
  });

  it('Modules list: Check the script filters the other modules when accessing a module.', async () => {
    const randomModule = getRandomModule();
    await page.goto(`${host}/courses/${courseObject.id}/modules/${randomModule.id}`);
    await appendCPNScript(page);
    const modulesSelector = 'div.context_module';
    await page.waitForSelector(modulesSelector);
    const modules = await page.$$(modulesSelector);
    await expect(modules.length).toBe(1);
  });

});
