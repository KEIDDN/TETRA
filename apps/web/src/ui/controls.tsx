import type { ReactNode } from 'react';

const focusRing = 'outline-none focus-visible:ring-2 focus-visible:ring-accent/60';

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  small,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
  small?: boolean;
}) {
  return (
    <div className="hairline inline-flex shrink-0 rounded-full bg-tile p-1">
      {options.map(([id, name]) => (
        <button
          key={id}
          data-nav
          onClick={() => onChange(id)}
          className={`rounded-full font-medium transition-all duration-250 ease-spring ${focusRing} ${small ? 'px-4 py-1.5 text-[13px]' : 'px-5 py-2 text-[14px]'} ${
            value === id ? 'bg-fg text-black' : 'text-muted hover:text-fg'
          }`}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

export function Section({ label, note, children }: { label: string; note?: string; children: ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline justify-between gap-4 px-1">
        <span className="label">{label}</span>
        {note && <span className="text-right text-[12px] text-faint">{note}</span>}
      </div>
      <div className="hairline overflow-hidden rounded-[28px] bg-tile">{children}</div>
    </section>
  );
}

export function Row({ name, hint, children }: { name: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-line px-6 py-4 first:border-t-0 sm:px-7">
      <div className="min-w-0">
        <div className="text-[16px] font-medium tracking-[-0.01em]">{name}</div>
        {hint && <div className="mt-0.5 text-[13px] text-faint">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

export function SliderRow(props: {
  name: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  display: (v: number) => string;
  sub?: (v: number) => string;
  onChange: (v: number) => void;
  onCommit?: () => void;
}) {
  const { min, max, step, value } = props;
  const rounded = Math.round(value / step) * step;
  const fill = ((rounded - min) / (max - min)) * 100;
  return (
    <Row name={props.name} hint={props.hint}>
      <div className="flex w-full items-center gap-5 sm:w-[320px]">
        <input
          data-nav
          type="range"
          className="slider flex-1"
          min={min}
          max={max}
          step={step}
          value={rounded}
          style={{ '--fill': `${fill}%` } as React.CSSProperties}
          onChange={(e) => props.onChange(Number(e.target.value))}
          onPointerUp={props.onCommit}
          onKeyUp={props.onCommit}
        />
        <div className="w-[64px] text-right">
          <div className="tabular text-[16px] font-medium leading-none">{props.display(rounded)}</div>
          {props.sub && <div className="tabular mt-1 text-[11px] text-faint">{props.sub(rounded)}</div>}
        </div>
      </div>
    </Row>
  );
}

export function ToggleRow({ name, hint, value, onChange }: { name: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Row name={name} hint={hint}>
      <button
        data-nav
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative h-[30px] w-[52px] shrink-0 rounded-full transition-colors duration-200 ${focusRing} ${value ? 'bg-[#30d158]' : 'bg-white/[0.14]'}`}
      >
        <span
          className={`absolute top-[3px] left-[3px] size-6 rounded-full bg-white shadow-sm transition-transform duration-250 ease-spring ${
            value ? 'translate-x-[22px]' : ''
          }`}
        />
      </button>
    </Row>
  );
}
