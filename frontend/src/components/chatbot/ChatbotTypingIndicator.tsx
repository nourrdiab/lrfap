/**
 * Animated three-dot "thinking" bubble shown while a response is in
 * flight. Sits in the same visual slot as an incoming model bubble so
 * the UI flows naturally once the real response arrives.
 *
 * Animation driven by Tailwind's built-in `animate-bounce` with
 * per-dot negative delays so the three dots bob out of phase.
 */
export function ChatbotTypingIndicator() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Assistant is typing"
      className="flex items-start"
    >
      <div className="inline-flex items-center gap-[4px] rounded-xl bg-lrfap-ghost/70 px-[14px] py-[10px]">
        <Dot delay="-0.3s" />
        <Dot delay="-0.15s" />
        <Dot delay="0s" />
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-[6px] w-[6px] rounded-full bg-lrfap-navy/60 animate-bounce"
      style={{ animationDelay: delay }}
    />
  );
}
