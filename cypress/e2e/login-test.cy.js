/// <reference types="cypress" />

describe('Login Page', () => {
  beforeEach(() => {
    // Clear any existing state
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.visit('/');
    
    // Wait for the app to load
    cy.get('body').should('be.visible');
  });

  it('should display the login form', () => {
    // Check for the app container
    cy.get('#root').should('exist');
    
    // Check for the login form elements with more flexible selectors
    cy.get('body').then(($body) => {
      // Log the body content for debugging
      console.log('Body content:', $body.html().substring(0, 500) + '...');
      
      // Look for any input fields that might be for phone number
      const phoneInput = $body.find('input[type="tel"], input[placeholder*="phone"], input[placeholder*="Phone"]').first();
      
      if (phoneInput.length > 0) {
        cy.wrap(phoneInput).should('be.visible');
      } else {
        // If no specific phone input is found, look for any text input
        const textInput = $body.find('input[type="text"], input:not([type])').first();
        if (textInput.length > 0) {
          cy.wrap(textInput).should('be.visible');
        } else {
          // If no inputs are found, fail the test with a helpful message
          assert.fail('No input fields found on the login page');
        }
      }
      
      // Look for any buttons that might be for login/send OTP
      const loginButton = $body.find('button, input[type="submit"], [role="button"]')
        .filter((i, el) => {
          const text = Cypress.$(el).text().toLowerCase();
          return text.includes('login') || 
                 text.includes('send') || 
                 text.includes('verify') || 
                 text.includes('otp') ||
                 text.includes('continue');
        }).first();
      
      if (loginButton.length > 0) {
        cy.wrap(loginButton).should('be.visible');
      } else {
        // If no specific button is found, look for any button
        const anyButton = $body.find('button, input[type="submit"], [role="button"]').first();
        if (anyButton.length > 0) {
          cy.wrap(anyButton).should('be.visible');
        } else {
          // If no buttons are found, fail the test with a helpful message
          assert.fail('No buttons found on the login page');
        }
      }
    });
    
    // Take a screenshot for debugging
    cy.screenshot('login-form');
  });

  it('should allow entering a phone number', () => {
    // Find the phone input field
    cy.get('body').then(($body) => {
      // Try to find a phone input field
      let phoneInput = $body.find('input[type="tel"]');
      
      if (phoneInput.length === 0) {
        // If no tel input, look for any text input that might be for phone
        phoneInput = $body.find('input[type="text"], input:not([type])').first();
      }
      
      if (phoneInput.length > 0) {
        // Type a test phone number
        const testPhone = '1234567890';
        cy.wrap(phoneInput).type(testPhone).should('have.value', testPhone);
        
        // Take a screenshot
        cy.screenshot('phone-number-entered');
      } else {
        // If no input is found, log the body for debugging
        console.log('No input field found. Body content:', $body.html().substring(0, 500) + '...');
        cy.screenshot('no-input-field-found');
        assert.fail('No input field found on the login page');
      }
    });
  });

  it('should handle login with test credentials', () => {
    // Mock the OTP send request
    cy.intercept('POST', '**/auth/v1/otp', {
      statusCode: 200,
      body: {
        message: 'OTP sent successfully'
      }
    }).as('sendOtp');
    
    // Mock the OTP verification request
    cy.intercept('POST', '**/auth/v1/verify', {
      statusCode: 200,
      body: {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        user: {
          id: 'test-user-id',
          phone: '+1234567890'
        }
      }
    }).as('verifyOtp');
    
    // Find and fill the phone number input
    cy.get('body').then(($body) => {
      // Try to find a phone input field
      let phoneInput = $body.find('input[type="tel"]');
      
      if (phoneInput.length === 0) {
        // If no tel input, look for any text input that might be for phone
        phoneInput = $body.find('input[type="text"], input:not([type])').first();
      }
      
      if (phoneInput.length === 0) {
        assert.fail('No input field found for phone number');
      }
      
      // Type the phone number
      const testPhone = '1234567890';
      cy.wrap(phoneInput).type(testPhone);
      
      // Find and click the send OTP button
      const sendButton = $body.find('button, input[type="submit"], [role="button"]')
        .filter((i, el) => {
          const text = Cypress.$(el).text().toLowerCase();
          return text.includes('send') || 
                 text.includes('login') || 
                 text.includes('verify') || 
                 text.includes('otp') ||
                 text.includes('continue');
        }).first();
      
      if (sendButton.length === 0) {
        assert.fail('No send OTP button found');
      }
      
      cy.wrap(sendButton).click();
      
      // Wait for the OTP send request
      cy.wait('@sendOtp');
      
      // Find and fill the OTP input
      cy.get('body').then(($otpBody) => {
        const otpInput = $otpBody.find('input[type="text"], input[type="number"], input:not([type])')
          .filter((i, el) => {
            const placeholder = Cypress.$(el).attr('placeholder') || '';
            return placeholder.toLowerCase().includes('otp') || 
                   placeholder.toLowerCase().includes('code') ||
                   placeholder.match(/^\d{6}$/);
          }).first();
        
        if (otpInput.length === 0) {
          // If no specific OTP input is found, try to find any input that appeared after clicking send
          const allInputs = $otpBody.find('input');
          console.log('Available inputs after sending OTP:', allInputs.length);
          allInputs.each((i, el) => {
            console.log(`Input ${i}:`, {
              type: el.type,
              id: el.id,
              name: el.name,
              placeholder: el.placeholder,
              class: el.className
            });
          });
          
          // Take a screenshot to see what's on the screen
          cy.screenshot('otp-screen');
          
          // Try to find the OTP input with a delay in case it's added dynamically
          cy.get('input', { timeout: 10000 }).should('exist');
          
          // If we still can't find it, fail with a helpful message
          cy.get('body').then(($newBody) => {
            const newOtpInput = $newBody.find('input[type="text"], input[type="number"], input:not([type])')
              .not(phoneInput);
              
            if (newOtpInput.length === 0) {
              assert.fail('Could not find OTP input field after sending OTP');
            } else {
              cy.wrap(newOtpInput.first()).type('123456');
            }
          });
        } else {
          cy.wrap(otpInput).type('123456');
        }
        
        // Find and click the verify button
        const verifyButton = $otpBody.find('button, input[type="submit"], [role="button"]')
          .filter((i, el) => {
            const text = Cypress.$(el).text().toLowerCase();
            return text.includes('verify') || 
                   text.includes('login') || 
                   text.includes('submit') || 
                   text.includes('continue');
          }).first();
        
        if (verifyButton.length === 0) {
          assert.fail('No verify button found');
        }
        
        cy.wrap(verifyButton).click();
        
        // Wait for the OTP verification request
        cy.wait('@verifyOtp');
        
        // Verify we're redirected to the map page
        cy.url().should('include', '/map');
        
        // Take a screenshot after successful login
        cy.screenshot('after-login');
      });
    });
  });
});
