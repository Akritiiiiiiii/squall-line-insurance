// api/_lib/weather.js
// Fetches a rainfall reading in mm. Uses OpenWeatherMap when OPENWEATHER_API_KEY
// is set; otherwise returns a small random "light drizzle" mock so the demo
// never breaks because of a missing key.

async function fetchRainfallMm() {
  const key = process.env.OPENWEATHER_API_KEY;
  const lat = process.env.LAT || "25.7617";
  const lon = process.env.LON || "-80.1918";

  if (!key) {
    return { rainfallMm: Math.round((2 + Math.random() * 10) * 100) / 100, source: "mock" };
  }

  const url =
    `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(lat)}` +
    `&lon=${encodeURIComponent(lon)}&appid=${encodeURIComponent(key)}&units=metric`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenWeatherMap responded ${res.status}`);
  const data = await res.json();

  // The free current-weather endpoint reports rain volume for the last hour.
  const rainfallMm = Number(data.rain?.["1h"] ?? 0);
  return { rainfallMm, source: "openweathermap", place: data.name || null };
}

module.exports = { fetchRainfallMm };
