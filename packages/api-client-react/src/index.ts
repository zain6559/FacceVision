/**
 * FaceVision - React Query API Client
 * 
 * Generated React Query hooks for the Face Recognition API.
 */

import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Person {
  id: number;
  name: string;
  nameAr?: string;
  source?: string;
  createdAt: Date;
  faceCount?: number;
}

export interface ListPersonsResponse {
  data: Person[];
  total: number;
  page: number;
  limit: number;
}

export interface StatsOverview {
  totalIdentities: number;
  totalFaces: number;
  totalRecognitions: number;
  avgConfidence: number;
  avgProcessingTime: number;
  recognitionRate: number;
}

export interface AccuracyMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  confusionMatrix?: number[][];
}

export interface DatabaseGrowth {
  date: string;
  identities: number;
  faces: number;
}

export interface RecognitionLog {
  id: number;
  imageUrl: string;
  resultCount: number;
  avgConfidence: number;
  processingTime: number;
  createdAt: Date;
}

export interface LearningStatus {
  status: 'idle' | 'running' | 'completed' | 'failed';
  progress: number;
  currentEpoch?: number;
  totalEpochs?: number;
  loss?: number;
  accuracy?: number;
}

export interface LearningRun {
  id: number;
  name: string;
  status: string;
  startedAt: Date;
  completedAt?: Date;
  metrics?: {
    accuracy: number;
    loss: number;
  };
}

// ─── API Client ────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  
  return response.json();
}

// ─── Query Keys ────────────────────────────────────────────────────────────────

export const getListPersonsQueryKey = (params?: { page?: number; limit?: number; search?: string }) => 
  ['persons', params] as const;

export const getStatsOverviewQueryKey = () => ['stats', 'overview'] as const;
export const getAccuracyMetricsQueryKey = () => ['stats', 'accuracy'] as const;
export const getDatabaseGrowthQueryKey = () => ['stats', 'growth'] as const;
export const listRecognitionLogsQueryKey = (params?: { page?: number; limit?: number }) => 
  ['recognition-logs', params] as const;
export const getLearningStatusQueryKey = () => ['learning', 'status'] as const;
export const listLearningRunsQueryKey = (params?: { page?: number; limit?: number }) => 
  ['learning', 'runs', params] as const;

// ─── Query Hooks ───────────────────────────────────────────────────────────────

export function useListPersons(
  params?: { page?: number; limit?: number; search?: string },
  options?: { query?: { queryKey?: readonly unknown[] } }
) {
  return useQuery({
    queryKey: options?.query?.queryKey || getListPersonsQueryKey(params),
    queryFn: () => fetchApi<ListPersonsResponse>('/persons', {
      searchParams: params,
    }),
  });
}

export function useGetStatsOverview() {
  return useQuery({
    queryKey: getStatsOverviewQueryKey(),
    queryFn: () => fetchApi<StatsOverview>('/stats/overview'),
    refetchInterval: 30000,
  });
}

export function useGetAccuracyMetrics() {
  return useQuery({
    queryKey: getAccuracyMetricsQueryKey(),
    queryFn: () => fetchApi<AccuracyMetrics>('/stats/accuracy'),
  });
}

export function useGetDatabaseGrowth() {
  return useQuery({
    queryKey: getDatabaseGrowthQueryKey(),
    queryFn: () => fetchApi<DatabaseGrowth[]>('/stats/growth'),
  });
}

export function useListRecognitionLogs(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: listRecognitionLogsQueryKey(params),
    queryFn: () => fetchApi<{ data: RecognitionLog[]; total: number }>('/stats/recognition-logs', {
      searchParams: params,
    }),
  });
}

export function useGetLearningStatus() {
  return useQuery({
    queryKey: getLearningStatusQueryKey(),
    queryFn: () => fetchApi<LearningStatus>('/learning/status'),
    refetchInterval: 5000,
  });
}

export function useListLearningRuns(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: listLearningRunsQueryKey(params),
    queryFn: () => fetchApi<{ data: LearningRun[]; total: number }>('/learning/runs', {
      searchParams: params,
    }),
  });
}

// ─── Mutation Hooks ────────────────────────────────────────────────────────────

export function useEnrollPerson() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { name: string; nameAr?: string; source?: string }) => 
      fetchApi<Person>('/persons', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
    },
  });
}

export function useDeletePerson() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: number) => 
      fetchApi<void>(`/persons/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
    },
  });
}

export function useTriggerLearning() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (config?: { dataset?: string; epochs?: number }) => 
      fetchApi<LearningStatus>('/learning/trigger', {
        method: 'POST',
        body: JSON.stringify(config || {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning'] });
    },
  });
}

export function useStopLearning() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => 
      fetchApi<void>('/learning/stop', {
        method: 'POST',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['learning'] });
    },
  });
}

// ─── Query Client Export ───────────────────────────────────────────────────────

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export type {
  Person,
  ListPersonsResponse,
  StatsOverview,
  AccuracyMetrics,
  DatabaseGrowth,
  RecognitionLog,
  LearningStatus,
  LearningRun,
};
