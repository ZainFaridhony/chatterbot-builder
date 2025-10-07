import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import ProjectListPage from './pages/ProjectListPage';
import ProjectManagerPage from './pages/ProjectManagerPage';
import './styles/global.css';
import 'reactflow/dist/style.css';

const createClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60,
      },
    },
  });

const Providers = ({ children }: { children: ReactNode }) => {
  const [client] = useState(createClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

type View = 'list' | 'manager';

const App = () => {
  const [view, setView] = useState<View>('list');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [navAction, setNavAction] = useState<ReactNode | null>(null);
  const [navPrimary, setNavPrimary] = useState<ReactNode | null>(null);

  const navLabel = useMemo(
    () => (view === 'list' ? 'Project Bots' : 'Project Bot Manager'),
    [view],
  );

  const handleSelectProject = (projectId: number) => {
    setSelectedProjectId(projectId);
    setView('manager');
  };

  const handleBackToProjects = () => {
    setView('list');
  };

  const handleProjectDeleted = () => {
    setSelectedProjectId(null);
    setView('list');
  };

  const brand = (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 font-semibold text-white">
        FM
      </span>
      <h1 className="text-lg font-semibold tracking-tight text-neutral-800">FlowMind Agent Builder</h1>
    </div>
  );

  useEffect(() => {
    if (view !== 'manager') {
      setNavAction(null);
      setNavPrimary(null);
    }
  }, [view]);

  const handleListProjectDeleted = (projectId: number) => {
    if (projectId === selectedProjectId) {
      handleProjectDeleted();
    }
  };

  const page = view === 'manager' && selectedProjectId !== null ? (
    <ProjectManagerPage
      projectId={selectedProjectId}
      onBack={handleBackToProjects}
      setNavAction={setNavAction}
      setNavPrimary={setNavPrimary}
    />
  ) : (
    <ProjectListPage
      onSelectProject={handleSelectProject}
      onProjectDeleted={handleListProjectDeleted}
      selectedProjectId={selectedProjectId}
    />
  );

  return (
    <Providers>
      <main className="min-h-screen bg-neutral-50 text-neutral-900">
        <nav className="sticky top-0 z-30 border-b border-neutral-200 bg-white/80 px-10 py-6 backdrop-blur">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-4">
              {view === 'manager' && navPrimary ? navPrimary : brand}
            </div>
            <div className="flex items-center gap-3">
              {navAction}
            </div>
          </div>
        </nav>
        {page}
      </main>
    </Providers>
  );
};

export default App;
