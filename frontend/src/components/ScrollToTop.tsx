import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Resets window scroll to top on forward navigation (link click,
 * programmatic). Skips on POP so back/forward restore the prior
 * scroll position natively. Search-param changes don't trigger —
 * filter changes on the same page leave scroll alone.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    if (navType === 'POP') return;
    window.scrollTo(0, 0);
  }, [pathname, navType]);

  return null;
}
