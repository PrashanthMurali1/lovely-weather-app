import { useCallback, useEffect, useState } from "react";
import type { Place } from "./api/types";
import DailyList from "./components/DailyList";
import Footer from "./components/Footer";
import Hero from "./components/Hero";
import HourlyStrip from "./components/HourlyStrip";
import SearchSheet from "./components/SearchSheet";
import Stats from "./components/Stats";
import StatusBanner from "./components/StatusBanner";
import { useForecast } from "./hooks/useForecast";
import { useSavedPlaces } from "./hooks/useSavedPlaces";
import { DEFAULT_PLACE } from "./lib/defaults";

const FALLBACK_ATTRIBUTION = "Weather data by Open-Meteo.com";
const round2 = (n: number) => Math.round(n * 100) / 100;

function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export default function App() {
  const { recent } = useSavedPlaces();
  const [place, setPlace] = useState<Place>(() => recent[0] ?? DEFAULT_PLACE);
  const [searchOpen, setSearchOpen] = useState(false);
  const online = useOnline();
  const forecast = useForecast(place);

  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const selectPlace = useCallback((p: Place) => {
    setPlace(p);
    setSearchOpen(false);
  }, []);

  const locateMe = () => {
    try {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setPlace({
            id: -1,
            name: "My location",
            admin: null,
            lat: round2(pos.coords.latitude),
            lon: round2(pos.coords.longitude),
          }),
        () => {},
      );
    } catch {
      // unsupported or blocked: keep the current place
    }
  };

  const data = forecast.data;
  const nowHour = data ? data.current.time.slice(0, 13) : "";
  const upcoming = data ? data.hourly.filter((h) => h.time.slice(0, 13) >= nowHour).slice(0, 24) : [];

  return (
    <>
      <header className="app-header">
        <h1>India Weather</h1>
        <div className="app-actions">
          <button type="button" onClick={() => setSearchOpen(true)}>
            Search places
          </button>
          <button type="button" onClick={locateMe}>
            Use my location
          </button>
        </div>
      </header>
      <main>
        <StatusBanner
          offline={!online}
          stale={data?.stale ?? false}
          fetchedAt={data?.fetchedAt}
          error={forecast.isError ? forecast.error : null}
          onRetry={() => void forecast.refetch()}
        />
        {data ? (
          <>
            <Hero place={place} current={data.current} fetchedAt={data.fetchedAt} />
            <Stats current={data.current} today={data.daily[0]} />
            <HourlyStrip hourly={upcoming.length > 0 ? upcoming : data.hourly.slice(0, 24)} />
            <DailyList daily={data.daily.slice(0, 7)} />
          </>
        ) : forecast.isError ? null : (
          <p className="loading" role="status">
            Loading forecast…
          </p>
        )}
      </main>
      <Footer attribution={data?.attribution ?? FALLBACK_ATTRIBUTION} />
      <SearchSheet open={searchOpen} onClose={closeSearch} onSelect={selectPlace} />
    </>
  );
}
