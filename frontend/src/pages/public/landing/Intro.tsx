import { motion } from 'framer-motion';
import decorationIntro from '../../../assets/landing/decoration-intro.svg';

/**
 * Intro section — navy staircase H2 on the left, navy body paragraph on the
 * right, light-gray geometric decoration bleeding off the right edge.
 *
 * Positions are absolute inside a fixed-height (253.76 px) frame so the
 * staircase indentation and the body's x=683 offset land on exact Figma
 * pixels. A responsive pass will replace this with a stacked layout below the
 * 1366 px design breakpoint once all six landing sections are in.
 *
 * Figma frame coordinates (y=735 is the section top — hero photo bottom):
 *   H2 line 1 "BUILT FOR TRANSPARENCY"      top=62.69  left=58
 *   H2 line 2 "FAIRNESS"                    top=107.32 left=296.28
 *   H2 line 3 "& NATIONAL COORDINATION."    top=150.07 left=296.28
 *   Body paragraph (2 lines, 594 wide)      top=72.36  left=683.27
 *   Decoration (507.72 × 431.20)            top=30.04  right=-256.26
 */
export function Intro() {
  return (
    <section
      aria-label="Built for transparency, fairness and national coordination"
      className="relative w-full overflow-hidden bg-white"
    >
      <div className="px-6 py-10 lg:hidden">
        <motion.h2
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          className="font-display text-[26px] leading-[32px] font-extrabold text-lrfap-navy"
        >
          BUILT FOR TRANSPARENCY, FAIRNESS &amp; NATIONAL COORDINATION
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, ease: 'easeOut', delay: 0.15 }}
          className="mt-6 font-sans text-[15px] leading-[22px] font-normal text-lrfap-navy"
        >
          Submit one verified application, rank your preferred programs, and
          access a secure, transparent, and standardized matching process.
        </motion.p>
      </div>

      <div className="hidden lg:block">
        <div className="relative mx-auto h-[253.76px] w-full max-w-[1366px]">
          <img
            src={decorationIntro}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none absolute select-none"
            style={{
              top: '30.04px',
              right: '-256.26px',
              width: '507.72px',
              height: '431.20px',
            }}
          />

          <motion.h2
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className="absolute font-display text-[40.3px] leading-[43.7px] font-extrabold text-lrfap-navy"
            style={{ top: '62.69px', left: '28px' }}
          >
            <span className="block">BUILT FOR TRANSPARENCY</span>
            <span className="block pl-[238.28px]">FAIRNESS</span>
            <span className="block pl-[238.28px]">&amp; NATIONAL COORDINATION</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.55, ease: 'easeOut', delay: 0.15 }}
            className="absolute font-sans text-[18.11px] leading-[21.73px] font-normal text-lrfap-navy"
            style={{ top: '62.69px', left: '653.27px', width: '594px' }}
          >
            Submit one verified application, rank your preferred programs, and
            access a secure, transparent, and standardized matching process.
          </motion.p>
        </div>
      </div>
    </section>
  );
}
