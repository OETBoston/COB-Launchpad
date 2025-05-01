import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Session } from '../API';
import { AppContext } from './app-context';
import { ApiClient } from './api-client/api-client';
import { Utils } from './utils';

interface SessionsContextType {
  recentSessions: Session[];
  loadingSessions: boolean;
  refreshSessions: () => void;
}

export const SessionsContext = createContext<SessionsContextType>({
  recentSessions: [],
  loadingSessions: true,
  refreshSessions: () => {},
});

export function SessionsProvider({ children }: { children: React.ReactNode }) {
  const appContext = useContext(AppContext);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const initialLoadDone = useRef(false);

  const fetchRecentSessions = async () => {
    if (!appContext) return;
    
    try {
      const apiClient = new ApiClient(appContext);
      const result = await apiClient.sessions.getSessions();
      if (result.data?.listSessions) {
        const sortedSessions = [...result.data.listSessions].sort((a, b) => 
          new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
        ).slice(0, 5);
        
        setRecentSessions(sortedSessions);
      }
    } catch (error) {
      console.error("Error fetching sessions:", Utils.getErrorMessage(error));
    } finally {
      setLoadingSessions(false);
    }
  };

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
  }, [appContext]);

  return (
    <SessionsContext.Provider 
      value={{
        recentSessions,
        loadingSessions,
        refreshSessions: fetchRecentSessions
      }}
    >
      {children}
    </SessionsContext.Provider>
  );
}

export const useSessionsContext = () => useContext(SessionsContext); 