module.exports = {
  launch: {
    headless: true,
    // devtools: true,
    slowMo: 50,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ]
  },
  // Don't error if there are console messages
  // At the moment Canvas has errors in the console on a course
  exitOnPageError: false,
  // We tried this and it improved tests, but the Student view would still fail.
  // browserContext: 'incognito'

}

