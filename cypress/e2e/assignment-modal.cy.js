/// <reference types="cypress" />

describe('Assignment Details Modal', () => {
  beforeEach(() => {
    // Clear any existing state
    cy.clearCookies();
    cy.clearLocalStorage();
    
    // Mock API response for assignments
    cy.intercept('GET', '/api/assignments*', {
      statusCode: 200,
      body: {
        available: [
          { 
            id: 1, 
            status: 'available', 
            location: '123 Main St, City', 
            distance: '1.2 km',
            details: 'Residential pickup',
            estimatedTime: '30 minutes',
            wasteType: 'General',
            specialInstructions: 'Backyard access required',
            createdAt: '2023-05-01T10:00:00Z',
            updatedAt: '2023-05-01T10:00:00Z'
          }
        ],
        accepted: [
          { 
            id: 2, 
            status: 'accepted', 
            location: '456 Oak Ave, Town', 
            distance: '2.5 km',
            details: 'Commercial pickup',
            estimatedTime: '45 minutes',
            wasteType: 'Recyclables',
            specialInstructions: 'Use service entrance',
            acceptedAt: '2023-05-02T09:30:00Z',
            createdAt: '2023-05-01T15:30:00Z',
            updatedAt: '2023-05-02T09:30:00Z'
          }
        ],
        completed: []
      }
    }).as('getAssignments');
    
    // Mock API response for accepting an assignment
    cy.intercept('POST', '/api/assignments/*/accept', {
      statusCode: 200,
      body: {
        success: true,
        message: 'Assignment accepted successfully'
      }
    }).as('acceptAssignment');
    
    // Mock API response for completing an assignment
    cy.intercept('POST', '/api/assignments/*/complete', {
      statusCode: 200,
      body: {
        success: true,
        message: 'Assignment completed successfully'
      }
    }).as('completeAssignment');
    
    // Mock API response for getting assignment details
    cy.intercept('GET', '/api/assignments/*', (req) => {
      const assignmentId = req.url.split('/').pop();
      const response = {
        statusCode: 200,
        body: {
          id: parseInt(assignmentId),
          status: assignmentId === '1' ? 'available' : 'accepted',
          location: assignmentId === '1' ? '123 Main St, City' : '456 Oak Ave, Town',
          distance: assignmentId === '1' ? '1.2 km' : '2.5 km',
          details: assignmentId === '1' ? 'Residential pickup' : 'Commercial pickup',
          estimatedTime: assignmentId === '1' ? '30 minutes' : '45 minutes',
          wasteType: assignmentId === '1' ? 'General' : 'Recyclables',
          specialInstructions: assignmentId === '1' ? 'Backyard access required' : 'Use service entrance',
          createdAt: '2023-05-01T10:00:00Z',
          updatedAt: '2023-05-02T09:30:00Z'
        }
      };
      
      if (assignmentId === '2') {
        response.body.acceptedAt = '2023-05-02T09:30:00Z';
      }
      
      req.reply(response);
    }).as('getAssignmentDetails');
    
    // Mock Google Maps API
    cy.intercept('https://maps.googleapis.com/**', {
      statusCode: 200,
      body: {}
    }).as('googleMaps');
    
    // Visit the application
    cy.visit('/', {
      failOnStatusCode: false,
      onBeforeLoad(win) {
        // Disable service workers
        delete win.navigator.__proto__.serviceWorker;
      }
    });
    
    // Wait for assignments to load
    cy.wait('@getAssignments');
  });

  it('should open the assignment details modal when clicking on an available assignment', () => {
    // Click on the first available assignment
    cy.get('[data-testid="assignment-item-1"]').click();
    
    // Check that the modal is visible
    cy.get('[data-testid="assignment-modal"]').should('be.visible');
    
    // Check that the assignment details are displayed correctly
    cy.get('[data-testid="assignment-location"]').should('contain', '123 Main St, City');
    cy.get('[data-testid="assignment-distance"]').should('contain', '1.2 km');
    cy.get('[data-testid="assignment-details"]').should('contain', 'Residential pickup');
    cy.get('[data-testid="assignment-estimated-time"]').should('contain', '30 minutes');
    cy.get('[data-testid="assignment-waste-type"]').should('contain', 'General');
    cy.get('[data-testid="assignment-instructions"]').should('contain', 'Backyard access required');
    
    // Check that the map container is visible
    cy.get('[data-testid="assignment-map"]').should('be.visible');
    
    // Check that the Accept button is visible for available assignments
    cy.get('[data-testid="accept-assignment-btn"]').should('be.visible');
    
    // Close the modal
    cy.get('[data-testid="close-modal-btn"]').click();
    
    // Check that the modal is closed
    cy.get('[data-testid="assignment-modal"]').should('not.exist');
  });

  it('should allow accepting an available assignment', () => {
    // Click on the first available assignment
    cy.get('[data-testid="assignment-item-1"]').click();
    
    // Click the Accept button
    cy.get('[data-testid="accept-assignment-btn"]').click();
    
    // Check that the API was called to accept the assignment
    cy.wait('@acceptAssignment').its('request.body').should('deep.equal', {
      assignmentId: 1
    });
    
    // Check that a success message is displayed
    cy.get('[data-testid="toast-message"]').should('be.visible').and('contain', 'Assignment accepted successfully');
    
    // Check that the modal is closed
    cy.get('[data-testid="assignment-modal"]').should('not.exist');
    
    // Check that the assignment is moved to the Accepted tab
    cy.get('[data-testid="accepted-tab"]').click();
    cy.get('[data-testid="assignment-item-1"]').should('exist');
  });

  it('should display the correct action buttons for an accepted assignment', () => {
    // Go to the Accepted tab
    cy.get('[data-testid="accepted-tab"]').click();
    
    // Click on the first accepted assignment
    cy.get('[data-testid="assignment-item-2"]').click();
    
    // Check that the modal is visible
    cy.get('[data-testid="assignment-modal"]').should('be.visible');
    
    // Check that the Complete and Dumping Site buttons are visible for accepted assignments
    cy.get('[data-testid="complete-assignment-btn"]').should('be.visible');
    cy.get('[data-testid="dumping-site-btn"]').should('be.visible');
    
    // Close the modal
    cy.get('[data-testid="close-modal-btn"]').click();
  });

  it('should open the completion modal when clicking the Complete button', () => {
    // Go to the Accepted tab
    cy.get('[data-testid="accepted-tab"]').click();
    
    // Click on the first accepted assignment
    cy.get('[data-testid="assignment-item-2"]').click();
    
    // Click the Complete button
    cy.get('[data-testid="complete-assignment-btn"]').click();
    
    // Check that the completion modal is visible
    cy.get('[data-testid="completion-modal"]').should('be.visible');
    
    // Check that the photo upload interface is displayed
    cy.get('[data-testid="photo-upload"]').should('be.visible');
    
    // Check that the location verification is displayed
    cy.get('[data-testid="location-verification"]').should('be.visible');
    
    // Check that the Submit button is disabled (no photos uploaded yet)
    cy.get('[data-testid="submit-completion-btn"]').should('be.disabled');
    
    // Close the modal
    cy.get('[data-testid="close-modal-btn"]').click();
  });

  it('should open the disposal modal when clicking the Dumping Site button', () => {
    // Go to the Accepted tab
    cy.get('[data-testid="accepted-tab"]').click();
    
    // Click on the first accepted assignment
    cy.get('[data-testid="assignment-item-2"]').click();
    
    // Click the Dumping Site button
    cy.get('[data-testid="dumping-site-btn"]').click();
    
    // Check that the disposal modal is visible
    cy.get('[data-testid="disposal-modal"]').should('be.visible');
    
    // Check that the nearest dumping site information is displayed
    cy.get('[data-testid="dumping-site-info"]').should('be.visible');
    
    // Check that the Directions and Dispose buttons are visible
    cy.get('[data-testid="get-directions-btn"]').should('be.visible');
    cy.get('[data-testid="dispose-btn"]').should('be.visible');
    
    // Close the modal
    cy.get('[data-testid="close-modal-btn"]').click();
  });

  it('should complete an assignment after disposal', () => {
    // Go to the Accepted tab
    cy.get('[data-testid="accepted-tab"]').click();
    
    // Click on the first accepted assignment
    cy.get('[data-testid="assignment-item-2"]').click();
    
    // Click the Dumping Site button
    cy.get('[data-testid="dumping-site-btn"]').click();
    
    // Click the Dispose button
    cy.get('[data-testid="dispose-btn"]').click();
    
    // Check that the disposal confirmation is displayed
    cy.get('[data-testid="disposal-confirmation"]').should('be.visible');
    
    // Click the Confirm button
    cy.get('[data-testid="confirm-disposal-btn"]').click();
    
    // Check that the API was called to complete the assignment
    cy.wait('@completeAssignment').its('request.body').should('deep.equal', {
      assignmentId: 2,
      disposalConfirmed: true
    });
    
    // Check that a success message is displayed
    cy.get('[data-testid="toast-message"]').should('be.visible').and('contain', 'Assignment completed successfully');
    
    // Check that the modal is closed
    cy.get('[data-testid="assignment-modal"]').should('not.exist');
    
    // Check that the assignment is moved to the Completed tab
    cy.get('[data-testid="completed-tab"]').click();
    cy.get('[data-testid="assignment-item-2"]').should('exist');
  });
});
