import { TopNavBar } from '../components/NavBar';

const PrivacyPage = () => {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <TopNavBar />
      
      <div className="flex-grow mt-14 mb-4 px-4 py-3 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Privacy Policy</h1>
        
        <div className="card mb-4">
          <h2 className="text-lg font-bold mb-2">1. Introduction</h2>
          <p className="mb-4">
            TrashDrop Inc. ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our TrashDrop Mobile Collector Driver application ("the App").
          </p>
          <p>
            Please read this Privacy Policy carefully. By using the App, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, do not use the App.
          </p>
        </div>
        
        <div className="card mb-4">
          <h2 className="text-lg font-bold mb-2">2. Information We Collect</h2>
          <p className="mb-2">We collect several types of information from and about users of our App, including:</p>
          
          <h3 className="font-bold mt-3 mb-1">2.1 Personal Information</h3>
          <p className="mb-2">We may collect personal information that you provide directly to us, such as:</p>
          <ul className="list-disc pl-5 mb-2 space-y-1">
            <li>Name, address, email address, and telephone number</li>
            <li>Account login credentials</li>
            <li>Date of birth, identification information, and driver's license information</li>
            <li>Vehicle information</li>
            <li>Employment and company information</li>
            <li>Banking and payment information</li>
            <li>Photo or profile picture</li>
          </ul>
          
          <h3 className="font-bold mt-3 mb-1">2.2 Automatic Information</h3>
          <p className="mb-2">When you use our App, we may automatically collect:</p>
          <ul className="list-disc pl-5 mb-2 space-y-1">
            <li>Location information (GPS coordinates)</li>
            <li>Device information (model, operating system, unique device identifiers)</li>
            <li>Usage data (interaction with the App, time spent on pages, features used)</li>
            <li>Log information (IP address, browser type, referring/exit pages, timestamps)</li>
          </ul>
        </div>
        
        <div className="card mb-4">
          <h2 className="text-lg font-bold mb-2">3. How We Use Your Information</h2>
          <p className="mb-2">We use information that we collect about you or that you provide to us:</p>
          <ul className="list-disc pl-5 mb-2 space-y-1">
            <li>To provide, maintain, and improve our App</li>
            <li>To process and match you with waste collection requests</li>
            <li>To track your location for route optimization and service verification</li>
            <li>To calculate and process payments</li>
            <li>To communicate with you about services, updates, and promotions</li>
            <li>To monitor and analyze usage patterns and trends</li>
            <li>To verify your identity and prevent fraud</li>
            <li>To comply with legal obligations</li>
          </ul>
        </div>
        
        <div className="card mb-4">
          <h2 className="text-lg font-bold mb-2">4. Location Data</h2>
          <p className="mb-4">
            Our App collects and uses precise location information to enable core app functionality, including matching you with nearby waste collection requests, providing navigation, and verifying service completion.
          </p>
          <p className="mb-4">
            The App collects location data in the foreground (when you are actively using the App) and, with your permission, in the background (when the App is closed or not in use) during active collection assignments.
          </p>
          <p>
            You can disable location permissions through your device settings, but this will affect core App functionality. If you disable background location, you may need to reopen the App to receive updates on new pickup requests.
          </p>
        </div>
        
        <div className="card mb-4">
          <h2 className="text-lg font-bold mb-2">5. Sharing of Your Information</h2>
          <p className="mb-2">We may disclose your personal information to:</p>
          <ul className="list-disc pl-5 mb-2 space-y-1">
            <li>Service providers who perform services on our behalf</li>
            <li>Customers requesting waste collection services (limited information)</li>
            <li>Your employer or contracting company</li>
            <li>Business partners for joint marketing or promotional purposes</li>
            <li>Law enforcement or government agencies when required by law</li>
            <li>Third parties in connection with a merger, acquisition, or business transfer</li>
          </ul>
        </div>
        
        <div className="card mb-4">
          <h2 className="text-lg font-bold mb-2">6. Data Storage and Security</h2>
          <p className="mb-4">
            We use commercially reasonable safeguards to protect your personal information from unauthorized access, disclosure, alteration, and destruction. However, no electronic transmission or storage of information can be guaranteed to be 100% secure.
          </p>
          <p>
            Your personal information may be stored and processed in any country where we have operations or where we engage service providers. By using the App, you consent to the transfer of information to countries outside of your country of residence, which may have different data protection rules.
          </p>
        </div>
        
        <div className="card mb-4">
          <h2 className="text-lg font-bold mb-2">7. Your Rights and Choices</h2>
          <p className="mb-4">
            You can access and update certain personal information through your account settings in the App. You may also contact us directly to request access to, correction of, or deletion of personal information that you have provided to us.
          </p>
          <p>
            Depending on your location, you may have additional rights under applicable privacy laws, such as the right to data portability, restriction of processing, and objection to processing.
          </p>
        </div>
        
        <div className="card mb-4">
          <h2 className="text-lg font-bold mb-2">8. Changes to Our Privacy Policy</h2>
          <p>
            We may update our Privacy Policy from time to time. If we make material changes to how we treat our users' personal information, we will notify you through the App or by other means. The date the Privacy Policy was last revised is identified at the bottom of this page.
          </p>
        </div>
        
        <div className="card mb-4">
          <h2 className="text-lg font-bold mb-2">9. Contact Information</h2>
          <p className="mb-2">
            If you have any questions or concerns about this Privacy Policy, please contact us at:
          </p>
          <p>
            <strong>TrashDrop Inc.</strong><br />
            123 Waste Management Ave<br />
            Accra, Ghana<br />
            Email: privacy@trashdrop.com<br />
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

export default PrivacyPage;
