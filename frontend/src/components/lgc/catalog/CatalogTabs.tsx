import { useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * WAI-ARIA tablist for the Catalog Management shell.
 *
 * Each tab is a button (not a NavLink) because the router drives which
 * tab is "selected" from the URL — we just navigate on activation.
 * Arrow Left/Right cycle focus + selection; Home/End jump to first/last;
 * the selected tab is the only one in the page's tab order (tabindex=0),
 * which is the roving-tabindex pattern the WAI-ARIA APG prescribes so
 * keyboard users land on the active tab and then Tab into the panel.
 */

export interface CatalogTabDef {
  /** Last path segment under /lgc/catalog, e.g. "universities". */
  to: string;
  label: string;
}

interface CatalogTabsProps {
  tabs: CatalogTabDef[];
  /** The tablist panel id so aria-controls on each tab resolves. */
  panelId: string;
}

export function CatalogTabs({ tabs, panelId }: CatalogTabsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => location.pathname.endsWith(`/${t.to}`)),
  );

  function go(index: number) {
    const clamped = (index + tabs.length) % tabs.length;
    buttonsRef.current[clamped]?.focus();
    navigate(tabs[clamped].to);
  }

  function handleKey(e: ReactKeyboardEvent<HTMLButtonElement>, i: number) {
    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        go(i + 1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        go(i - 1);
        break;
      case 'Home':
        e.preventDefault();
        go(0);
        break;
      case 'End':
        e.preventDefault();
        go(tabs.length - 1);
        break;
      default:
        break;
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Catalog sections"
      className="flex w-full items-center gap-[2px] overflow-x-auto border-b border-lrfap-ghost"
    >
      {tabs.map((tab, i) => {
        const selected = i === activeIndex;
        const tabId = `catalog-tab-${tab.to}`;
        return (
          <button
            key={tab.to}
            ref={(el) => {
              buttonsRef.current[i] = el;
            }}
            id={tabId}
            role="tab"
            type="button"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => navigate(tab.to)}
            onKeyDown={(e) => handleKey(e, i)}
            className={`-mb-px inline-flex h-[44px] items-center justify-center border-b-[2px] px-[18px] font-sans text-[13px] font-medium uppercase tracking-wide transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lrfap-sky ${
              selected
                ? 'border-lrfap-sky text-lrfap-navy'
                : 'border-transparent text-slate-500 hover:text-lrfap-navy'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
