// GET /api/weather
// Server-side proxy for the weather source so the API key never reaches the browser.

const { fetchRainfallMm } = require("./_lib/weather");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
  try {
    res.status(200).json(await fetchRainfallMm());
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
