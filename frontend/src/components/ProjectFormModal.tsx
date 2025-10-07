import { FormEvent, useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import { Project, ProjectCreatePayload, ProjectUpdatePayload } from '../hooks/useIntents';

type Mode = 'create' | 'edit';

interface ProjectFormModalProps {
  mode: Mode;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: ProjectCreatePayload | ProjectUpdatePayload) => Promise<void> | void;
  submitting?: boolean;
  project?: Project | null;
}

const defaultLanguages = ['en', 'id', 'ms'];

const ProjectFormModal = ({
  mode,
  isOpen,
  onClose,
  onSubmit,
  submitting,
  project,
}: ProjectFormModalProps) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [supportedLanguages, setSupportedLanguages] = useState(defaultLanguages.join(', '));
  const [defaultLanguage, setDefaultLanguage] = useState('en');
  const [confidenceThreshold, setConfidenceThreshold] = useState('0.7');

  useEffect(() => {
    if (mode === 'edit' && project) {
      setName(project.name);
      setDescription(project.description ?? '');
      setSupportedLanguages(project.supported_languages.join(', '));
      setDefaultLanguage(project.default_language);
      setConfidenceThreshold(project.confidence_threshold.toString());
    } else if (mode === 'create') {
      setName('');
      setDescription('');
      setSupportedLanguages(defaultLanguages.join(', '));
      setDefaultLanguage('en');
      setConfidenceThreshold('0.7');
    }
  }, [mode, project, isOpen]);

  const parsedLanguages = useMemo(
    () =>
      supportedLanguages
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [supportedLanguages],
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsedThreshold = Number(confidenceThreshold);
    const normalizedThreshold = Number.isFinite(parsedThreshold)
      ? Math.min(1, Math.max(0, parsedThreshold))
      : 0.7;

    const payloadBase = {
      description: description || undefined,
      supported_languages: parsedLanguages.length ? parsedLanguages : defaultLanguages,
      default_language: parsedLanguages.includes(defaultLanguage)
        ? defaultLanguage
        : parsedLanguages[0] ?? defaultLanguage,
      confidence_threshold: normalizedThreshold,
    };

    if (mode === 'create') {
      onSubmit({
        name,
        ...payloadBase,
      } satisfies ProjectCreatePayload);
    } else {
      onSubmit({
        name,
        ...payloadBase,
      } satisfies ProjectUpdatePayload);
    }
  };

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-500 transition hover:border-neutral-300 hover:bg-neutral-100"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="project-form"
        disabled={submitting}
        className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
      >
        {mode === 'create' ? 'Create Project' : 'Save Changes'}
      </button>
    </>
  );

  return (
    <Modal
      title={mode === 'create' ? 'Create Project' : `Edit ${project?.name ?? ''}`}
      description={
        mode === 'create'
          ? 'Spin up a fresh workspace for your conversational agent.'
          : 'Update the baseline settings for this bot.'
      }
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      footer={footer}
    >
      <form
        id="project-form"
        onSubmit={handleSubmit}
        className="grid gap-5 md:grid-cols-2"
      >
        <div className="grid gap-2 md:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500" htmlFor="project-name">
            Project Name
          </label>
          <input
            id="project-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 transition focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
            placeholder="support-bot"
          />
        </div>

        <div className="grid gap-2 md:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500" htmlFor="project-description">
            Description
          </label>
          <textarea
            id="project-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 transition focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
            placeholder="Handles support triage"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500" htmlFor="project-languages">
            Supported Languages (comma separated)
          </label>
          <input
            id="project-languages"
            type="text"
            value={supportedLanguages}
            onChange={(event) => setSupportedLanguages(event.target.value)}
            className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 transition focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
          />
        </div>

        <div className="grid gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500" htmlFor="project-default-language">
            Default Language
          </label>
          <select
            id="project-default-language"
            value={defaultLanguage}
            onChange={(event) => setDefaultLanguage(event.target.value)}
            className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 transition focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
          >
            {parsedLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {lang.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500" htmlFor="project-confidence">
            Confidence Threshold (0 - 1)
          </label>
          <input
            id="project-confidence"
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={confidenceThreshold}
            onChange={(event) => setConfidenceThreshold(event.target.value)}
            className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 transition focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
          />
        </div>
      </form>
    </Modal>
  );
};

export default ProjectFormModal;
