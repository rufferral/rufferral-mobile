import { createContext, useContext, useState, ReactNode } from "react";
type AppReadyContextType = {
  dashboardReady: boolean;
  setDashboardReady: (ready: boolean) => void;
  splashDone: boolean;
  setSplashDone: (done: boolean) => void;
};
const AppReadyContext = createContext<AppReadyContextType>({
  dashboardReady: false,
  setDashboardReady: () => {},
  splashDone: false,
  setSplashDone: () => {},
});
export function AppReadyProvider({ children }: { children: ReactNode }) {
  const [dashboardReady, setDashboardReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  return (
    <AppReadyContext.Provider value={{ dashboardReady, setDashboardReady, splashDone, setSplashDone }}>
      {children}
    </AppReadyContext.Provider>
  );
}
export function useAppReady() {
  return useContext(AppReadyContext);
}
