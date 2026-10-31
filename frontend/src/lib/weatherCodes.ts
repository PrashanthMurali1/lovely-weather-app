export interface WeatherDescription {
  label: string;
  icon: string;
}

const TABLE: Record<number, WeatherDescription> = {
  1: { label: "Mainly clear", icon: "mostly-clear" },
  2: { label: "Partly cloudy", icon: "partly-cloudy" },
  3: { label: "Overcast", icon: "cloudy" },
  45: { label: "Fog", icon: "fog" },
  48: { label: "Rime fog", icon: "fog" },
  51: { label: "Light drizzle", icon: "drizzle" },
  53: { label: "Drizzle", icon: "drizzle" },
  55: { label: "Dense drizzle", icon: "drizzle" },
  56: { label: "Freezing drizzle", icon: "sleet" },
  57: { label: "Dense freezing drizzle", icon: "sleet" },
  61: { label: "Rain", icon: "rain" },
  63: { label: "Moderate rain", icon: "rain" },
  65: { label: "Heavy rain", icon: "heavy-rain" },
  66: { label: "Freezing rain", icon: "sleet" },
  67: { label: "Heavy freezing rain", icon: "sleet" },
  71: { label: "Light snow", icon: "snow" },
  73: { label: "Snow", icon: "snow" },
  75: { label: "Heavy snow", icon: "snow" },
  77: { label: "Snow grains", icon: "snow" },
  80: { label: "Light showers", icon: "showers" },
  81: { label: "Showers", icon: "showers" },
  82: { label: "Violent showers", icon: "heavy-rain" },
  85: { label: "Snow showers", icon: "snow" },
  86: { label: "Heavy snow showers", icon: "snow" },
  95: { label: "Thunderstorm", icon: "thunderstorm" },
  96: { label: "Thunderstorm with hail", icon: "thunderstorm" },
  99: { label: "Severe thunderstorm with hail", icon: "thunderstorm" },
};

export function describeWeather(code: number, isDay: boolean): WeatherDescription {
  if (code === 0) {
    return { label: "Clear sky", icon: isDay ? "clear-day" : "clear-night" };
  }
  return TABLE[code] ?? { label: "Unknown", icon: "unknown" };
}
