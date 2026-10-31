import { describeWeather } from "../lib/weatherCodes";

function Sun() {
  return <g className="weather-warm"><circle cx="16" cy="15" r="5" /><path d="M16 3v3m0 18v3M4 15h3m18 0h3M7.5 6.5l2 2m13 13 2 2M7.5 23.5l2-2m13-13 2-2" /></g>;
}

export default function WeatherIcon({ code, isDay = true }: { code: number; isDay?: boolean }) {
  const { icon } = describeWeather(code, isDay);
  const clear = ["clear-day", "clear-night", "mostly-clear"].includes(icon);
  const rain = ["rain", "heavy-rain", "drizzle", "showers", "sleet", "thunderstorm"].includes(icon);
  return (
    <svg className="weather-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {icon === "unknown" ? <><circle cx="16" cy="16" r="10" /><path d="M13 12a3 3 0 0 1 6 0c0 3-3 2-3 5m0 4h.01" /></> : <>
        {clear || icon === "partly-cloudy" ? isDay ? <g transform={clear ? undefined : "translate(7 -3) scale(.85)"}><Sun /></g> : <path className="weather-moon" d="M24 22A11 11 0 0 1 12 4a12 12 0 1 0 12 18Z" /> : null}
        {!clear ? <path className="weather-cloud" d="M8 23a5 5 0 0 1-1-10 7 7 0 0 1 13-2 6 6 0 0 1 3 12Z" /> : null}
        {rain && icon !== "thunderstorm" ? <path className="weather-rain" d="m10 26-1 3m8-3-1 3m8-3-1 3" /> : null}
        {icon === "thunderstorm" ? <path className="weather-lightning" d="m17 21-4 6h4l-2 4" /> : null}
        {icon === "snow" ? <path d="M10 26v5m-2.2-3.8 4.4 2.6m0-2.6-4.4 2.6M23 26v5m-2.2-3.8 4.4 2.6m0-2.6-4.4 2.6" /> : null}
        {icon === "fog" ? <path d="M4 25h22M8 29h16" /> : null}
      </>}
    </svg>
  );
}
