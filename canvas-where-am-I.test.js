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
const amazonBucketUrl = process.env.AMAZON_S3_BUCKET_URL;

getRandomModule = () => {
  return moduleArray[Math.floor(Math.random() * moduleArray.length)];
}

describe('Test the "Canvas Where Am I" most relevant theme integration items.', () => {

  beforeAll(async () => {
    assert(token, 'You must set the environmental variable OAUTH_TOKEN');
    assert(host, 'You must set the environmental variable CANVAS_HOST');
    assert(account, 'You must set the environmental variable ACCOUNT_ID');
    assert(amazonBucketUrl, 'You must set the environmental variable AMAZON_S3_BUCKET_URL');

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

  it('General: Check the course is created and navigable.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}`);
    await expect(page.title()).resolves.toMatch(courseObject.name);
  });

  it('General: Check modules have been created.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}/modules`);
    const element = await page.$('#context_modules');
    await expect(element).not.toBeNull();
    const moduleItemElements = await page.$$('.context_module');
    // We add one because Canvas also returns an extra blank module with id context_module_blank
    await expect(moduleItemElements.length).toBe(moduleArray.length + 1);

  });

  it('General: Check one module item is created and navigable.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}/modules/items/${moduleItems[0].id}`);
    await expect(page.title()).resolves.toMatch(moduleItems[0].title);
  });

  it('General: Check the Amazon S3 Bucket exists.', async () => {
    await page.goto(amazonBucketUrl);
    await expect(page.content()).resolves.toContain('<Message>Access Denied</Message>');
  });

  it('General: Check the COURSE_ID is in the ENV variable.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}/modules`);
    const courseId = await page.evaluate(() => {
      return ENV.COURSE_ID || ENV.course_id;
    });
    await expect(parseInt(courseId)).toBe(courseObject.id);
  });

  it('General: Check the alternative way to get the COURSE_ID from the url.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}/modules`);
    const courseId  = page.url().split('courses/')[1];
    await expect(parseInt(courseId)).toBe(courseObject.id);
  });

  it('General: Check the DOMAIN_ROOT_ACCOUNT_ID is in the ENV variable.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}/modules`);
    const domainAccountId = await page.evaluate(() => {
      return ENV.DOMAIN_ROOT_ACCOUNT_ID;
    });
    await expect(domainAccountId).not.toBeNull();
  });

  it('General: Check the modules API returns the module objects of the course.', async () => {
    const moduleRequest = `${host}/api/v1/courses/${courseObject.id}/modules?per_page=100`;
    let courseModules = [];
    await axios({
      method: 'GET',
      url: moduleRequest,
      headers: {'Authorization': 'Bearer ' + token}
    }).then((response) => {
      courseModules = response.data;
    });
    await expect(courseModules.length).toBe(moduleArray.length);
  });

  it('General: Check the modules API is pageable.', async () => {
    const moduleRequest = `${host}/api/v1/courses/${courseObject.id}/modules?per_page=1`;
    const requestLink = await axios({
      method: 'GET',
      url: moduleRequest,
      headers: {'Authorization': 'Bearer ' + token}
    }).then((response) => {
      return response.headers['link'];
    });
    await expect(requestLink).not.toBeNull();
    await expect(requestLink).toContain('rel="next"');
  });

  it('Tile View: Check course_home_content DIV exists.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}`);
    const element = await page.$('#course_home_content');
    await expect(element).not.toBeNull();
  });

  it('Tile View: Check content DIV exists.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}`);
    const element = await page.$('#content');
    await expect(element).not.toBeNull();
  });

  it('Tile View: Check context_modules_sortable_container DIV exists.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}`);
    const element = await page.$('#context_modules_sortable_container');
    await expect(element).not.toBeNull();
  });

  it('Tile View: Check the standard view has been replaced by the tile view.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}`);
    await page.evaluate(() => ENV['FORCE_CPN'] = true);
    await Promise.all([
      page.addScriptTag({ path: './canvas-where-am-I.js' }),
      page.addStyleTag({ path: './canvas-where-am-I.css' }),
    ]);
    // The script replaces the course_home_content by module_nav.
    const selector = '#module_nav';
    await page.waitForSelector(selector);
    const moduleNav = await page.$(selector);
    await expect(moduleNav).not.toBeNull();
    const courseHomeContent = await page.$('#course_home_content');
    await expect(courseHomeContent).toBeNull();
  });

  it('Tile View: Check the standard view of the modules have been replaced by cards.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}`);
    await page.evaluate(() => ENV['FORCE_CPN'] = true);
    await Promise.all([
      page.addScriptTag({ path: './canvas-where-am-I.js' }),
      page.addStyleTag({ path: './canvas-where-am-I.css' }),
    ]);
    // The script replaces the course_home_content by module_nav.
    await page.waitForSelector('#module_nav');
    const modules = await page.$$('.ou-ModuleCard');
    await expect(modules.length).toBe(moduleArray.length);
  });

  it('Modules submenu: Check modules tool menu item exists.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}`);
    const element = await page.$$('li.section a.modules');
    await expect(element).not.toBeNull();
  });

  it('Modules submenu: Check the selected module is highlighted in the LHS menu.', async () => {
    const randomModule = getRandomModule();
    await page.goto(`${host}/courses/${courseObject.id}/modules/${randomModule.id}`);
    await page.evaluate(() => ENV['FORCE_CPN'] = true);
    await Promise.all([
      page.addScriptTag({ path: './canvas-where-am-I.js' }),
      page.addStyleTag({ path: './canvas-where-am-I.css' }),
    ]);
    await page.waitForSelector('.ou-section-tabs-sub');
    // The script replaces the course_home_content by module_nav.
    const selectedLHSItem = await page.$('li.section a.active');
    const selectedModuleName = await page.evaluate(selectedLHSItem => selectedLHSItem.textContent, selectedLHSItem);
    await expect(selectedModuleName).toBe(randomModule.name);
  });

  it('Modules submenu: Check the selected module is highlighted in the LHS menu when accessing an item.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}/modules/items/${moduleItems[0].id}`);
    await page.evaluate(() => ENV['FORCE_CPN'] = true);
    await Promise.all([
      page.addScriptTag({ path: './canvas-where-am-I.js' }),
      page.addStyleTag({ path: './canvas-where-am-I.css' }),
    ]);
    await page.waitForSelector('.ou-section-tabs-sub');
    // The script replaces the course_home_content by module_nav.
    const selectedLHSItem = await page.$('li.section a.active');
    const selectedModuleName = await page.evaluate(selectedLHSItem => selectedLHSItem.textContent, selectedLHSItem);
    await expect(selectedModuleName).toBe(moduleArray[0].name);
  });

  it('Progress bar: Check module item footer exists, for the progress bar.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}/modules/items/${moduleItems[0].id}`);
    const element = await page.$('#sequence_footer');
    await expect(element).not.toBeNull();
    const footerElement = await page.$('.module-sequence-footer-content');
    await expect(footerElement).not.toBeNull();
  });

  it('Progress bar: Check the method to get the moduleItemId from the module_item_id param.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}/modules/items/${moduleItems[0].id}`);
    await expect(page.url()).toContain('module_item_id');
  });

  it('Progress bar: Check the method to get the moduleItemId from an external url module item.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}/modules/items/${moduleItems[1].id}`);
    await expect(page.url()).toBe(`${host}/courses/${courseObject.id}/modules/items/${moduleItems[1].id}`);
  });

  it('Modules list: Check the data-module-id attribute exists.', async () => {
    const randomModule = getRandomModule();
    await page.goto(`${host}/courses/${courseObject.id}/modules`);
    const modules = await page.$$('div.context_module');
    // We add one because Canvas also returns an extra blank module with id context_module_blank
    await expect(modules.length).toBe(moduleArray.length + 1);
    const itemsToRemove = await page.$$(`div.context_module:not([data-module-id='${randomModule.id}'])`);
    // Check that we get all the items except the first one, we leave the expresson + 1 - 1 for clarity.
    // We add one because Canvas also returns an extra blank module with id context_module_blank
    await expect(itemsToRemove.length).toBe(moduleArray.length + 1 - 1);
  });

  it('Modules list: Check the method to get the moduleId from the hash.', async () => {
    const randomModule = getRandomModule();
    await page.goto(`${host}/courses/${courseObject.id}/modules/${randomModule.id}`);
    await expect(page.url()).toBe(`${host}/courses/${courseObject.id}/modules#module_${randomModule.id}`);
  });

  it('Modules list: Check the script does not perform changes to modules.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}/modules`);
    await page.evaluate(() => ENV['FORCE_CPN'] = true);
    await Promise.all([
      page.addScriptTag({ path: './canvas-where-am-I.js' }),
      page.addStyleTag({ path: './canvas-where-am-I.css' }),
    ]);
    const modulesSelector = 'div.context_module';
    await page.waitForSelector(modulesSelector);
    const modules = await page.$$(modulesSelector);
    // We add one because Canvas also returns an extra blank module with id context_module_blank
    await expect(modules.length).toBe(moduleArray.length + 1);
  });

  it('Modules list: Check the script filters the other modules when accessing a module.', async () => {
    const randomModule = getRandomModule();
    await page.goto(`${host}/courses/${courseObject.id}/modules/${randomModule.id}`);
    await page.evaluate(() => ENV['FORCE_CPN'] = true);
    await Promise.all([
      page.addScriptTag({ path: './canvas-where-am-I.js' }),
      page.addStyleTag({ path: './canvas-where-am-I.css' }),
    ]);
    const modulesSelector = 'div.context_module';
    await page.waitForSelector(modulesSelector);
    const modules = await page.$$(modulesSelector);
    await expect(modules.length).toBe(1);
  });

});
