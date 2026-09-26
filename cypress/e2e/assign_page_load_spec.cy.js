// Simple E2E test to verify the Assign page loads correctly
describe('Assign Page Load Test', () => {
  // Optional: Add a separate test that tries to access the assign page without auth
  // This test will likely fail (redirect to login) but provides useful debugging info
  it('should attempt to access assign page (expected to redirect to login)', () => {
    // Visit the assign page directly
    cy.visit('http://localhost:5173/assign', { failOnStatusCode: false });
    
    // Wait for page to fully load
    cy.get('body', { timeout: 10000 }).should('not.be.empty');
    
    // Take a screenshot for debugging
    cy.screenshot('assign-page-redirect-debug');
    
    // Log the current URL to see if we were redirected
    cy.url().then(url => {
      cy.log(`Current URL after visiting /assign: ${url}`);
      
      // We expect to be redirected to login, so this is just informational
      if (url.includes('login')) {
        cy.log('As expected, we were redirected to login page');
      } else if (url.includes('assign')) {
        cy.log('Unexpectedly, we were NOT redirected from assign page');
      }
    });
    
    // Log page content for debugging
    cy.log('Page Content:');
    cy.get('body').then(($body) => {
      const text = $body.text();
      cy.log(text);
    });
  });
});
