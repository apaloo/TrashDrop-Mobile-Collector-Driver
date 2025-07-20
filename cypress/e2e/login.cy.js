/// <reference types="cypress" />

describe('Login Flow', () => {
  beforeEach(() => {
    // Clear all browser data before each test
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.visit('/');
    
    // Mock the OTP sending and verification
    cy.intercept('POST', '**/auth/v1/otp', {
      statusCode: 200,
      body: { success: true }
    }).as('sendOtp');
    
    cy.intercept('POST', '**/auth/v1/verify', {
      statusCode: 200,
      body: {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        user: {
          id: 'test-user-id',
          phone: '+1234567890',
          role: 'collector'
        },
        expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
      }
    }).as('verifyOtp');
  });

  it('should display the login page with phone number input', () => {
    // Verify we're on the login page
    cy.url().should('include', '/login');
    
    // Check for the app logo and title
    cy.get('img[alt="TrashDrop Logo"]').should('be.visible');
    cy.contains('h1', 'TrashDrop').should('be.visible');
    
    // Check for phone number input
    cy.get('input[type="tel"]')
      .should('be.visible')
      .should('have.attr', 'placeholder', 'Enter your phone number')
      .should('have.attr', 'required');
    
    // Check for the send OTP button
    cy.contains('button', /^Send Verification Code$/).should('be.visible');
    
    // Take a screenshot for documentation
    cy.screenshot('login-page');
  });

  it('should show OTP input after sending verification code', () => {
    // Enter phone number
    const testPhoneNumber = '+1234567890';
    cy.get('input[type="tel"]').type(testPhoneNumber);
    
    // Click send OTP button
    cy.contains('button', /^Send Verification Code$/).click();
    
    // Wait for the OTP request to complete
    cy.wait('@sendOtp').its('request.body').should('deep.include', {
      phone: testPhoneNumber
    });
    
    // Verify OTP input is shown
    cy.get('input[type="text"][inputmode="numeric"]')
      .should('be.visible')
      .should('have.attr', 'placeholder', 'Enter 6-digit code')
      .should('have.attr', 'maxlength', '6')
      .should('have.attr', 'required');
    
    // Verify the verify button is shown
    cy.contains('button', 'Verify Code').should('be.visible');
    
    // Take a screenshot
    cy.screenshot('otp-verification');
  });

  it('should log in successfully with valid OTP', () => {
    // First, go through the OTP sending flow
    const testPhoneNumber = '+1234567890';
    cy.get('input[type="tel"]').type(testPhoneNumber);
    cy.contains('button', /^Send Verification Code$/).click();
    cy.wait('@sendOtp');
    
    // Enter OTP
    const testOtp = '123456';
    cy.get('input[type="text"][inputmode="numeric"]').type(testOtp);
    
    // Click verify button
    cy.contains('button', 'Verify Code').click();
    
    // Wait for verification request
    cy.wait('@verifyOtp').its('request.body').should('deep.include', {
      phone: testPhoneNumber,
      token: testOtp,
      type: 'sms'
    });
    
    // Verify successful login by checking for elements on the map page
    cy.url().should('include', '/map');
    
    // Verify the map container is visible
    cy.get('.map-container').should('be.visible');
    
    // Take a screenshot
    cy.screenshot('map-page-after-login');
  });
  
  it('should show error for invalid phone number format', () => {
    // Enter invalid phone number
    cy.get('input[type="tel"]').type('123');
    
    // Click send OTP button
    cy.contains('button', /^Send Verification Code$/).click();
    
    // Verify error message is shown
    cy.get('.text-red-600')
      .should('be.visible')
      .should('contain', 'Invalid phone number');
    
    // Take a screenshot
    cy.screenshot('login-error-invalid-phone');
  });
  
  it('should show error for invalid OTP', () => {
    // Mock a failed OTP verification
    cy.intercept('POST', '**/auth/v1/verify', {
      statusCode: 400,
      body: {
        error: 'Invalid OTP',
        message: 'The OTP provided is invalid or has expired.'
      }
    }).as('verifyOtpError');
    
    // Go through the OTP sending flow
    const testPhoneNumber = '+1234567890';
    cy.get('input[type="tel"]').type(testPhoneNumber);
    cy.contains('button', /^Send Verification Code$/).click();
    cy.wait('@sendOtp');
    
    // Enter invalid OTP
    cy.get('input[type="text"][inputmode="numeric"]').type('000000');
    
    // Click verify button
    cy.contains('button', 'Verify Code').click();
    
    // Wait for verification request
    cy.wait('@verifyOtpError');
    
    // Verify error message is shown
    cy.get('.text-red-600')
      .should('be.visible')
      .should('contain', 'Invalid OTP');
    
    // Take a screenshot
    cy.screenshot('login-error-invalid-otp');
  });
});
    // Visit the map page directly
    cy.visit('/map');
    
    // Wait for the page to load
    cy.get('body').should('be.visible');
    
    // Check if we're on the map page
    cy.url().should('include', '/map');
    
    // Log the document structure for debugging
    cy.document().then((doc) => {
      console.log('Document title:', doc.title);
      console.log('Body classes:', doc.body.className);
      
      // Log all elements with map-related classes
      const mapElements = doc.querySelectorAll('[class*="map"], [class*="leaflet"], [id*="map"]');
      console.log(`Found ${mapElements.length} potential map elements`);
      
      // Log information about potential map elements
      mapElements.forEach((el, i) => {
        console.log(`Element ${i}:`, {
          tag: el.tagName,
          id: el.id,
          class: el.className,
          visible: el.offsetParent !== null,
          width: el.offsetWidth,
          height: el.offsetHeight
        });
      });
    });
    
    // Take a screenshot of the page
    cy.screenshot('map-page');
    
    // Check for navigation elements
    cy.get('nav').should('be.visible');
    
    // Check for map container with a more permissive selector
    cy.get('body').then(($body) => {
      // Look for any element that might be the map container
      const mapContainer = $body.find('[class*="map"], [class*="leaflet"], [id*="map"], canvas');
      
      if (mapContainer.length > 0) {
        // If we found potential map elements, log them
        console.log('Found potential map elements:', mapContainer.length);
        
        // Check if any of them are visible and have reasonable dimensions
        const visibleMapContainers = mapContainer.filter((i, el) => {
          const $el = Cypress.$(el);
          return $el.is(':visible') && $el.width() > 100 && $el.height() > 100;
        });
        
        if (visibleMapContainers.length > 0) {
          cy.wrap(visibleMapContainers.first()).should('be.visible');
        } else {
          // If no visible map container found, log the issue
          console.log('No visible map container found with sufficient dimensions');
          cy.wrap(mapContainer.first()).should('be.visible');
        }
      } else {
        // If no map elements found at all, fail the test
        throw new Error('No map container elements found on the page');
      }
    });
  });
});
