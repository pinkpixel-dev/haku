// Small shared controls. Every one is keyboard reachable and labelled; icon buttons carry a tooltip
// that shows on hover and on keyboard focus.

import { useId, type CSSProperties, type ReactNode } from 'react';

interface IconButtonProps {
  label: string;
  onClick: () => void;
  children: ReactNode;
  pressed?: boolean;
  disabled?: boolean;
  variant?: 'ghost' | 'primary' | 'danger';
  tipSide?: 'top' | 'bottom';
  className?: string;
}

export function IconButton({ label, onClick, children, pressed, disabled, variant = 'ghost', tipSide = 'bottom', className = '' }: IconButtonProps) {
  return (
    <button
      type="button"
      className={`icon-btn icon-btn--${variant} ${className}`}
      aria-label={label}
      aria-pressed={pressed}
      data-tip={label}
      data-tip-side={tipSide}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

interface SliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
  hideLabel?: boolean;
}

export function Slider({ label, value, onChange, min = 0, max = 1, step = 0.01, format = (v) => `${Math.round(v * 100)}`, hideLabel }: SliderProps) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={`slider ${hideLabel ? 'slider--bare' : ''}`}>
      {!hideLabel && (
        <label htmlFor={id} className="slider__label">
          <span>{label}</span>
          <output htmlFor={id}>{format(value)}</output>
        </label>
      )}
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={hideLabel ? label : undefined}
        aria-valuetext={format(value)}
        style={{ '--pct': `${pct}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

interface SelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  hideLabel?: boolean;
  className?: string;
}

export function Select<T extends string>({ label, value, options, onChange, hideLabel, className = '' }: SelectProps<T>) {
  const id = useId();
  return (
    <div className={`field ${className}`}>
      {!hideLabel && (
        <label htmlFor={id} className="field__label">
          {label}
        </label>
      )}
      <select id={id} className="select" value={value} aria-label={hideLabel ? label : undefined} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface SwitchProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

export function Switch({ label, checked, onChange }: SwitchProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="switch" onClick={() => onChange(!checked)}>
      <span className="switch__track" aria-hidden="true">
        <span className="switch__thumb" />
      </span>
      <span className="switch__label">{label}</span>
    </button>
  );
}

/** Turns "late-night-train" into "Late night train" for option labels. */
export const titleCase = (id: string) => {
  const s = id.replace(/-/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
