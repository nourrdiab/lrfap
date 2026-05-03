import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronDown, GraduationCap, Languages, MapPin, Users } from 'lucide-react';
import type {
  CycleStatus,
  ID,
  Program,
  Specialty,
  Track,
  University,
} from '../../../types';

/**
 * Public catalog card for one Program.
 *
 * Click target IS the card — it toggles inline expand to show full
 * description + extraRequirements. Only one card is expanded at a time;
 * parent owns that state.
 *
 * Seat display is cycle-aware:
 *   - Pre-match (cycle in draft/open/review/ranking): "N seats"
 *   - Post-match (matching/published/closed): "X of N available"
 * This is honest — `availableSeats` always equals capacity before a
 * match has run, so showing "6 of 6 available" during open-enrollment
 * looks broken and isn't informationally useful.
 */

const TRACK_PILL: Record<Track, string> = {
  residency: 'rounded-md bg-sky-50 text-sky-800',
  fellowship: 'rounded-md bg-amber-50 text-amber-800',
};

const POST_MATCH_STATUSES: ReadonlyArray<CycleStatus> = [
  'matching',
  'published',
  'closed',
];

interface ProgramCardProps {
  program: Program;
  universityById: Map<ID, University>;
  specialtyById: Map<ID, Specialty>;
  cycleStatus: CycleStatus | null;
  expanded: boolean;
  onToggle: () => void;
  isAuthenticated: boolean;
}

function populate<T extends { _id: ID }>(
  ref: ID | T | null | undefined,
  lookup: Map<ID, T>,
): T | null {
  if (!ref) return null;
  if (typeof ref === 'string') return lookup.get(ref) ?? null;
  return ref;
}

export function ProgramCard({
  program,
  universityById,
  specialtyById,
  cycleStatus,
  expanded,
  onToggle,
  isAuthenticated,
}: ProgramCardProps) {
  const uni = populate(program.university, universityById);
  const spec = populate(program.specialty, specialtyById);
  const trackPill = TRACK_PILL[program.track];

  const postMatch = cycleStatus ? POST_MATCH_STATUSES.includes(cycleStatus) : false;
  const seatsLabel = postMatch
    ? `${program.availableSeats} of ${program.capacity} available`
    : `${program.capacity} ${program.capacity === 1 ? 'seat' : 'seats'}`;

  const hasLanguage =
    program.languageRequirement &&
    program.languageRequirement !== 'none' &&
    program.languageRequirement !== 'english';

  const descriptionId = `program-${program._id}-description`;
  const extras = program.extraRequirements?.filter(Boolean) ?? [];
  const hasDescription = !!program.description?.trim();
  const hasExtras = extras.length > 0;
  const isExpandable = hasDescription || hasExtras;
  const showCTA = !isAuthenticated;

  const cardBody = (
    <>
      <header className="flex items-start justify-between gap-[10px]">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[20px] font-bold leading-[1.2] text-lrfap-navy">
            {spec?.name ?? 'Unknown specialty'}
          </h3>
          <p className="mt-[6px] flex flex-wrap items-center gap-x-[8px] gap-y-[2px] font-sans text-[13px] text-lrfap-navy">
            <span className="font-medium">{uni?.name ?? 'Unknown university'}</span>
            {uni?.city ? (
              <span className="inline-flex items-center gap-[3px] text-lrfap-navy">
                <MapPin aria-hidden="true" className="h-3 w-3" />
                {uni.city}
              </span>
            ) : null}
          </p>
        </div>
        {isExpandable ? (
          <ChevronDown
            aria-hidden="true"
            className={`mt-[4px] h-4 w-4 shrink-0 text-lrfap-navy/40 transition-transform duration-200 group-hover:text-lrfap-navy ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-[6px]">
        <span
          className={`inline-flex items-center px-[8px] py-[2px] font-sans text-[11px] font-medium uppercase tracking-wide capitalize ${trackPill}`}
        >
          {program.track}
        </span>
        <span className="inline-flex items-center gap-[4px] rounded-md bg-lrfap-ghost/50 px-[8px] py-[2px] font-sans text-[11px] font-medium uppercase tracking-wide text-lrfap-navy">
          <GraduationCap aria-hidden="true" className="h-3 w-3" />
          {program.durationYears} {program.durationYears === 1 ? 'yr' : 'yrs'}
        </span>
        {hasLanguage ? (
          <span className="inline-flex items-center gap-[4px] rounded-md bg-lrfap-ghost/50 px-[8px] py-[2px] font-sans text-[11px] font-medium uppercase tracking-wide capitalize text-lrfap-navy">
            <Languages aria-hidden="true" className="h-3 w-3" />
            {program.languageRequirement}
          </span>
        ) : null}
      </div>

      <p className="inline-flex items-center gap-[6px] font-sans text-[12px] text-lrfap-navy">
        <Users aria-hidden="true" className="h-3.5 w-3.5 text-lrfap-navy" />
        <span>
          <strong className="font-semibold text-lrfap-navy">{seatsLabel}</strong>
        </span>
      </p>
    </>
  );

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-xl bg-white transition-shadow duration-200 ${
        expanded
          ? 'shadow-[0_8px_32px_-12px_rgba(38,43,102,0.25)]'
          : 'shadow-[0_4px_24px_-12px_rgba(38,43,102,0.15)] hover:shadow-[0_6px_28px_-12px_rgba(38,43,102,0.2)]'
      }`}
    >
      {isExpandable ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={descriptionId}
          className="group flex flex-col items-stretch gap-[12px] px-[20px] pt-[20px] pb-[16px] text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-lrfap-sky"
        >
          {cardBody}
        </button>
      ) : (
        <div className="flex flex-col items-stretch gap-[12px] px-[20px] pt-[20px] pb-[16px]">
          {cardBody}
          {showCTA ? (
            <div className="flex justify-end border-t border-lrfap-navy/10 pt-[12px]">
              <Link
                to="/login"
                className="inline-flex items-center gap-[4px] font-sans text-[12px] font-medium uppercase tracking-wide text-lrfap-navy hover:text-lrfap-sky focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
              >
                Sign in to apply →
              </Link>
            </div>
          ) : null}
        </div>
      )}

      <AnimatePresence initial={false}>
        {expanded && isExpandable ? (
          <motion.section
            key="expanded"
            id={descriptionId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0.7, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-lrfap-navy/10 px-[20px] py-[16px]">
              {hasDescription ? (
                <p className="font-sans text-[13px] leading-relaxed text-slate-600">
                  {program.description}
                </p>
              ) : null}
              {hasExtras ? (
                <div className={hasDescription ? 'mt-[14px]' : ''}>
                  <h4 className="font-sans text-[11px] font-semibold uppercase tracking-wide text-lrfap-navy/70">
                    Additional requirements
                  </h4>
                  <ul className="mt-[6px] flex flex-col gap-[4px] font-sans text-[13px] text-lrfap-navy">
                    {extras.map((req, i) => (
                      <li
                        key={`${req}-${i}`}
                        className="flex items-start gap-[8px]"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-[7px] inline-block h-[4px] w-[4px] shrink-0 rounded-full bg-lrfap-sky"
                        />
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {showCTA ? (
                <div
                  className={`flex justify-end ${hasExtras ? 'mt-[14px] border-t border-lrfap-navy/10 pt-[12px]' : ''}`}
                >
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-[4px] font-sans text-[12px] font-medium uppercase tracking-wide text-lrfap-navy hover:text-lrfap-sky focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lrfap-sky"
                  >
                    Sign in to apply →
                  </Link>
                </div>
              ) : null}
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </article>
  );
}
