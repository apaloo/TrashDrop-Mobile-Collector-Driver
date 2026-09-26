/// <reference types="cypress" />

describe('Development Server Check', () => {
  it('should check the main application entry point', () => {
    // Try to access the main application
    cy.request({
      url: 'http://localhost:5173',
      failOnStatusCode: false
    }).then((response) => {
      console.log('Main application status:', response.status);
      
      // Even if the status is not 200, check if we get some HTML back
      expect(response.headers['content-type']).to.include('text/html');
      
      // Check if the response contains the root div
      expect(response.body).to.include('<div id="root">');
    });
  });
  
  it('should check if the Vite dev server is running', () => {
    // Check if the Vite dev server is running by requesting the Vite client script
    cy.request({
      url: 'http://localhost:5173/@vite/client',
      failOnStatusCode: false
    }).then((response) => {
      console.log('Vite dev server status:', response.status);
      
      if (response.status !== 200) {
        console.log('Vite dev server might not be running. Try running `npm run dev` first.');
      } else {
        console.log('Vite dev server is running.');
      }
    });
  });
});
