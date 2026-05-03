import { ArrowUpRight, FolderOpen, GraduationCap } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Dashboard widget: two shortcut tiles to the applicant's main
 * destinations. Stays at two tiles on purpose — adding filler links
 * (support, calendar) before those pages exist would hurt the page
 * more than an empty slot would.
 */

export function QuickLinksGrid() {
  return (
    <section aria-labelledby="dashboard-quick-links-heading">
      <h2
        id="dashboard-quick-links-heading"
        className="font-display text-[16px] font-bold uppercase tracking-wide text-lrfap-navy"
      >
        Quick Links
      </h2>
      <div className="mt-[12px] grid grid-cols-1 gap-[16px] md:grid-cols-2">
        <QuickLinkTile
          to="/applicant/applications"
          icon={<FolderOpen aria-hidden="true" className="h-5 w-5" />}
          title="My Applications"
          body="View all drafts and submissions"
        />
        <QuickLinkTile
          to="/programs"
          icon={<GraduationCap aria-hidden="true" className="h-5 w-5" />}
          title="Browse Programs"
          body="Explore residency & fellowship programs"
        />
      </div>
    </section>
  );
}

interface QuickLinkTileProps {
  to: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}

function QuickLinkTile({ to, icon, title, body }: QuickLinkTileProps) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-[14px] border-[0.91px] border-lrfap-ghost bg-white p-[20px] shadow-[0_4px_12px_rgba(38,43,102,0.08)] transition-colors hover:border-lrfap-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
    >
      <span
        aria-hidden="true"
        className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-lrfap-ghost text-lrfap-navy transition-colors group-hover:bg-lrfap-navy group-hover:text-white"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-sans text-[14px] font-semibold uppercase tracking-wide text-lrfap-navy">
          {title}
        </p>
        <p className="mt-[2px] font-sans text-[12px] text-slate-600">{body}</p>
      </div>
      <ArrowUpRight
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:-translate-y-[1px] group-hover:translate-x-[1px] group-hover:text-lrfap-navy"
      />
    </Link>
  );
}
