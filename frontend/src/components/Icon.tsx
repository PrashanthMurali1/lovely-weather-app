import type { ReactElement } from "react";

export type IconName = "search" | "locate" | "close" | "offline" | "clock" | "alert" | "drop";

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
