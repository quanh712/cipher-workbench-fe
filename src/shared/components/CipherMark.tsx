export function CipherMark({ busy = false }: { busy?: boolean }) {
  return (
    <svg
      className={`cipher-mark${busy ? " cipher-mark--busy" : ""}`}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="currentColor" strokeWidth="1.5" opacity="0.55">
        {Array.from({ length: 24 }, (_, index) => (
          <path key={index} d="M32 2v3" transform={`rotate(${index * 15} 32 32)`} />
        ))}
      </g>
      <g className="cipher-mark__outer">
        <circle
          cx="32"
          cy="32"
          r="24"
          stroke="currentColor"
          strokeWidth="5"
          pathLength="100"
          strokeDasharray="10 2.5"
        />
        <circle
          cx="32"
          cy="32"
          r="24"
          stroke="var(--accent)"
          strokeWidth="5"
          pathLength="100"
          strokeDasharray="10 90"
          transform="rotate(-90 32 32)"
        />
      </g>
      <g className="cipher-mark__inner">
        <path
          d="M18 25C23 12 41 12 46 25M18 39C23 52 41 52 46 39M18 25C30 25 34 39 46 39M18 39C30 39 34 25 46 25"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <g fill="currentColor">
          <circle cx="18" cy="25" r="2.8" />
          <circle cx="46" cy="25" r="2.8" />
          <circle cx="18" cy="39" r="2.8" />
        </g>
        <circle cx="46" cy="39" r="3.5" fill="var(--accent)" />
      </g>
    </svg>
  );
}
