export function TopoField({ className = "" }: { className?: string }) {
  return (
    <div className={`topo ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 800 640" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="topo-glow" cx="48%" cy="42%" r="42%">
            <stop offset="0%" stopColor="#c45c2a" stopOpacity="0.28" />
            <stop offset="42%" stopColor="#3a2a20" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#14110e" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="800" height="640" fill="#14110e" />
        <ellipse cx="390" cy="270" rx="220" ry="170" fill="url(#topo-glow)" />
        {[
          "M180 300 C 260 180, 540 170, 640 310 C 560 430, 250 440, 180 300 Z",
          "M230 300 C 300 210, 510 200, 590 310 C 520 390, 280 400, 230 300 Z",
          "M290 300 C 340 240, 470 235, 530 305 C 480 360, 330 365, 290 300 Z",
          "M350 298 C 380 268, 430 266, 460 300 C 430 328, 380 330, 350 298 Z",
        ].map((d) => (
          <path key={d} d={d} fill="none" stroke="rgba(239,232,220,0.22)" strokeWidth="1.1" />
        ))}
        <circle cx="400" cy="292" r="7" fill="#c45c2a" />
        <circle cx="400" cy="292" r="18" fill="none" stroke="#c45c2a" strokeOpacity="0.45" />
      </svg>
    </div>
  )
}
