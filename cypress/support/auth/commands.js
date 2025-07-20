// Authentication test commands

/**
 * Clears all auth-related data from the browser
 */
Cypress.Commands.add('clearAuthData', () => {
  cy.clearCookies();
  cy.window().then((win) => {
    win.localStorage.clear();
    win.sessionStorage.clear();
  });
});

/**
 * Fills in the phone number field
 * @param {string} phoneNumber - The phone number to enter
 */
Cypress.Commands.add('enterPhoneNumber', (phoneNumber) => {
  cy.get('input[type="tel"]', { timeout: 10000 })
    .should('be.visible')
    .clear()
    .type(phoneNumber);
    
  // Verify the input has the expected value
  cy.get('input[type="tel"]').should('have.value', phoneNumber);
});

/**
 * Clicks the send verification code button
 */
Cypress.Commands.add('clickSendVerificationCode', () => {
  cy.contains('button', /Send Verification Code|Login/i)
    .should('be.visible')
    .should('not.be.disabled')
    .click();
    
  // Verify loading state appears
  cy.contains('button', /Sending.../i).should('exist');
});

/**
 * Enters the OTP code
 * @param {string} otp - The OTP code to enter
 */
Cypress.Commands.add('enterOtp', (otp) => {
  cy.get('input[inputmode="numeric"]', { timeout: 10000 })
    .should('be.visible')
    .clear()
    .type(otp);
    
  // Verify the input has the expected value
  cy.get('input[inputmode="numeric"]').should('have.value', otp);
});

/**
 * Clicks the verify OTP button
 */
Cypress.Commands.add('clickVerifyOtp', () => {
  cy.contains('button', /Verify OTP|Login/i)
    .should('be.visible')
    .should('not.be.disabled')
    .click();
    
  // Verify loading state appears
  cy.contains('button', /Verifying.../i).should('exist');
});

/**
 * Verifies the user is logged in
 * @param {string} phoneNumber - The expected phone number
 */
Cypress.Commands.add('verifyLoggedIn', (phoneNumber) => {
  // Verify URL changes to map page
  cy.url({ timeout: 10000 }).should('include', '/map');
  
  // Verify auth state in localStorage
  cy.window().then((win) => {
    const userData = JSON.parse(win.localStorage.getItem('sb-user') || '{}');
    expect(userData.phone).to.eq(phoneNumber);
    expect(win.localStorage.getItem('sb-access-token')).to.exist;
    expect(win.localStorage.getItem('sb-refresh-token')).to.exist;
  });
  
  // Verify map container is visible
  cy.get('[data-testid="map-container"]', { timeout: 10000 })
    .should('be.visible');
});

/**
 * Mocks the OTP send request
 * @param {string} sessionId - The session ID to return in the response
 */
Cypress.Commands.add('mockOtpSend', (sessionId = `test-session-${Date.now()}`) => {
  cy.intercept('POST', '**/auth/v1/otp', (req) => {
    return Cypress.Promise.delay(500).then(() => {
      req.reply({
        statusCode: 200,
        body: {
          message: 'OTP sent successfully',
          sessionId: sessionId
        }
      });
    });
  }).as('sendOtp');
  
  return cy.wrap(sessionId);
});

/**
 * Mocks the OTP verification request
 * @param {string} phoneNumber - The expected phone number
 * @param {string} sessionId - The expected session ID
 */
Cypress.Commands.add('mockOtpVerify', (phoneNumber, sessionId) => {
  const testAccessToken = `test-access-token-${Date.now()}`;
  const testRefreshToken = `test-refresh-token-${Date.now()}`;
  
  cy.intercept('POST', '**/auth/v1/verify', (req) => {
    return Cypress.Promise.delay(500).then(() => {
      req.reply({
        statusCode: 200,
        body: {
          access_token: testAccessToken,
          refresh_token: testRefreshToken,
          expires_in: 3600,
          token_type: 'bearer',
          user: {
            id: 'test-user-id',
            phone: phoneNumber,
            role: 'collector',
            created_at: new Date().toISOString()
          }
        }
      });
    });
  }).as('verifyOtp');
  
  return cy.wrap({
    accessToken: testAccessToken,
    refreshToken: testRefreshToken
  });
});
