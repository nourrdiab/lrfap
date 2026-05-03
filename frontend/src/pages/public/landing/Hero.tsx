import { motion, useReducedMotion } from 'framer-motion';
import { PublicNavBar } from '../../../components/public/PublicNavBar';

/**
 * Hero section — full-bleed photograph + dark multiply overlay + H1 + 5
 * numbered feature row. Measurements are taken directly from the Figma
 * frame `1:1595` (LRFAP Home).
 *
 * Key y-coordinates in the 1366×735 hero frame:
 *   - NavBar content: y=31 → y=80
 *   - H1 block:       y=135.9 → y=~281 (three 40.3px ExtraBold lines, 48.37px leading)
 *   - Features row:   y=621.18 → y=~693 (5 items, justify-between)
 *   - Hero bottom:    y=735 (photo bottom)
 *
 * The H1's middle line ("FELLOWSHIP APPLICATION") sits on a #4192CF block
 * whose left/right/top/bottom offsets were measured directly from Figma
 * frames 1:1604 (highlight) and 1:1635 (text).
 */

// em equivalents of the original Figma px offsets (calibrated to the 40.3px
// desktop H1) so the highlight scales with the responsive clamp on mobile
// instead of overhanging proportionally more of the smaller text.
const HIGHLIGHT_OFFSETS: React.CSSProperties = {
  top: '0.0576em',
  bottom: '-0.0377em',
  left: '-0.1239em',
  right: '-0.1144em',
};

// Linear-gradient multiply overlay pulled from imgVector1 (c068d996…svg).
// #231F20 (opaque) → #181B29 (30% alpha, 51% stop) → #231F20 (opaque).
const OVERLAY_STYLE: React.CSSProperties = {
  background:
    'linear-gradient(180deg, #231F20 0%, rgba(24, 27, 41, 0.3) 51%, #231F20 100%)',
};

interface Feature {
  number: string;
  lines: [string, string, string];
}

// Designer's text had missing spaces ("PROGRAM&APPLICANT"); restored here
// without touching layout or type scale.
const FEATURES: Feature[] = [
  { number: '01', lines: ['STANDARDIZED', 'APPLICATION', 'WORKFLOW'] },
  { number: '02', lines: ['SECURE', 'DOCUMENT', 'SUBMISSION'] },
  { number: '03', lines: ['PROGRAM &', 'APPLICANT', 'RANKING'] },
  { number: '04', lines: ['TRANSPARENT', 'MATCHING', 'RELEASE'] },
  { number: '05', lines: ['GOVERNANCE', 'OVERSIGHT &', 'AUDITABILITY'] },
];

export function Hero() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <section
      aria-label="LRFAP — Lebanese Residency and Fellowship Application Program"
      className="relative isolate flex w-full flex-col overflow-hidden bg-[#1a1d2e] pb-[40px] md:min-h-[580px] md:pb-0"
    >
      <img
        src="/images/homepage-1.jpg"
        alt=""
        aria-hidden="true"
        draggable={false}
        className="absolute bottom-0 left-1/2 -z-20 h-full w-full -translate-x-1/2 object-cover object-[42%_center] md:h-[115%] md:w-[225%] md:object-[42%_0%]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 opacity-70 mix-blend-multiply"
        style={OVERLAY_STYLE}
      />

      <PublicNavBar variant="transparent" />

      <motion.h1
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
        className="relative mx-auto mt-[34.4px] w-full max-w-[1366px] px-6 font-display text-[clamp(20px,5.8vw,40.3px)] leading-[1.2] font-extrabold tracking-normal text-white md:px-[58px] md:leading-[48.37px]"
      >
        <span className="block whitespace-nowrap">LEBANESE RESIDENCY AND</span>
        <span className="relative block w-fit whitespace-nowrap md:inline-block">
          <motion.span
            aria-hidden="true"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1], delay: 0.55 }}
            className="absolute origin-left bg-lrfap-sky"
            style={HIGHLIGHT_OFFSETS}
          />
          <span className="relative">FELLOWSHIP APPLICATION</span>
        </span>
        <span className="block">PROGRAM</span>
      </motion.h1>

      <motion.ul
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: {
            transition: shouldReduceMotion
              ? { duration: 0 }
              : { staggerChildren: 0.07, delayChildren: 0.3 },
          },
        }}
        className="relative mx-auto mt-auto mb-[42.4px] hidden w-full max-w-[1366px] items-start justify-between px-[58px] lg:flex"
      >
        {FEATURES.map((feature) => (
          <motion.li
            key={feature.number}
            variants={{
              hidden: shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 },
              visible: { opacity: 1, y: 0 },
            }}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { duration: 0.45, ease: 'easeOut' }
            }
            className="flex items-start gap-[15px] text-white"
          >
            <span
              aria-hidden="true"
              className="font-display text-[40.3px] leading-none font-extrabold"
            >
              {feature.number}
            </span>
            <div className="flex flex-col pt-[6px] font-sans text-[18.11px] leading-[21.73px] font-normal">
              {feature.lines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}
