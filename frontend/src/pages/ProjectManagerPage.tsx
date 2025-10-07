import { FC, ReactNode, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames';
import IntentTree from '../components/IntentTree';
import ProjectFormModal from '../components/ProjectFormModal';
import IntentFormModal from '../components/IntentFormModal';
import ConfirmDialog from '../components/ConfirmDialog';
import FallbackFormModal from '../components/FallbackFormModal';
import ChatTester from '../components/ChatTester';
import IntentFlowCanvas from '../components/IntentFlowCanvas';
import {
  FallbackPayload,
  IntentApiResponse,
  IntentPayload,
  IntentUpdatePayload,
  ProjectUpdatePayload,
  useChat,
  useFallbackMutations,
  useIntentMutations,
  useIntents,
  useIntentTree,
  useProjectMutations,
  useProjects,
} from '../hooks/useIntents';

interface ProjectManagerPageProps {
  projectId: number;
  onBack: () => void;
  setNavAction: (action: ReactNode | null) => void;
  setNavPrimary: (primary: ReactNode | null) => void;
}

const ProjectManagerPage: FC<ProjectManagerPageProps> = ({
  projectId,
  onBack,
  setNavAction,
  setNavPrimary,
}) => {
  const { data: projects, isLoading: loadingProjects } = useProjects();
  const activeProject = useMemo(
    () => projects?.find((project) => project.id === projectId) ?? null,
    [projects, projectId],
  );

  const [viewMode, setViewMode] = useState<'tree' | 'flow'>('tree');
  const [selectedIntentId, setSelectedIntentId] = useState<number | null>(null);
  const [intentModalMode, setIntentModalMode] = useState<'create' | 'edit'>('create');
  const [intentModalOpen, setIntentModalOpen] = useState(false);
  const [initialParentIntentId, setInitialParentIntentId] = useState<number | null>(null);
  const [intentToEdit, setIntentToEdit] = useState<number | null>(null);
  const [intentToDelete, setIntentToDelete] = useState<number | null>(null);
  const [fallbackModalOpen, setFallbackModalOpen] = useState(false);
  const [selectedFallbackLanguage, setSelectedFallbackLanguage] = useState<string | null>(null);
  const [fallbackScopeIntentId, setFallbackScopeIntentId] = useState<number | null>(null);
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    setSelectedIntentId(null);
    setSelectedFallbackLanguage(null);
    setFallbackScopeIntentId(null);
  }, [projectId]);

  const {
    data: intents,
    isLoading: loadingIntents,
  } = useIntents(projectId, Boolean(projectId));

  const tree = useIntentTree(intents);
  const selectedIntent = useMemo<IntentApiResponse | null>(() => {
    if (!selectedIntentId) return null;
    return intents?.find((intent) => intent.id === selectedIntentId) ?? null;
  }, [intents, selectedIntentId]);

  const fallbackList = useMemo(
    () =>
      activeProject
        ? activeProject.fallbacks
            .filter((fallback) => fallback.intent_id === null)
            .sort((a, b) => a.language.localeCompare(b.language))
        : [],
    [activeProject],
  );

  const { updateProject } = useProjectMutations();
  const { createIntent, updateIntent, deleteIntent } = useIntentMutations(projectId);
  const { upsertFallback } = useFallbackMutations(projectId);

  const {
    messages,
    sendMessage,
    resetSession,
    isLoading: chatLoading,
    error: chatError,
    updateLanguage: setChatLanguage,
    selectedLanguage: chatLanguage,
  } = useChat(projectId, activeProject?.default_language ?? null);

  const openProjectFallbackModal = (language?: string) => {
    if (!activeProject) return;
    const languages = activeProject.supported_languages;
    const defaultLang = language ?? activeProject.default_language ?? languages[0] ?? null;
    if (!defaultLang) return;
    setFallbackScopeIntentId(null);
    setSelectedFallbackLanguage(defaultLang);
    setFallbackModalOpen(true);
  };

  const openIntentFallbackModal = (intentId?: number, language?: string) => {
    if (!activeProject) return;
    const targetIntentId = intentId ?? selectedIntentId;
    if (!targetIntentId) return;
    const languages = activeProject.supported_languages;
    const defaultLang = language ?? activeProject.default_language ?? languages[0] ?? null;
    if (!defaultLang) return;
    setSelectedIntentId(targetIntentId);
    setFallbackScopeIntentId(targetIntentId);
    setSelectedFallbackLanguage(defaultLang);
    setFallbackModalOpen(true);
  };

  const openCreateIntent = (parentId: number | null) => {
    setIntentModalMode('create');
    setInitialParentIntentId(parentId);
    setIntentToEdit(null);
    setIntentModalOpen(true);
  };

  const openEditIntent = (intentId?: number) => {
    const targetId = intentId ?? selectedIntentId ?? null;
    if (!targetId) return;
    setSelectedIntentId(targetId);
    setIntentModalMode('edit');
    setIntentToEdit(targetId);
    setIntentModalOpen(true);
  };

  const openDeleteIntent = (intentId?: number) => {
    const targetId = intentId ?? selectedIntentId ?? null;
    if (!targetId) return;
    setSelectedIntentId(targetId);
    setIntentToDelete(targetId);
  };

  const handleProjectUpdate = async (payload: ProjectUpdatePayload) => {
    if (!activeProject) return;
    try {
      await updateProject.mutateAsync({ projectId: activeProject.id, payload });
      setProjectModalOpen(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleIntentSubmit = async (
    payload: IntentPayload | IntentUpdatePayload,
  ) => {
    try {
      if (intentModalMode === 'create') {
        await createIntent.mutateAsync(payload);
      } else if (intentModalMode === 'edit' && intentToEdit) {
        await updateIntent.mutateAsync({ intentId: intentToEdit, payload });
      }
      setIntentModalOpen(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleIntentDelete = async () => {
    if (!selectedIntentId) return;
    try {
      await deleteIntent.mutateAsync(selectedIntentId);
      setIntentToDelete(null);
      setSelectedIntentId(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleFallbackModalClose = () => {
    setFallbackModalOpen(false);
    setFallbackScopeIntentId(null);
  };

  useEffect(() => {
    if (!activeProject) {
      setNavAction(null);
      setNavPrimary(null);
      return;
    }
    setNavPrimary(
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-600 transition hover:border-neutral-400"
        >
          ← Projects
        </button>
        <div>
          <p className="text-base font-semibold text-neutral-900">{activeProject.name}</p>
          {activeProject.description ? (
            <p className="text-xs text-neutral-500">{activeProject.description}</p>
          ) : null}
        </div>
      </div>,
    );
    setNavAction(
      <button
        type="button"
        onClick={() => setProjectModalOpen(true)}
        className="rounded-full border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-100"
      >
        Edit Settings
      </button>,
    );
    return () => {
      setNavAction(null);
      setNavPrimary(null);
    };
  }, [activeProject, onBack, setNavAction, setNavPrimary]);

  if (loadingProjects) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-neutral-500">
        Loading project…
      </div>
    );
  }

  if (!activeProject) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-10 text-center">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-neutral-900">Project unavailable</h2>
          <p className="text-sm text-neutral-500">
            This bot may have been removed or is still syncing. Return to the project list to continue.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-400"
        >
          Back to Projects
        </button>
      </div>
    );
  }

  const supportedLanguages = activeProject.supported_languages;

  return (
    <div className="relative flex w-full flex-1 flex-col gap-6 px-10 py-6">
      <section className="flex-1 rounded-[28px] border border-neutral-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 px-6 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-2 rounded-full bg-neutral-100 p-0.5 text-xs font-medium text-neutral-600">
              <button
                type="button"
                onClick={() => setViewMode('tree')}
                className={classNames('rounded-full px-3 py-1 transition', {
                  'bg-white text-neutral-900 shadow-sm': viewMode === 'tree',
                })}
              >
                Tree
              </button>
              <button
                type="button"
                onClick={() => setViewMode('flow')}
                className={classNames('rounded-full px-3 py-1 transition', {
                  'bg-white text-neutral-900 shadow-sm': viewMode === 'flow',
                })}
              >
                Flow
              </button>
            </div>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => openCreateIntent(null)}
              className="rounded-full border border-neutral-200 px-4 py-1.5 font-semibold text-neutral-600 transition hover:border-neutral-300"
            >
              + Create Intent
            </button>
            <button
              type="button"
              onClick={() => openProjectFallbackModal()}
              className="rounded-full bg-amber-500 px-4 py-1.5 font-semibold text-white shadow-sm transition hover:bg-amber-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
            >
              Edit Root Fallback
            </button>
            <button
              type="button"
              onClick={() => setChatOpen((prev) => !prev)}
              className={classNames(
                'rounded-full px-4 py-1.5 font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                {
                  'bg-neutral-900 text-white shadow-sm hover:bg-neutral-800 focus-visible:outline-neutral-900': !chatOpen,
                  'border border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:bg-neutral-100 focus-visible:outline-neutral-400':
                    chatOpen,
                },
              )}
            >
              {chatOpen ? 'Hide Chat Tester' : 'Open Chat Tester'}
            </button>
          </div>
        </div>
        <div
          className={classNames('px-6 py-6', {
            'max-h-[calc(100vh-240px)] overflow-y-auto': viewMode === 'tree',
            'h-[calc(100vh-240px)]': viewMode === 'flow',
          })}
        >
          {loadingIntents ? (
            <p className="text-sm text-neutral-500">Loading intents…</p>
          ) : viewMode === 'tree' ? (
            tree.length ? (
                <IntentTree
                  intents={tree}
                  onSelect={(intent) => setSelectedIntentId(intent.id)}
                  selectedId={selectedIntentId}
                  onEditIntent={(intent) => openEditIntent(intent.id)}
                  onDeleteIntent={(intent) => openDeleteIntent(intent.id)}
                />
            ) : (
              <div className="flex min-h-[50vh] items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50">
                <p className="text-sm text-neutral-500">
                  No intents yet. Create your first intent to start.
                </p>
              </div>
            )
          ) : (
            <IntentFlowCanvas
              intents={tree}
              selectedIntentId={selectedIntentId}
              onSelectIntent={(id) => setSelectedIntentId(id)}
              onCreateFollowUp={(parentId) => openCreateIntent(parentId)}
              onEditIntent={(intentId) => openEditIntent(intentId)}
              onDeleteIntent={(intentId) => openDeleteIntent(intentId)}
              onEditFallback={(intentId) => openIntentFallbackModal(intentId)}
            />
          )}
        </div>
      </section>

      {chatOpen && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-40">
          <div className="pointer-events-auto w-[22rem] rounded-3xl border border-neutral-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
              <div className="text-sm font-semibold text-neutral-700">Chat Tester</div>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-medium text-neutral-500 transition hover:border-neutral-300 hover:bg-neutral-100"
              >
                Minimize
              </button>
            </div>
            <div className="px-4 py-4">
              <ChatTester
                messages={messages}
                onSend={sendMessage}
                isLoading={chatLoading}
                error={chatError}
                onReset={resetSession}
                supportedLanguages={supportedLanguages}
                selectedLanguage={chatLanguage}
                onLanguageChange={setChatLanguage}
              />
            </div>
          </div>
        </div>
      )}

      <ProjectFormModal
        mode="edit"
        isOpen={isProjectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        onSubmit={handleProjectUpdate}
        submitting={updateProject.isPending}
        project={activeProject}
      />

      <IntentFormModal
        mode={intentModalMode}
        isOpen={intentModalOpen}
        onClose={() => setIntentModalOpen(false)}
        onSubmit={handleIntentSubmit}
        submitting={createIntent.isPending || updateIntent.isPending}
        intent={intents?.find((item) => item.id === intentToEdit)}
        intents={tree}
        supportedLanguages={supportedLanguages}
        defaultLanguage={activeProject.default_language ?? 'en'}
        initialParentId={initialParentIntentId}
      />

      <FallbackFormModal
        isOpen={fallbackModalOpen}
        onClose={() => {
          handleFallbackModalClose();
          setSelectedFallbackLanguage(null);
        }}
        onSubmit={async (payload: FallbackPayload) => {
          try {
            await upsertFallback.mutateAsync(payload);
            handleFallbackModalClose();
            setSelectedFallbackLanguage(null);
          } catch (error) {
            console.error(error);
          }
        }}
        submitting={upsertFallback.isPending}
        fallback={(() => {
          if (!selectedFallbackLanguage) return null;
          if (fallbackScopeIntentId) {
            const targetIntent = intents?.find((item) => item.id === fallbackScopeIntentId);
            return targetIntent?.fallbacks?.find((item) => item.language === selectedFallbackLanguage) ?? null;
          }
          return fallbackList.find((item) => item.language === selectedFallbackLanguage) ?? null;
        })()}
        fallbacks={fallbackScopeIntentId
          ? (intents?.find((item) => item.id === fallbackScopeIntentId)?.fallbacks ?? [])
          : fallbackList}
        supportedLanguages={supportedLanguages}
        initialLanguage={selectedFallbackLanguage}
        intentName={fallbackScopeIntentId ? intents?.find((item) => item.id === fallbackScopeIntentId)?.name : undefined}
        intentId={fallbackScopeIntentId}
      />

      <ConfirmDialog
        title="Delete intent"
        description="Deleting this intent also reattaches its children to the parent level. Continue?"
        isOpen={intentToDelete !== null}
        onCancel={() => setIntentToDelete(null)}
        onConfirm={handleIntentDelete}
        confirmLabel="Delete"
        confirmVariant="danger"
        confirmDisabled={deleteIntent.isPending}
      />
    </div>
  );
};

export default ProjectManagerPage;
