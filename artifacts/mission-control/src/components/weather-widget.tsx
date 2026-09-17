import { useEffect, useState } from "react";

const FALLBACK_COORDS = { latitude: 34.0522, longitude: -118.2437 };

type Weather = { temperatureF: number; label: string };

const WEATHER_CODES: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Showers",
  81: "Showers",
  82: "Heavy showers",
  95: "Thunderstorm",
  96: "Thunderstorm",
  99: "Thunderstorm",
};

async function fetchWeather({ latitude, longitude }: { latitude: number; longitude: number }): Promise<Weather> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("weather unavailable");
  const data = (await response.json()) as { current?: { temperature_2m?: number; weather_code?: number } };
  if (typeof data.current?.temperature_2m !== "number") throw new Error("weather unavailable");
  return {
    temperatureF: Math.round(data.current.temperature_2m),
    label: WEATHER_CODES[data.current.weather_code ?? -1] ?? "—",
  };
}

function useCoords() {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setCoords(FALLBACK_COORDS);
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        setCoords(FALLBACK_COORDS);
      }
    }, 4000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        setCoords(FALLBACK_COORDS);
      },
    );

    return () => clearTimeout(timer);
  }, []);

  return coords;
}

export function WeatherWidget() {
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<Weather | null>(null);
  const [failed, setFailed] = useState(false);
  const coords = useCoords();

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    const load = () =>
      fetchWeather(coords)
        .then((result) => {
          if (!cancelled) {
            setWeather(result);
            setFailed(false);
          }
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
    load();
    const timer = setInterval(load, 600000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [coords]);

  return (
    <div className="flex h-full flex-col justify-between border-4 border-border bg-card p-4 shadow-[6px_6px_0px_0px_hsl(var(--border))]">
      <div>
        <p className="font-mono text-[11px] font-black uppercase tracking-wider text-muted-foreground">
          {now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
        </p>
        <p className="mt-1 font-mono text-3xl font-black tabular-nums tracking-tighter">
          {now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
        </p>
      </div>
      <div className="mt-4 flex items-end justify-between">
        <span className="text-4xl font-black tabular-nums tracking-tighter text-primary">
          {weather ? `${weather.temperatureF}°` : failed ? "—" : "··"}
        </span>
        <span className="pb-1 font-mono text-xs font-bold uppercase text-muted-foreground">
          {weather ? weather.label : failed ? "offline" : "loading"}
        </span>
      </div>
    </div>
  );
}
