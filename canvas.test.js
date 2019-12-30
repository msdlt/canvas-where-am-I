const axios = require('axios');
const assert = require('assert');
const dotenv = require('dotenv');

dotenv.config();
jest.setTimeout(60000);

describe ('Canvas', () => {
  beforeAll(async () => {
    const token = process.env.OAUTH_TOKEN;
    assert(token, 'You must set the environmental variable OAUTH_TOKEN');
    await axios.get("https://canvas.ox.ac.uk/login/session_token", {headers: {'Authorization': 'Bearer '+token }})
      .then((response) => {
        return page.goto(response.data.session_url);
      });
  });

  it('should be at dashboard', async () => {
    await expect(page).toMatch('Dashboard')
    await expect(page).toClick('.ic-DashboardCard__link')
    await page.waitForNavigation();
    await expect(page).toClick('a', {text: "Student view"});
    await page.waitForNavigation();
    await page.addScriptTag({path: './canvas-where-am-I.js'});
    await page.addStyleTag({path: './canvas-where-am-I.css'});
    await expect(page).toMatch('First Module');
  });

});