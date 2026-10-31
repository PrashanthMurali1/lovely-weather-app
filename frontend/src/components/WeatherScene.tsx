import type { Current, DailyPoint } from "../api/types";
import { resolveWeatherScene } from "../lib/weatherScene";

export default function WeatherScene({ current, today }: { current?: Current; today?: DailyPoint }) {
  const scene = current ? resolveWeatherScene(current, today) : "night";
  const celestial = ["day", "night", "dawn", "dusk"].includes(scene);
  return (
    <div className="weather-scene" data-scene={scene} data-night={current ? !current.isDay : true} aria-hidden="true">
      <div className="scene-light" />
      {scene === "night" ? <div className="scene-stars" /> : null}
      {celestial ? <div className={`scene-orb ${scene === "night" ? "scene-moon" : ""}`} /> : null}
      <div className="scene-cloud scene-cloud-back" /><div className="scene-cloud scene-cloud-front" />
      {scene === "rain" || scene === "storm" ? <div className="scene-rain" /> : null}
      {scene === "snow" ? <div className="scene-snow" /> : null}
    </div>
  );
}
