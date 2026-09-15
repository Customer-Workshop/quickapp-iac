import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'yaml';

export type ChartInfo = {
  name: string;
  isMfe: boolean;
  isGateway: boolean;
  healthPath: string;
  healthPort: number;
  ingressHost: string;
  ingressEnabled: boolean;
  baseUrl: string;
};

const VALID_ENVS = ['dev', 'staging', 'prod'] as const;
const REPO_ROOT = path.resolve(__dirname, '../..');

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeValues(base: unknown, override: unknown): unknown {
  if (isPlainObject(base) && isPlainObject(override)) {
    const out: PlainObject = { ...base };
    for (const [key, value] of Object.entries(override)) {
      out[key] = key in out ? mergeValues(out[key], value) : value;
    }
    return out;
  }
  return override;
}

export function toEnvKey(name: string): string {
  return name.replace(/-/g, '_').toUpperCase();
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function resolveBaseUrl(name: string, healthPort: number, ingressHost: string): string {
  const perChart = process.env[`BASE_URL_${toEnvKey(name)}`];
  if (perChart) {
    return stripTrailingSlash(perChart);
  }
  const template =
    process.env.SMOKE_BASE_URL_TEMPLATE ??
    process.env.BASE_URL ??
    process.env.PLAYWRIGHT_BASE_URL;
  if (template) {
    return stripTrailingSlash(
      template.replaceAll('{port}', String(healthPort)).replaceAll('{name}', name),
    );
  }
  return `https://${ingressHost}`;
}

export function loadCharts(env = process.env.TARGET_ENV ?? 'dev'): ChartInfo[] {
  if (!(VALID_ENVS as readonly string[]).includes(env)) {
    throw new Error(
      `Invalid TARGET_ENV "${env}". Expected one of: ${VALID_ENVS.join(', ')}`,
    );
  }

  const chartsDir = path.join(REPO_ROOT, 'charts');
  const envValuesPath = path.join(REPO_ROOT, 'environments', env, 'values.yaml');
  const envValues: unknown = fs.existsSync(envValuesPath)
    ? parse(fs.readFileSync(envValuesPath, 'utf8'))
    : {};

  const dirs = fs
    .readdirSync(chartsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  return dirs.map((name) => {
    const chartValues: unknown = parse(
      fs.readFileSync(path.join(chartsDir, name, 'values.yaml'), 'utf8'),
    );
    const values = mergeValues(chartValues, envValues) as PlainObject;

    const healthCheck = (values.healthCheck ?? {}) as PlainObject;
    const ingress = (values.ingress ?? {}) as PlainObject;
    const hosts = (ingress.hosts ?? []) as PlainObject[];
    const ingressHost = String(hosts[0]?.host ?? '');
    const ingressEnabled = Boolean(ingress.enabled);
    const healthPath = String(healthCheck.path ?? '/healthz');
    const healthPort = Number(healthCheck.port ?? 80);

    return {
      name,
      isMfe: name.endsWith('-mfe'),
      isGateway: name === 'api-gateway',
      healthPath,
      healthPort,
      ingressHost,
      ingressEnabled,
      baseUrl: resolveBaseUrl(name, healthPort, ingressHost),
    };
  });
}

export function uniquePorts(charts: ChartInfo[]): number[] {
  return [...new Set(charts.map((c) => c.healthPort))].sort((a, b) => a - b);
}
