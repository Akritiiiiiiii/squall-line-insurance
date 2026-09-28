// GET /api/status
// Read-only snapshot for the front-end. Returns { mode: "demo" } when no
// contract is configured, so the page falls back to its built-in simulation.

const { ethers, STATUS_NAMES, TOKEN_DECIMALS, isConfigured, canWrite, getReadContract, shortError } = require("./_lib/chain");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "s-maxage=5, stale-while-revalidate=10");

  if (!isConfigured()) {
    return res.status(200).json({ mode: "demo" });
  }

  try {
    const c = getReadContract();
    const [rain, updatedAt, next] = await Promise.all([
      c.latestRainfallMm100(),
      c.latestUpdatedAt(),
      c.nextPolicyId(),
    ]);

    let policy = null;
    if (next > 0n) {
      const id = next - 1n;
      const p = await c.getPolicy(id);
      policy = {
        id: Number(id),
        holder: p.holder,
        payout: ethers.formatUnits(p.payoutAmount, TOKEN_DECIMALS),
        thresholdMm: Number(p.thresholdMm100) / 100,
        windowStart: Number(p.windowStart),
        windowEnd: Number(p.windowEnd),
        status: STATUS_NAMES[Number(p.status)] || "Unknown",
      };
    }

    res.status(200).json({
      mode: "live",
      network: process.env.CHAIN_NAME || "Sepolia",
      explorer: process.env.EXPLORER_URL || "https://sepolia.etherscan.io",
      contract: process.env.CONTRACT_ADDRESS,
      rainfallMm: Number(rain) / 100,
      updatedAt: Number(updatedAt),
      policy,
      simulateEnabled: process.env.ENABLE_SIMULATE === "true" && canWrite(),
    });
  } catch (e) {
    res.status(502).json({ mode: "error", error: shortError(e) });
  }
};
