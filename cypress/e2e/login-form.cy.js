/// <reference types="cypress" />

describe('Login Form', () => {
  const testPhone = '+14155552671';

  before(() => {
    // Clear all auth data before all tests
    cy.clearAuthData();
    
    // Clear all browser data
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.window().then((win) => {
      win.sessionStorage.clear();
      win.localStorage.clear();
    });
  });

  beforeEach(() => {
    // Clear all auth data before each test
    cy.clearAuthData();
    
    // Visit the login page directly
    cy.log('Navigating to /login...');
    cy.visit('/login', {
      timeout: 30000,
      failOnStatusCode: false,
      onBeforeLoad(win) {
        // Disable service workers
        delete win.navigator.__proto__.serviceWorker;
        // Add debug logging
        win.console.log('Login page is being loaded in test environment');
      }
    });
    
    // Basic page load checks
    cy.document().should('exist');
    cy.get('body').should('be.visible');
    
    // Debug: Log page information
    cy.window().then((win) => {
      cy.log('Current URL:', win.location.href);
      cy.log('Page title:', win.document.title);
      
      // Log any console errors
      if (win.console && win.console.error) {
        const originalConsoleError = win.console.error;
        win.console.error = function(...args) {
          cy.log('Console Error:', ...args);
          originalConsoleError.apply(win.console, args);
        };
      }
    });
    
    // Wait for the login form or any interactive element
    cy.get('body').then(($body) => {
      // Log the current state of the page
      const pageText = $body.text().substring(0, 200);
      cy.log('Page content sample:', pageText);
      
      // Log all interactive elements for debugging
      const elements = $body.find('*');
      cy.log(`Found ${elements.length} elements on the page`);
      
      // Log the first 10 elements for debugging
      elements.slice(0, 10).each((i, el) => {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        const classes = el.className ? `.${el.className.split(' ').join('.')}` : '';
        const text = el.innerText ? ` (${el.innerText.substring(0, 30).replace(/\n/g, ' ').trim()}...)` : '';
        cy.log(`Element ${i + 1}: ${tag}${id}${classes}${text}`);
      });
    });
    
    // Wait for the login form or any interactive element
    cy.get('form, [role="form"], input, button', { timeout: 10000 })
      .should('be.visible');
  });

  it('should display the login form with all required elements', () => {
    // Debug: Log the current document for inspection
    cy.document().then((doc) => {
      cy.log('Document body content sample:', doc.body.innerText.substring(0, 500));
      cy.log('Document HTML sample:', doc.documentElement.outerHTML.substring(0, 1000));
    });
    
    // Check for the login form container
    cy.get('form', { timeout: 10000 })
      .should('be.visible')
      .within(() => {
        // Check for the phone input field
        cy.get('input[type="tel"], #phoneNumber', { timeout: 10000 })
          .should('be.visible')
          .should('have.attr', 'placeholder')
          .and('match', /phone number|e\.g\.|\+/i);
          
        // Check for the send OTP button
        cy.get('button')
          .contains(/send otp/i)
          .should('be.visible')
          .and('be.disabled'); // Should be disabled until phone is entered
      });
    
    // Check for the logo - using a more flexible selector
    cy.get('img')
      .should('be.visible')
      .and('have.attr', 'src')
      .and('match', /logo|trashdrop/i);
      
    // Check for the login title - more flexible selector
    cy.get('h1, h2, h3')
      .contains(/login|sign in|phone/i, { matchCase: false })
      .should('be.visible');
      
    // Take a screenshot for visual verification
    cy.screenshot('login-form-elements');
    
    // Additional debug: List all interactive elements
    cy.get('body').then(($body) => {
      const elements = $body.find('input, button, a, [role="button"], [tabindex]');
      cy.log(`Found ${elements.length} interactive elements on the page`);
      
      // Log the first 10 elements for debugging
      elements.slice(0, 10).each((i, el) => {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : '';
        const classes = el.className ? `.${el.className.split(' ').join('.')}` : '';
        const text = el.innerText ? ` (${el.innerText.substring(0, 30).replace(/\n/g, ' ').trim()}...)` : '';
        cy.log(`Element ${i + 1}: ${tag}${id}${classes}${text}`);
      });
    });
  });

  it('should validate phone number input', () => {
    // Test with empty input - button should be disabled
    cy.get('#phoneNumber').clear().blur();
    cy.contains('button', /Send OTP/i).should('be.disabled');
    
    // Test with too short number - button should be disabled
    cy.get('#phoneNumber').clear().type('123').blur();
    cy.contains('button', /Send OTP/i).should('be.disabled');
    
    // Test with valid phone number - button should be enabled
    const testPhone = '+233501234567';
    cy.get('#phoneNumber').clear().type(testPhone);
    
    // Check that the send button is now enabled
    cy.contains('button', /Send OTP/i)
      .should('be.visible')
      .should('not.be.disabled');
      
    // Take a screenshot of the form with valid input
    cy.screenshot('phone-validation-valid');
    
    // Log the current input state for debugging
    cy.get('#phoneNumber').then(($input) => {
      cy.log('Phone input state:', {
        value: $input.val(),
        required: $input[0].required,
        validity: $input[0].validity,
        validationMessage: $input[0].validationMessage
      });
    });
  });
});
