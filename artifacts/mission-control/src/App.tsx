import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import { Layout } from './components/layout';
import { Home } from './pages/home';
import { Inbox } from './pages/inbox';
import { Dashboard } from './pages/dashboard';
import { Projects } from './pages/projects';
import { ProjectDetail } from './pages/project-detail';
import { Agents } from './pages/agents';
import { Skills } from './pages/skills';
import { Arena } from './pages/arena';
import { Approvals } from './pages/approvals';
import { IdeaLab } from './pages/idea-lab';

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/inbox" component={Inbox} />
          <Route path="/overview" component={Dashboard} />
          <Route path="/projects" component={Projects} />
          <Route path="/projects/:id" component={ProjectDetail} />
          <Route path="/agents" component={Agents} />
          <Route path="/skills" component={Skills} />
          <Route path="/approvals" component={Approvals} />
          <Route path="/idea-lab" component={IdeaLab} />
          <Route path="/arena" component={Arena} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Layout>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
