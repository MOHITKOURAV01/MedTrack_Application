import React, { useEffect, useRef, useState } from 'react';

/**
 * A wrapper component that applies a given Tailwind animation class
 * when the element scrolls into view.
 *
 * @param {string} animation - The animation class (e.g., 'animate-fade-up', 'animate-fade-left')
 * @param {string} className - Additional classes
 * @param {string} delay - Optional animation delay class (e.g., 'delay-100')
 */
export default function AnimatedSection({ children, animation = 'animate-fade-up', className = '', delay = '' }) {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef();

  useEffect(() => {
    // Without this guard the constructor throws in an environment that does not implement
    // IntersectionObserver, the effect never completes, and `isVisible` stays false - which for
    // this component means the content is permanently transparent rather than un-animated.
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            // We only want it to animate once per page load to keep it smooth
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );

    const currentRef = domRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);

  // `animation` and `delay` are unconditional; only the opacity is a function of visibility.
  //
  // They used to live inside the `isVisible` branch, which meant the element carried neither
  // until the observer fired - so a caller's `animation="animate-fade-left"` was simply dropped,
  // and the keyframes were attached in the same frame the opacity transition started rather than
  // before it. A Tailwind animation class on a still-transparent element does nothing visible,
  // so there is nothing to suppress by withholding it.
  const classes = ['transition-opacity', 'duration-700', animation, delay, isVisible ? 'opacity-100' : 'opacity-0', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={domRef} className={classes}>
      {children}
    </div>
  );
}
