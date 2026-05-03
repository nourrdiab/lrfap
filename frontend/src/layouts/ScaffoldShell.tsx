import { Link, NavLink, Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}

interface ScaffoldShellProps {
  label: string;
  items: NavItem[];
  accent?: 'navy' | 'sky';
  right?: ReactNode;
}

/**
 * Temporary shell used by every layout until we build the real navbar/footer
 * from the Figma design. Intentionally plain — do not treat as the final look.
 */
export function ScaffoldShell({ label, items, accent = 'navy', right }: ScaffoldShellProps) {
  const accentBg = accent === 'sky' ? 'bg-sky-600' : 'bg-[#0B2545]';
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <header className={`${accentBg} text-white`}>
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <Link to="/" className="flex items-center gap-2 text-base font-semibold">
            <img
              src="/logos/logo-white.png"
              alt=""
              className="h-7 w-auto"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
            <span>LRFAP</span>
            <span className="ml-2 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest">
              {label}
            </span>
          </Link>
          <nav className="ml-auto flex flex-wrap items-center gap-4 text-sm">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `transition hover:text-white ${
                    isActive ? 'text-white' : 'text-white/70'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            {right}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-slate-500">
          © {new Date().getFullYear()} LRFAP — Lebanese Residency and Fellowship
          Application Program. Scaffold footer (to be replaced from Figma).
        </div>
      </footer>
    </div>
  );
}
