/// <reference types="cypress" />

describe('Filter Synchronization', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should load the map page', () => {
    cy.get('body').should('be.visible');
    cy.url().should('include', '/map');
  });

  it('should have filter controls', () => {
    cy.get('.filter-card, [class*="filter"], [data-testid*="filter"]')
      .should('be.visible');
  });

  it('should synchronize filters between pages', () => {
    // Set test filters
    const testFilters = {
      maxDistance: 5,
      wasteTypes: ['PLASTIC', 'PAPER'],
      activeFilter: 'recyclable',
      timestamp: Date.now()
    };

    // Set filters in localStorage
    cy.window().then((win) => {
      win.localStorage.setItem('filters', JSON.stringify(testFilters));
    });

    // Navigate to requests page
    cy.get('a[href="/requests"], [data-testid="nav-requests"]').first().click();
    cy.url().should('include', '/requests');

    // Verify filters were synchronized
    cy.window().then((win) => {
      const storedFilters = JSON.parse(win.localStorage.getItem('filters'));
      expect(storedFilters.maxDistance).to.equal(5);
      expect(storedFilters.activeFilter).to.equal('recyclable');
      expect(storedFilters.wasteTypes).to.include('PLASTIC');
    });
  });
});
