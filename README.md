# Squall Line — Parametric Rainfall Cover

A smart contract that holds test funds in escrow and pays out automatically when
an oracle reports rainfall above a threshold, with a front-end and serverless
oracle bridge you can deploy to Vercel.

```
public/index.html      front-end (static)
api/status.js          GET  — reads contract + latest policy
api/weather.js         GET  — weather proxy (keeps the API key server-side)
api/oracle.js          GET  — cron: fetch weather, post on-chain, settle if triggered
api/simulate.js        POST — demo button: push a storm reading + settle (testnet)
api/reset.js           POST — re-arm the demo with a fresh policy (testnet)
contracts/ scripts/ test/ oracle/   Hardhat project + CLI oracle scripts (not deployed to Vercel)
```

## Two modes, zero config to start

- **Simulation mode (default).** With no environment variables set, the page runs a
  fully client-side simulation. This is the Step 6 demo-day fallback and works
  the moment you deploy.
- **Live mode.** Set the env vars below and the page reads the real contract on
  Sepolia, shows real transactions with explorer links, and the buttons drive
  on-chain transactions.

## Deploy to Vercel

### 1. Deploy the contract first (only for live mode)

```bash
npm install
cp .env.example .env     # set RPC_URL, PRIVATE_KEY, ORACLE_ADDRESS (or leave it as the deployer)
npx hardhat test
npm run deploy:sepolia   # prints CONTRACT_ADDRESS and TOKEN_ADDRESS
```

Fund the deployer wallet with Sepolia ETH from a faucet. The deploy script mints
1,000,000 mUSDC and writes one demo policy.

### 2. Push to Git and import into Vercel

1. Push this folder to a GitHub repo (`.env` is git-ignored).
2. In Vercel: **Add New → Project → import the repo**. Framework preset: **Other**.
   `vercel.json` already sets the output directory (`public`), skips the build step,
   and installs production dependencies only.

Or with the CLI:

```bash
npm i -g vercel
vercel          # preview
vercel --prod   # production
```

### 3. Environment variables (Project → Settings → Environment Variables)

| Variable | Needed for | Notes |
|---|---|---|
| `RPC_URL` | live mode | Sepolia RPC (Infura, Alchemy, etc.) |
| `CONTRACT_ADDRESS` | live mode | From the deploy script. Setting this switches the UI to live mode |
| `PRIVATE_KEY` | writes | **Testnet-only** wallet. Must be the contract's `oracle` |
| `CRON_SECRET` | `/api/oracle` | Any long random string. Vercel sends it as a Bearer token to cron routes |
| `ENABLE_SIMULATE` | buttons | `true` enables `/api/simulate` and `/api/reset` |
| `TOKEN_ADDRESS` | Reset station | Escrow token; the server wallet must hold it |
| `OPENWEATHER_API_KEY`, `LAT`, `LON` | real weather | Omit to use mock readings |
| `CHAIN_NAME`, `EXPLORER_URL`, `TOKEN_DECIMALS`, `HOLDER_ADDRESS` | optional | Defaults: Sepolia, Etherscan, 6, server wallet |

Redeploy after changing env vars.

### 4. Verify

- Open your Vercel URL: the meta row should say **Mode: live on Sepolia**.
- `GET /api/status` returns the contract snapshot.
- Click **Simulate weather event**: expect two transactions (update + settle), roughly 15–40 seconds on Sepolia. The stamp flips to *Triggered*.
- Click **Reset station** to write a fresh policy for the next visitor.

## Things to know before the expo

- **Cron on the Hobby plan runs once per day at most**; `vercel.json` schedules `/api/oracle` daily at 12:00 UTC. For faster feeds, upgrade the plan, or run `npm run oracle:watch` from a laptop.
- **The weather source reports the last hour of rain**, not a true 24h total (the free OpenWeatherMap endpoint). The contract compares whatever the oracle posts, so treat the trigger as "latest reading above 50mm". A rolling 24h sum needs One Call 3.0 or your own accumulator.
- **`/api/simulate` and `/api/reset` are unauthenticated by design** so visitors can press the button. They spend testnet gas and testnet tokens from the server wallet, with only a per-instance 20s cooldown. Keep `ENABLE_SIMULATE` off outside demos, and never put a wallet with real value in `PRIVATE_KEY`.
- **Single-oracle trust and open `writePolicy`** remain (see contract comments). Demo-grade, not audited.
- The `vercel-deploy/` folder is an older static-only bundle. It is excluded via `.vercelignore` and superseded by this root project.

## Local development

```bash
npm install
npx vercel dev      # serves public/ and the api/ routes at http://localhost:3000
```

Without a `.env`, you get simulation mode.
