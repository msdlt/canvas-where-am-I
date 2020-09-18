const axios = require('axios');
const assert = require('assert');
const dotenv = require('dotenv');

dotenv.config();
jest.setTimeout(1200000);

// Contains the created course, reusable between tests.
let courseObject = {};
// Contains the modules created in that course.
let moduleArray = [];
// Contains an item created in that course
let moduleItem = {};

// Configuration parameters, see .env.example for more information.
const token = process.env.OAUTH_TOKEN;
const host = process.env.CANVAS_HOST;
const account = process.env.ACCOUNT_ID;
const amazonBucketUrl = process.env.AMAZON_S3_BUCKET_URL;

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

    // Create an item and attach it to the first module.
    const firstModule = moduleArray[0];
    const newModuleItem = { module_item: { title: 'Test module item', type: 'ExternalUrl', external_url: 'https://www.ox.ac.uk' } };
    await axios({
      method: 'POST',
        url: `${host}/api/v1/courses/${courseObject.id}/modules/${firstModule.id}/items`,
      headers: {'Authorization': 'Bearer ' + token},
      data: newModuleItem
    }).then((response) => {
      moduleItem = response.data;
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
    const moduleItems = await page.$$('.context_module');
    // We add one because Canvas also returns an extra blank module with id context_module_blank
    await expect(moduleItems.length).toBe(moduleArray.length + 1);

  });

  it('General: Check one module item is created and navigable.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}/modules/items/${moduleItem.id}`);
    await expect(page.title()).resolves.toMatch(moduleItem.title);
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

  it('General: Check the DOMAIN_ROOT_ACCOUNT_ID is in the ENV variable.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}/modules`);
    const domainAccountId = await page.evaluate(() => {
      return ENV.DOMAIN_ROOT_ACCOUNT_ID;
    });
    await expect(domainAccountId).not.toBeNull();
  });

  it('Tile View: Check course_home_content DIV exists.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}`);
    const element = await page.$('#course_home_content');
    await expect(element).not.toBeNull();
  });

  it('Tile View: Check context_modules_sortable_container DIV exists.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}`);
    const element = await page.$('#context_modules_sortable_container');
    await expect(element).not.toBeNull();
  });

  it('Modules submenu: Check modules tool menu item exists.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}`);
    const element = await page.$$('li.section a.modules');
    await expect(element).not.toBeNull();
  });

  it('Progress bar: Check module item footer exists, for the progress bar.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}/modules/items/${moduleItem.id}`);
    const element = await page.$('#sequence_footer');
    await expect(element).not.toBeNull();
    const footerElement = await page.$('.module-sequence-footer-content');
    await expect(footerElement).not.toBeNull();
  });

  it('Modules list: Check the data-module-id attribute exists.', async () => {
    await page.goto(`${host}/courses/${courseObject.id}/modules`);
    const modules = await page.$$('div.context_module');
    // We add one because Canvas also returns an extra blank module with id context_module_blank
    await expect(modules.length).toBe(moduleArray.length + 1);
    const itemsToRemove = await page.$$(`div.context_module:not([data-module-id='${moduleArray[0].id}'])`);
    // Check that we get all the items except the first one, we leave the expresson + 1 - 1 for clarity.
    // We add one because Canvas also returns an extra blank module with id context_module_blank
    await expect(itemsToRemove.length).toBe(moduleArray.length + 1 - 1);
  });

});
