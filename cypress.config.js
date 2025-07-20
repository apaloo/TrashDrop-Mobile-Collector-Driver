import { defineConfig } from "cypress";
import vitePreprocessor from 'cypress-vite';

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:5173', // Vite's default port
    viewportWidth: 375, // Mobile viewport width
    viewportHeight: 812, // Mobile viewport height
    defaultCommandTimeout: 15000, // Increase timeout for commands
    pageLoadTimeout: 60000, // Increase page load timeout
    responseTimeout: 30000, // Increase API response timeout
    video: false, // Disable video recording to speed up tests
    screenshotOnRunFailure: true, // Always take screenshots on failure
    retries: {
      runMode: 2, // Retry failed tests up to 2 times in run mode
      openMode: 0 // Don't retry in open mode (Cypress UI)
    },
    // Add support for Vite
    setupNodeEvents(on, config) {
      on('file:preprocessor', vitePreprocessor())
      
      // Add browser launch options
      on('before:browser:launch', (browser = {}, launchOptions) => {
        if (browser.family === 'chromium' && browser.name !== 'electron') {
          // Auto-open devtools in headed mode
          launchOptions.args.push('--auto-open-devtools-for-tabs')
          // Disable web security for testing
          launchOptions.args.push('--disable-web-security')
          // Disable same-origin policy
          launchOptions.args.push('--disable-site-isolation-trials')
        }
        return launchOptions
      })
      
      // Log browser console messages
      on('task', {
        log(message) {
          console.log(message)
          return null
        },
        table(message) {
          console.table(message)
          return null
        }
      })
      
      return config
    },
    setupNodeEvents(on, config) {
      // Add custom event listeners here
      on('before:browser:launch', (browser = {}, launchOptions) => {
        // Add browser launch options
        if (browser.family === 'chromium' && browser.name !== 'electron') {
          // Auto-open devtools in headed mode
          launchOptions.args.push('--auto-open-devtools-for-tabs');
        }
        return launchOptions;
      });
      
      // Log browser console messages
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
        table(message) {
          console.table(message);
          return null;
        }
      });
    },
  },
  component: {
    devServer: {
      framework: 'react',
      bundler: 'vite',
    },
  },
});
