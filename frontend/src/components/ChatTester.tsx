import { FC, FormEvent, useEffect, useMemo, useRef } from 'react';
import classNames from 'classnames';
import { ChatMessage } from '../hooks/useIntents';

interface ChatTesterProps {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  isLoading: boolean;
  error?: string | null;
  onReset: () => void;
  supportedLanguages: string[];
  selectedLanguage?: string | null;
  onLanguageChange?: (value: string | null) => void;
}

const ChatTester: FC<ChatTesterProps> = ({
  messages,
  onSend,
  isLoading,
  error,
  onReset,
  supportedLanguages,
  selectedLanguage,
  onLanguageChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const languages = useMemo(() => (supportedLanguages.length ? supportedLanguages : ['en']), [supportedLanguages]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const value = inputRef.current?.value ?? '';
    if (!value.trim()) return;
    onSend(value);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[26px] border border-neutral-200/80 bg-white/95 shadow-xl backdrop-blur">
      <div className="flex items-center justify-between border-b border-neutral-200/80 bg-gradient-to-r from-white via-neutral-50 to-neutral-100 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Chat Tester</p>
          <p className="text-xs text-neutral-500">Experiment and inspect responses in real time.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedLanguage ?? 'auto'}
            onChange={(event) => onLanguageChange?.(event.target.value === 'auto' ? null : event.target.value)}
            className="rounded-full border border-neutral-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 shadow-sm transition focus:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
          >
            <option value="auto">Auto detect</option>
            {languages.map((lang) => (
              <option value={lang} key={lang}>
                {lang.toUpperCase()}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-neutral-200/80 px-3 py-1.5 text-xs font-semibold text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
          >
            Reset Session
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-neutral-50/80 px-5 py-5">
        <div className="space-y-4">
          {messages.length === 0 && (
            <p className="text-sm text-neutral-500">
              Start by typing a message below to explore how the bot responds.
            </p>
          )}
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-500 shadow-sm">
                <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-300" />
                Bot is typing…
              </div>
            </div>
          )}
          <div ref={scrollAnchorRef} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="border-t border-neutral-200/80 bg-white/90 px-5 py-4">
        {error && <p className="mb-2 text-xs text-rose-500">{error}</p>}
        <div className="flex items-center gap-3 rounded-full border border-neutral-200/80 bg-white px-3 py-2 shadow-sm focus-within:border-neutral-400 focus-within:ring-2 focus-within:ring-neutral-900/10">
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a message…"
            className="flex-1 border-none bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800 disabled:bg-neutral-400 disabled:shadow-none"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

const MessageBubble: FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const timestamp = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const avatarLabel = isUser ? 'You' : isSystem ? 'Sys' : 'Bot';

  return (
    <div className={classNames('flex w-full', { 'justify-end': isUser, 'justify-start': !isUser })}>
      <div
        className={classNames('flex max-w-[85%] items-end gap-3', {
          'flex-row-reverse text-right': isUser,
          'flex-row': !isUser,
        })}
      >
        <div
          aria-hidden
          className={classNames(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold uppercase',
            {
              'bg-neutral-900 text-white': isUser,
              'bg-sky-100 text-sky-600': isSystem,
              'bg-neutral-100 text-neutral-600': !isUser && !isSystem,
            },
          )}
        >
          {avatarLabel.slice(0, 3)}
        </div>
        <div
          className={classNames(
            'relative max-w-full rounded-3xl px-4 py-3 text-sm shadow-sm ring-1 ring-inset',
            {
              'bg-neutral-900 text-white ring-neutral-900/20': isUser,
              'bg-sky-50 text-sky-900 ring-sky-200': isSystem,
              'bg-white text-neutral-700 ring-neutral-200': !isUser && !isSystem,
            },
          )}
        >
          <div
            className={classNames('flex items-center gap-3 text-[11px] uppercase tracking-wide', {
              'justify-end text-white/70': isUser,
              'text-neutral-400': !isUser,
            })}
          >
            <span>{isUser ? 'You' : isSystem ? 'System' : 'Bot'}</span>
            <span>{timestamp}</span>
          </div>

          {message.parts && message.parts.length > 0 ? (
            <div className="mt-2 space-y-3">
              {message.parts.map((part, index) => {
                if (part.type === 'image' && part.image_url) {
                  return (
                    <div key={index} className="space-y-2">
                      {part.text && (
                        <p className={classNames('text-xs', { 'text-white/70': isUser, 'text-neutral-500': !isUser })}>
                          {part.text}
                        </p>
                      )}
                      <img
                        src={part.image_url}
                        alt={part.text ?? 'bot-image'}
                        className="max-h-48 rounded-2xl border border-neutral-200/60 object-cover"
                      />
                    </div>
                  );
                }
                if (part.type === 'api') {
                  return (
                    <div
                      key={index}
                      className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700 shadow-inner"
                    >
                      <div className="flex gap-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                        <span>API Status: {part.api_status ?? 'N/A'}</span>
                      </div>
                      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all">
                        {typeof part.api_response === 'string'
                          ? part.api_response
                          : JSON.stringify(part.api_response, null, 2)}
                      </pre>
                    </div>
                  );
                }
                return (
                  <p key={index} className="whitespace-pre-line">
                    {part.text ?? ''}
                  </p>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 whitespace-pre-line">
              {message.text || (message.is_fallback ? 'Fallback response triggered.' : 'No response text returned.')}
            </p>
          )}

          {!isUser && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-medium text-neutral-400">
              {message.language && <span>Lang: {message.language.toUpperCase()}</span>}
              {typeof message.intent_id === 'number' && <span>Intent: {message.intent_id}</span>}
              {typeof message.confidence === 'number' && <span>Conf: {(message.confidence * 100).toFixed(1)}%</span>}
              {message.is_fallback && <span className="text-amber-600">Fallback</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatTester;
