import { FC, useMemo, useState } from 'react';
import classNames from 'classnames';
import ConfirmDialog from '../components/ConfirmDialog';
import ProjectFormModal from '../components/ProjectFormModal';
import {
  Project,
  ProjectCreatePayload,
  ProjectUpdatePayload,
  useProjectMutations,
  useProjects,
} from '../hooks/useIntents';

interface ProjectListPageProps {
  onSelectProject: (projectId: number) => void;
  onProjectDeleted?: (projectId: number) => void;
  selectedProjectId?: number | null;
}

const ProjectListPage: FC<ProjectListPageProps> = ({
  onSelectProject,
  onProjectDeleted,
  selectedProjectId = null,
}) => {
  const { data: projects, isLoading: loadingProjects } = useProjects();
  const { createProject, updateProject, deleteProject } = useProjectMutations();

  const [projectModalMode, setProjectModalMode] = useState<'create' | 'edit'>('create');
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectBeingEdited, setProjectBeingEdited] = useState<Project | null>(null);
  const [projectBeingDeleted, setProjectBeingDeleted] = useState<Project | null>(null);

  const hasProjects = Boolean(projects?.length);

  const sortedProjects = useMemo(() => {
    if (!projects) return [];
    return projects.slice().sort((a, b) => a.name.localeCompare(b.name));
  }, [projects]);

  const openCreateProject = () => {
    setProjectModalMode('create');
    setProjectBeingEdited(null);
    setProjectModalOpen(true);
  };

  const openEditProject = (project: Project) => {
    setProjectModalMode('edit');
    setProjectBeingEdited(project);
    setProjectModalOpen(true);
  };

  const handleProjectSubmit = async (payload: ProjectCreatePayload | ProjectUpdatePayload) => {
    try {
      if (projectModalMode === 'create') {
        const project = await createProject.mutateAsync(payload as ProjectCreatePayload);
        setProjectModalOpen(false);
        setProjectBeingEdited(null);
        onSelectProject(project.id);
      } else if (projectModalMode === 'edit' && projectBeingEdited) {
        await updateProject.mutateAsync({
          projectId: projectBeingEdited.id,
          payload: payload as ProjectUpdatePayload,
        });
        setProjectModalOpen(false);
        setProjectBeingEdited(null);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectBeingDeleted) return;
    try {
      await deleteProject.mutateAsync(projectBeingDeleted.id);
      const deletedId = projectBeingDeleted.id;
      setProjectBeingDeleted(null);
      onProjectDeleted?.(deletedId);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-10 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight text-neutral-900">Project Bots</h2>
          <p className="text-sm text-neutral-500">
            Pick an agent to manage or create a new bot for your next conversational workflow.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateProject}
          className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800"
        >
          + New Project Bot
        </button>
      </header>

      {loadingProjects ? (
        <div className="flex min-h-[45vh] items-center justify-center rounded-3xl border border-dashed border-neutral-200 bg-neutral-50">
          <p className="text-sm text-neutral-500">Loading bots…</p>
        </div>
      ) : hasProjects ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {sortedProjects.map((project) => {
            const isActive = project.id === selectedProjectId;
            return (
              <article
                key={project.id}
                className={classNames(
                  'flex h-full flex-col justify-between rounded-3xl border px-6 py-5 transition',
                  isActive
                    ? 'border-neutral-900 bg-neutral-900 text-white shadow-xl'
                    : 'border-neutral-200 bg-white text-neutral-900 shadow-sm hover:border-neutral-300 hover:bg-neutral-50',
                )}
              >
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold">{project.name}</h3>
                    <p className={classNames('text-sm', isActive ? 'text-neutral-200' : 'text-neutral-500')}>
                      {project.description ?? 'No description yet. Add one via settings.'}
                    </p>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={classNames('font-semibold uppercase tracking-wide', isActive ? 'text-neutral-100' : 'text-neutral-500')}>
                        Languages
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {project.supported_languages.map((lang) => (
                          <span
                            key={lang}
                            className={classNames(
                              'rounded-full border px-3 py-1 font-semibold uppercase tracking-wide',
                              isActive
                                ? 'border-white/30 bg-white/10 text-white'
                                : 'border-neutral-200 bg-neutral-100 text-neutral-600',
                            )}
                          >
                            {lang}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={classNames('font-semibold uppercase tracking-wide', isActive ? 'text-neutral-100' : 'text-neutral-500')}>
                        Default
                      </span>
                      <span className={isActive ? 'text-neutral-100' : 'text-neutral-600'}>
                        {project.default_language}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={classNames('font-semibold uppercase tracking-wide', isActive ? 'text-neutral-100' : 'text-neutral-500')}>
                        Confidence
                      </span>
                      <span className={isActive ? 'text-neutral-100' : 'text-neutral-600'}>
                        {(project.confidence_threshold * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => onSelectProject(project.id)}
                    className={classNames(
                      'w-full rounded-full px-4 py-2 text-center text-xs font-semibold transition',
                      isActive
                        ? 'bg-white text-neutral-900 hover:bg-neutral-200'
                        : 'border border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-100',
                    )}
                  >
                    Manage Bot
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditProject(project)}
                    className={classNames(
                      'w-full rounded-full px-4 py-2 text-center text-xs font-semibold transition',
                      isActive
                        ? 'border border-white/30 text-white hover:border-white/50'
                        : 'border border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:bg-neutral-100',
                    )}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setProjectBeingDeleted(project)}
                    className={classNames(
                      'w-full rounded-full px-4 py-2 text-center text-xs font-semibold transition',
                      isActive
                        ? 'border border-rose-200/60 text-rose-100 hover:border-rose-200'
                        : 'border border-rose-200 text-rose-600 hover:border-rose-300 hover:bg-rose-50',
                    )}
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-[45vh] flex-col items-center justify-center gap-6 rounded-3xl border border-dashed border-neutral-200 bg-neutral-50 text-center">
          <div className="space-y-2">
            <h3 className="text-2xl font-semibold text-neutral-900">Create your first bot</h3>
            <p className="max-w-md text-sm text-neutral-500">
              Start by defining an agent shell. You can add intents, fallbacks, and fulfillment afterwards.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateProject}
            className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800"
          >
            + Create Project Bot
          </button>
        </div>
      )}

      <ProjectFormModal
        mode={projectModalMode}
        isOpen={projectModalOpen}
        onClose={() => {
          setProjectModalOpen(false);
          setProjectBeingEdited(null);
        }}
        onSubmit={handleProjectSubmit}
        submitting={projectModalMode === 'create' ? createProject.isPending : updateProject.isPending}
        project={projectModalMode === 'edit' ? projectBeingEdited : null}
      />

      <ConfirmDialog
        title="Delete bot"
        description={
          projectBeingDeleted
            ? `Deleting "${projectBeingDeleted.name}" removes all related intents and fallbacks. Continue?`
            : 'Deleting this bot removes all related intents and fallbacks. Continue?'
        }
        isOpen={projectBeingDeleted !== null}
        onCancel={() => setProjectBeingDeleted(null)}
        onConfirm={handleDeleteProject}
        confirmLabel="Delete"
        confirmVariant="danger"
        confirmDisabled={deleteProject.isPending}
      />
    </div>
  );
};

export default ProjectListPage;
