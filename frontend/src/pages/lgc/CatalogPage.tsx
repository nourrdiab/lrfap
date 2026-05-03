import { Outlet, useLocation } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import {
  CatalogTabs,
  type CatalogTabDef,
} from '../../components/lgc/catalog/CatalogTabs';

/**
 * Shell for /lgc/catalog. Renders the page header, the tablist, and an
 * <Outlet/> that hosts whichever tab is active. Tab-specific data
 * loading lives in the tab components themselves — the shell is purely
 * presentational so switching tabs doesn't re-run the other tabs'
 * fetches.
 */

interface TabMeta extends CatalogTabDef {
  description: string;
}

const TABS: TabMeta[] = [
  {
    to: 'universities',
    label: 'Universities',
    description:
      'Manage participating universities — the top-level identity each program belongs to.',
  },
  {
    to: 'specialties',
    label: 'Specialties',
    description:
      'Manage medical specialties. These are track-agnostic and referenced by programs.',
  },
  {
    to: 'programs',
    label: 'Programs',
    description:
      'Manage programs — the per-cycle, per-track offerings universities open for applications.',
  },
];

const PANEL_ID = 'lgc-catalog-panel';

export default function LGCCatalogPage() {
  useDocumentTitle('Catalog');
  const location = useLocation();

  const activeTab =
    TABS.find((t) => location.pathname.endsWith(`/${t.to}`)) ?? TABS[0];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-[40px] md:px-8">
      <div className="flex flex-col gap-[28px]">
        <header className="flex flex-col gap-[8px]">
          <h1 className="font-display text-[32px] font-extrabold leading-[1.05] text-lrfap-navy md:text-[40px]">
            Catalog Management
            <span className="font-sans font-normal text-slate-500">
              {' · '}
              {activeTab.label}
            </span>
          </h1>
          <p className="max-w-[640px] font-sans text-[13px] text-slate-600">
            {activeTab.description}
          </p>
        </header>

        <CatalogTabs tabs={TABS} panelId={PANEL_ID} />

        <div
          id={PANEL_ID}
          role="tabpanel"
          aria-labelledby={`catalog-tab-${activeTab.to}`}
          tabIndex={0}
          className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lrfap-sky"
        >
          <Outlet />
        </div>
      </div>
    </div>
  );
}
