import React, { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import Shell from '@/components/layout/Shell';

const Recognition = lazy(() => import('@/pages/Recognition'));
const Database = lazy(() => import('@/pages/Database'));
const Learning = lazy(() => import('@/pages/Learning'));
const Stats = lazy(() => import('@/pages/Stats'));
const Projects = lazy(() => import('@/pages/Projects'));
const ApiKeys = lazy(() => import('@/pages/ApiKeys'));
const Monitoring = lazy(() => import('@/pages/Monitoring'));
const Intelligence = lazy(() => import('@/pages/Intelligence'));
const Marketplace = lazy(() => import('@/pages/Marketplace'));
const DatasetStudio = lazy(() => import('@/pages/DatasetStudio'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error?: Error}> {
  constructor(props: {children: React.ReactNode}) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col h-screen items-center justify-center font-mono text-destructive bg-background gap-4">
          <div className="text-2xl uppercase tracking-widest">[ SYSTEM FAILURE ]</div>
          <div className="text-sm opacity-70">{this.state.error?.message}</div>
          <button onClick={() => window.location.reload()} className="px-4 py-2 mt-4 border border-destructive hover:bg-destructive/10">REBOOT SYSTEM</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PageFallback() {
  return (
    <div className="flex h-[60vh] flex-col items-center justify-center font-mono gap-4 text-primary">
      <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <div className="text-xs uppercase tracking-widest animate-pulse">[ LOADING NEURAL MODULE... ]</div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Shell>
            <Suspense fallback={<PageFallback />}>
              <Switch>
                <Route path="/" component={Recognition} />
                <Route path="/persons" component={Database} />
                <Route path="/intelligence" component={Intelligence} />
                <Route path="/marketplace" component={Marketplace} />
                <Route path="/dataset-studio" component={DatasetStudio} />
                <Route path="/projects" component={Projects} />
                <Route path="/api-keys" component={ApiKeys} />
                <Route path="/monitoring" component={Monitoring} />
                <Route path="/learning" component={Learning} />
                <Route path="/stats" component={Stats} />
                <Route>
                  <div className="flex h-[50vh] items-center justify-center font-mono text-primary text-xl tracking-widest uppercase">
                    [404] Neural Pathway Not Found
                  </div>
                </Route>
              </Switch>
            </Suspense>
          </Shell>
        </WouterRouter>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--primary))',
              color: 'hsl(var(--primary))',
              fontFamily: 'var(--font-mono)',
              borderRadius: '0',
              boxShadow: '0 0 15px rgba(0,229,255,0.2)'
            }
          }}
        />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
