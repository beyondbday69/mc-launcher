import React from "react";

export interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

// 21st.dev inspired interactive animated SVGs:
// Pixel-precise vector geometry with sub-element classes for smooth micro-animations

// 1. Dashboard / Home
export function IconHome({ size = 18, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon-animated-home ${className || ""}`}
      style={style}
    >
      <path className="home-roof" d="m3 9 9-7 9 7" />
      <path className="home-walls" d="M4 10v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V10" />
      <polyline className="home-door" points="9 21 9 12 15 12 15 21" />
    </svg>
  );
}

// 2. Game Library / Instances (Voxel Box with lifting lid)
export function IconInstances({ size = 18, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon-animated-box ${className || ""}`}
      style={style}
    >
      <path className="box-lid" d="M12 2L2 7l10 5 10-5-10-5z" />
      <path className="box-body-left" d="M2 17l10 5V12L2 7v10z" />
      <path className="box-body-right" d="M12 12v10l10-5V7l-10 5z" />
    </svg>
  );
}

// 3. Driver Catalog (High-tech GPU/Driver Microchip with pulsing silicon core)
export function IconVersions({ size = 18, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon-animated-chip ${className || ""}`}
      style={style}
    >
      <rect className="chip-board" x="4" y="4" width="16" height="16" rx="2" />
      <rect className="chip-core" x="9" y="9" width="6" height="6" />
      <path className="chip-pins" d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" />
    </svg>
  );
}

// 4. Transfers / Downloads (Arrow dropping into tray with spring bounce)
export function IconDownloads({ size = 18, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon-animated-download ${className || ""}`}
      style={style}
    >
      <path className="download-tray" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <g className="download-arrow">
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </g>
    </svg>
  );
}

// 5. Mods & Packs (Universal Jigsaw Puzzle Piece)
export function IconContent({ size = 18, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon-animated-puzzle ${className || ""}`}
      style={style}
    >
      <path
        className="puzzle-piece"
        d="M4 7h3a1 1 0 0 0 1-1v-1a2 2 0 0 1 4 0v1a1 1 0 0 0 1 1h3a1 1 0 0 1 1 1v3a1 1 0 0 0 1 1h1a2 2 0 0 1 0 4h-1a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-1a2 2 0 0 0-4 0v1a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a2 2 0 0 0 0-4h-1a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1"
      />
    </svg>
  );
}

export const IconPuzzle = IconContent;
export const IconMods = IconContent;

// 6. Settings & Tuning (Precision Gear Rotor with rotation)
export function IconSettings({ size = 18, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon-animated-gear ${className || ""}`}
      style={style}
    >
      <g className="gear-rotor">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </g>
    </svg>
  );
}

// 7. Game Ready / Gamepad (Replaces Unicode Emoji with High-Tech Ergonomic Controller)
export function IconGamepad({ size = 24, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon-animated-gamepad ${className || ""}`}
      style={style}
    >
      {/* Ergonomic controller grips and body */}
      <path
        className="gamepad-body"
        d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 19c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258A4 4 0 0 0 17.32 5z"
      />
      {/* D-Pad on left */}
      <g className="gamepad-dpad">
        <line x1="6" y1="12" x2="10" y2="12" />
        <line x1="8" y1="10" x2="8" y2="14" />
      </g>
      {/* Action Buttons on right */}
      <g className="gamepad-btns">
        <circle cx="15" cy="13" r="0.75" fill="currentColor" stroke="none" />
        <circle cx="18" cy="11" r="0.75" fill="currentColor" stroke="none" />
      </g>
      {/* Game Ready glowing status LED in center */}
      <circle className="gamepad-led" cx="12" cy="10" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

export const IconGameReady = IconGamepad;

// 8. Launch / Play
export function IconPlay({ size = 18, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`icon-animated-play ${className || ""}`}
      style={style}
    >
      <path className="play-triangle" d="M8 5v14l11-7z" />
    </svg>
  );
}

// 9. Stop
export function IconStop({ size = 18, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`icon-animated-stop ${className || ""}`}
      style={style}
    >
      <rect x="5" y="5" width="14" height="14" rx="2" />
    </svg>
  );
}

// 10. Search (Magnifying glass with bounce)
export function IconSearch({ size = 16, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon-animated-search ${className || ""}`}
      style={style}
    >
      <circle className="search-glass" cx="11" cy="11" r="8" />
      <line className="search-handle" x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

// 11. Plus / Add (90deg spring spin)
export function IconPlus({ size = 16, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon-animated-plus ${className || ""}`}
      style={style}
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// 12. Check / Verified (Elastic pop)
export function IconCheck({ size = 16, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon-animated-check ${className || ""}`}
      style={style}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// 13. Edit / Rename (Pencil tilt)
export function IconEdit({ size = 16, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon-animated-edit ${className || ""}`}
      style={style}
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path className="edit-pencil" d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

// 14. Copy / Duplicate (Front sheet offset)
export function IconCopy({ size = 16, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon-animated-copy ${className || ""}`}
      style={style}
    >
      <rect className="copy-top-sheet" x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path className="copy-back-sheet" d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

// 15. Trash / Delete (Lid opens)
export function IconTrash({ size = 16, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon-animated-trash ${className || ""}`}
      style={style}
    >
      <g className="trash-lid">
        <polyline points="3 6 5 6 21 6" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </g>
      <path className="trash-can" d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

// 16. Game Folder (Folder flap tilts open)
export function IconFolder({ size = 16, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon-animated-folder ${className || ""}`}
      style={style}
    >
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
      <path className="folder-flap" d="M2 10h20" />
    </svg>
  );
}

// 17. User / Gamer Profile (Avatar head nods)
export function IconUser({ size = 16, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon-animated-user ${className || ""}`}
      style={style}
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle className="user-head" cx="12" cy="7" r="4" />
    </svg>
  );
}

// 18. Clock / Playtime History
export function IconClock({ size = 16, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon-animated-clock ${className || ""}`}
      style={style}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline className="clock-minute" points="12 6 12 12 16 14" />
    </svg>
  );
}

// 19. Calendar
export function IconCalendar({ size = 16, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

// 20. 3D Voxel Cube (Minecraft block)
export function IconCube({ size = 16, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon-animated-cube ${className || ""}`}
      style={style}
    >
      <path className="cube-top" d="m12 3 8 4.5-8 4.5-8-4.5z" />
      <path className="cube-left" d="m4 7.5v9l8 4.5v-9z" />
      <path className="cube-right" d="m12 12v9l8-4.5v-9z" />
    </svg>
  );
}

// 21. RAM / Silicon Die
export function IconRam({ size = 16, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon-animated-chip ${className || ""}`}
      style={style}
    >
      <rect className="chip-board" x="4" y="4" width="16" height="16" rx="2" />
      <rect className="chip-core" x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  );
}

// 22. Speed / Performance Gauge
export function IconSpeed({ size = 16, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon-animated-speed ${className || ""}`}
      style={style}
    >
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="m4.93 4.93 2.83 2.83" />
      <path d="m16.24 16.24 2.83 2.83" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="m4.93 19.07 2.83-2.83" />
      <path d="m16.24 7.76 2.83-2.83" />
    </svg>
  );
}

// 23. Chevron Down
export function IconChevronDown({ size = 14, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// 24. Refresh / Sync (360deg spin)
export function IconRefresh({ size = 16, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon-animated-refresh ${className || ""}`}
      style={style}
    >
      <g className="refresh-arrows">
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </g>
    </svg>
  );
}

// 25. Grid View
export function IconGrid({ size = 16, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

// 26. List View
export function IconList({ size = 16, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}
