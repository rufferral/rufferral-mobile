import { createContext, useContext, useState, ReactNode } from "react";

type AppReadyContextType = {
  dashboardReady: boolean;
  setDashboardReady: (ready: boolean) => void;
};

const AppReadyContext = createContext<AppReadyContextType>({
  dashboardReady: false,
  setDashboardReady: () => {},
});

export function AppReadyProvider({ children }: { children: ReactNode }) {
  const [dashboardReady, setDashboardReady] = useState(false);
  return (
    <AppReadyContext.Provider value={{ dashboardReady, setDashboardReady }}>
      {children}
    </AppReadyContext.Provider>
  );
}

export function useAppReady() {
  return useContext(AppReadyContext);
}
