/**
 * FaceVision — State Management Store
 * 
 * Segregated state management for different concerns:
 * - UI State: Component-level state
 * - Server State: Data from API (React Query)
 * - Recognition State: Active recognition sessions
 * - Session State: User session data
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── User & Auth State ─────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'DEVELOPER' | 'VIEWER' | 'OPERATOR';
  tenantId: string;
  permissions: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),
      logout: () => set({ user: null, token: null, isAuthenticated: false }),
    }),
    { name: 'auth-storage' }
  )
);

// ─── UI State ──────────────────────────────────────────────────────────────────

interface UIState {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'ar';
  notifications: Notification[];
  activeModal: string | null;
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setLanguage: (lang: 'en' | 'ar') => void;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  setActiveModal: (modal: string | null) => void;
}

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  theme: 'dark',
  language: 'en',
  notifications: [],
  activeModal: null,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        {
          ...notification,
          id: crypto.randomUUID(),
          timestamp: new Date(),
          read: false,
        },
      ],
    })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  setActiveModal: (modal) => set({ activeModal: modal }),
}));

// ─── Recognition Session State ─────────────────────────────────────────────────

interface RecognitionSession {
  id: string;
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';
  imageUrl: string | null;
  results: RecognitionResult[];
  startedAt: Date | null;
  completedAt: Date | null;
  progress: number;
  error: string | null;
}

interface RecognitionResult {
  id: string;
  identityId: number;
  name: string;
  confidence: number;
  decision: string;
  thumbnail?: string;
  source?: string;
}

interface RecognitionState {
  currentSession: RecognitionSession | null;
  history: RecognitionSession[];
  setCurrentSession: (session: RecognitionSession | null) => void;
  updateSession: (updates: Partial<RecognitionSession>) => void;
  addToHistory: (session: RecognitionSession) => void;
  clearHistory: () => void;
}

const initialSession: RecognitionSession = {
  id: '',
  status: 'idle',
  imageUrl: null,
  results: [],
  startedAt: null,
  completedAt: null,
  progress: 0,
  error: null,
};

export const useRecognitionStore = create<RecognitionState>((set) => ({
  currentSession: null,
  history: [],
  setCurrentSession: (session) => set({ currentSession: session }),
  updateSession: (updates) =>
    set((state) => ({
      currentSession: state.currentSession
        ? { ...state.currentSession, ...updates }
        : null,
    })),
  addToHistory: (session) =>
    set((state) => ({
      history: [session, ...state.history].slice(0, 50), // Keep last 50
    })),
  clearHistory: () => set({ history: [] }),
}));

// ─── Project & Collection State ────────────────────────────────────────────────

interface Project {
  id: number;
  name: string;
  description?: string;
  status: 'active' | 'archived';
  collectionCount: number;
  identityCount: number;
  createdAt: Date;
}

interface Collection {
  id: number;
  projectId: number;
  name: string;
  description?: string;
  identityCount: number;
  createdAt: Date;
}

interface ProjectState {
  activeProject: Project | null;
  projects: Project[];
  collections: Collection[];
  setActiveProject: (project: Project | null) => void;
  setProjects: (projects: Project[]) => void;
  setCollections: (collections: Collection[]) => void;
  addProject: (project: Project) => void;
  addCollection: (collection: Collection) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  activeProject: null,
  projects: [],
  collections: [],
  setActiveProject: (project) => set({ activeProject: project }),
  setProjects: (projects) => set({ projects }),
  setCollections: (collections) => set({ collections }),
  addProject: (project) =>
    set((state) => ({ projects: [...state.projects, project] })),
  addCollection: (collection) =>
    set((state) => ({ collections: [...state.collections, collection] })),
}));

// ─── Stats & Metrics State ─────────────────────────────────────────────────────

interface SystemStats {
  totalIdentities: number;
  totalFaces: number;
  totalRecognitions: number;
  avgConfidence: number;
  avgProcessingTime: number;
  recognitionRate: number;
  lastUpdated: Date;
}

interface ChartData {
  labels: string[];
  values: number[];
}

interface StatsState {
  systemStats: SystemStats | null;
  recognitionTimeline: ChartData;
  confidenceHistogram: ChartData;
  latencyChart: ChartData;
  setSystemStats: (stats: SystemStats) => void;
  setRecognitionTimeline: (data: ChartData) => void;
  setConfidenceHistogram: (data: ChartData) => void;
  setLatencyChart: (data: ChartData) => void;
}

export const useStatsStore = create<StatsState>((set) => ({
  systemStats: null,
  recognitionTimeline: { labels: [], values: [] },
  confidenceHistogram: { labels: [], values: [] },
  latencyChart: { labels: [], values: [] },
  setSystemStats: (stats) => set({ systemStats: stats }),
  setRecognitionTimeline: (data) => set({ recognitionTimeline: data }),
  setConfidenceHistogram: (data) => set({ confidenceHistogram: data }),
  setLatencyChart: (data) => set({ latencyChart: data }),
}));

// ─── Navigation State ──────────────────────────────────────────────────────────

type Persona = 'ADMIN' | 'ANALYST' | 'OPERATOR' | 'DEVELOPER';

interface NavigationState {
  currentPersona: Persona;
  quickActions: QuickAction[];
  pinnedProjects: number[];
  setPersona: (persona: Persona) => void;
  addQuickAction: (action: QuickAction) => void;
  removeQuickAction: (id: string) => void;
  togglePinnedProject: (projectId: number) => void;
}

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  shortcut?: string;
  category: 'recognition' | 'project' | 'admin' | 'stats';
}

export const useNavigationStore = create<NavigationState>()(
  persist(
    (set) => ({
      currentPersona: 'DEVELOPER',
      quickActions: [
        {
          id: 'quick-recognition',
          label: 'Quick Recognition',
          icon: 'scan',
          action: () => {},
          shortcut: 'R',
          category: 'recognition',
        },
        {
          id: 'new-project',
          label: 'New Project',
          icon: 'plus',
          action: () => {},
          category: 'project',
        },
      ],
      pinnedProjects: [],
      setPersona: (persona) => set({ currentPersona: persona }),
      addQuickAction: (action) =>
        set((state) => ({ quickActions: [...state.quickActions, action] })),
      removeQuickAction: (id) =>
        set((state) => ({
          quickActions: state.quickActions.filter((a) => a.id !== id),
        })),
      togglePinnedProject: (projectId) =>
        set((state) => ({
          pinnedProjects: state.pinnedProjects.includes(projectId)
            ? state.pinnedProjects.filter((id) => id !== projectId)
            : [...state.pinnedProjects, projectId],
        })),
    }),
    { name: 'navigation-storage' }
  )
);

// ─── Filters & Preferences State ───────────────────────────────────────────────

interface FiltersState {
  searchQuery: string;
  dateRange: { start: Date | null; end: Date | null };
  qualityThreshold: number;
  showOnlyVerified: boolean;
  showOnlyNeedsReview: boolean;
  setSearchQuery: (query: string) => void;
  setDateRange: (range: { start: Date | null; end: Date | null }) => void;
  setQualityThreshold: (threshold: number) => void;
  setShowOnlyVerified: (show: boolean) => void;
  setShowOnlyNeedsReview: (show: boolean) => void;
  resetFilters: () => void;
}

const initialFilters = {
  searchQuery: '',
  dateRange: { start: null as Date | null, end: null as Date | null },
  qualityThreshold: 0,
  showOnlyVerified: false,
  showOnlyNeedsReview: false,
};

export const useFiltersStore = create<FiltersState>((set) => ({
  ...initialFilters,
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setDateRange: (dateRange) => set({ dateRange }),
  setQualityThreshold: (qualityThreshold) => set({ qualityThreshold }),
  setShowOnlyVerified: (showOnlyVerified) => set({ showOnlyVerified }),
  setShowOnlyNeedsReview: (showOnlyNeedsReview) => set({ showOnlyNeedsReview }),
  resetFilters: () => set(initialFilters),
}));
