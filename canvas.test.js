const axios = require('axios');
const assert = require('assert');
const dotenv = require('dotenv');

dotenv.config();
jest.setTimeout(1200000);

describe('Canvas', () => {
  beforeEach(async () => {
    // We should always have more than 60 seconds as we sometimes see a 60 second stall.
    await page.setDefaultTimeout(90000);
    const token = process.env.OAUTH_TOKEN;
    const host = process.env.CANVAS_HOST;
    assert(token, 'You must set the environmental variable OAUTH_TOKEN');
    assert(host, 'You must set the environmental variable CANVAS_HOST');
    await Promise.all([
      page.waitForNavigation(),
      axios.get("https://" + host + "/login/session_token", {headers: {'Authorization': 'Bearer ' + token}})
      .then((response) => {
        return page.goto(response.data.session_url);
      })
    ]);
  });


  it('Check displays simple modules', async () => {
    await expect(page).toMatch('Dashboard')
    await Promise.all([
      page.waitForNavigation(),
      expect(page).toClick('.ic-DashboardCard__link', {text: /Simple Modules/})
    ]);
    await page.waitForFunction("jQuery._data(document, 'events').click.filter((item) => /data-confirm/.test(item.selector)).length > 0");
    await Promise.all([
      page.waitForNavigation(),
      expect(page).toClick('a.btn', {text: /Student view/})
    ]);
    await expect(page).toMatch('You are currently logged in to student view')
    await page.addScriptTag({path: './canvas-where-am-I.js'});
    await page.addStyleTag({path: './canvas-where-am-I.css'});
    const menuElement = await page.$('div.ic-app-course-menu');
    await expect(menuElement).toMatch('Module 1');
    await expect(menuElement).toMatch('Module 2');
    await expect(menuElement).toMatch('Module 3');
    // Unpublished modules shouldn't show up for students.
    await expect(menuElement).not.toMatch('Unpublished Module');
  });

  it('Check does not display to teacher when hidden', async () => {
    await expect(page).toMatch('Dashboard')
    await Promise.all([
      page.waitForNavigation(),
      expect(page).toClick('.ic-DashboardCard__link', {text: /Hidden Modules/})
    ]);
    await page.addScriptTag({path: './canvas-where-am-I.js'});
    await page.addStyleTag({path: './canvas-where-am-I.css'});
    const menuElement = await page.$('div.ic-app-course-menu');
    await expect(menuElement).not.toMatch('Module 1');
  });

  it('Check does not display to student when hidden', async () => {
    await expect(page).toMatch('Dashboard')
    await Promise.all([
      page.waitForNavigation(),
      expect(page).toClick('.ic-DashboardCard__link', {text: /Hidden Modules/})
    ]);
    // This is because the handlers don't get registered at the start of the page load.
    // Waiting for jQuery ready to have fired doesn't appear to work although I can't think why this is the case
    // This is using undocumented jQuery functionality.
    await page.waitForFunction("jQuery._data(document, 'events').click.filter((item) => /data-confirm/.test(item.selector)).length > 0");

    await Promise.all([
      page.waitForNavigation(),
      expect(page).toClick('a[href*="student_view"]')
    ])
    await expect(page).toMatch('You are currently logged in to student view')
    await page.addScriptTag({path: './canvas-where-am-I.js'});
    await page.addStyleTag({path: './canvas-where-am-I.css'});
    const menuElement = await page.$('div.ic-app-course-menu');
    await expect(menuElement).not.toMatch('Module 1');
  });

  it('Check it works with lots of modules', async () => {
    await expect(page).toMatch('Dashboard')
    await Promise.all([
      page.waitForNavigation(),
      expect(page).toClick('.ic-DashboardCard__link', {text: /Lots of Modules/})
    ]);

    // This is because the handlers don't get registered at the start of the page load.
    // Waiting for jQuery ready to have fired doesn't appear to work although I can't think why this is the case
    // This is using undocumented jQuery functionality.
    await page.waitForFunction("jQuery._data(document, 'events').click.filter((item) => /data-confirm/.test(item.selector)).length > 0");

    await Promise.all([
      page.waitForNavigation(),
      expect(page).toClick('a[href*="student_view"]')
    ])
    await expect(page).toMatch('You are currently logged in to student view')
    await page.addScriptTag({path: './canvas-where-am-I.js'});
    await page.addStyleTag({path: './canvas-where-am-I.css'});
    const menuElement = await page.$('div.ic-app-course-menu');
    await expect(menuElement).not.toMatch('Module 1');
    await expect(menuElement).not.toMatch('Module 100');

    // await page.waitFor(100000);
    // for (var count = 1; count < 150; count++) {
    //   await Promise.all([
    //     page.waitForSelector('button.submit_button'),
    //     expect(page).toClick('.add_module_link', {text: /Module/})
    //   ]);
    //
    //   await expect(page).toFill('#context_module_name', 'Module ' + count, {delay: 10});
    //   await page.waitForFunction((name) => document.querySelector("#context_module_name").value === name, {}, 'Module '+ count);
    //
    //   await Promise.all([
    //     page.waitForSelector('.unpublished_module .ig-header-title span[title="Module ' + count + '"]'),
    //     expect(page).toClick('.submit_button', {text: 'Add module'})
    //   ]);
    //
    //   var id = await page.$eval('.unpublished_module .ig-header-title span[title="Module '+ count+ '"]', el => el.closest('.context_module').id);
    //
    //   await Promise.all([
    //     page.waitForSelector('#'+ id+ ' i.icon-publish'),
    //     expect(page).toClick('#'+ id+ ' i.icon-unpublish')
    //   ])
    // }
  });


});