// GET /api/oracle  — invoked by Vercel Cron (see vercel.json)
// Fetches the weather reading, posts it on-chain via updateWeather(), and settles
// the current policy if the trigger condition is now met.
//
// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. CRON_SECRET is required.

const { canWrite, getWriteContext, assertIsOracle, shortError } = require("./_lib/chain");
const { fetchRainfallMm } = require("./_lib/weather");

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(500).json({ error: "CRON_SECRET is not set" });
  if (req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!canWrite()) {
    return res.status(503).json({ error: "RPC_URL, CONTRACT_ADDRESS and PRIVATE_KEY must be set" });
  }

  try {
    const { wallet, insurance } = getWriteContext();
    await assertIsOracle(insurance, wallet);

    const { rainfallMm, source } = await fetchRainfallMm();
    const tx = await insurance.updateWeather(Math.round(rainfallMm * 100));
    await tx.wait();

    const out = { ok: true, rainfallMm, source, updateTx: tx.hash, settleTx: null };

    const next = await insurance.nextPolicyId();
    if (next > 0n) {
      const id = next - 1n;
      try {
        await insurance.checkAndSettle.staticCall(id); // reverts if not settle-able
        const settle = await insurance.checkAndSettle(id);
        await settle.wait();
        out.settleTx = settle.hash;
      } catch (_) {
        // condition not met (or already settled) — nothing to do
      }
    }

    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: shortError(e) });
  }
};
