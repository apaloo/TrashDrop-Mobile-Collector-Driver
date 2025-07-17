// End-to-end test for the "View Report" button functionality using DiagnosticPage
describe('View Report Button Test via DiagnosticPage', () => {
  // Setup: Visit the diagnostic page before each test
  beforeEach(() => {
    // Visit the diagnostic page directly (no auth required)
    cy.visit('http://localhost:5173/diagnostic');
    
    // Wait for page to fully load
    cy.get('body', { timeout: 10000 }).should('not.be.empty');
    
    // Log page content for debugging
    cy.log('Diagnostic Page Content:');
    cy.get('body').then(($body) => {
      cy.log($body.text());
    });
  });
  
  // Verify that the diagnostic page has loaded with the expected elements
  it('should load the Diagnostic page with Test Report Modal button', () => {
    // Check for diagnostic page title
    cy.contains('Diagnostic', { timeout: 10000 }).should('exist');
    
    // Check for Test Report Modal button which should exist
    cy.get('body').then($body => {
      const hasTestReportButton = $body.text().includes('Test Report Modal');
      cy.log(`Has Test Report Modal button: ${hasTestReportButton}`);
      
      // Using cy.wrap to properly handle the assertion in the Cypress command chain
      cy.wrap(hasTestReportButton).should('be.true', 'Diagnostic page should contain Test Report Modal button');
    });
    
    // Log which buttons are present
    cy.log('Checking which buttons are present:');
    cy.get('button').then($buttons => {
      const buttonTexts = $buttons.map((i, el) => Cypress.$(el).text()).get();
      cy.log(buttonTexts.join(', '));
    });
  });

  it('should open the Report Modal when Test Report Modal button is clicked', () => {
    // Check if Test Report Modal button exists
    cy.get('body').then($body => {
      const hasTestReportButton = $body.text().includes('Test Report Modal');
      cy.log(`Has Test Report Modal button: ${hasTestReportButton}`);
      
      if (hasTestReportButton) {
        // Find and click the Test Report Modal button
        cy.contains('Test Report Modal').click();
        
        // Wait for modal to appear
        cy.wait(1000);
        
        // Check if modal appears
        cy.get('body').then($body => {
          const hasModalTitle = $body.text().includes('Disposal Report');
          cy.log(`Modal opened with title 'Disposal Report': ${hasModalTitle}`);
          
          // Using cy.wrap to properly handle the assertion in the Cypress command chain
          cy.wrap(hasModalTitle).should('be.true', 'Report Modal should open with title');
          
          // Check for specific information in the modal
          cy.get('body').then($modalBody => {
            // Log modal content for debugging
            cy.log('Modal Content:');
            cy.log($modalBody.text());
            
            // Check for expected sections
            const hasAssignmentDetails = $modalBody.text().includes('Assignment Details');
            const hasCompletionInfo = $modalBody.text().includes('Completion Information');
            const hasDisposalInfo = $modalBody.text().includes('Disposal Information');
            
            cy.log(`Has Assignment Details section: ${hasAssignmentDetails}`);
            cy.log(`Has Completion Information section: ${hasCompletionInfo}`);
            cy.log(`Has Disposal Information section: ${hasDisposalInfo}`);
            
            // Verify at least one section exists
            const hasSections = hasAssignmentDetails || hasCompletionInfo || hasDisposalInfo;
            cy.wrap(hasSections).should('be.true', 'Report Modal should contain at least one information section');
            
            // Close the modal
            cy.contains('button', 'Close').click({ force: true });
            
            // Wait for modal to close
            cy.wait(500);
            
            // Verify that the modal is closed
            cy.contains('Disposal Report').should('not.exist');
          });
        });
      } else {
        cy.log('No Test Report Modal button found, skipping modal test');
        // Fail the test if the button doesn't exist
        cy.wrap(false).should('be.true', 'Test Report Modal button should exist');
      }
    });
  });

  it('should verify Report Modal contains expected data fields', () => {
    // Check if Test Report Modal button exists
    cy.get('body').then($body => {
      const hasTestReportButton = $body.text().includes('Test Report Modal');
      
      if (hasTestReportButton) {
        // Find and click the Test Report Modal button
        cy.contains('Test Report Modal').click();
        
        // Wait for modal to appear
        cy.wait(1000);
        
        // Check for specific fields that should be present in the modal
        cy.get('body').then($modalBody => {
          // Log modal content for debugging
          cy.log('Checking for data fields in modal:');
          
          // Check for specific fields that should be present
          const hasLocation = $modalBody.text().includes('Location');
          const hasDisposalSite = $modalBody.text().includes('Disposal Site') || $modalBody.text().includes('Disposal Center');
          const hasTimestamp = $modalBody.text().includes('Timestamp') || $modalBody.text().includes('Date');
          
          cy.log(`Has Location field: ${hasLocation}`);
          cy.log(`Has Disposal Site field: ${hasDisposalSite}`);
          cy.log(`Has Timestamp field: ${hasTimestamp}`);
          
          // Verify at least one field exists
          const hasFields = hasLocation || hasDisposalSite || hasTimestamp;
          cy.wrap(hasFields).should('be.true', 'Report Modal should contain at least one data field');
          
          // Close the modal
          cy.contains('button', 'Close').click({ force: true });
          
          // Wait for modal to close
          cy.wait(500);
          
          // Verify that the modal is closed
          cy.contains('Disposal Report').should('not.exist');
        });
      } else {
        cy.log('No Test Report Modal button found, skipping modal test');
        // Fail the test if the button doesn't exist
        cy.wrap(false).should('be.true', 'Test Report Modal button should exist');
      }
    });
  });

  /*
  it('should have additional modal interaction tests', () => {
    // Future tests can be added here
  });
  */
});
