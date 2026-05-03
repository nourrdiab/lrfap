import { useEffect } from 'react';

const TITLE_PREFIX = 'LRFAP';

/**
 * Sets the document.title to `LRFAP | {title}` for the lifetime of the component.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${TITLE_PREFIX} | ${title}` : TITLE_PREFIX;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
