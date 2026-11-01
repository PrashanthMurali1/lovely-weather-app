import { useEffect, useMemo, useRef, useState } from "react";
import type { Cyclone, Place } from "../api/types";
import Icon from "../components/Icon";
import { useCyclones } from "../hooks/useCyclones";
import { useRadar } from "../hooks/useRadar";
import type { Theme } from "../hooks/useTheme";
import { CLASS_COLOR, CLASS_LABEL, classColor, currentIndex } from "./cycloneLayer";
import { cyclonesUsable, offlineCyclonesLabel, offlineRadarLabel, usableFrames } from "./frames";
import MapCanvas, { type MapHandle } from "./MapCanvas";
import { BANDS, RAMP, bandRateText } from "./radarScale";
import { formatAge, formatEpochClock, formatTrackTime } from "./time";

interface Props {
  theme: Theme;
  place: Place | null;
  online: boolean;
}

const STEP_MS = 650;
const HOLD_MS = 1400;

function cycloneStage(c: Cyclone): string {
  const cls = c.track[currentIndex(c)]?.cls ?? null;
  return cls ? CLASS_LABEL[cls] ?? cls : "Tropical cyclone";
}

export default function MapView({ theme, place, online }: Props) {
  const mapRef = useRef<MapHandle>(null);
  const radar = useRadar();
  const cyclones = useCyclones();
  const [showRadar, setShowRadar] = useState(true);
  const [showCyclones, setShowCyclones] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [frameIndex, setFrameIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState<boolean[]>([]);
  const [prefetchAll, setPrefetchAll] = useState(false);

  // Radar older than 3 hours is never shown, however it got here (network or offline cache).
  const frames = useMemo(() => usableFrames(radar.data?.frames ?? [], Date.now()), [radar.data]);
  const radarForMap = useMemo(() => (radar.data ? { ...radar.data, frames } : null), [radar.data, frames]);
  const radarFailed = radar.isError && !radar.data;
  const radarOutOfDate = !!radar.data && frames.length === 0;
  const latest = Math.max(0, frames.length - 1);
  const index = Math.min(frameIndex ?? latest, latest);
  const cyclonesFresh = cyclones.data ? cyclonesUsable(cyclones.data.fetchedAt, Date.now()) : true;
  const storms = cyclones.data && cyclonesFresh ? cyclones.data.cyclones : [];
  const readyCount = ready.filter(Boolean).length;

  // New frames arrive every few minutes: follow the latest unless the viewer moved the slider.
  useEffect(() => {
    if (frameIndex !== null && frameIndex >= frames.length) setFrameIndex(null);
  }, [frames.length, frameIndex]);

  // Playback steps through loaded frames and rests on the newest.
  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const next = (from: number) => {
      for (let step = 1; step <= frames.length; step++) {
        const i = (from + step) % frames.length;
        if (ready[i]) return i;
      }
      return from;
    };
    const t = setTimeout(() => setFrameIndex(next(index)), index === latest ? HOLD_MS : STEP_MS);
    return () => clearTimeout(t);
  }, [playing, index, latest, frames.length, ready]);

  const frameTime = frames[index]?.time;
  const radarStatus = useMemo(() => {
    if (!showRadar) return "Radar hidden";
    if (radarFailed || radarOutOfDate) return "Radar unavailable";
    if (!frames.length) return "Loading radar…";
    if (!online) return offlineRadarLabel(frames[index].time, Date.now());
    // Older frames load only once the viewer plays or scrubs, so only then is anything "loading".
    const loading = prefetchAll && readyCount < frames.length ? ` · loading frames ${readyCount}/${frames.length}` : "";
    return `${formatEpochClock(frames[index].time)} IST · ${formatAge(frames[index].time)}${loading}`;
  }, [showRadar, radarFailed, radarOutOfDate, online, frames, index, readyCount, prefetchAll]);

  const mapLabel =
    "Interactive map of India and the surrounding seas. Drag to pan, scroll or pinch to zoom, arrow keys to move, plus and minus to zoom, 0 to reset.";

  return (
    <section className="map-view" aria-labelledby="map-title">
      <div className="surface map-panel">
        <div className="map-head">
          <div>
            <h2 id="map-title">Radar &amp; storms</h2>
            <p className="map-sub" aria-live="polite">
              {radarStatus}
            </p>
          </div>
          <div className="map-toggles" role="group" aria-label="Map layers">
            <button type="button" className="chip" aria-pressed={showRadar} onClick={() => setShowRadar((v) => !v)}>
              Radar
            </button>
            <button type="button" className="chip" aria-pressed={showCyclones} onClick={() => setShowCyclones((v) => !v)}>
              Cyclones
            </button>
          </div>
        </div>

        <div className="map-stage">
          <MapCanvas
            ref={mapRef}
            theme={theme}
            place={place}
            radar={radarForMap}
            frameIndex={index}
            showRadar={showRadar}
            prefetchAll={prefetchAll}
            cyclones={storms}
            showCyclones={showCyclones}
            selectedCycloneId={selectedId}
            onSelectCyclone={setSelectedId}
            onFramesReady={setReady}
            label={mapLabel}
          />

          <div className="map-controls" role="group" aria-label="Map controls">
            <button type="button" className="map-btn" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
              <Icon name="plus" />
            </button>
            <button type="button" className="map-btn" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
              <Icon name="minus" />
            </button>
            <button type="button" className="map-btn" aria-label="Show all of India" onClick={() => mapRef.current?.fitRegion()}>
              <Icon name="expand" />
            </button>
            {place ? (
              <button type="button" className="map-btn" aria-label={`Zoom to ${place.name}`} onClick={() => mapRef.current?.flyToPlace()}>
                <Icon name="locate" />
              </button>
            ) : null}
          </div>

          {showRadar ? (
            <div className="map-legend" role="group" aria-label="Radar intensity legend">
              <div
                className="legend-bar"
                aria-hidden="true"
                style={{
                  background: `linear-gradient(90deg, ${RAMP.map(
                    (s) => `rgba(${s.rgba[0]},${s.rgba[1]},${s.rgba[2]},${s.rgba[3]}) ${((s.dbz - 10) / 55) * 100}%`,
                  ).join(", ")})`,
                }}
              />
              <ul className="legend-bands">
                {BANDS.map((b) => (
                  <li key={b.label}>
                    <span>{b.label}</span>
                    <span className="legend-rate">{bandRateText(b)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {radarFailed || radarOutOfDate ? (
            <div className="map-note" role="alert">
              <p>{!online ? "Radar needs a connection." : radarOutOfDate ? "Radar is out of date." : "Couldn't load radar."}</p>
              {online ? (
                <button type="button" className="btn btn-quiet" onClick={() => void radar.refetch()}>
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="map-timeline">
          <button
            type="button"
            className="map-btn"
            aria-label={playing ? "Pause radar loop" : "Play radar loop"}
            disabled={frames.length < 2 || !showRadar}
            onClick={() => {
              setPrefetchAll(true);
              setPlaying((p) => !p);
            }}
          >
            <Icon name={playing ? "pause" : "play"} />
          </button>
          <div className="timeline-track">
            <input
              type="range"
              min={0}
              max={latest}
              step={1}
              value={index}
              disabled={frames.length < 2 || !showRadar}
              aria-label="Radar time"
              aria-valuetext={frameTime ? `${formatEpochClock(frameTime)} IST` : undefined}
              onChange={(e) => {
                setPrefetchAll(true);
                setPlaying(false);
                setFrameIndex(Number(e.target.value));
              }}
            />
            <div className="timeline-ends" aria-hidden="true">
              <span>{frames.length ? formatEpochClock(frames[0].time) : ""}</span>
              <span>{frames.length ? "Latest" : ""}</span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-quiet timeline-now"
            disabled={index === latest || frames.length < 2}
            onClick={() => {
              setPlaying(false);
              setFrameIndex(null);
            }}
          >
            Latest
          </button>
        </div>
      </div>

      <div className="surface map-storms">
        <div className="section-head">
          <h2>Active cyclones</h2>
          <p>{!online && cyclones.data && cyclonesFresh ? offlineCyclonesLabel(cyclones.data.fetchedAt, Date.now()) : "North Indian Ocean · now"}</p>
        </div>
        {cyclones.isError && !cyclones.data ? (
          <p className="map-empty" role="alert">
            Couldn’t load cyclone data.{" "}
            <button type="button" className="link-btn" onClick={() => void cyclones.refetch()}>
              Retry
            </button>
          </p>
        ) : !cyclones.data ? (
          <p className="map-empty" role="status">
            Loading cyclones…
          </p>
        ) : !cyclonesFresh ? (
          <p className="map-empty" role="status">
            {online ? "Cyclone data is out of date. " : "Cyclone data needs a connection."}
            {online ? (
              <button type="button" className="link-btn" onClick={() => void cyclones.refetch()}>
                Retry
              </button>
            ) : null}
          </p>
        ) : storms.length === 0 ? (
          <p className="map-empty">No active cyclones over the Arabian Sea or the Bay of Bengal.</p>
        ) : (
          <ul className="storm-list">
            {storms.map((c) => {
              const open = c.id === selectedId;
              const forecast = c.track.slice(currentIndex(c) + 1).filter((t) => t.time);
              return (
                <li key={c.id} className={`storm${open ? " is-open" : ""}`}>
                  <button
                    type="button"
                    className="storm-head"
                    aria-expanded={open}
                    onClick={() => {
                      setSelectedId(open ? null : c.id);
                      if (!open) mapRef.current?.flyToCyclone(c);
                    }}
                  >
                    <span className="storm-dot" style={{ background: classColor(c.track[currentIndex(c)]?.cls ?? null) }} aria-hidden="true" />
                    <span className="storm-name">{c.name}</span>
                    <span className="storm-meta">
                      {cycloneStage(c)}
                      {c.windKph !== null ? ` · max winds ${Math.round(c.windKph)} km/h` : ""}
                    </span>
                    <span className={`alert-chip alert-${c.alert.toLowerCase()}`}>{c.alert} alert</span>
                  </button>
                  {open ? (
                    <div className="storm-body">
                      {forecast.length ? (
                        <>
                          <h3>Forecast track</h3>
                          <ol className="storm-points">
                            {forecast.slice(0, 6).map((t) => (
                              <li key={t.time}>
                                <span className="storm-dot" style={{ background: classColor(t.cls) }} aria-hidden="true" />
                                <span>{formatTrackTime(t.time!)} IST</span>
                                <span className="storm-meta">{t.cls ? CLASS_LABEL[t.cls] ?? t.cls : ""}</span>
                              </li>
                            ))}
                          </ol>
                        </>
                      ) : (
                        <p className="map-empty">No forecast track is published for this storm.</p>
                      )}
                      <p className="storm-note">
                        Categories and winds follow GDACS. For official advisories see{" "}
                        <a href="https://mausam.imd.gov.in/" target="_blank" rel="noreferrer">
                          IMD
                        </a>
                        {c.reportUrl ? (
                          <>
                            {" "}
                            or the{" "}
                            <a href={c.reportUrl} target="_blank" rel="noreferrer">
                              GDACS report
                            </a>
                          </>
                        ) : null}
                        .
                      </p>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <ul className="storm-key" aria-label="Track colours">
          {Object.entries(CLASS_COLOR).map(([cls, color]) => (
            <li key={cls}>
              <span className="storm-dot" style={{ background: color }} aria-hidden="true" />
              {CLASS_LABEL[cls]}
            </li>
          ))}
          <li>
            <span className="storm-dash" aria-hidden="true" />
            Forecast
          </li>
        </ul>
      </div>

      <p className="map-attribution">
        {radar.data?.attribution ?? "Radar by RainViewer"} · {cyclones.data?.attribution ?? "Cyclone data by GDACS"} · Map data © Natural Earth
      </p>
    </section>
  );
}
