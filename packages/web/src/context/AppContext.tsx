import { createContext, useContext, useReducer, useCallback, useRef, type ReactNode } from 'react';
import type { PR, PRDetail, PRComment } from '../types/index.ts';
import { api, APIError } from '../lib/api.ts';

// State shape
interface AppState {
  prs: PR[];
  currentPR: PRDetail | null;
  currentDiff: string | null;
  currentComments: PRComment[];
  selectedFile: string | null;
  targetLine: number | null; // Line to scroll to in the editor
  scrollToCommentId: number | null; // Comment ID to scroll to in panel
  filters: {
    state: 'open' | 'closed' | 'all';
    query: string;
    author?: string;
  };
  loading: boolean;
  error: string | null;
}

// Action types
type AppAction =
  | { type: 'SET_PRS'; payload: PR[] }
  | { type: 'SET_CURRENT_PR'; payload: PRDetail | null }
  | { type: 'SET_CURRENT_DIFF'; payload: string | null }
  | { type: 'SET_CURRENT_COMMENTS'; payload: PRComment[] }
  | { type: 'SET_SELECTED_FILE'; payload: string | null }
  | { type: 'SET_TARGET_LINE'; payload: number | null }
  | { type: 'SET_SCROLL_TO_COMMENT'; payload: number | null }
  | { type: 'SET_FILTERS'; payload: Partial<AppState['filters']> }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

// Initial state
const initialState: AppState = {
  prs: [],
  currentPR: null,
  currentDiff: null,
  currentComments: [],
  selectedFile: null,
  targetLine: null,
  scrollToCommentId: null,
  filters: {
    state: 'open',
    query: '',
  },
  loading: false,
  error: null,
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PRS':
      return { ...state, prs: action.payload };
    case 'SET_CURRENT_PR':
      return { ...state, currentPR: action.payload };
    case 'SET_CURRENT_DIFF':
      return { ...state, currentDiff: action.payload };
    case 'SET_CURRENT_COMMENTS':
      return { ...state, currentComments: action.payload };
    case 'SET_SELECTED_FILE':
      return { ...state, selectedFile: action.payload };
    case 'SET_TARGET_LINE':
      return { ...state, targetLine: action.payload };
    case 'SET_SCROLL_TO_COMMENT':
      return { ...state, scrollToCommentId: action.payload };
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

// Context
interface AppContextValue {
  state: AppState;
  fetchPRs: (state?: AppState['filters']['state']) => Promise<void>;
  selectPR: (number: number) => Promise<void>;
  clearPR: () => void;
  setSelectedFile: (path: string | null) => void;
  navigateToFileLine: (path: string, line: number) => void;
  scrollToComment: (commentId: number) => void;
  setFilters: (partial: Partial<AppState['filters']>) => void;
  refreshCurrent: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

// Provider
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  
  // Store AbortController refs for cancellation
  const prListAbortController = useRef<AbortController | null>(null);
  const prDetailAbortController = useRef<AbortController | null>(null);

  const fetchPRs = useCallback(async (filterState?: AppState['filters']['state']) => {
    const stateToFetch = filterState || state.filters.state;
    
    // Cancel previous request
    if (prListAbortController.current) {
      prListAbortController.current.abort();
    }
    
    // Create new AbortController
    prListAbortController.current = new AbortController();
    const signal = prListAbortController.current.signal;
    
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const prs = await api.prs.list(stateToFetch, signal);
      dispatch({ type: 'SET_PRS', payload: prs });
    } catch (error) {
      // Don't show error for aborted requests
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      
      // APIError already has user-friendly messages
      const errorMessage = error instanceof APIError || error instanceof Error
        ? error.message
        : 'Failed to fetch pull requests. Please try again.';
      
      dispatch({
        type: 'SET_ERROR',
        payload: errorMessage,
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.filters.state]);

  const selectPR = useCallback(async (number: number) => {
    // Cancel previous request
    if (prDetailAbortController.current) {
      prDetailAbortController.current.abort();
    }
    
    // Create new AbortController
    prDetailAbortController.current = new AbortController();
    const signal = prDetailAbortController.current.signal;
    
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const [pr, diff, comments] = await Promise.all([
        api.prs.get(number, signal),
        api.prs.diff(number, signal),
        api.prs.comments(number, signal),
      ]);

      dispatch({ type: 'SET_CURRENT_PR', payload: pr });
      dispatch({ type: 'SET_CURRENT_DIFF', payload: diff.diff });
      dispatch({ type: 'SET_CURRENT_COMMENTS', payload: comments });
      
      // Auto-select first file if available
      if (pr.files && pr.files.length > 0) {
        dispatch({ type: 'SET_SELECTED_FILE', payload: pr.files[0]!.filename });
      }
    } catch (error) {
      // Don't show error for aborted requests
      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }
      
      // APIError already has user-friendly messages
      const errorMessage = error instanceof APIError || error instanceof Error
        ? error.message
        : 'Failed to load pull request details. Please try again.';
      
      dispatch({
        type: 'SET_ERROR',
        payload: errorMessage,
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  const clearPR = useCallback(() => {
    dispatch({ type: 'SET_CURRENT_PR', payload: null });
    dispatch({ type: 'SET_CURRENT_DIFF', payload: null });
    dispatch({ type: 'SET_CURRENT_COMMENTS', payload: [] });
    dispatch({ type: 'SET_SELECTED_FILE', payload: null });
    dispatch({ type: 'SET_TARGET_LINE', payload: null });
    dispatch({ type: 'SET_SCROLL_TO_COMMENT', payload: null });
  }, []);

  const setSelectedFile = useCallback((path: string | null) => {
    dispatch({ type: 'SET_SELECTED_FILE', payload: path });
    dispatch({ type: 'SET_TARGET_LINE', payload: null }); // Clear target line when manually selecting file
  }, []);

  const navigateToFileLine = useCallback((path: string, line: number) => {
    // Clear targetLine first to ensure useEffect triggers even for same line
    dispatch({ type: 'SET_TARGET_LINE', payload: null });
    
    // Then set file and line in the next tick
    setTimeout(() => {
      dispatch({ type: 'SET_SELECTED_FILE', payload: path });
      dispatch({ type: 'SET_TARGET_LINE', payload: line });
    }, 0);
  }, []);

  const scrollToComment = useCallback((commentId: number) => {
    // Clear first to ensure effect triggers even for same comment
    dispatch({ type: 'SET_SCROLL_TO_COMMENT', payload: null });
    
    setTimeout(() => {
      dispatch({ type: 'SET_SCROLL_TO_COMMENT', payload: commentId });
    }, 0);
  }, []);

  const setFilters = useCallback((partial: Partial<AppState['filters']>) => {
    dispatch({ type: 'SET_FILTERS', payload: partial });
  }, []);

  const refreshCurrent = useCallback(async () => {
    if (state.currentPR) {
      await selectPR(state.currentPR.number);
    }
  }, [state.currentPR, selectPR]);

  return (
    <AppContext.Provider
      value={{
        state,
        fetchPRs,
        selectPR,
        clearPR,
        setSelectedFile,
        navigateToFileLine,
        scrollToComment,
        setFilters,
        refreshCurrent,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// Hooks
export function useAppState() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used within AppProvider');
  }
  return context.state;
}

export function useAppActions() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppActions must be used within AppProvider');
  }
  return {
    fetchPRs: context.fetchPRs,
    selectPR: context.selectPR,
    clearPR: context.clearPR,
    setSelectedFile: context.setSelectedFile,
    navigateToFileLine: context.navigateToFileLine,
    scrollToComment: context.scrollToComment,
    setFilters: context.setFilters,
    refreshCurrent: context.refreshCurrent,
  };
}
