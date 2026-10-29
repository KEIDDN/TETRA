import { useEffect, useRef, useState } from 'react';
import { setName } from '../lib/profile';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/70';

/** Asks a newly signed-in player what to call them. */
export function NamePrompt() {
  const [name, setDraft] = useState('');
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => field.current?.focus(), []);
  return (
    <div className="animate-fade fixed inset-0 z-[65] grid place-items-center bg-black/70 backdrop-blur-md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) setName(name);
        }}
        className="glass-panel animate-rise w-[min(440px,90vw)] rounded-[32px] p-8"
      >
        <span className="font-mono text-[11px] tracking-[0.24em] text-white/50 uppercase">Welcome to TETRA</span>
        <h2 className="mt-3 text-[30px] leading-[1.05] font-[560] tracking-[-0.03em]">Choose your player name.</h2>
        <p className="mt-2 text-[14px] text-white/55">It's how you'll appear in TETRA. You can change it in your Profile.</p>
        <input
          ref={field}
          required
          maxLength={24}
          value={name}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Player name"
          autoComplete="nickname"
          className="glass-panel mt-6 h-12 w-full rounded-full px-5 text-[16px] outline-none placeholder:text-white/30 focus-visible:ring-2 focus-visible:ring-accent/60"
        />
        <button disabled={!name.trim()} className={`glass-light mt-4 h-12 w-full rounded-full text-[16px] font-semibold disabled:opacity-50 ${focusRing}`}>
          Continue
        </button>
      </form>
    </div>
  );
}
