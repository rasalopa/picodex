import type { ReactNode } from 'react';

export interface IconProps {
  className?: string;
}

/** Shared line-icon frame: 24-grid, currentColor stroke, decorative only. */
function Icon({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Library: a grid of game tiles. */
export function IconGrid(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </Icon>
  );
}

/** Covers / box art: a framed picture. */
export function IconImage(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="M4 18l5-4.5 3.5 3 3-2.5 4.5 4" />
    </Icon>
  );
}

/** Screenshots: the console's two screens, one above the other. */
export function IconScreens(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="3" width="16" height="8" rx="1.5" />
      <rect x="4" y="13" width="16" height="8" rx="1.5" />
    </Icon>
  );
}

/** Play stats: bars on a baseline. */
export function IconChart(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h16" />
      <path d="M7.5 20v-5.5" />
      <path d="M12 20V6" />
      <path d="M16.5 20v-9" />
    </Icon>
  );
}

/** Health: a heartbeat trace. */
export function IconPulse(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />
    </Icon>
  );
}

/** Folder banners: a folder. */
export function IconFolder(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3 7a2 2 0 0 1 2-2h3.5l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </Icon>
  );
}

/** File associations: a chain link. */
export function IconLink(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.5 14.5l5-5" />
      <path d="M11 6.8l1.3-1.3a3.6 3.6 0 0 1 5.1 5.1l-1.9 1.9" />
      <path d="M13 17.2l-1.3 1.3a3.6 3.6 0 0 1-5.1-5.1l1.9-1.9" />
    </Icon>
  );
}

/** Games count: a cartridge. */
export function IconCartridge(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <rect x="8.5" y="6" width="7" height="4" rx="1" />
      <path d="M9 14h6" />
      <path d="M9 17h6" />
    </Icon>
  );
}

/** Systems count: stacked layers. */
export function IconLayers(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </Icon>
  );
}

/** Favorites: a heart. */
export function IconHeart(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 19.5C5.5 15 3.5 12 3.5 9A3.6 3.6 0 0 1 12 6.9 3.6 3.6 0 0 1 20.5 9c0 3-2 6-8.5 10.5z" />
    </Icon>
  );
}

/** Play time: a clock. */
export function IconClock(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Icon>
  );
}

/** Completed: a check in a circle. */
export function IconCheckCircle(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5.5" />
    </Icon>
  );
}

/** Launches: a play triangle. */
export function IconPlay(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8 5.5l11 6.5-11 6.5z" />
    </Icon>
  );
}
