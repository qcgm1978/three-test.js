// Karma configuration
// Generated on Mon May 09 2016 13:57:37 GMT-0700 (Pacific Daylight Time)
// const ChromiumRevision = require('puppeteer/package.json').puppeteer.chromium_revision
// const Downloader = require('puppeteer/utils/ChromiumDownloader')
// const revisionInfo = Downloader.revisionInfo(Downloader.currentPlatform(), ChromiumRevision)

// process.env.CHROME_BIN = revisionInfo.executablePath;
// console.log = function() {}
module.exports = function (config) {
  config.set({

    // base path that will be used to resolve all patterns (eg. files, exclude)
    basePath: '',


    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['jasmine'],
    // client: {
    //     captureConsole: false
    // },

    // list of files / patterns to load in the browser
    files: [
      'build/three.js',
      'test/jasmine/*.js'
      // { pattern: 'src/client/screen.css', included: false }
      // 't-SNE/*.js'
    ],


    // list of files to exclude
    exclude: [
    ],


    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
    },


    // test results reporter to use
    // possible values: 'dots', 'progress'
    // available reporters: https://npmjs.org/browse/keyword/karma-reporter
    reporters: ['dots'],


    // web server port
    port: 9876,


    // enable / disable colors in the output (reporters and logs)
    colors: true,


    // level of logging
    // possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
    logLevel: config.LOG_ERROR,


    // enable / disable watching file and executing tests whenever any file changes
    autoWatch: true,


    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    // browsers: ['ChromeHeadless'],
    // browsers:['Chrome'],
    browsers: ['ChromeHeadless_without_security'],
    customLaunchers: {
      ChromeHeadless_without_security: {
        base: 'ChromeHeadless',
        flags: ['--disable-web-security']
      }
    },
    browserNoActivityTimeout: 60000,
    // Continuous Integration mode
    // if true, Karma captures browsers, runs the tests and exits
    singleRun: false,

    // Concurrency level
    // how many browser should be started simultaneous
    concurrency: Infinity
  })
}