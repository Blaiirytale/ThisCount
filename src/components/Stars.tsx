// Star display (read-only) and star picker (for writing a review)

interface StarsProps {
  value: number; // 0–5, decimals allowed (4.3)
  label?: string;
}

export function Stars({ value, label }: StarsProps) {
  const rounded = Math.round(value);
  return (
    <span className="stars" role="img" aria-label={label ?? `${value} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rounded ? 'star is-on' : 'star'} aria-hidden="true">
          ★
        </span>
      ))}
    </span>
  );
}

interface StarInputProps {
  value: number; // 0 = not picked yet
  onChange: (value: number) => void;
  label: string;
}

export function StarInput({ value, onChange, label }: StarInputProps) {
  return (
    <div className="star-input" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} / 5`}
          className={n <= value ? 'star is-on' : 'star'}
          onClick={() => onChange(n)}
        >
          ★
        </button>
      ))}
    </div>
  );
}
