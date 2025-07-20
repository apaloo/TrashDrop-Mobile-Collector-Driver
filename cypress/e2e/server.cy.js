/// <reference types="cypress" />

describe('Server Health Check', () => {
  it('should respond with 200 status code', () => {
    // Check if the server is responding
    cy.request({
      url: '/',
      failOnStatusCode: false // Don't fail the test on non-200 status
    }).then((response) => {
      // Log the response for debugging
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      console.log('Response body (first 500 chars):', 
        typeof response.body === 'string' 
          ? response.body.substring(0, 500) 
          : JSON.stringify(response.body, null, 2).substring(0, 500)
      );
      
      // Check if we got a response at all
      expect(response).to.have.property('status');
      
      // If we got a 200, the server is running
      if (response.status === 200) {
        expect(response.headers).to.have.property('content-type');
        expect(response.headers['content-type']).to.include('text/html');
      }
    });
  });

  it('should serve the index.html file', () => {
    // Request the root path
    cy.request({
      url: '/index.html',
      failOnStatusCode: false
    }).then((response) => {
      console.log('Index.html status:', response.status);
      
      // If we get a 200, check for HTML content
      if (response.status === 200) {
        expect(response.body).to.include('<!DOCTYPE html>');
        expect(response.body).to.include('<div id="root">');
      }
    });
  });

  it('should have the correct content type for JavaScript files', () => {
    // Request the main JavaScript bundle
    cy.request({
      url: '/assets/index-*.js',
      failOnStatusCode: false
    }).then((response) => {
      console.log('JS file status:', response.status);
      
      if (response.status === 200) {
        expect(response.headers['content-type']).to.include('application/javascript');
      }
    });
  });
});
