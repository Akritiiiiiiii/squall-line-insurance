// POST /api/simulate
// Demo-day button: pushes a rainfall reading 13mm above the policy threshold,
// then settles the policy so the payout fires on-chain.
// Disabled unless ENABLE_SIMULATE=true. Testnet only — anyone who can reach this
// URL can trigger it.

const { canWrite, getWriteContext, assertIsOracle, shortError, cooldown } = require("./_lib/chain");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (process.env.ENABLE_SIMULATE !== "true") {
    return res.status(403).json({ error: "Simulation is disabled. Set ENABLE_SIMULATE=true." });
  }
  if (!canWrite()) return res.status(503).json({ error: "Server wallet is not configured" });

  const wait = cooldown("simulate", 20000);
  if (wait) return res.status(429).json({ error: `Try again in ${wait}s` });

  try {
    const { wallet, insurance } = getWriteContext();
    await assertIsOracle(insurance, wallet);

    const next = await insurance.nextPolicyId();
    if (next === 0n) return res.status(409).json({ error: "No policy exists yet. Use Reset station." });

    const id = next - 1n;
    const policy = await insurance.getPolicy(id);
    if (Number(policy.status) !== 0) {
      return res.status(409).json({ error: "Policy is not active. Use Reset station first." });
    }

    const reading = Number(policy.thresholdMm100) + 1300;
    const updateTx = await insurance.updateWeather(reading);
    await updateTx.wait();

    const settleTx = await insurance.checkAndSettle(id);
    await settleTx.wait();

    res.status(200).json({
      ok: true,
      rainfallMm: reading / 100,
      updateTx: updateTx.hash,
      settleTx: settleTx.hash,
    });
  } catch (e) {
    res.status(500).json({ error: shortError(e) });
  }
};
