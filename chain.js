// api/_lib/chain.js
// Shared helpers for the serverless functions. Files/folders prefixed with "_"
// are not exposed as routes by Vercel.

const { ethers } = require("ethers");

const INSURANCE_ABI = [
  "function oracle() view returns (address)",
  "function updateWeather(uint256 rainfallMm100)",
  "function checkAndSettle(uint256 policyId)",
  "function writePolicy(address holder, uint256 payoutAmount, uint256 thresholdMm100, uint64 windowStart, uint64 windowEnd) returns (uint256)",
  "function latestRainfallMm100() view returns (uint256)",
  "function latestUpdatedAt() view returns (uint256)",
  "function nextPolicyId() view returns (uint256)",
  "function getPolicy(uint256 policyId) view returns (tuple(address holder, uint256 payoutAmount, uint256 thresholdMm100, uint64 windowStart, uint64 windowEnd, uint8 status))",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
];

const STATUS_NAMES = ["Active", "Triggered", "Expired", "Cancelled"];

const TOKEN_DECIMALS = Number(process.env.TOKEN_DECIMALS || 6);

function isConfigured() {
  return Boolean(process.env.RPC_URL && process.env.CONTRACT_ADDRESS);
}

function canWrite() {
  return isConfigured() && Boolean(process.env.PRIVATE_KEY);
}

function getProvider() {
  return new ethers.JsonRpcProvider(process.env.RPC_URL);
}

function getReadContract() {
  return new ethers.Contract(process.env.CONTRACT_ADDRESS, INSURANCE_ABI, getProvider());
}

function getWriteContext() {
  const provider = getProvider();
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const insurance = new ethers.Contract(process.env.CONTRACT_ADDRESS, INSURANCE_ABI, wallet);
  return { provider, wallet, insurance };
}

function getToken(wallet) {
  if (!process.env.TOKEN_ADDRESS) throw new Error("TOKEN_ADDRESS is not set");
  return new ethers.Contract(process.env.TOKEN_ADDRESS, ERC20_ABI, wallet);
}

async function assertIsOracle(insurance, wallet) {
  const oracle = await insurance.oracle();
  if (oracle.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(
      `PRIVATE_KEY wallet (${wallet.address}) is not the contract's oracle (${oracle}). ` +
        "Deploy with ORACLE_ADDRESS set to this wallet, or call setOracle()."
    );
  }
}

function shortError(e) {
  return e?.shortMessage || e?.reason || e?.message || "Unknown error";
}

// Best-effort, per-instance cooldown. Serverless instances don't share memory,
// so this is a speed bump, not real rate limiting.
const lastCall = new Map();
function cooldown(key, ms) {
  const now = Date.now();
  const prev = lastCall.get(key) || 0;
  if (now - prev < ms) return Math.ceil((ms - (now - prev)) / 1000);
  lastCall.set(key, now);
  return 0;
}

module.exports = {
  ethers,
  STATUS_NAMES,
  TOKEN_DECIMALS,
  isConfigured,
  canWrite,
  getReadContract,
  getWriteContext,
  getToken,
  assertIsOracle,
  shortError,
  cooldown,
};
