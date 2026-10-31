"use client";

//JJQR - AI (Oct 31, 2026)
import { createContext, useContext, type ReactNode } from "react";

type AppShellMobileNavContextValue = {
  closeMobileNav: () => void;
};

const AppShellMobileNavContext = createContext<AppShellMobileNavContextValue | null>(null);

export function AppShellMobileNavProvider({
  closeMobileNav,
  children,
}: {
  closeMobileNav: () => void;
  children: ReactNode;
}) {
  return (
    <AppShellMobileNavContext.Provider value={{ closeMobileNav }}>
      {children}
    </AppShellMobileNavContext.Provider>
  );
}

export function useAppShellMobileNav() {
  return useContext(AppShellMobileNavContext);
}
//JJQR - END
