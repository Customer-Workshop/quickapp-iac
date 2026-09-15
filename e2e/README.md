# End-to-end smoke tests

Post-deployment smoke tests for the quickapp Helm charts, built with
[Playwright](https://playwright.dev/). Charts are discovered automatically from
`../charts/*/values.yaml`, merged with the `environments/<env>/values.yaml`
overlay for the target environment.

## What is tested

For every chart:

- `GET <healthCheck.path>` returns 200.
- Plain `http://` requests redirect to `https://` (skipped automatically when the
  base URL is plain http, e.g. local stub runs).

For MFE charts (`*-mfe`):

- The root page renders without console or page errors.
- `remoteEntry.js` is served with a JavaScript content type (non-shell MFEs),
  or index HTML is served as `text/html` (`shell-mfe`).

For `api-gateway`:

- `/api/products` and `/api/customers` return 200 or 401.

## Running locally against the stub server

The default `stub` project starts a local `node:http` server (see
`stub/server.ts`) that listens on every chart's `healthCheck.port` and serves
health, index, `remoteEntry.js`, and `/api/*` responses.

```bash
cd e2e
npm ci
npx playwright install --with-deps chromium
npm run test:e2e
```

## Running against a real environment

```bash
cd e2e
TARGET_ENV=staging npm run test:e2e:deployed
```

By default each chart is reached at `https://<ingress.hosts[0].host>`. Override
per-chart or globally:

```bash
BASE_URL_API_GATEWAY=https://gw.example.com TARGET_ENV=prod npm run test:e2e:deployed
SMOKE_BASE_URL_TEMPLATE='https://{name}.staging.example.com' npm run test:e2e:deployed
```

## Environment variables

| Variable | Description |
| --- | --- |
| `TARGET_ENV` | Values overlay to use: `dev` (default), `staging`, or `prod`. |
| `BASE_URL_<CHART>` | Per-chart base URL, e.g. `BASE_URL_API_GATEWAY`. Highest precedence. |
| `SMOKE_BASE_URL_TEMPLATE` | URL template applied to every chart; `{port}` → `healthCheck.port`, `{name}` → chart directory name. |
| `BASE_URL` / `PLAYWRIGHT_BASE_URL` | Aliases for `SMOKE_BASE_URL_TEMPLATE` when the template itself is unset. |
| `CI` | When set, tests retry once and the stub web server is not reused. |

Base URL precedence: `BASE_URL_<CHART>` → `SMOKE_BASE_URL_TEMPLATE` (or its
aliases) → `https://<ingressHost>`.

## CI

`.github/workflows/playwright.yml` runs `helm lint` plus `helm template` for
every chart against all three environments, then installs Playwright, runs
`npm run typecheck`, and executes the stub-project smoke suite. The HTML report
is uploaded as the `playwright-report` artifact (retained 14 days).
