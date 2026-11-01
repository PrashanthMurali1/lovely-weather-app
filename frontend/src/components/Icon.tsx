import type { ReactElement } from "react";

export type IconName = "search" | "locate" | "close" | "offline" | "clock" | "alert" | "drop" | "sun" | "moon" | "plus" | "minus" | "expand" | "play" | "pause" | "map" | "forecast";

const PATHS: Record<IconName, ReactElement> = {
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 21 21" />
    </>
  ),
  locate: (
    <>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2" className="icon-fill" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  offline: (
    <>
      <path d="M4.5 12.5a10.5 10.5 0 0 1 4.6-2.6M14.5 9.8a10.5 10.5 0 0 1 5 2.7M8.2 16a5.5 5.5 0 0 1 7.6 0" />
      <circle cx="12" cy="19.5" r="1" className="icon-fill" />
      <path d="M3 3l18 18" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5 21.5 20h-19z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17.3" r="0.6" className="icon-fill" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.3M12 19.2v2.3M2.5 12h2.3M19.2 12h2.3M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6" />
    </>
  ),
  moon: <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  play: <path d="M8 5.5v13l11-6.5z" className="icon-fill" />,
  pause: <path d="M8 5.5v13M16 5.5v13" strokeWidth="3" />,
  map: (
    <>
      <path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z" />
      <path d="M9 4v14M15 6v14" />
    </>
  ),
  forecast: (
    <>
      <path d="M7 18a4 4 0 0 1-.6-7.96A5.5 5.5 0 0 1 17 8.5a4.75 4.75 0 0 1 0 9.5z" />
    </>
  ),
  drop: <path d="M12 3.5c3.4 4.3 5.8 7.6 5.8 10.6a5.8 5.8 0 0 1-11.6 0c0-3 2.4-6.3 5.8-10.6z" />,
};

export default function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className ? `icon ${className}` : "icon"}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
