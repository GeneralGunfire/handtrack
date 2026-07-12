import type { TreeNode } from './types';

/**
 * Manual sample codebase for v1 — a plausible web-app repo. Later this gets
 * replaced by a real folder scan; everything downstream only sees TreeNode.
 */
export const SAMPLE_TREE: TreeNode = {
  id: 'root',
  name: 'nova-app',
  kind: 'folder',
  children: [
    {
      id: 'src',
      name: 'src',
      kind: 'folder',
      children: [
        {
          id: 'src/components',
          name: 'components',
          kind: 'folder',
          children: [
            {
              id: 'src/components/App.tsx',
              name: 'App.tsx',
              kind: 'file',
              language: 'tsx',
              size: 2140,
              preview: `import { Router } from './Router';
import { ThemeProvider } from './ThemeProvider';
import { useSession } from '../hooks/useSession';

export function App() {
  const session = useSession();

  if (session.loading) {
    return <SplashScreen />;
  }

  return (
    <ThemeProvider theme={session.user?.theme ?? 'dark'}>
      <Router authenticated={Boolean(session.user)} />
    </ThemeProvider>
  );
}`,
            },
            {
              id: 'src/components/Dashboard.tsx',
              name: 'Dashboard.tsx',
              kind: 'file',
              language: 'tsx',
              size: 5820,
              preview: `import { MetricCard } from './MetricCard';
import { ActivityFeed } from './ActivityFeed';
import { useMetrics } from '../hooks/useMetrics';

export function Dashboard() {
  const { metrics, isLive } = useMetrics({ refreshMs: 5000 });

  return (
    <main className="dashboard-grid">
      <header>
        <h1>Operations</h1>
        <LiveBadge active={isLive} />
      </header>
      {metrics.map((m) => (
        <MetricCard key={m.id} metric={m} sparkline />
      ))}
      <ActivityFeed limit={20} />
    </main>
  );
}`,
            },
            {
              id: 'src/components/MetricCard.tsx',
              name: 'MetricCard.tsx',
              kind: 'file',
              language: 'tsx',
              size: 1930,
              preview: `interface MetricCardProps {
  metric: Metric;
  sparkline?: boolean;
}

export function MetricCard({ metric, sparkline }: MetricCardProps) {
  const trend = metric.delta >= 0 ? 'up' : 'down';

  return (
    <article className={\`card trend-\${trend}\`}>
      <span className="label">{metric.label}</span>
      <strong>{formatValue(metric.value, metric.unit)}</strong>
      {sparkline && <Sparkline points={metric.history} />}
    </article>
  );
}`,
            },
            {
              id: 'src/components/ActivityFeed.tsx',
              name: 'ActivityFeed.tsx',
              kind: 'file',
              language: 'tsx',
              size: 2470,
              preview: `export function ActivityFeed({ limit = 50 }: { limit?: number }) {
  const events = useEventStream('/api/events', { limit });

  return (
    <ol className="feed">
      {events.map((event) => (
        <li key={event.id}>
          <time>{relativeTime(event.at)}</time>
          <p>{event.summary}</p>
        </li>
      ))}
    </ol>
  );
}`,
            },
          ],
        },
        {
          id: 'src/hooks',
          name: 'hooks',
          kind: 'folder',
          children: [
            {
              id: 'src/hooks/useSession.ts',
              name: 'useSession.ts',
              kind: 'file',
              language: 'ts',
              size: 1620,
              preview: `export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ loading: true });

  useEffect(() => {
    let cancelled = false;
    api.get('/session')
      .then((user) => !cancelled && setState({ loading: false, user }))
      .catch(() => !cancelled && setState({ loading: false }));
    return () => { cancelled = true; };
  }, []);

  return state;
}`,
            },
            {
              id: 'src/hooks/useMetrics.ts',
              name: 'useMetrics.ts',
              kind: 'file',
              language: 'ts',
              size: 2210,
              preview: `export function useMetrics({ refreshMs }: { refreshMs: number }) {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const poll = async () => {
      const data = await api.get('/metrics');
      setMetrics(data);
      setIsLive(true);
    };
    poll();
    const timer = setInterval(poll, refreshMs);
    return () => clearInterval(timer);
  }, [refreshMs]);

  return { metrics, isLive };
}`,
            },
            {
              id: 'src/hooks/useEventStream.ts',
              name: 'useEventStream.ts',
              kind: 'file',
              language: 'ts',
              size: 1880,
              preview: `export function useEventStream(url: string, opts: StreamOptions) {
  const [events, setEvents] = useState<AppEvent[]>([]);

  useEffect(() => {
    const source = new EventSource(url);
    source.onmessage = (msg) => {
      const event = JSON.parse(msg.data) as AppEvent;
      setEvents((prev) => [event, ...prev].slice(0, opts.limit));
    };
    return () => source.close();
  }, [url, opts.limit]);

  return events;
}`,
            },
          ],
        },
        {
          id: 'src/services',
          name: 'services',
          kind: 'folder',
          children: [
            {
              id: 'src/services/api.ts',
              name: 'api.ts',
              kind: 'file',
              language: 'ts',
              size: 2650,
              preview: `const BASE_URL = import.meta.env.VITE_API_URL;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(\`\${BASE_URL}\${path}\`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
};`,
            },
            {
              id: 'src/services/auth.ts',
              name: 'auth.ts',
              kind: 'file',
              language: 'ts',
              size: 1740,
              preview: `export async function login(email: string, password: string) {
  const { token, user } = await api.post('/auth/login', { email, password });
  tokenStore.set(token);
  return user;
}

export function logout() {
  tokenStore.clear();
  window.location.assign('/login');
}`,
            },
            {
              id: 'src/services/telemetry.ts',
              name: 'telemetry.ts',
              kind: 'file',
              language: 'ts',
              size: 1350,
              preview: `const queue: TelemetryEvent[] = [];

export function track(name: string, props?: Record<string, unknown>) {
  queue.push({ name, props, at: Date.now() });
  if (queue.length >= 10) flush();
}

async function flush() {
  const batch = queue.splice(0, queue.length);
  await api.post('/telemetry', { batch });
}`,
            },
          ],
        },
        {
          id: 'src/store',
          name: 'store',
          kind: 'folder',
          children: [
            {
              id: 'src/store/appStore.ts',
              name: 'appStore.ts',
              kind: 'file',
              language: 'ts',
              size: 2980,
              preview: `export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  notifications: [],

  toggleSidebar: () =>
    set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  pushNotification: (n) =>
    set((s) => ({ notifications: [n, ...s.notifications] })),

  dismissNotification: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),
}));`,
            },
          ],
        },
        {
          id: 'src/main.tsx',
          name: 'main.tsx',
          kind: 'file',
          language: 'tsx',
          size: 480,
          preview: `import { createRoot } from 'react-dom/client';
import { App } from './components/App';
import './index.css';

createRoot(document.getElementById('root')!).render(<App />);`,
        },
        {
          id: 'src/index.css',
          name: 'index.css',
          kind: 'file',
          language: 'css',
          size: 3120,
          preview: `:root {
  --bg: #0b0d12;
  --panel: #141821;
  --accent: #4cc9f0;
  --text: #e8ecf4;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: 'Inter', system-ui, sans-serif;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  padding: 24px;
}`,
        },
      ],
    },
    {
      id: 'server',
      name: 'server',
      kind: 'folder',
      children: [
        {
          id: 'server/index.ts',
          name: 'index.ts',
          kind: 'file',
          language: 'ts',
          size: 1560,
          preview: `import express from 'express';
import { metricsRouter } from './routes/metrics';
import { authRouter } from './routes/auth';

const app = express();
app.use(express.json());
app.use('/api/metrics', metricsRouter);
app.use('/api/auth', authRouter);

app.listen(process.env.PORT ?? 3001, () => {
  console.log('nova-app server ready');
});`,
        },
        {
          id: 'server/routes',
          name: 'routes',
          kind: 'folder',
          children: [
            {
              id: 'server/routes/metrics.ts',
              name: 'metrics.ts',
              kind: 'file',
              language: 'ts',
              size: 2040,
              preview: `export const metricsRouter = Router();

metricsRouter.get('/', async (req, res) => {
  const window = parseWindow(req.query.window);
  const metrics = await db.metric.findMany({
    where: { at: { gte: window.start } },
    orderBy: { at: 'desc' },
  });
  res.json(aggregate(metrics, window));
});`,
            },
            {
              id: 'server/routes/auth.ts',
              name: 'auth.ts',
              kind: 'file',
              language: 'ts',
              size: 1890,
              preview: `authRouter.post('/login', async (req, res) => {
  const { email, password } = credentialsSchema.parse(req.body);
  const user = await db.user.findUnique({ where: { email } });

  if (!user || !(await verify(password, user.passwordHash))) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  res.json({ token: signToken(user.id), user: publicUser(user) });
});`,
            },
          ],
        },
        {
          id: 'server/db.ts',
          name: 'db.ts',
          kind: 'file',
          language: 'ts',
          size: 720,
          preview: `import { PrismaClient } from '@prisma/client';

export const db = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query'] : [],
});`,
        },
      ],
    },
    {
      id: 'tests',
      name: 'tests',
      kind: 'folder',
      children: [
        {
          id: 'tests/dashboard.test.tsx',
          name: 'dashboard.test.tsx',
          kind: 'file',
          language: 'tsx',
          size: 1670,
          preview: `describe('Dashboard', () => {
  it('renders a card per metric', async () => {
    server.use(mockMetrics(threeMetrics));
    render(<Dashboard />);

    const cards = await screen.findAllByRole('article');
    expect(cards).toHaveLength(3);
  });

  it('shows the live badge once data arrives', async () => {
    render(<Dashboard />);
    expect(await screen.findByText('LIVE')).toBeVisible();
  });
});`,
        },
        {
          id: 'tests/api.test.ts',
          name: 'api.test.ts',
          kind: 'file',
          language: 'ts',
          size: 1210,
          preview: `describe('api client', () => {
  it('throws ApiError on non-2xx responses', async () => {
    server.use(rest.get('*/session', (_, res, ctx) => res(ctx.status(500))));

    await expect(api.get('/session')).rejects.toThrow(ApiError);
  });
});`,
        },
      ],
    },
    {
      id: 'package.json',
      name: 'package.json',
      kind: 'file',
      language: 'json',
      size: 940,
      preview: `{
  "name": "nova-app",
  "version": "1.4.2",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest",
    "server": "tsx server/index.ts"
  },
  "dependencies": {
    "react": "^19.0.0",
    "express": "^5.0.0",
    "zustand": "^5.0.0"
  }
}`,
    },
    {
      id: 'README.md',
      name: 'README.md',
      kind: 'file',
      language: 'md',
      size: 1380,
      preview: `# nova-app

Operations dashboard with live metrics and an event feed.

## Stack
- React 19 + Vite
- Express API with Prisma
- Zustand state, SSE event stream

## Getting started
\`\`\`bash
npm install
npm run dev      # web
npm run server   # api
\`\`\``,
    },
  ],
};
