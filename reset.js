// POST /api/reset
// Re-arms the demo: posts a low reading and, if the latest policy has already
// been settled, writes a fresh 7-day policy (500 tokens, 50mm trigger).
// Needs TOKEN_ADDRESS and a server wallet holding enough of the escrow token.
// Disabled unless ENABLE_SIMULATE=true.

const { ethers, TOKEN_DECIMALS, canWrite, getWriteContext, getToken, assertIsOracle, shortError, cooldown } = require("./_lib/chain");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (process.env.ENABLE_SIMULATE !== "true") {
    return res.status(403).json({ error: "Simulation is disabled. Set ENABLE_SIMULATE=true." });
  }
  if (!canWrite()) return res.status(503).json({ error: "Server wallet is not configured" });

  const wait = cooldown("reset", 20000);
  if (wait) return res.status(429).json({ error: `Try again in ${wait}s` });

  try {
    const { wallet, insurance } = getWriteContext();
    await assertIsOracle(insurance, wallet);

    const out = { ok: true, policyTx: null };

    // 1. Low reading first, so a stale high reading can never satisfy the new policy.
    const lowTx = await insurance.updateWeather(1000 + Math.floor(Math.random() * 500));
    await lowTx.wait();
    out.updateTx = lowTx.hash;

    // 2. Write a fresh policy only if there's no active one.
    const next = await insurance.nextPolicyId();
    let needsPolicy = next === 0n;
    if (!needsPolicy) {
      const last = await insurance.getPolicy(next - 1n);
      needsPolicy = Number(last.status) !== 0;
    }

    if (needsPolicy) {
      const payout = ethers.parseUnits("500", TOKEN_DECIMALS);
      const token = getToken(wallet);
      const approveTx = await token.approve(process.env.CONTRACT_ADDRESS, payout);
      await approveTx.wait();

      const now = Math.floor(Date.now() / 1000);
      const holder = process.env.HOLDER_ADDRESS || wallet.address;
      const policyTx = await insurance.writePolicy(holder, payout, 5000, now - 30, now + 7 * 86400);
      await policyTx.wait();
      out.policyTx = policyTx.hash;
    }

    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: shortError(e) });
  }
};
