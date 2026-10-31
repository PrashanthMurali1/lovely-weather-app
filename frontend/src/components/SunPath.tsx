import type { DailyPoint } from "../api/types";
import { forecastTime, solarProgress } from "../lib/weatherScene";

export default function SunPath({ time, today }: { time: string; today?: DailyPoint }) {
  if (!today || !Number.isFinite(forecastTime(today.sunrise)) || !Number.isFinite(forecastTime(today.sunset))) return null;
  const progress = solarProgress(time, today);
  return <svg className="sun-path" viewBox="0 0 350 70" aria-hidden="true" focusable="false">
    <path className="sun-horizon" d="M10 59H340" />
    <path className="sun-track" d="M20 57Q175-48 330 57" />
    {progress !== null ? <circle className="sun-position" cx={20 + 310 * progress} cy={57 - 210 * progress * (1 - progress)} r="6" /> : null}
  </svg>;
}
