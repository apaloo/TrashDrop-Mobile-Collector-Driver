# TrashDrop Mobile Collector Driver - Manual Testing Guide

## View Report Button Functionality Test

### Prerequisites
- TrashDrop Mobile Collector Driver app running locally
- Valid user credentials for login
- At least one completed and disposed assignment in the database

### Test Environment Setup
1. Start the development server:
   ```bash
   npm run dev
   ```
2. Note the port number in the console output (e.g., http://localhost:5177/)

### Test Steps

#### 1. Login to the Application
1. Navigate to the login page (http://localhost:5176/login)
2. Enter a valid phone number
3. Enter the OTP code (use '123456' for development mode)
4. Verify successful login (should redirect to Map page)

#### 2. Navigate to Assignments Page
1. Click on the "Assign" tab in the bottom navigation bar
2. Verify the Assignments page loads with tabs (Available, Accepted, Completed)

#### 3. View Completed Assignments
1. Click on the "Completed" tab
2. Verify completed assignments are displayed
3. Verify assignments show the "View Report" button (for assignments that have been disposed)

#### 4. Test View Report Button
1. Click on the "View Report" button for a completed and disposed assignment
2. Verify the Report Modal opens
3. Verify the modal displays:
   - Modal title "Disposal Report"
   - Assignment Details section with Assignment ID, Address, etc.
   - Completion Information section with Completed On date, Status, etc.
   - Disposal Information section with Disposal Site, Disposed On date, etc.
4. Click the "Close" button
5. Verify the modal closes properly

### Expected Results
- The "View Report" button should be visible on completed and disposed assignments
- Clicking the button should open a modal with detailed disposal report information
- The modal should display all relevant assignment, completion, and disposal information
- The modal should close when the "Close" button is clicked

### Notes
- The "View Report" button should only appear on assignments that have been both completed and disposed
- The modal should be responsive and display correctly on different screen sizes
- All dates in the report should be properly formatted
- Assignment ID should match the ID displayed on the assignment card

## Diagnostic Page Test

For development and testing purposes, a diagnostic page is available that allows testing the Report Modal component directly without requiring authentication:

1. Navigate to the diagnostic page (http://localhost:5176/diagnostic)
2. Click the "Test Report Modal" button
3. Verify the Report Modal opens with mock data
4. Verify all sections and information are displayed correctly
5. Click the "Close" button to close the modal

This provides a quick way to test the Report Modal component in isolation without needing to go through the full assignment workflow.
