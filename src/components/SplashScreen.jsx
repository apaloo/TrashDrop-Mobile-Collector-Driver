import { useState, useEffect } from 'react';
import './SplashScreen.css';

const SplashScreen = ({ onComplete }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [animationPhase, setAnimationPhase] = useState('entering');

  useEffect(() => {
    const animationSequence = async () => {
      // Phase 1: Entry animation (1.2s)
      setTimeout(() => {
        setAnimationPhase('settling');
      }, 1200);

      // Phase 2: Settlement (0.4s)
      setTimeout(() => {
        setAnimationPhase('breathing');
      }, 1600);

      // Phase 3: Breathing effect (0.6s)
      setTimeout(() => {
        setAnimationPhase('exiting');
      }, 2200);

      // Phase 4: Exit animation (0.4s)
      setTimeout(() => {
        setIsVisible(false);
        if (onComplete) {
          onComplete();
        }
      }, 2600);
    };

    animationSequence();
  }, [onComplete]);

  const handleSkip = () => {
    setAnimationPhase('exiting');
    setTimeout(() => {
      setIsVisible(false);
      if (onComplete) {
        onComplete();
      }
    }, 300);
  };

  if (!isVisible) return null;

  return (
    <div 
      className={`splash-screen ${animationPhase}`}
      onClick={handleSkip}
      role="button"
      tabIndex={0}
      aria-label="Tap to skip splash screen"
    >
      <div className={`splash-background ${animationPhase}`} />
      
      <div className={`splash-logo-container ${animationPhase}`}>
        <img
          src="/icons/logo-02.jpg?v=3.0.0"
          alt="TrashDrop Logo"
          className="splash-logo"
          draggable={false}
        />
      </div>

      {/* Skip indicator */}
      <div className="skip-indicator">
        <span>Tap anywhere to skip</span>
      </div>
    </div>
  );
};

export default SplashScreen;
