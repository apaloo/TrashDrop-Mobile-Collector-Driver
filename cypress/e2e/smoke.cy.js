/// <reference types="cypress" />

describe('Smoke Test', () => {
  it('should load the app', () => {
    cy.visit('/');
    cy.get('body').should('be.visible');
  });
});
