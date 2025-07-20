/// <reference types="cypress" />

describe('Tab Navigation', () => {
  beforeEach(() => {
    // Clear any existing state
    cy.clearCookies();
    cy.clearLocalStorage();
    
    // Visit the root URL with no caching
    cy.visit('/', {
      failOnStatusCode: false,
      onBeforeLoad(win) {
        // Disable service workers
        delete win.navigator.__proto__.serviceWorker;
      }
    });
  });

  it('should display the default tab', () => {
    // Check that the Available tab is active by default
    cy.get('[data-testid="available-tab"]').should('have.class', 'active');
    cy.get('[data-testid="accepted-tab"]').should('not.have.class', 'active');
    cy.get('[data-testid="completed-tab"]').should('not.have.class', 'active');
    
    // Check that the Available tab content is visible
    cy.get('[data-testid="available-assignments"]').should('be.visible');
  });

  it('should switch to the Accepted tab', () => {
    // Click on the Accepted tab
    cy.get('[data-testid="accepted-tab"]').click();
    
    // Check that the Accepted tab is now active
    cy.get('[data-testid="accepted-tab"]').should('have.class', 'active');
    cy.get('[data-testid="available-tab"]').should('not.have.class', 'active');
    cy.get('[data-testid="completed-tab"]').should('not.have.class', 'active');
    
    // Check that the Accepted tab content is visible
    cy.get('[data-testid="accepted-assignments"]').should('be.visible');
  });

  it('should switch to the Completed tab', () => {
    // Click on the Completed tab
    cy.get('[data-testid="completed-tab"]').click();
    
    // Check that the Completed tab is now active
    cy.get('[data-testid="completed-tab"]').should('have.class', 'active');
    cy.get('[data-testid="available-tab"]').should('not.have.class', 'active');
    cy.get('[data-testid="accepted-tab"]').should('not.have.class', 'active');
    
    // Check that the Completed tab content is visible
    cy.get('[data-testid="completed-assignments"]').should('be.visible');
  });

  it('should maintain tab state when refreshing the page', () => {
    // Switch to the Accepted tab
    cy.get('[data-testid="accepted-tab"]').click();
    
    // Refresh the page
    cy.reload();
    
    // Check that the Accepted tab is still active after refresh
    cy.get('[data-testid="accepted-tab"]').should('have.class', 'active');
    cy.get('[data-testid="accepted-assignments"]').should('be.visible');
  });

  it('should display the correct empty state for each tab', () => {
    // Check empty state for Available tab
    cy.get('[data-testid="available-tab"]').click();
    cy.get('[data-testid="available-empty-state"]').should('be.visible');
    
    // Check empty state for Accepted tab
    cy.get('[data-testid="accepted-tab"]').click();
    cy.get('[data-testid="accepted-empty-state"]').should('be.visible');
    
    // Check empty state for Completed tab
    cy.get('[data-testid="completed-tab"]').click();
    cy.get('[data-testid="completed-empty-state"]').should('be.visible');
  });

  it('should display the correct number of assignments in each tab', () => {
    // Mock API response for assignments
    cy.intercept('GET', '/api/assignments*', {
      statusCode: 200,
      body: {
        available: [
          { id: 1, status: 'available', location: 'Location 1', distance: '1.2 km' },
          { id: 2, status: 'available', location: 'Location 2', distance: '2.5 km' }
        ],
        accepted: [
          { id: 3, status: 'accepted', location: 'Location 3', acceptedAt: '2023-05-01T10:00:00Z' }
        ],
        completed: [
          { id: 4, status: 'completed', location: 'Location 4', completedAt: '2023-05-02T15:30:00Z' },
          { id: 5, status: 'completed', location: 'Location 5', completedAt: '2023-05-03T09:15:00Z' },
          { id: 6, status: 'completed', location: 'Location 6', completedAt: '2023-05-04T11:45:00Z' }
        ]
      }
    }).as('getAssignments');
    
    // Refresh the page to load the mocked data
    cy.reload();
    
    // Wait for the API call to complete
    cy.wait('@getAssignments');
    
    // Check the number of assignments in each tab
    cy.get('[data-testid="available-tab"]').click();
    cy.get('[data-testid="assignment-item"]').should('have.length', 2);
    
    cy.get('[data-testid="accepted-tab"]').click();
    cy.get('[data-testid="assignment-item"]').should('have.length', 1);
    
    cy.get('[data-testid="completed-tab"]').click();
    cy.get('[data-testid="assignment-item"]').should('have.length', 3);
  });

  it('should sort assignments correctly in each tab', () => {
    // Mock API response for assignments with specific timestamps and distances
    cy.intercept('GET', '/api/assignments*', {
      statusCode: 200,
      body: {
        available: [
          { id: 1, status: 'available', location: 'Location 2', distance: 2.5 },
          { id: 2, status: 'available', location: 'Location 1', distance: 1.2 },
          { id: 3, status: 'available', location: 'Location 3', distance: 5.0 }
        ],
        accepted: [
          { id: 4, status: 'accepted', location: 'Location B', acceptedAt: '2023-05-01T10:00:00Z', distance: 3.0 },
          { id: 5, status: 'accepted', location: 'Location A', acceptedAt: '2023-05-01T09:00:00Z', distance: 5.0 },
          { id: 6, status: 'accepted', location: 'Location C', acceptedAt: '2023-05-01T11:00:00Z', distance: 1.0 }
        ],
        completed: [
          { id: 7, status: 'completed', location: 'Location X', completedAt: '2023-05-01T15:30:00Z' },
          { id: 8, status: 'completed', location: 'Location Z', completedAt: '2023-05-02T15:30:00Z' },
          { id: 9, status: 'completed', location: 'Location Y', completedAt: '2023-05-01T10:30:00Z' }
        ]
      }
    }).as('getAssignments');
    
    // Refresh the page to load the mocked data
    cy.reload();
    
    // Wait for the API call to complete
    cy.wait('@getAssignments');
    
    // Check sorting in Available tab (by distance, nearest first)
    cy.get('[data-testid="available-tab"]').click();
    cy.get('[data-testid="assignment-item"]').eq(0).should('contain', '1.2 km');
    cy.get('[data-testid="assignment-item"]').eq(1).should('contain', '2.5 km');
    cy.get('[data-testid="assignment-item"]').eq(2).should('contain', '5.0 km');
    
    // Check sorting in Accepted tab (by timestamp, oldest & nearest first)
    cy.get('[data-testid="accepted-tab"]').click();
    cy.get('[data-testid="assignment-item"]').eq(0).should('contain', 'Location A'); // Oldest & nearest
    cy.get('[data-testid="assignment-item"]').eq(1).should('contain', 'Location B');
    cy.get('[data-testid="assignment-item"]').eq(2).should('contain', 'Location C');
    
    // Check sorting in Completed tab (by completion time, newest first)
    cy.get('[data-testid="completed-tab"]').click();
    cy.get('[data-testid="assignment-item"]').eq(0).should('contain', 'Location Z'); // Newest
    cy.get('[data-testid="assignment-item"]').eq(1).should('contain', 'Location X');
    cy.get('[data-testid="assignment-item"]').eq(2).should('contain', 'Location Y'); // Oldest
  });
});
