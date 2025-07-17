/**
 * Animation utility functions for the TrashDrop Mobile Collector Driver app
 */

/**
 * Adds a fade-in animation to an element
 * @param {HTMLElement} element - The DOM element to animate
 * @param {number} duration - Animation duration in milliseconds
 * @param {Function} callback - Optional callback function to run after animation completes
 */
export const fadeIn = (element, duration = 300, callback = null) => {
  if (!element) return;
  
  // Set initial styles
  element.style.opacity = '0';
  element.style.display = 'block';
  element.style.transition = `opacity ${duration}ms ease-in-out`;
  
  // Force reflow to ensure transition works
  void element.offsetWidth;
  
  // Trigger animation
  element.style.opacity = '1';
  
  // Clean up and run callback after animation
  setTimeout(() => {
    element.style.transition = '';
    if (callback && typeof callback === 'function') {
      callback();
    }
  }, duration);
};

/**
 * Adds a fade-out animation to an element
 * @param {HTMLElement} element - The DOM element to animate
 * @param {number} duration - Animation duration in milliseconds
 * @param {Function} callback - Optional callback function to run after animation completes
 */
export const fadeOut = (element, duration = 300, callback = null) => {
  if (!element) return;
  
  // Set initial styles
  element.style.opacity = '1';
  element.style.transition = `opacity ${duration}ms ease-in-out`;
  
  // Trigger animation
  element.style.opacity = '0';
  
  // Clean up and run callback after animation
  setTimeout(() => {
    element.style.display = 'none';
    element.style.transition = '';
    if (callback && typeof callback === 'function') {
      callback();
    }
  }, duration);
};

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
 * Adds a slide-out animation to an element
 * @param {HTMLElement} element - The DOM element to animate
 * @param {string} direction - Direction to slide to ('top', 'right', 'bottom', 'left')
 * @param {number} distance - Distance to slide in pixels
 * @param {number} duration - Animation duration in milliseconds
 * @param {Function} callback - Optional callback function to run after animation completes
 */
export const slideOut = (element, direction = 'bottom', distance = 50, duration = 300, callback = null) => {
  if (!element) return;
  
  // Set initial styles
  element.style.opacity = '1';
  element.style.transition = `transform ${duration}ms ease-in, opacity ${duration}ms ease-in`;
  
  // Set transform based on direction
  const transformMap = {
    top: `translateY(-${distance}px)`,
    right: `translateX(${distance}px)`,
    bottom: `translateY(${distance}px)`,
    left: `translateX(-${distance}px)`
  };
  
  // Trigger animation
  element.style.opacity = '0';
  element.style.transform = transformMap[direction] || transformMap.bottom;
  
  // Clean up and run callback after animation
  setTimeout(() => {
    element.style.display = 'none';
    element.style.transform = '';
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

/**
 * React animation hook helpers for common animations
 */
export const reactAnimations = {
  /**
   * CSS classes for fade animations
   */
  fade: {
    enter: 'transition-opacity duration-300 ease-in-out',
    enterFrom: 'opacity-0',
    enterTo: 'opacity-100',
    leave: 'transition-opacity duration-300 ease-in-out',
    leaveFrom: 'opacity-100',
    leaveTo: 'opacity-0',
  },
  
  /**
   * CSS classes for slide animations
   */
  slide: {
    down: {
      enter: 'transition-all transform duration-300 ease-out',
      enterFrom: 'opacity-0 -translate-y-4',
      enterTo: 'opacity-100 translate-y-0',
      leave: 'transition-all transform duration-300 ease-in',
      leaveFrom: 'opacity-100 translate-y-0',
      leaveTo: 'opacity-0 -translate-y-4',
    },
    up: {
      enter: 'transition-all transform duration-300 ease-out',
      enterFrom: 'opacity-0 translate-y-4',
      enterTo: 'opacity-100 translate-y-0',
      leave: 'transition-all transform duration-300 ease-in',
      leaveFrom: 'opacity-100 translate-y-0',
      leaveTo: 'opacity-0 translate-y-4',
    },
    left: {
      enter: 'transition-all transform duration-300 ease-out',
      enterFrom: 'opacity-0 translate-x-4',
      enterTo: 'opacity-100 translate-x-0',
      leave: 'transition-all transform duration-300 ease-in',
      leaveFrom: 'opacity-100 translate-x-0',
      leaveTo: 'opacity-0 translate-x-4',
    },
    right: {
      enter: 'transition-all transform duration-300 ease-out',
      enterFrom: 'opacity-0 -translate-x-4',
      enterTo: 'opacity-100 translate-x-0',
      leave: 'transition-all transform duration-300 ease-in',
      leaveFrom: 'opacity-100 translate-x-0',
      leaveTo: 'opacity-0 -translate-x-4',
    },
  },
  
  /**
   * CSS classes for scale animations
   */
  scale: {
    enter: 'transition-all transform duration-300 ease-out',
    enterFrom: 'opacity-0 scale-95',
    enterTo: 'opacity-100 scale-100',
    leave: 'transition-all transform duration-300 ease-in',
    leaveFrom: 'opacity-100 scale-100',
    leaveTo: 'opacity-0 scale-95',
  },
};
