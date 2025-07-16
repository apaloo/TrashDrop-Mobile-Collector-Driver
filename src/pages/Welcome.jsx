import { useState } from 'react';

const WelcomePage = () => {
  const [step, setStep] = useState(1);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      // Navigate to the map page when onboarding is complete
      window.location.href = '/map';
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-50 dark:bg-gray-900 p-4">
      {/* Progress indicator */}
      <div className="w-full max-w-md mt-8 mb-4">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-primary h-2 rounded-full transition-all" 
            style={{ width: `${(step / 3) * 100}%` }}
          ></div>
        </div>
      </div>
      
      {/* Content container */}
      <div className="w-full max-w-md flex-grow flex flex-col justify-center items-center p-4">
        {step === 1 && (
          <div className="text-center">
            <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-4">Welcome to TrashDrop!</h1>
            <p className="mb-8">
              Your registration was successful. Let's get you set up to start collecting waste and earning money!
            </p>
          </div>
        )}
        
        {step === 2 && (
          <div className="text-center">
            <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-4">Enable Location</h1>
            <p className="mb-8">
              TrashDrop needs your location to show you nearby pickup requests and track your routes. Please enable location services when prompted.
            </p>
          </div>
        )}
        
        {step === 3 && (
          <div className="text-center">
            <div className="w-24 h-24 bg-primary rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-4">You're All Set!</h1>
            <p className="mb-8">
              Your account is ready to use. Start accepting pickup requests, complete assignments, and track your earnings all from one place.
            </p>
          </div>
        )}
        
        {/* Button */}
        <button 
          onClick={handleNext}
          className="btn btn-primary w-full max-w-xs"
        >
          {step < 3 ? "Next" : "Get Started"}
        </button>
      </div>
      
      {/* Skip option */}
      {step < 3 && (
        <div className="my-4">
          <button 
            onClick={() => window.location.href = '/map'} 
            className="text-primary text-sm"
          >
            Skip Introduction
          </button>
        </div>
      )}
    </div>
  );
};

export default WelcomePage;
