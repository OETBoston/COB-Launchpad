import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Session } from '../API';
import { AppContext } from './app-context';
import { ApiClient } from './api-client/api-client';
import { Utils } from './utils';

interface SessionsContextType {
  recentSessions: Session[];
  allSessions: Session[];
  loadingSessions: boolean;
  refreshSessions: () => Promise<void>;
}

export const SessionsContext = createContext<SessionsContextType>({
  recentSessions: [],
  allSessions: [],
  loadingSessions: true,
  refreshSessions: async () => {},
});

export function SessionsProvider({ children }: { children: React.ReactNode }) {
  const appContext = useContext(AppContext);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const initialLoadDone = useRef(false);

  const fetchRecentSessions = useCallback(async () => {
    if (!appContext) return;
    
    // Only show loading state on first load
    setLoadingSessions((currentLoading) => {
      return allSessions.length === 0 ? true : currentLoading;
    });
    
    try {
      const apiClient = new ApiClient(appContext);
      const result = await apiClient.sessions.getSessions();
      if (result.data?.listSessions) {
        const sessions = result.data.listSessions as Session[];
        const sortedSessions = [...sessions].sort((a, b) => 
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        );
        
        // Store all sessions for the full sessions page
        setAllSessions(sortedSessions);
        // Store top 5 for navigation panel
        setRecentSessions(sortedSessions.slice(0, 5));
      }
    } catch (error) {
      console.error("Error fetching sessions:", Utils.getErrorMessage(error));
    } finally {
      setLoadingSessions(false);
    }
  }, [appContext, allSessions.length]);

  useEffect(() => {
    const handleChatMessage = () => {
      fetchRecentSessions();
    };

    window.addEventListener('chatMessageSent', handleChatMessage);

    if (!initialLoadDone.current) {
      fetchRecentSessions();
      initialLoadDone.current = true;
    }

    return () => {
      window.removeEventListener('chatMessageSent', handleChatMessage);
    };
  }, [fetchRecentSessions]);

  return (
    <SessionsContext.Provider 
      value={{
        recentSessions,
        allSessions,
        loadingSessions,
        refreshSessions: fetchRecentSessions
      }}
    >
      {children}
    </SessionsContext.Provider>
  );
}

export const useSessionsContext = () => useContext(SessionsContext); 