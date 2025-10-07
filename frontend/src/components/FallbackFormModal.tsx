import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import { FallbackMessagePart, FallbackPayload, FallbackResponse } from '../hooks/useIntents';

interface FallbackFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: FallbackPayload) => Promise<void> | void;
  submitting?: boolean;
  fallback?: FallbackResponse | null;
  supportedLanguages: string[];
  fallbacks: FallbackResponse[];
  initialLanguage?: string | null;
  intentName?: string;
  intentId?: number | null;
}

type FallbackPartFormState = {
  id: string;
  type: 'text' | 'image' | 'api';
  text: string;
  imageUrl: string;
  apiStatus: string;
  apiResponse: string;
  apiHeaders: string;
};

const createPartId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

const FallbackFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  submitting,
  fallback,
  supportedLanguages,
  fallbacks,
  initialLanguage,
  intentName,
  intentId,
}: FallbackFormModalProps) => {
  const labelClass = 'text-xs font-semibold uppercase tracking-wide text-neutral-500';
  const inputClass =
    'rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 transition focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10';
  const cardClass = 'rounded-3xl border border-neutral-200 bg-white/85 p-5 shadow-sm';
  const languages = useMemo(() => (supportedLanguages.length ? supportedLanguages : ['en']), [supportedLanguages]);
  const [language, setLanguage] = useState(languages[0] ?? 'en');
  const [text, setText] = useState('');
  const [parts, setParts] = useState<FallbackPartFormState[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const formatStructuredValue = useCallback((value: unknown) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, []);

  const mapFallbackParts = useCallback(
    (target: FallbackResponse | null | undefined) => {
      if (!target?.message_parts?.length) return [];
      return target.message_parts.map((item) => ({
        id: createPartId(),
        type: item.type,
        text: item.text ?? '',
        imageUrl: item.image_url ?? '',
        apiStatus: item.api_status != null ? String(item.api_status) : '',
        apiResponse: formatStructuredValue(item.api_response),
        apiHeaders: item.api_headers ? JSON.stringify(item.api_headers, null, 2) : '',
      }));
    },
    [formatStructuredValue],
  );

  useEffect(() => {
    if (fallback) {
      setLanguage(fallback.language);
      setText(fallback.text);
      setParts(mapFallbackParts(fallback));
    } else if (languages.length) {
      const defaultLang = initialLanguage && languages.includes(initialLanguage)
        ? initialLanguage
        : languages[0];
      setLanguage(defaultLang);
      const existing = fallbacks.find((item) => item.language === defaultLang);
      setText(existing?.text ?? '');
      setParts(mapFallbackParts(existing));
    } else {
      setParts([]);
    }
    setFormError(null);
  }, [fallback, fallbacks, initialLanguage, languages, isOpen, mapFallbackParts]);

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    const existing = fallbacks.find((item) => item.language === value);
    setText(existing?.text ?? '');
    setParts(mapFallbackParts(existing));
    setFormError(null);
  };

  const handleAddPart = () => {
    setParts((prev) => [
      ...prev,
      {
        id: createPartId(),
        type: 'image',
        text: '',
        imageUrl: '',
        apiStatus: '',
        apiResponse: '',
        apiHeaders: '',
      },
    ]);
  };

  const handleRemovePart = (id: string) => {
    setParts((prev) => prev.filter((part) => part.id !== id));
  };

  const handlePartTypeChange = (id: string, type: FallbackPartFormState['type']) => {
    setParts((prev) =>
      prev.map((part) =>
        part.id === id
          ? {
              id: part.id,
              type,
              text: '',
              imageUrl: '',
              apiStatus: '',
              apiResponse: '',
              apiHeaders: '',
            }
          : part,
      ),
    );
  };

  const handlePartUpdate = (id: string, updates: Partial<FallbackPartFormState>) => {
    setParts((prev) =>
      prev.map((part) => (part.id === id ? { ...part, ...updates } : part)),
    );
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const trimmed = text.trim();
    if (!trimmed) {
      setText('');
      setFormError('Fallback text is required.');
      return;
    }
    const preparedParts: FallbackMessagePart[] = [];
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];
      const sequenceLabel = `Response part ${index + 1}`;
      if (part.type === 'text') {
        const value = part.text.trim();
        if (!value) {
          setFormError(`${sequenceLabel} requires text.`);
          return;
        }
        preparedParts.push({ type: 'text', text: value });
        continue;
      }
      if (part.type === 'image') {
        const url = part.imageUrl.trim();
        if (!url) {
          setFormError(`${sequenceLabel} requires an image URL.`);
          return;
        }
        const payload: FallbackMessagePart = {
          type: 'image',
          image_url: url,
        };
        const caption = part.text.trim();
        if (caption) {
          payload.text = caption;
        }
        preparedParts.push(payload);
        continue;
      }
      const apiPayload: FallbackMessagePart = {
        type: 'api',
      };
      const statusRaw = part.apiStatus.trim();
      if (statusRaw) {
        const parsedStatus = Number(statusRaw);
        if (!Number.isInteger(parsedStatus) || parsedStatus < 100 || parsedStatus > 599) {
          setFormError(`${sequenceLabel} status code must be between 100 and 599.`);
          return;
        }
        apiPayload.api_status = parsedStatus;
      }
      const responseRaw = part.apiResponse.trim();
      if (!responseRaw) {
        setFormError(`${sequenceLabel} requires an API response payload.`);
        return;
      }
      if (responseRaw.startsWith('{') || responseRaw.startsWith('[')) {
        try {
          apiPayload.api_response = JSON.parse(responseRaw);
        } catch {
          apiPayload.api_response = responseRaw;
        }
      } else {
        apiPayload.api_response = responseRaw;
      }
      const headersRaw = part.apiHeaders.trim();
      if (headersRaw) {
        try {
          const parsedHeaders = JSON.parse(headersRaw);
          if (
            typeof parsedHeaders !== 'object' ||
            parsedHeaders === null ||
            Array.isArray(parsedHeaders)
          ) {
            throw new Error('Headers must be a JSON object');
          }
          apiPayload.api_headers = parsedHeaders as Record<string, unknown>;
        } catch {
          setFormError(`${sequenceLabel} headers must be valid JSON object syntax.`);
          return;
        }
      }
      const caption = part.text.trim();
      if (caption) {
        apiPayload.text = caption;
      }
      preparedParts.push(apiPayload);
    }
    onSubmit({
      language,
      text: trimmed,
      intent_id: intentId ?? null,
      message_parts: preparedParts,
    });
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
        form="fallback-form"
        disabled={submitting}
        className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400"
      >
        Save Fallback
      </button>
    </>
  );

  return (
    <Modal
      title="Fallback Response"
      description={intentName
        ? `Configure the fallback message shown when users get stuck within “${intentName}”.`
        : 'Set the default reply used when no intent reaches the confidence threshold.'}
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      footer={footer}
    >
      <form id="fallback-form" onSubmit={handleSubmit} className="space-y-6">
        <section className={`${cardClass} space-y-3`}>
          <div className="text-xs text-neutral-500">
            Scope: {intentName ? `Layer – ${intentName}` : 'Global bot fallback'}
          </div>
          <div className="grid gap-2">
            <label className={labelClass} htmlFor="fallback-language">
              Language
            </label>
            <select
              id="fallback-language"
              value={language}
              onChange={(event) => handleLanguageChange(event.target.value)}
              className={inputClass}
            >
              {languages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label className={labelClass} htmlFor="fallback-text">
              Response Text
            </label>
            <textarea
              id="fallback-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={4}
              placeholder="Sorry, I didn't catch that. Could you rephrase?"
              className={inputClass}
              required
            />
          </div>
        </section>

        <section className={`${cardClass} space-y-4`}>
          <div className="flex items-center justify-between">
            <div className={labelClass}>Additional Responses</div>
            <button
              type="button"
              onClick={handleAddPart}
              className="rounded-full border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-100"
            >
              + Add Response Part
            </button>
          </div>
          {parts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-4 text-xs text-neutral-500">
              No rich responses configured. Add additional text, image, or custom API payloads to send alongside the fallback message.
            </div>
          ) : (
            <div className="space-y-3">
              {parts.map((part, index) => (
                <div key={part.id} className="space-y-3 rounded-2xl border border-neutral-200 bg-white/85 p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className={labelClass}>Response part {index + 1}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePart(part.id)}
                      className="rounded-full border border-rose-100 px-3 py-1 text-xs font-semibold text-rose-500 transition hover:border-rose-200 hover:bg-rose-50"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="grid gap-2">
                    <label className={labelClass}>Type</label>
                    <select
                      value={part.type}
                      onChange={(event) => handlePartTypeChange(part.id, event.target.value as FallbackPartFormState['type'])}
                      className={inputClass}
                    >
                      <option value="text">Text</option>
                      <option value="image">Image</option>
                      <option value="api">Custom API</option>
                    </select>
                  </div>

                  {part.type === 'text' && (
                    <div className="grid gap-2">
                      <label className={labelClass}>Text Message</label>
                      <textarea
                        value={part.text}
                        onChange={(event) => handlePartUpdate(part.id, { text: event.target.value })}
                        rows={3}
                        placeholder="Additional guidance for the user"
                        className={inputClass}
                      />
                    </div>
                  )}

                  {part.type === 'image' && (
                    <div className="space-y-3">
                      <div className="grid gap-2">
                        <label className={labelClass}>Image URL</label>
                        <input
                          type="url"
                          value={part.imageUrl}
                          onChange={(event) => handlePartUpdate(part.id, { imageUrl: event.target.value })}
                          placeholder="https://example.com/fallback.png"
                          className={inputClass}
                        />
                      </div>
                      <div className="grid gap-2">
                        <label className={labelClass}>Caption (optional)</label>
                        <textarea
                          value={part.text}
                          onChange={(event) => handlePartUpdate(part.id, { text: event.target.value })}
                          rows={2}
                          placeholder="Need more help? Visit our support center."
                          className={inputClass}
                        />
                      </div>
                    </div>
                  )}

                  {part.type === 'api' && (
                    <div className="space-y-3">
                      <div className="grid gap-2">
                        <label className={labelClass}>Status Code (optional)</label>
                        <input
                          type="number"
                          min={100}
                          max={599}
                          value={part.apiStatus}
                          onChange={(event) => handlePartUpdate(part.id, { apiStatus: event.target.value })}
                          placeholder="200"
                          className={`${inputClass} w-32`}
                        />
                      </div>
                      <div className="grid gap-2">
                        <label className={labelClass}>API Response</label>
                        <textarea
                          value={part.apiResponse}
                          onChange={(event) => handlePartUpdate(part.id, { apiResponse: event.target.value })}
                          rows={4}
                          placeholder='{"message":"We will connect you with an agent."}'
                          className={`${inputClass} font-mono`}
                        />
                        <p className="text-xs text-neutral-400">
                          Accepts JSON or plain text payloads returned to the client.
                        </p>
                      </div>
                      <div className="grid gap-2">
                        <label className={labelClass}>Headers (JSON, optional)</label>
                        <textarea
                          value={part.apiHeaders}
                          onChange={(event) => handlePartUpdate(part.id, { apiHeaders: event.target.value })}
                          rows={3}
                          placeholder='{"Content-Type":"application/json"}'
                          className={`${inputClass} font-mono`}
                        />
                      </div>
                      <div className="grid gap-2">
                        <label className={labelClass}>Message (optional)</label>
                        <textarea
                          value={part.text}
                          onChange={(event) => handlePartUpdate(part.id, { text: event.target.value })}
                          rows={2}
                          placeholder="Sharing information from our API…"
                          className={inputClass}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {formError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {formError}
          </div>
        )}
      </form>

    </Modal>
  );
};

export default FallbackFormModal;
