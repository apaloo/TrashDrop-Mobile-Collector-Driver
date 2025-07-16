import { TopNavBar } from '../components/NavBar';

const TermsPage = () => {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <TopNavBar />
      
      <div className="flex-grow mt-14 mb-4 px-4 py-3 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Terms of Service</h1>
        
        <div className="card mb-4">
          <h2 className="text-lg font-bold mb-2">1. Introduction</h2>
          <p className="mb-4">
            Welcome to TrashDrop Mobile Collector Driver Application. By using our app, you agree to these Terms of Service.
            Please read them carefully before using the application. If you do not agree with these terms, you should not use the application.
          </p>
          <p>
            These terms govern your use of the TrashDrop Mobile Collector Driver app, which is operated by TrashDrop Inc.
            The terms "we", "us", and "our" refer to TrashDrop Inc. The terms "you" and "your" refer to you,
            as the user of our application.
          </p>
        </div>
        
        <div className="card mb-4">
          <h2 className="text-lg font-bold mb-2">2. Account Registration</h2>
          <p className="mb-2">
            To use the TrashDrop Mobile Collector Driver app, you must create an account by providing accurate and complete information.
            You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
          </p>
          <p className="mb-2">
            You must be at least 18 years old to create an account and use the app. By creating an account, you represent and warrant that you are at least 18 years old.
          </p>
          <p>
            We reserve the right to suspend or terminate your account at any time for any reason, including but not limited to violation of these Terms of Service.
          </p>
        </div>
        
        <div className="card mb-4">
          <h2 className="text-lg font-bold mb-2">3. Driver Responsibilities</h2>
          <p className="mb-2">
            As a waste collector driver using our platform, you agree to:
          </p>
          <ul className="list-disc pl-5 mb-2 space-y-1">
            <li>Maintain all required licenses and permits for waste collection in your region</li>
            <li>Keep your vehicle in safe operating condition</li>
            <li>Follow all local traffic laws and waste management regulations</li>
            <li>Handle waste materials properly according to their classification</li>
            <li>Provide professional and courteous service to customers</li>
            <li>Complete pickup requests in a timely manner</li>
            <li>Report any issues or incidents promptly through the app</li>
          </ul>
          <p>
            Failure to meet these responsibilities may result in penalties, suspension, or termination of your account.
          </p>
        </div>
        
        <div className="card mb-4">
          <h2 className="text-lg font-bold mb-2">4. Compensation and Payments</h2>
          <p className="mb-2">
            Compensation for waste collection services will be calculated based on the rates specified in the app for each pickup request or assignment.
            Payments will be processed according to the payment schedule outlined in your collector agreement.
          </p>
          <p>
            We reserve the right to adjust compensation rates with notice to drivers. Any disputes regarding payment must be reported within 30 days of the payment date.
          </p>
        </div>
        
        <div className="card mb-4">
          <h2 className="text-lg font-bold mb-2">5. Privacy and Data Collection</h2>
          <p className="mb-2">
            We collect and process personal data in accordance with our Privacy Policy, which is incorporated by reference into these Terms of Service.
            By using our app, you consent to our collection and processing of your personal data as described in the Privacy Policy.
          </p>
          <p>
            The app uses location services to match you with nearby pickup requests and track your routes. You must enable location services to use the app effectively.
          </p>
        </div>
        
        <div className="card mb-4">
          <h2 className="text-lg font-bold mb-2">6. Limitation of Liability</h2>
          <p className="mb-2">
            To the maximum extent permitted by law, TrashDrop Inc. shall not be liable for any indirect, incidental, special, consequential, or punitive damages,
            or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses,
            resulting from your access to or use of or inability to access or use the app.
          </p>
          <p>
            TrashDrop Inc. shall not be liable for any damage, liability, or loss arising from: (i) your use of or reliance on the app or your inability to access or use the app;
            (ii) any transaction or relationship between you and any third party as a result of your use of the app; or (iii) any conduct or act of any third party.
          </p>
        </div>
        
        <div className="card mb-4">
          <h2 className="text-lg font-bold mb-2">7. Modification of Terms</h2>
          <p>
            We reserve the right to modify these Terms of Service at any time. If we make material changes to these terms, we will provide notice through the app or by other means.
            Your continued use of the app after such notice constitutes your acceptance of the modified terms.
          </p>
        </div>
        
        <div className="card mb-4">
          <h2 className="text-lg font-bold mb-2">8. Contact Information</h2>
          <p>
            If you have any questions about these Terms of Service, please contact us at:
          </p>
          <p className="mt-2">
            <strong>TrashDrop Inc.</strong><br />
            123 Waste Management Ave<br />
            Accra, Ghana<br />
            Email: support@trashdrop.com<br />
            Phone: +233 50 123 4567
          </p>
        </div>
        
        <div className="text-center text-sm text-gray-500 mt-8 mb-4">
          Last Updated: July 1, 2025
        </div>
        
        <div className="flex justify-center mb-6">
          <a href="/login" className="btn btn-primary">
            Back to Login
          </a>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
