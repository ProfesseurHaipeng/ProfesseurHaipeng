export function TopoField({ className = "" }: { className?: string }) {
  const stars = [
    [62, 54],
    [118, 132],
    [176, 48],
    [248, 96],
    [312, 38],
    [390, 78],
    [468, 44],
    [540, 110],
    [612, 36],
    [688, 88],
    [742, 58],
    [84, 220],
    [710, 210],
    [52, 480],
    [760, 520],
    [140, 560],
    [680, 580],
  ] as const

  return (
    <div className={`topo ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 800 640" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="topo-glow" cx="52%" cy="42%" r="48%">
            <stop offset="0%" stopColor="#c45c2a" stopOpacity="0.28" />
            <stop offset="42%" stopColor="#2a221c" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#050506" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="800" height="640" fill="#050506" />
        {[100, 200, 300, 400, 500, 600, 700].map((x) => (
          <path key={`v${x}`} d={`M${x} 0 V640`} stroke="rgba(243,239,230,0.05)" />
        ))}
        {[80, 160, 240, 320, 400, 480, 560].map((y) => (
          <path key={`h${y}`} d={`M0 ${y} H800`} stroke="rgba(243,239,230,0.05)" />
        ))}
        <ellipse cx="400" cy="268" rx="238" ry="172" fill="url(#topo-glow)" />
        {[
          "M180 300 C 260 180, 540 170, 640 310 C 560 430, 250 440, 180 300 Z",
          "M230 300 C 300 210, 510 200, 590 310 C 520 390, 280 400, 230 300 Z",
          "M290 300 C 340 240, 470 235, 530 305 C 480 360, 330 365, 290 300 Z",
          "M350 298 C 380 268, 430 266, 460 300 C 430 328, 380 330, 350 298 Z",
        ].map((d) => (
          <path key={d} d={d} fill="none" stroke="rgba(243,239,230,0.28)" strokeWidth="1" />
        ))}
        {stars.map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={x % 3 === 0 ? 1.1 : 0.7} fill="#f3efe6" opacity="0.55" />
        ))}
        <path d="M400 248 V276 M386 262 H414" stroke="#c45c2a" strokeWidth="1.1" />
        <circle cx="400" cy="292" r="3.2" fill="#c45c2a" />
        <circle cx="400" cy="292" r="16" fill="none" stroke="#f3efe6" strokeOpacity="0.35" />
        <path d="M24 24 H72 M24 24 V72" stroke="rgba(243,239,230,0.28)" />
        <path d="M728 568 H776 M776 520 V568" stroke="rgba(243,239,230,0.28)" />
      </svg>
    </div>
  )
}
