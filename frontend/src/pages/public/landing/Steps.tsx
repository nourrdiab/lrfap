import { motion } from 'framer-motion';

import step1Icon from '../../../assets/landing/step-1.svg';
import step2aIcon from '../../../assets/landing/step-2a.svg';
import step2bIcon from '../../../assets/landing/step-2b.svg';
import step3aIcon from '../../../assets/landing/step-3a.svg';
import step3bIcon from '../../../assets/landing/step-3b.svg';
import step4Icon from '../../../assets/landing/step-4.svg';
import step5Icon from '../../../assets/landing/step-5.svg';

/**
 * Step overview section — heading row + 5-cell grid.
 *
 * Uses a semantic layout (flex for the heading row, CSS grid for the cells);
 * pixel-perfect Figma dimensions are preserved only on the cells themselves
 * (272.4 × 289.91 per cell, 0.91 px #EFEFEF border) and on the inner icon /
 * caption placements, which are absolute **inside each cell** rather than
 * absolute at the section level.
 *
 * That inversion is the key fix for a previous bug where the entire cell row
 * was wrapped in `<motion.div className="contents">`. `display: contents`
 * produces no DOM box, so Framer Motion's `whileInView` (IntersectionObserver)
 * never fired and every cell + caption sat at `opacity: 0`. Here each cell is
 * a real motion element with its own whileInView.
 *
 * Cell-relative coordinates (caption is identical across all five cells):
 *   Icons (per step):  positions listed below, all within the 272.4 × 289.91 box
 *   Caption:           top=169.84, left=48.84, width per step (see widths note)
 */

interface IconPlacement {
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface StepDef {
  icons: IconPlacement[];
  captionWidth: number;
  captionLines: [string, string, string];
}

// Caption widths were widened from Figma's originals (172/143/145/165/159)
// after restoring missing spaces in the designer's text. See earlier commit
// for the detailed math — each width stays inside the ~223 px usable space
// per cell (272.4 cell width − 48.84 left inset).
const STEPS: StepDef[] = [
  {
    icons: [{ src: step1Icon, x: 48.84, y: 102.56, w: 10.44, h: 10.44 }],
    captionWidth: 172,
    captionLines: ['Create an account', 'and complete your', 'profile.'],
  },
  {
    icons: [
      { src: step2aIcon, x: 45.48, y: 95.0, w: 52.11, h: 25.55 },
      { src: step2bIcon, x: 115.18, y: 103.69, w: 52.12, h: 25.55 },
    ],
    captionWidth: 160,
    captionLines: ['Upload all the', 'information and', 'documents.'],
  },
  {
    icons: [
      { src: step3aIcon, x: 49.22, y: 100.39, w: 25.28, h: 25.28 },
      { src: step3bIcon, x: 213.43, y: 106.71, w: 12.64, h: 12.64 },
    ],
    captionWidth: 160,
    captionLines: ['Select programs', 'and rank your', 'preferences.'],
  },
  {
    // Previously part of the combined step-4-5 SVG, now a standalone cluster.
    icons: [{ src: step4Icon, x: 57.29, y: 72.88, w: 64.1, h: 60.36 }],
    captionWidth: 200,
    captionLines: ['Universities review', 'and rank the', 'applicants.'],
  },
  {
    // The lone big dot that used to ride on the right side of step-4-5.svg.
    icons: [{ src: step5Icon, x: 201.04, y: 93.71, w: 21.86, h: 21.86 }],
    captionWidth: 200,
    captionLines: ['LRFAP publishes', 'results, applicants', 'confirm offers.'],
  },
];

export function Steps() {
  return (
    <section
      aria-labelledby="steps-heading"
      className="relative w-full overflow-hidden bg-white py-[30px]"
    >
      <div className="mx-auto w-full max-w-[1366px] px-6 md:px-[58px]">
        <div className="flex flex-col items-start md:flex-row">
          <p
            aria-hidden="true"
            className="font-display text-[64px] leading-none font-extrabold text-lrfap-ghost select-none md:text-[121.21px]"
          >
            05
          </p>
          <motion.h2
            id="steps-heading"
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="font-display text-[26px] leading-[32px] font-extrabold text-lrfap-navy md:mt-[30.63px] md:ml-[22.06px] md:text-[40.3px] md:leading-[48.37px]"
          >
            <span className="block">STEP</span>
            <span className="block">OVERVIEW</span>
          </motion.h2>
        </div>
      </div>

      <div className="mx-auto mt-[35.05px] grid w-full max-w-[1362px] grid-cols-1 px-6 xl:grid-cols-5 xl:px-0">
        {STEPS.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{
              duration: 0.45,
              ease: 'easeOut',
              delay: 0.1 + i * 0.08,
            }}
            className={`relative border-[0.91px] border-lrfap-ghost xl:border-l-0 ${
              i === 0 ? 'xl:border-l-[0.91px]' : ''
            }`}
            style={{ height: '289.91px' }}
          >
            {step.icons.map((icon, j) => (
              <img
                key={j}
                src={icon.src}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="absolute select-none"
                style={{
                  top: `${icon.y}px`,
                  left: `${icon.x}px`,
                  width: `${icon.w}px`,
                  height: `${icon.h}px`,
                }}
              />
            ))}

            <p
              className="absolute font-sans text-[18.11px] leading-[21.73px] font-normal text-lrfap-navy"
              style={{
                top: '169.84px',
                left: '48.84px',
                width: `${step.captionWidth}px`,
              }}
            >
              <span className="sr-only">Step {i + 1}. </span>
              {step.captionLines.map((line, j) => (
                <span key={j} className="block whitespace-nowrap">
                  {line}
                </span>
              ))}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
