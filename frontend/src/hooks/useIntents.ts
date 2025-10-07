import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import apiClient from '../lib/api';

export interface IntentApiResponse {
  id: number;
  name: string;
  description?: string | null;
  parent_intent_id?: number | null;
  project_id: number;
  children?: { id: number; name: string }[];
  is_active: boolean;
  is_fallback: boolean;
  is_default_welcome: boolean;
  created_at: string;
  updated_at: string;
  training_phrases: TrainingPhrase[];
  responses: IntentResponseData[];
  fulfillment?: FulfillmentDetails | null;
  branches: IntentBranch[];
  fallbacks: FallbackResponse[];
  input_contexts: IntentInputContext[];
  output_contexts: IntentOutputContext[];
}

export interface IntentTreeNode extends Omit<IntentApiResponse, 'children'> {
  children: IntentTreeNode[];
}

export interface IntentBranchInput {
  expression: string;
  true_intent_id?: number | null;
  false_intent_id?: number | null;
}

export interface IntentBranch extends IntentBranchInput {
  id: number;
}

export interface FulfillmentDetails {
  id?: number;
  enabled: boolean;
  url: string | null;
  method: string;
  headers: Record<string, unknown> | null;
  payload_template: Record<string, unknown> | null;
  timeout_seconds: number;
  save_as?: string | null;
}

export interface IntentInputContext {
  id?: number;
  name: string;
}

export interface IntentOutputContext {
  id?: number;
  name: string;
  lifespan_turns: number;
}

export interface Project {
  id: number;
  name: string;
  description?: string | null;
  supported_languages: string[];
  default_language: string;
  confidence_threshold: number;
  fallbacks: FallbackResponse[];
}

type ApiProject = Omit<Project, 'fallbacks'> & { fallbacks?: FallbackResponse[] };

const fallbackSortKey = (fallback: FallbackResponse): [number, string] => [fallback.intent_id ?? -1, fallback.language];

const normalizeProject = (project: ApiProject): Project => ({
  ...project,
  fallbacks: (project.fallbacks ?? [])
    .slice()
    .sort((a, b) => {
      const [intentA, langA] = fallbackSortKey(a);
      const [intentB, langB] = fallbackSortKey(b);
      if (intentA !== intentB) return intentA - intentB;
      return langA.localeCompare(langB);
    }),
});

export interface FallbackMessagePart {
  type: 'text' | 'image' | 'api';
  text?: string | null;
  image_url?: string | null;
  api_status?: number | null;
  api_response?: unknown;
  api_headers?: Record<string, unknown> | null;
}

export interface FallbackResponse {
  project_id: number;
  language: string;
  text: string;
  updated_at: string;
  intent_id: number | null;
  message_parts: FallbackMessagePart[];
}

export interface FallbackPayload {
  language: string;
  text: string;
  intent_id?: number | null;
  message_parts?: FallbackMessagePart[];
}

export interface ProjectCreatePayload {
  name: string;
  description?: string | null;
  supported_languages: string[];
  default_language: string;
  confidence_threshold: number;
}

export type ProjectUpdatePayload = Partial<Omit<ProjectCreatePayload, 'name'>> & {
  name?: string;
};

export const useProjects = () =>
  useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiProject[]>('/projects');
      return data.map(normalizeProject);
    },
  });

export const useProjectMutations = () => {
  const queryClient = useQueryClient();

  const createProject = useMutation({
    mutationFn: async (payload: ProjectCreatePayload) => {
      const { data } = await apiClient.post<ApiProject>('/projects', payload);
      return normalizeProject(data);
    },
    onSuccess: (project) => {
      queryClient.setQueryData<Project[]>(['projects'], (existing) => {
        if (!existing) return [project];
        if (existing.some((item) => item.id === project.id)) return existing;
        return [...existing, project];
      });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const updateProject = useMutation({
    mutationFn: async ({
      projectId,
      payload,
    }: {
      projectId: number;
      payload: ProjectUpdatePayload;
    }) => {
      const { data } = await apiClient.patch<ApiProject>(
        `/projects/${projectId}`,
        payload,
      );
      return normalizeProject(data);
    },
    onSuccess: (project, { projectId }) => {
      queryClient.setQueryData<Project[]>(['projects'], (existing) => {
        if (!existing) return existing;
        return existing.map((item) => (item.id === project.id ? project : item));
      });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'intents'] });
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (projectId: number) => {
      await apiClient.delete(`/projects/${projectId}`);
    },
    onSuccess: (_, projectId) => {
      queryClient.setQueryData<Project[]>(['projects'], (existing) => {
        if (!existing) return existing;
        return existing.filter((project) => project.id !== projectId);
      });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  return {
    createProject,
    updateProject,
    deleteProject,
  };
};

export const useIntents = (projectId?: number, enabled = true) =>
  useQuery<IntentApiResponse[]>({
    queryKey: ['projects', projectId, 'intents'],
    queryFn: async () => {
      if (!projectId) return [];
      const { data } = await apiClient.get<IntentApiResponse[]>(`/projects/${projectId}/intents`);
      return data;
    },
    enabled: enabled && Boolean(projectId),
  });

export interface TrainingPhraseInput {
  language: string;
  text: string;
}

export interface TrainingPhrase extends TrainingPhraseInput {
  id?: number;
}

export interface IntentResponseInput {
  language: string;
  text?: string | null;
  response_type?: 'text' | 'image' | 'api';
  payload?: Record<string, unknown> | null;
  is_rich_content?: boolean;
}

export interface IntentResponseData extends IntentResponseInput {
  id?: number;
}

export interface ChatMessagePart {
  type: 'text' | 'image' | 'api';
  text?: string | null;
  image_url?: string | null;
  api_status?: number | null;
  api_response?: unknown;
  api_headers?: Record<string, unknown> | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'bot' | 'system';
  text?: string;
  parts?: ChatMessagePart[];
  timestamp: string;
  language: string;
  intent_id?: number | null;
  confidence?: number;
  is_fallback?: boolean;
}

export interface ChatResponsePayload {
  type: 'text' | 'image' | 'api';
  text?: string | null;
  image_url?: string | null;
  api_status?: number | null;
  api_response?: unknown;
  api_headers?: Record<string, unknown> | null;
}

export interface ChatResponse {
  project_id: number;
  intent_id: number | null;
  response: string | null;
  responses: ChatResponsePayload[];
  language: string;
  confidence: number;
  is_fallback: boolean;
  timestamp: string;
}

export interface IntentPayload {
  name: string;
  description?: string | null;
  is_active: boolean;
  is_fallback: boolean;
  is_default_welcome: boolean;
  parent_intent_id?: number | null;
  training_phrases: TrainingPhraseInput[];
  responses: IntentResponseInput[];
  fulfillment?: FulfillmentDetails | null;
  branches?: IntentBranchInput[];
  fallbacks?: FallbackPayload[];
  input_contexts?: IntentInputContext[];
  output_contexts?: IntentOutputContext[];
}

export type IntentUpdatePayload = Partial<IntentPayload> & {
  training_phrases?: TrainingPhraseInput[];
  responses?: IntentResponseInput[];
};

export const useIntentMutations = (projectId?: number) => {
  const queryClient = useQueryClient();

  const invalidate = () => {
    if (!projectId) return;
    queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'intents'] });
  };

  const createIntent = useMutation({
    mutationFn: async (payload: IntentPayload) => {
      if (!projectId) throw new Error('projectId is required');
      const { data } = await apiClient.post<IntentApiResponse>(
        `/projects/${projectId}/intents`,
        payload,
      );
      return data;
    },
    onSuccess: invalidate,
  });

  const updateIntent = useMutation({
    mutationFn: async ({ intentId, payload }: { intentId: number; payload: IntentUpdatePayload }) => {
      if (!projectId) throw new Error('projectId is required');
      const { data } = await apiClient.put<IntentApiResponse>(
        `/projects/${projectId}/intents/${intentId}`,
        payload,
      );
      return data;
    },
    onSuccess: invalidate,
  });

  const deleteIntent = useMutation({
    mutationFn: async (intentId: number) => {
      if (!projectId) throw new Error('projectId is required');
      await apiClient.delete(`/projects/${projectId}/intents/${intentId}`);
    },
    onSuccess: invalidate,
  });

  return {
    createIntent,
    updateIntent,
    deleteIntent,
  };
};

export const useFallbackMutations = (projectId?: number) => {
  const queryClient = useQueryClient();

  const upsertFallback = useMutation({
    mutationFn: async (payload: FallbackPayload) => {
      if (!projectId) throw new Error('projectId is required');
      const { data } = await apiClient.put<FallbackResponse>(
        `/projects/${projectId}/fallback`,
        payload,
      );
      return data;
    },
    onSuccess: (fallback) => {
      if (!projectId) return;
      queryClient.setQueryData<Project[]>(['projects'], (existing) => {
        if (!existing) return existing;
        return existing.map((project) => {
          if (project.id !== projectId) return project;
          const remaining = project.fallbacks.filter(
            (item) =>
              !(
                item.language === fallback.language &&
                (item.intent_id ?? null) === (fallback.intent_id ?? null)
              ),
          );
          return {
            ...project,
            fallbacks: [...remaining, fallback].sort((a, b) => {
              const [intentA, langA] = fallbackSortKey(a);
              const [intentB, langB] = fallbackSortKey(b);
              if (intentA !== intentB) return intentA - intentB;
              return langA.localeCompare(langB);
            }),
          };
        });
      });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'intents'] });
    },
  });

  return { upsertFallback };
};

export const useIntentTree = (intents?: IntentApiResponse[]) =>
  useMemo(() => {
    if (!intents) return [] as IntentTreeNode[];
    const map = new Map<number, IntentTreeNode>();
    const roots: IntentTreeNode[] = [];

    intents.forEach((intent) => {
      const normalized: IntentTreeNode = {
        ...intent,
        children: [],
      };
      map.set(intent.id, normalized);
    });

    map.forEach((intent) => {
      if (intent.parent_intent_id && map.has(intent.parent_intent_id)) {
        const parent = map.get(intent.parent_intent_id);
        parent?.children?.push(intent);
      } else {
        roots.push(intent);
      }
    });

    const sortNodes = (nodes: IntentTreeNode[]) =>
      [...nodes].sort((a, b) => a.name.localeCompare(b.name));

    const sortTree = (nodes: IntentTreeNode[]): IntentTreeNode[] =>
      sortNodes(nodes).map((node) => ({
        ...node,
        children: node.children ? sortTree(node.children) : [],
      }));

    return sortTree(roots);
  }, [intents]);

export const useChat = (projectId?: number, initialLanguage?: string | null) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string>(generateSessionId());
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(initialLanguage ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMessages([]);
    setError(null);
    setSessionId(generateSessionId());
    setSelectedLanguage(initialLanguage ?? null);
  }, [projectId, initialLanguage]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!projectId) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      const userMessage: ChatMessage = {
        id: createId(),
        role: 'user',
        text: trimmed,
        timestamp: new Date().toISOString(),
        language: selectedLanguage ?? 'auto',
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);
      try {
        const { data } = await apiClient.post<ChatResponse>(
          `/projects/${projectId}/chat`,
          {
            message: trimmed,
            language: selectedLanguage ?? undefined,
            session_id: sessionId,
          },
        );
        const parts: ChatMessagePart[] = (data.responses ?? []).map((part) => ({
          type: part.type,
          text: part.text ?? undefined,
          image_url: part.image_url ?? undefined,
          api_status: part.api_status ?? undefined,
          api_response: part.api_response,
          api_headers: part.api_headers ?? undefined,
        }));
        const botMessage: ChatMessage = {
          id: createId(),
          role: data.intent_id ? 'bot' : 'system',
          text: data.response ?? undefined,
          parts,
          timestamp: data.timestamp,
          language: data.language,
          intent_id: data.intent_id,
          confidence: data.confidence,
          is_fallback: data.is_fallback,
        };
        setMessages((prev) => [...prev, botMessage]);
      } catch (err: unknown) {
        const fallbackMessage: ChatMessage = {
          id: createId(),
          role: 'system',
          text: 'Failed to reach chatbot API. Check logs for details.',
          parts: [
            {
              type: 'text',
              text: 'Failed to reach chatbot API. Check logs for details.',
            },
          ],
          timestamp: new Date().toISOString(),
          language: selectedLanguage ?? 'en',
        };
        setMessages((prev) => [...prev, fallbackMessage]);
        if (err instanceof Error) {
          setError(err.message);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [projectId, sessionId, selectedLanguage],
  );

  const resetSession = useCallback(() => {
    setMessages([]);
    setError(null);
    setSessionId(generateSessionId());
  }, []);

  const updateLanguage = useCallback((value: string | null) => {
    setSelectedLanguage(value);
  }, []);

  return {
    messages,
    sendMessage,
    resetSession,
    updateLanguage,
    selectedLanguage,
    isLoading,
    error,
  };
};

function generateSessionId() {
  return createId();
}

function createId() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}
