"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * Global workspace selection (organization → client → project) shared by the
 * topbar and every module page. Persisted to localStorage so the choice sticks
 * across navigations and reloads. This is what makes the topbar's Cliente /
 * Projeto selectors actually drive the app instead of being decorative.
 */
interface WorkspaceState {
  clientId: string;
  projectId: string;
  setClientId: (id: string) => void;
  setProjectId: (id: string) => void;
}

const Ctx = createContext<WorkspaceState | null>(null);

const CLIENT_KEY = "soie.clientId";
const PROJECT_KEY = "soie.projectId";

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [clientId, setClientIdState] = useState("");
  const [projectId, setProjectIdState] = useState("");

  useEffect(() => {
    setClientIdState(localStorage.getItem(CLIENT_KEY) ?? "");
    setProjectIdState(localStorage.getItem(PROJECT_KEY) ?? "");
  }, []);

  const setClientId = (id: string) => {
    setClientIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(CLIENT_KEY, id);
  };
  const setProjectId = (id: string) => {
    setProjectIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(PROJECT_KEY, id);
  };

  return (
    <Ctx.Provider value={{ clientId, projectId, setClientId, setProjectId }}>
      {children}
    </Ctx.Provider>
  );
}

export function useWorkspace(): WorkspaceState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useWorkspace precisa estar dentro de WorkspaceProvider");
  return ctx;
}
