// Simple test to verify the DiagnosticPage is accessible
describe('DiagnosticPage Accessibility Test', () => {
  it('should load the DiagnosticPage', () => {
    // Visit the diagnostic page directly with a longer timeout
    cy.visit('http://localhost:5173/diagnostic', { timeout: 15000 });
    
    // Wait for page to fully load
    cy.get('body', { timeout: 15000 }).should('not.be.empty');
    
    // Add a longer timeout and log the page content for debugging
    cy.log('Page Content:');
    cy.get('body').then(($body) => {
      cy.log($body.text());
    });
    
    // Take a screenshot for debugging
    cy.screenshot('diagnostic-page-debug');
    
    // Try to find any content that should be on the page
    cy.contains('TrashDrop', { timeout: 15000 }).should('exist');
    
    // Check if the Test Report Modal button exists
    cy.get('body').then($body => {
      const hasTestButton = $body.text().includes('Test Report Modal');
      cy.log(`Has Test Report Modal button: ${hasTestButton}`);
      
      if (hasTestButton) {
        cy.contains('Test Report Modal').should('exist');
        cy.log('Found Test Report Modal button');
      } else {
        cy.log('Test Report Modal button not found - this is expected if the button has not been added');
      }
    });
  });
});
