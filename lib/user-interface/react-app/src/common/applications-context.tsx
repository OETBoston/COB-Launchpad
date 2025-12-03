import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Application } from '../API';
import { AppContext } from './app-context';
import { ApiClient } from './api-client/api-client';
import { Utils } from './utils';

interface ApplicationsContextType {
  applications: Application[];
  loadingApplications: boolean;
  refreshApplications: () => Promise<void>;
}

export const ApplicationsContext = createContext<ApplicationsContextType>({
  applications: [],
  loadingApplications: true,
  refreshApplications: async () => {},
});

export function ApplicationsProvider({ children }: { children: React.ReactNode }) {
  const appContext = useContext(AppContext);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(true);
  const initialLoadDone = useRef(false);

  const fetchApplications = async () => {
    if (!appContext) return;
    
    // Only show loading state on first load
    if (applications.length === 0) {
      setLoadingApplications(true);
    }
    
    try {
      const apiClient = new ApiClient(appContext);
      const result = await apiClient.applications.getApplications();
      if (result.data?.listApplications) {
        setApplications(result.data.listApplications);
      }
    } catch (error) {
      console.error("Error fetching applications:", Utils.getErrorMessage(error));
    } finally {
      setLoadingApplications(false);
    }
  };

  useEffect(() => {
    if (!initialLoadDone.current && appContext) {
      fetchApplications();
      initialLoadDone.current = true;
    }
  }, [appContext]);

  return (
    <ApplicationsContext.Provider 
      value={{
        applications,
        loadingApplications,
        refreshApplications: fetchApplications
      }}
    >
      {children}
    </ApplicationsContext.Provider>
  );
}

export const useApplicationsContext = () => useContext(ApplicationsContext);

