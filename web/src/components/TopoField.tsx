export function TopoField({ className = "" }: { className?: string }) {
  return (
    <div className={`topo ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 800 640" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="topo-glow" cx="48%" cy="40%" r="46%">
            <stop offset="0%" stopColor="#5a5a62" stopOpacity="0.45" />
            <stop offset="48%" stopColor="#2a2a2e" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="800" height="640" fill="#0b0b0d" />
        <ellipse cx="400" cy="268" rx="230" ry="176" fill="url(#topo-glow)" />
        {[
          "M180 300 C 260 180, 540 170, 640 310 C 560 430, 250 440, 180 300 Z",
          "M230 300 C 300 210, 510 200, 590 310 C 520 390, 280 400, 230 300 Z",
          "M290 300 C 340 240, 470 235, 530 305 C 480 360, 330 365, 290 300 Z",
          "M350 298 C 380 268, 430 266, 460 300 C 430 328, 380 330, 350 298 Z",
        ].map((d) => (
          <path key={d} d={d} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="1.1" />
        ))}
        <circle cx="400" cy="292" r="6" fill="#f5f5f7" />
        <circle cx="400" cy="292" r="18" fill="none" stroke="#f5f5f7" strokeOpacity="0.35" />
      </svg>
    </div>
  )
}
