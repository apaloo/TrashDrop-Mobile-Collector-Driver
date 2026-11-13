/**
 * Animation utility functions for the TrashDrop Mobile Collector Driver app
 */

/**
 * Adds a slide-in animation to an element
 * @param {HTMLElement} element - The DOM element to animate
 * @param {string} direction - Direction to slide from ('top', 'right', 'bottom', 'left')
 * @param {number} distance - Distance to slide in pixels
 * @param {number} duration - Animation duration in milliseconds
 * @param {Function} callback - Optional callback function to run after animation completes
 */
export const slideIn = (element, direction = 'bottom', distance = 50, duration = 300, callback = null) => {
  if (!element) return;
  
  // Set initial styles
  element.style.opacity = '0';
  element.style.display = 'block';
  element.style.transition = `transform ${duration}ms ease-out, opacity ${duration}ms ease-out`;
  
  // Set transform based on direction
  const transformMap = {
    top: `translateY(-${distance}px)`,
    right: `translateX(${distance}px)`,
    bottom: `translateY(${distance}px)`,
    left: `translateX(-${distance}px)`
  };
  
  element.style.transform = transformMap[direction] || transformMap.bottom;
  
  // Force reflow to ensure transition works
  void element.offsetWidth;
  
  // Trigger animation
  element.style.opacity = '1';
  element.style.transform = 'translate(0, 0)';
  
  // Clean up and run callback after animation
  setTimeout(() => {
    element.style.transition = '';
    if (callback && typeof callback === 'function') {
      callback();
    }
  }, duration);
};

/**
 * Creates a pulse animation effect
 * @param {HTMLElement} element - The DOM element to animate
 * @param {number} scale - Maximum scale factor (1.0 = no change)
 * @param {number} duration - Animation duration in milliseconds
 * @param {number} times - Number of pulses (0 for infinite)
 */
export const pulse = (element, scale = 1.05, duration = 1000, times = 0) => {
  if (!element) return;
  
  // Set initial styles
  element.style.transition = `transform ${duration / 2}ms ease-in-out`;
  
  let count = 0;
  let growing = true;
  
  const animate = () => {
    if (growing) {
      element.style.transform = `scale(${scale})`;
      growing = false;
    } else {
      element.style.transform = 'scale(1)';
      growing = true;
      count++;
    }
    
    if (times === 0 || count < times) {
      setTimeout(animate, duration / 2);
    } else {
      element.style.transition = '';
    }
  };
  
  animate();
};

