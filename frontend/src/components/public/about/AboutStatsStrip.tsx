import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { programsApi } from '../../../api/programs';
import { universitiesApi } from '../../../api/universities';
import { specialtiesApi } from '../../../api/specialties';

/**
 * Live platform-stats strip shown on the About page, directly below the
 * hero. Fetches the three public catalog endpoints in parallel and
 * renders counts.
 *
 * Failure is intentionally silent — if anything errors out we just
 * render nothing and the page reads as a normal static About. The strip
 * is decorative context ("this is real and running"), not load-bearing
 * information, so a failure shouldn't interrupt the rest of the page.
 */

interface Stats {
  universities: number;
  specialties: number;
  programs: number;
}

type Status = 'loading' | 'loaded' | 'error';

export function AboutStatsStrip() {
  const [status, setStatus] = useState<Status>('loading');
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      universitiesApi.list(),
      specialtiesApi.list(),
      programsApi.list(),
    ])
      .then(([unis, specs, progs]) => {
        if (cancelled) return;
        setStats({
          universities: unis.filter((u) => u.isActive !== false).length,
          specialties: specs.filter((s) => s.isActive !== false).length,
          programs: progs.filter((p) => p.isActive !== false).length,
        });
        setStatus('loaded');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'error') return null;

  return (
    <div className="bg-white">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="mx-auto flex w-full max-w-[1366px] flex-col px-6 py-[64px] sm:flex-row sm:px-[58px]"
      >
        <StatCell
          label="Participating universities"
          value={stats?.universities}
          loading={status === 'loading'}
        />
        <StatCell
          label="Medical specialties"
          value={stats?.specialties}
          loading={status === 'loading'}
        />
        <StatCell
          label="Programs available"
          value={stats?.programs}
          loading={status === 'loading'}
        />
      </motion.div>
    </div>
  );
}

interface StatCellProps {
  label: string;
  value?: number;
  loading: boolean;
}

function StatCell({ label, value, loading }: StatCellProps) {
  return (
    <div className="flex-1 py-[10px] text-center sm:py-0">
      {loading ? (
        <div
          aria-hidden="true"
          className="mx-auto h-[36px] w-[60px] animate-pulse bg-slate-100"
        />
      ) : (
        <p className="font-display text-[32px] font-extrabold leading-none text-lrfap-navy">
          {value ?? 0}
        </p>
      )}
      <p className="mt-[6px] font-sans text-[11px] font-semibold uppercase tracking-wide text-lrfap-navy">
        {label}
      </p>
    </div>
  );
}
