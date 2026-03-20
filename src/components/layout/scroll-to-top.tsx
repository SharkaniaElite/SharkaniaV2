// src/components/layout/scroll-to-top.tsx
import { useEffect, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls to top on every route change.
 * Uses useLayoutEffect + requestAnimationFrame to ensure
 * the scroll happens AFTER the new page has been rendered.
 *
 * Place inside <BrowserRouter> in App.tsx:
 *   <BrowserRouter>
 *     <ScrollToTop />
 *     ...
 *   </BrowserRouter>
 */
export function ScrollToTop() {
  const { pathname } = useLocation();

  // useLayoutEffect fires synchronously after DOM mutations
  useLayoutEffect(() => {
    // Immediate attempt
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

    // Deferred attempt after paint (catches layout shifts)
    const raf = requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });

    // Final fallback after a brief delay
    const timeout = setTimeout(() => {
      window.scrollTo(0, 0);
    }, 50);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [pathname]);

  return null;
}
