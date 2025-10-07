import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import classNames from 'classnames';
import Modal from './Modal';
import {
  IntentApiResponse,
  IntentPayload,
  IntentUpdatePayload,
  IntentTreeNode,
  TrainingPhraseInput,
  IntentResponseInput,
  IntentBranchInput,
} from '../hooks/useIntents';

interface IntentFormModalProps {
  mode: 'create' | 'edit';
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: IntentPayload | IntentUpdatePayload) => Promise<void> | void;
  submitting?: boolean;
  intent?: IntentApiResponse | null;
  intents?: IntentTreeNode[];
  supportedLanguages: string[];
  defaultLanguage: string;
  initialParentId?: number | null;
}

const blankTrainingPhrase = (language: string): TrainingPhraseInput => ({
  language,
  text: '',
});

const blankResponse = (language: string): IntentResponseInput => ({
  language,
  text: '',
  response_type: 'text',
  payload: {},
});

const flattenIntents = (nodes: IntentTreeNode[] = []): IntentTreeNode[] => {
  const result: IntentTreeNode[] = [];
  nodes.forEach((node) => {
    result.push(node);
    if (node.children?.length) {
      result.push(...flattenIntents(node.children));
    }
  });
  return result;
};

const IntentFormModal = ({
  mode,
  isOpen,
  onClose,
  onSubmit,
  submitting,
  intent,
  intents = [],
  supportedLanguages,
  defaultLanguage,
  initialParentId,
}: IntentFormModalProps) => {
  const labelClass = 'text-xs font-semibold uppercase tracking-wide text-neutral-500';
  const inputClass =
    'rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 transition focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10';
  const compactInputClass =
    'rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-900 transition focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10';
  const cardClass = 'rounded-3xl border border-neutral-200 bg-white/80 p-6 shadow-sm';
  const SIMPLE_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  const AUTH_TYPES = ['none', 'bearer', 'basic'];

  type CheckboxTone = 'neutral' | 'success' | 'warning';
  const checkboxToneClasses: Record<CheckboxTone, string> = {
    neutral: 'accent-neutral-900 focus:ring-neutral-900/20',
    success: 'accent-emerald-500 focus:ring-emerald-500/20',
    warning: 'accent-amber-500 focus:ring-amber-500/20',
  };

  const CheckboxRow = ({
    label,
    description,
    checked,
    onChange,
    tone = 'neutral',
  }: {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (next: boolean) => void;
    tone?: CheckboxTone;
  }) => (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-neutral-200 bg-white px-5 py-4">
      <div>
        <p className="text-sm font-semibold text-neutral-900">{label}</p>
        {description && <p className="mt-1 text-xs text-neutral-500">{description}</p>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className={classNames(
          'h-5 w-5 rounded border-neutral-300 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-offset-1',
          checkboxToneClasses[tone],
        )}
      />
    </label>
  );

const PAYLOAD_PLACEHOLDERS = ['{{intent_id}}', '{{intent_name}}', '{{language}}', '{{user_text}}', '{{session_id}}'];
const LOGIC_SNIPPETS = [
  'context.session.ticket.status == "open"',
  'input.payload.language == "en"',
  'session.attributes.support_tier == "vip"',
];
const ensureString = (value: unknown, fallback = ''): string => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return fallback;
  }
};
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [parentIntentId, setParentIntentId] = useState<number | ''>('');
  const [trainingPhrases, setTrainingPhrases] = useState<TrainingPhraseInput[]>([
    blankTrainingPhrase(defaultLanguage),
  ]);
  const [responses, setResponses] = useState<IntentResponseInput[]>([
    blankResponse(defaultLanguage),
  ]);
  const [branches, setBranches] = useState<IntentBranchInput[]>([]);
  const [fulfillmentEnabled, setFulfillmentEnabled] = useState(false);
  const [fulfillmentUrl, setFulfillmentUrl] = useState('');
  const [fulfillmentMethod, setFulfillmentMethod] = useState('POST');
  const [fulfillmentHeaders, setFulfillmentHeaders] = useState('{}');
  const [fulfillmentPayload, setFulfillmentPayload] = useState('{}');
  const [fulfillmentTimeout, setFulfillmentTimeout] = useState(10);
  const [fulfillmentError, setFulfillmentError] = useState<string | null>(null);
  const [fulfillmentSaveAs, setFulfillmentSaveAs] = useState('');
  const [isFallback, setIsFallback] = useState(false);
  const [isDefaultWelcome, setIsDefaultWelcome] = useState(false);
  const [inputContexts, setInputContexts] = useState<string[]>([]);
  const [outputContexts, setOutputContexts] = useState<{ name: string; lifespan: string }[]>([]);

  const languages = supportedLanguages.length ? supportedLanguages : [defaultLanguage];

  const resetFulfillment = useCallback(() => {
    setFulfillmentEnabled(false);
    setFulfillmentUrl('');
    setFulfillmentMethod('POST');
    setFulfillmentTimeout(10);
    setFulfillmentHeaders('{}');
    setFulfillmentPayload('{}');
    setFulfillmentError(null);
    setFulfillmentSaveAs('');
  }, []);

  const lastHydratedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      lastHydratedKeyRef.current = null;
      return;
    }

    if (mode === 'edit') {
      if (!intent) return;
      const key = `edit:${intent.id}:${intent.updated_at}`;
      if (lastHydratedKeyRef.current === key) {
        return;
      }
      lastHydratedKeyRef.current = key;

      setName(intent.name);
      setDescription(intent.description ?? '');
      setIsActive(intent.is_active);
      setParentIntentId(intent.parent_intent_id ?? '');
      setTrainingPhrases(
        intent.training_phrases.length
          ? intent.training_phrases.map(({ language, text }) => ({ language, text }))
          : [blankTrainingPhrase(defaultLanguage)],
      );
      setResponses(
        intent.responses.length
          ? intent.responses.map(({ language, text, response_type, payload }) => ({
              language,
              text: text ?? '',
              response_type: response_type ?? 'text',
              payload: payload ?? {},
            }))
          : [blankResponse(defaultLanguage)],
      );
      if (intent.fulfillment) {
        setFulfillmentEnabled(intent.fulfillment.enabled);
        setFulfillmentUrl(intent.fulfillment.url ?? '');
        setFulfillmentMethod(intent.fulfillment.method ?? 'POST');
        setFulfillmentTimeout(intent.fulfillment.timeout_seconds ?? 10);
        setFulfillmentHeaders(JSON.stringify(intent.fulfillment.headers ?? {}, null, 2));
        setFulfillmentPayload(JSON.stringify(intent.fulfillment.payload_template ?? {}, null, 2));
        setFulfillmentSaveAs(intent.fulfillment.save_as ?? '');
      } else {
        resetFulfillment();
      }
      setBranches(
        intent.branches?.map((branch) => ({
          expression: branch.expression,
          true_intent_id: branch.true_intent_id,
          false_intent_id: branch.false_intent_id,
        })) ?? [],
      );
      setIsFallback(intent.is_fallback);
      setIsDefaultWelcome(intent.is_default_welcome);
      setInputContexts(intent.input_contexts?.map((ctx) => ctx.name) ?? []);
      setOutputContexts(
        intent.output_contexts?.map((ctx) => ({
          name: ctx.name,
          lifespan: String(ctx.lifespan_turns ?? 0),
        })) ?? [],
      );
      return;
    }

    const key = `create:${defaultLanguage}:${initialParentId ?? 'root'}`;
    if (lastHydratedKeyRef.current === key) {
      return;
    }
    lastHydratedKeyRef.current = key;

    setName('');
    setDescription('');
    setIsActive(true);
    setParentIntentId(initialParentId ?? '');
    setTrainingPhrases([blankTrainingPhrase(defaultLanguage)]);
    setResponses([blankResponse(defaultLanguage)]);
    resetFulfillment();
    setBranches([]);
    setIsFallback(false);
    setIsDefaultWelcome(false);
    setInputContexts([]);
    setOutputContexts([]);
  }, [mode, intent, isOpen, defaultLanguage, initialParentId, resetFulfillment]);

  const flatIntents = useMemo(() => flattenIntents(intents), [intents]);
  const parentOptions = useMemo(
    () =>
      flatIntents.filter((node) => (mode === 'create' ? true : node.id !== intent?.id)),
    [flatIntents, intent?.id, mode],
  );

  const handleTrainingChange = (index: number, key: keyof TrainingPhraseInput, value: string) => {
    setTrainingPhrases((prev) => prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)));
  };

  const handleResponseChange = (index: number, key: keyof IntentResponseInput, value: string) => {
    setResponses((prev) => prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)));
  };

  const handleResponsePayloadChange = (
    index: number,
    key: string,
    value: string,
  ) => {
    setResponses((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              payload: {
                ...(item.payload || {}),
                [key]: value,
              },
            }
          : item,
      ),
    );
  };

  const removeTrainingPhrase = (index: number) => {
    setTrainingPhrases((prev) => prev.filter((_, idx) => idx !== index));
  };

  const removeResponse = (index: number) => {
    setResponses((prev) => prev.filter((_, idx) => idx !== index));
  };

const addTrainingPhrase = () => {
  setTrainingPhrases((prev) => [...prev, blankTrainingPhrase(defaultLanguage)]);
};

const addResponse = () => {
  setResponses((prev) => [...prev, blankResponse(defaultLanguage)]);
};

const handleBranchChange = (
  index: number,
  key: keyof IntentBranchInput,
  value: string,
) => {
  setBranches((prev) =>
    prev.map((item, idx) =>
      idx === index
        ? {
            ...item,
            [key]:
              key === 'true_intent_id' || key === 'false_intent_id'
                ? value === '' ? null : Number(value)
                : value,
          }
        : item,
    ),
  );
};

const addBranch = () => {
  setBranches((prev) => [
    ...prev,
    {
      expression: '',
      true_intent_id: null,
      false_intent_id: null,
    },
  ]);
};

const removeBranch = (index: number) => {
  setBranches((prev) => prev.filter((_, idx) => idx !== index));
};

  const addInputContext = () => {
    setInputContexts((prev) => [...prev, '']);
  };

  const updateInputContext = (index: number, value: string) => {
    setInputContexts((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const removeInputContext = (index: number) => {
    setInputContexts((prev) => prev.filter((_, idx) => idx !== index));
  };

  const addOutputContext = () => {
    setOutputContexts((prev) => [...prev, { name: '', lifespan: '5' }]);
  };

  const updateOutputContext = (index: number, key: 'name' | 'lifespan', value: string) => {
    setOutputContexts((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              [key]: value,
            }
          : item,
      ),
    );
  };

  const removeOutputContext = (index: number) => {
    setOutputContexts((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    let parsedHeaders: Record<string, unknown> | null = null;
    let parsedPayload: Record<string, unknown> | null = null;
    if (fulfillmentHeaders.trim()) {
      try {
        parsedHeaders = JSON.parse(fulfillmentHeaders);
      } catch (error) {
        setFulfillmentError('Fulfillment headers must be valid JSON');
        return;
      }
    }
    if (fulfillmentPayload.trim()) {
      try {
        parsedPayload = JSON.parse(fulfillmentPayload);
      } catch (error) {
        setFulfillmentError('Fulfillment payload must be valid JSON');
        return;
      }
    }
    setFulfillmentError(null);
    const payloadBase = {
      name,
      description: description || undefined,
      is_active: isActive,
      is_fallback: isFallback,
      is_default_welcome: isDefaultWelcome,
      parent_intent_id: parentIntentId === '' ? null : Number(parentIntentId),
      training_phrases: trainingPhrases.filter((item) => item.text.trim()),
      responses: responses
        .map((item) => {
          const responseType = item.response_type ?? 'text';
          if (responseType === 'text') {
            const textValue = (item.text ?? '').trim();
            if (!textValue) return null;
            return {
              ...item,
              response_type: responseType,
              text: textValue,
              payload: undefined,
            };
          }
          if (responseType === 'image') {
            const url = ensureString(item.payload?.url, item.text ?? '').trim();
            if (!url) return null;
            return {
              ...item,
              response_type: responseType,
              text: (item.text ?? '').trim(),
              payload: { url },
            };
          }
          if (responseType === 'api') {
            const payload = (item.payload || {}) as Record<string, unknown>;
            const rawCurl = ensureString(payload.curl, '').trim();
            const urlValue = ensureString(payload.url, '').trim();
            if (!urlValue && !rawCurl) return null;
            const methodValue =
              typeof payload.method === 'string' && payload.method
                ? (payload.method as string).toUpperCase()
                : 'POST';
            const headersValue = ensureString(payload.headers, '').trim();
            const bodyValue = ensureString(payload.body, '').trim();
            const authTypeValue = ensureString(payload.auth_type, 'none').trim();
            const authTokenValue = ensureString(payload.auth_token, '').trim();

            const finalPayload: Record<string, unknown> = {};
            if (urlValue) finalPayload.url = urlValue;
            if (rawCurl) finalPayload.curl = rawCurl;
            if (methodValue) finalPayload.method = methodValue;
            if (headersValue) finalPayload.headers = headersValue;
            if (bodyValue) finalPayload.body = bodyValue;
            if (authTypeValue && authTypeValue !== 'none') {
              finalPayload.auth_type = authTypeValue;
              if (authTokenValue) {
                finalPayload.auth_token = authTokenValue;
              }
            }

            return {
              ...item,
              response_type: responseType,
              text: (item.text ?? '').trim(),
              payload: finalPayload,
            };
          }
          return null;
        })
        .filter((item): item is IntentResponseInput => Boolean(item)),
      fulfillment:
        fulfillmentEnabled && fulfillmentUrl.trim()
          ? {
              enabled: true,
              url: fulfillmentUrl.trim(),
              method: fulfillmentMethod,
              headers: parsedHeaders,
              payload_template: parsedPayload,
              timeout_seconds: fulfillmentTimeout,
              save_as: fulfillmentSaveAs.trim() || undefined,
            }
          : mode === 'edit' && intent?.fulfillment
          ? {
              enabled: false,
              url: fulfillmentUrl.trim() || intent.fulfillment.url,
              method: fulfillmentMethod,
              headers: parsedHeaders,
              payload_template: parsedPayload,
              timeout_seconds: fulfillmentTimeout,
              save_as: fulfillmentSaveAs.trim() || intent.fulfillment.save_as || undefined,
            }
          : undefined,
      branches: branches
        .map((branch) => {
          const expression = branch.expression.trim();
          if (!expression) return null;
          return {
            expression,
            true_intent_id: branch.true_intent_id ?? null,
            false_intent_id: branch.false_intent_id ?? null,
          };
        })
        .filter((branch): branch is IntentBranchInput => Boolean(branch)),
      input_contexts: inputContexts
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
        .map((name) => ({ name })),
      output_contexts: outputContexts
        .map((ctx) => {
          const raw = Number(ctx.lifespan);
          const lifespan = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
          return {
            name: ctx.name.trim(),
            lifespan_turns: lifespan,
          };
        })
        .filter((ctx) => ctx.name.length > 0),
    };
    if (mode === 'create') {
      onSubmit(payloadBase as IntentPayload);
    } else {
      onSubmit(payloadBase as IntentUpdatePayload);
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
        form="intent-form"
        disabled={submitting}
        className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
      >
        {mode === 'create' ? 'Create Intent' : 'Save Changes'}
      </button>
    </>
  );

  const handleInsertPayloadPlaceholder = (token: string) => {
    setFulfillmentPayload((prev) => {
      if (!prev.trim()) return token;
      return `${prev}${prev.endsWith('\n') ? '' : '\n'}${token}`;
    });
  };

  const handleInsertLogicSnippet = (snippet: string, branchIndex: number) => {
    setBranches((prev) =>
      prev.map((branch, idx) =>
        idx === branchIndex ? { ...branch, expression: snippet } : branch,
      ),
    );
  };

  return (
    <Modal
      title={mode === 'create' ? 'Create Intent' : `Edit ${intent?.name ?? ''}`}
      description={
        mode === 'create'
          ? 'Define how this intent greets users, captures training phrases, and responds in each channel.'
          : 'Tune the behaviour, fallbacks, and fulfillment for this intent.'
      }
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      footer={footer}
    >
      <form id="intent-form" onSubmit={handleSubmit} className="space-y-8">
        <section className={`${cardClass} space-y-6`}>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="grid gap-2 md:col-span-2">
              <label className={labelClass} htmlFor="intent-name">
                Intent Name
              </label>
              <input
                id="intent-name"
                type="text"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClass}
                placeholder="greeting"
              />
            </div>

            <div className="grid gap-2 md:col-span-2">
              <label className={labelClass} htmlFor="intent-description">
                Description
              </label>
              <textarea
                id="intent-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className={inputClass}
                placeholder="Used to greet the user"
              />
            </div>
          </div>

          <div className="space-y-3">
            <CheckboxRow
              label="Active"
              description="Serve this intent when conditions are met."
              checked={isActive}
              onChange={(next) => setIsActive(next)}
              tone="success"
            />
            <CheckboxRow
              label="Fallback intent"
              description="Handle unmatched messages by routing here."
              checked={isFallback}
              onChange={(next) => {
                setIsFallback(next);
                if (next) setIsDefaultWelcome(false);
              }}
              tone="warning"
            />
            <CheckboxRow
              label="Default welcome"
              description="Trigger immediately when a session starts."
              checked={isDefaultWelcome}
              onChange={(next) => {
                setIsDefaultWelcome(next);
                if (next) setIsFallback(false);
              }}
              tone="success"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <label className={labelClass} htmlFor="intent-parent">
                Parent intent
              </label>
              <select
                id="intent-parent"
                value={parentIntentId}
                onChange={(event) =>
                  setParentIntentId(event.target.value === '' ? '' : Number(event.target.value))
                }
                className={compactInputClass}
              >
                <option value="">None</option>
                {parentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <span className={labelClass}>Project defaults</span>
              <p className="text-xs text-neutral-500">
                This intent inherits supported languages and confidence threshold from the project settings. Adjust them
                from the project manager if you need different defaults.
              </p>
            </div>
          </div>
        </section>

        <section className={`${cardClass} space-y-4`}>
          <div className="flex items-center justify-between">
            <h3 className={labelClass}>
              Training Phrases
            </h3>
            <button
              type="button"
              onClick={addTrainingPhrase}
              className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-100"
            >
              + Add
            </button>
          </div>
          <div className="space-y-3">
            {trainingPhrases.map((phrase, index) => (
              <div key={index} className="space-y-3 rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-neutral-600">
                    <span className={labelClass}>Language</span>
                    <select
                      value={phrase.language}
                      onChange={(event) => handleTrainingChange(index, 'language', event.target.value)}
                      className={compactInputClass}
                    >
                      {languages.map((lang) => (
                        <option key={lang} value={lang}>
                          {lang.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>
                  {trainingPhrases.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTrainingPhrase(index)}
                      className="ml-auto rounded-full border border-rose-100 px-3 py-1 text-xs font-semibold text-rose-500 transition hover:border-rose-200 hover:bg-rose-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={phrase.text}
                  onChange={(event) => handleTrainingChange(index, 'text', event.target.value)}
                  className={inputClass}
                  placeholder="hello"
                />
              </div>
            ))}
          </div>
        </section>

        <section className={`${cardClass} space-y-5`}>
          <div className="flex items-center justify-between">
            <h3 className={labelClass}>Contexts</h3>
            <span className="text-xs text-neutral-500">
              Gate intent matching and activate follow-up contexts.
            </span>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={labelClass}>Input Contexts</span>
                <button
                  type="button"
                  onClick={addInputContext}
                  className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-100"
                >
                  + Add
                </button>
              </div>
              {inputContexts.length ? (
                <div className="space-y-2">
                  {inputContexts.map((value, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={value}
                        onChange={(event) => updateInputContext(index, event.target.value)}
                        className={`${compactInputClass} flex-1`}
                        placeholder="support_pending"
                      />
                      <button
                        type="button"
                        onClick={() => removeInputContext(index)}
                        className="rounded-full border border-rose-100 px-3 py-1 text-xs font-semibold text-rose-500 transition hover:border-rose-200 hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
                  No input contexts required. Add one to require a context before this intent can trigger.
                </p>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={labelClass}>Output Contexts</span>
                <button
                  type="button"
                  onClick={addOutputContext}
                  className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-100"
                >
                  + Add
                </button>
              </div>
              {outputContexts.length ? (
                <div className="space-y-2">
                  {outputContexts.map((ctx, index) => (
                    <div key={index} className="space-y-3 rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-sm">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={ctx.name}
                          onChange={(event) => updateOutputContext(index, 'name', event.target.value)}
                          className={`${compactInputClass} flex-1`}
                          placeholder="support_followup"
                        />
                        <button
                          type="button"
                          onClick={() => removeOutputContext(index)}
                          className="rounded-full border border-rose-100 px-3 py-1 text-xs font-semibold text-rose-500 transition hover:border-rose-200 hover:bg-rose-50"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-neutral-600">
                        <span>Lifespan</span>
                        <input
                          type="number"
                          min={0}
                          value={ctx.lifespan}
                          onChange={(event) => updateOutputContext(index, 'lifespan', event.target.value)}
                          className={`${compactInputClass} w-24`}
                        />
                        <span>turns</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-500">
                  No output contexts set. Add one to keep this layer active for a number of turns.
                </p>
              )}
            </div>
          </div>
        </section>

        <section className={`${cardClass} space-y-5`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className={labelClass}>Responses</h3>
              <p className="text-xs text-neutral-500">
                Define what the agent should send after matching this intent. Add multiple responses to cycle through
                variants.
              </p>
            </div>
            <button
              type="button"
              onClick={addResponse}
              className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-100"
            >
              + Add Response
            </button>
          </div>
          <div className="space-y-4">
            {responses.map((response, index) => {
              const responseType = response.response_type ?? 'text';
              const payload = (response.payload || {}) as Record<string, unknown>;
              const apiMethod =
                typeof payload.method === 'string' && payload.method
                  ? payload.method.toUpperCase()
                  : 'POST';
              const apiUrl = ensureString(payload.url, '');
              const apiHeaders = ensureString(payload.headers, '');
              const apiBody = ensureString(payload.body, '');
              const apiAuthType = ensureString(payload.auth_type, 'none');
              const apiAuthToken = ensureString(payload.auth_token, '');
              const apiCurl = ensureString(payload.curl, '');

              return (
                <div key={index} className="space-y-4 rounded-2xl border border-neutral-200 bg-white/85 p-5 shadow-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <span className={labelClass}>Language</span>
                      <select
                        value={response.language}
                        onChange={(event) => handleResponseChange(index, 'language', event.target.value)}
                        className={compactInputClass}
                      >
                        {languages.map((lang) => (
                          <option key={lang} value={lang}>
                            {lang.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-600">
                      <span className={labelClass}>Type</span>
                      <select
                        value={responseType}
                        onChange={(event) => handleResponseChange(index, 'response_type', event.target.value)}
                        className={compactInputClass}
                      >
                        <option value="text">Text</option>
                        <option value="image">Image</option>
                        <option value="api">API</option>
                      </select>
                    </div>
                    {responses.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeResponse(index)}
                        className="ml-auto rounded-full border border-rose-100 px-3 py-1 text-xs font-semibold text-rose-500 transition hover:border-rose-200 hover:bg-rose-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {responseType === 'text' && (
                    <textarea
                      value={response.text ?? ''}
                      onChange={(event) => handleResponseChange(index, 'text', event.target.value)}
                      rows={4}
                      className={`${inputClass} min-h-[140px]`}
                      placeholder="Hi! How can I assist you today?"
                    />
                  )}

                  {responseType === 'image' && (
                    <div className="grid gap-3">
                      <input
                        type="url"
                        value={ensureString(payload.url, '')}
                        onChange={(event) => handleResponsePayloadChange(index, 'url', event.target.value)}
                        className={inputClass}
                        placeholder="https://example.com/image.png"
                      />
                      <input
                        type="text"
                        value={response.text ?? ''}
                        onChange={(event) => handleResponseChange(index, 'text', event.target.value)}
                        className={inputClass}
                        placeholder="Optional caption"
                      />
                    </div>
                  )}

                  {responseType === 'api' && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <select
                          value={apiMethod}
                          onChange={(event) => handleResponsePayloadChange(index, 'method', event.target.value.toUpperCase())}
                          className={compactInputClass}
                        >
                          {SIMPLE_METHODS.map((method) => (
                            <option key={method} value={method}>
                              {method}
                            </option>
                          ))}
                        </select>
                        <input
                          type="url"
                          value={apiUrl}
                          onChange={(event) => handleResponsePayloadChange(index, 'url', event.target.value)}
                          className={`${inputClass} flex-1`}
                          placeholder="https://api.example.com/endpoint"
                        />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                          <span className={labelClass}>Headers (JSON)</span>
                          <textarea
                            value={apiHeaders}
                            onChange={(event) => handleResponsePayloadChange(index, 'headers', event.target.value)}
                            rows={4}
                            className={`${inputClass} font-mono`}
                            placeholder='{"Authorization":"Bearer token"}'
                          />
                        </div>
                        <div className="grid gap-2">
                          <span className={labelClass}>Authentication</span>
                          <select
                            value={apiAuthType}
                            onChange={(event) => handleResponsePayloadChange(index, 'auth_type', event.target.value)}
                            className={compactInputClass}
                          >
                            {AUTH_TYPES.map((type) => (
                              <option key={type} value={type}>
                                {type === 'none' ? 'No auth' : type.toUpperCase()}
                              </option>
                            ))}
                          </select>
                          {apiAuthType !== 'none' && (
                            <input
                              type="text"
                              value={apiAuthToken}
                              onChange={(event) => handleResponsePayloadChange(index, 'auth_token', event.target.value)}
                              className={inputClass}
                              placeholder={
                                apiAuthType === 'bearer'
                                  ? 'Bearer token'
                                  : 'username:password (base64 encoded)'
                              }
                            />
                          )}
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <span className={labelClass}>Body</span>
                        <textarea
                          value={apiBody}
                          onChange={(event) => handleResponsePayloadChange(index, 'body', event.target.value)}
                          rows={5}
                          className={`${inputClass} font-mono`}
                          placeholder='{"message":"How can we help?"}'
                        />
                      </div>

                      <div className="grid gap-2">
                        <span className={labelClass}>Raw cURL (optional)</span>
                        <textarea
                          value={apiCurl}
                          onChange={(event) => handleResponsePayloadChange(index, 'curl', event.target.value)}
                          rows={4}
                          className={`${inputClass} font-mono`}
                          placeholder="curl -X POST https://api.example.com/endpoint"
                        />
                      </div>

                      <div className="grid gap-2">
                        <span className={labelClass}>Success message (optional)</span>
                        <textarea
                          value={response.text ?? ''}
                          onChange={(event) => handleResponseChange(index, 'text', event.target.value)}
                          rows={2}
                          className={inputClass}
                          placeholder="Optional confirmation to show users after the API call succeeds."
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className={`${cardClass} space-y-5`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className={labelClass}>Fulfillment Webhook</h3>
              <p className="text-xs text-neutral-500">
                Trigger downstream services when this intent fires. Requests are sent after response generation.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-700">
              <input
                type="checkbox"
                checked={fulfillmentEnabled}
                onChange={(event) => setFulfillmentEnabled(event.target.checked)}
                className={classNames(
                  'h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:outline-none focus:ring-2 focus:ring-offset-1',
                  checkboxToneClasses.success,
                )}
              />
              <span>Enable webhook</span>
            </label>
          </div>
          {fulfillmentError && (
            <p className="text-xs text-rose-500">{fulfillmentError}</p>
          )}
          <div
            className={classNames(
              'space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50/80 p-5',
              { 'opacity-60 pointer-events-none': !fulfillmentEnabled },
            )}
          >
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={fulfillmentMethod}
                onChange={(event) => setFulfillmentMethod(event.target.value.toUpperCase())}
                className={compactInputClass}
              >
                {SIMPLE_METHODS.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </select>
              <input
                type="url"
                value={fulfillmentUrl}
                onChange={(event) => setFulfillmentUrl(event.target.value)}
                className={`${inputClass} flex-1`}
                placeholder="https://webhook.example.com/fulfill"
              />
              <div className="flex items-center gap-2">
                <span className={labelClass}>Timeout</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={fulfillmentTimeout}
                  onChange={(event) => setFulfillmentTimeout(Number(event.target.value))}
                  className={`${compactInputClass} w-24`}
                />
                <span className="text-xs uppercase tracking-wide text-neutral-500">seconds</span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <span className={labelClass}>Headers (JSON)</span>
                <textarea
                  value={fulfillmentHeaders}
                  onChange={(event) => setFulfillmentHeaders(event.target.value)}
                  rows={4}
                  className={`${inputClass} font-mono`}
                  placeholder='{"Authorization":"Bearer token"}'
                />
              </div>
              <div className="grid gap-2">
                <span className={labelClass}>Store response as</span>
                <input
                  type="text"
                  value={fulfillmentSaveAs}
                  onChange={(event) => setFulfillmentSaveAs(event.target.value)}
                  className={inputClass}
                  placeholder="e.g. session.fulfillment_result"
                />
                <p className="text-xs text-neutral-500">
                  Saved to the session context so follow-up intents can reference the API response.
                </p>
              </div>
            </div>

            <div className="grid gap-2">
              <span className={labelClass}>Payload template</span>
              <div className="flex flex-wrap gap-2">
                {PAYLOAD_PLACEHOLDERS.map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => handleInsertPayloadPlaceholder(token)}
                    className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-100"
                  >
                    {token}
                  </button>
                ))}
              </div>
              <textarea
                value={fulfillmentPayload}
                onChange={(event) => setFulfillmentPayload(event.target.value)}
                rows={6}
                className={`${inputClass} font-mono`}
                placeholder='{"conversation_id":"{{session_id}}","input":"{{user_text}}"}'
              />
              <p className="text-xs text-neutral-500">
                Use placeholders to reference runtime values. Payload is sent as JSON using the method selected above.
              </p>
            </div>
          </div>
        </section>

        <section className={`${cardClass} space-y-5`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className={labelClass}>Logic Branches</h3>
              <p className="text-xs text-neutral-500">
                Evaluate expressions to control routing. Expressions have access to session, context, and payload data.
              </p>
            </div>
            <button
              type="button"
              onClick={addBranch}
              className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-100"
            >
              + Add Branch
            </button>
          </div>
          {branches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-4 text-xs text-neutral-500">
              Add a branch to reroute conversations based on user attributes, API results, or session context values.
            </div>
          ) : (
            <div className="space-y-3">
              {branches.map((branch, index) => (
                <div key={index} className="space-y-4 rounded-2xl border border-neutral-200 bg-white/85 p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-neutral-700">Branch {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeBranch(index)}
                      className="rounded-full border border-rose-100 px-3 py-1 text-xs font-semibold text-rose-500 transition hover:border-rose-200 hover:bg-rose-50"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Quick inserts</span>
                    {LOGIC_SNIPPETS.map((snippet) => (
                      <button
                        key={snippet}
                        type="button"
                        onClick={() => handleInsertLogicSnippet(snippet, index)}
                        className="rounded-full border border-neutral-200 px-3 py-1 text-[11px] font-semibold text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-100"
                      >
                        {snippet}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-2">
                    <label className={labelClass} htmlFor={`branch-expression-${index}`}>
                      Expression (JMESPath)
                    </label>
                    <textarea
                      id={`branch-expression-${index}`}
                      rows={3}
                      value={branch.expression}
                      onChange={(event) => handleBranchChange(index, 'expression', event.target.value)}
                      className={`${inputClass} font-mono`}
                      placeholder="context.session.user.tier == 'vip'"
                    />
                  </div>
                  <div className="grid gap-3 text-xs text-neutral-600 md:grid-cols-2">
                    <div className="grid gap-1">
                      <span className="font-medium">When true</span>
                      <select
                        value={branch.true_intent_id ?? ''}
                        onChange={(event) => handleBranchChange(index, 'true_intent_id', event.target.value)}
                        className={compactInputClass}
                      >
                        <option value="">Stay on current flow</option>
                        {flatIntents.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-1">
                      <span className="font-medium">When false</span>
                      <select
                        value={branch.false_intent_id ?? ''}
                        onChange={(event) => handleBranchChange(index, 'false_intent_id', event.target.value)}
                        className={compactInputClass}
                      >
                        <option value="">Stay on current flow</option>
                        {flatIntents.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </form>
    </Modal>
  );
};

export default IntentFormModal;
