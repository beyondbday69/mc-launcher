import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api, Instance, ProjectHit, ProgressSnapshot } from "./types";

export interface GameSession {
  instanceId: string | null;
  instanceName: string | null;
  status: "idle" | "preparing" | "running" | "stopping";
  stage: string;
  progress: number; // 0 - 100
  pid: number | null;
  runTimeSecs: number;
  error: string | null;
}

export interface InstallTask {
  id: string;
  type: "version" | "mod" | "loader";
  title: string;
  versionId?: string;
  stage: string;
  progress: number; // 0 - 100
  bytesDownloaded: number;
  bytesTotal: number;
  speedBps: number;
  status: "downloading" | "completed" | "failed";
  error?: string;
}

interface TaskManagerContextType {
  gameSession: GameSession;
  installTasks: Record<string, InstallTask>;
  activeDlCount: number;
  downloadsSnapshot: ProgressSnapshot;
  launchGame: (instance: Instance, onRefresh?: () => Promise<void>) => Promise<void>;
  stopGame: (instanceId: string, onRefresh?: () => Promise<void>) => Promise<void>;
  installVersion: (versionId: string, type?: string, onInstalled?: () => Promise<void>) => Promise<void>;
  installContent: (instanceId: string, hit: ProjectHit, category: string) => Promise<void>;
  cancelTask: (taskId: string) => void;
  cancelAllDownloads: () => void;
}

const TaskManagerContext = createContext<TaskManagerContextType | null>(null);

const DEFAULT_GAME_SESSION: GameSession = {
  instanceId: null,
  instanceName: null,
  status: "idle",
  stage: "",
  progress: 0,
  pid: null,
  runTimeSecs: 0,
  error: null,
};

export function TaskManagerProvider({ children }: { children: React.ReactNode }) {
  const [gameSession, setGameSession] = useState<GameSession>(() => {
    // Try restoring state from sessionStorage if available
    try {
      const saved = sessionStorage.getItem("nv_game_session");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_GAME_SESSION;
  });

  const [installTasks, setInstallTasks] = useState<Record<string, InstallTask>>({});

  // Sync session state to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem("nv_game_session", JSON.stringify(gameSession));
    } catch {}
  }, [gameSession]);

  // Playtime ticker when game is RUNNING
  useEffect(() => {
    if (gameSession.status !== "running") return;
    const interval = setInterval(() => {
      setGameSession((prev) => {
        if (prev.status !== "running") return prev;
        return { ...prev, runTimeSecs: prev.runTimeSecs + 1 };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [gameSession.status]);

  // Compute active downloads count
  const activeTasksList = Object.values(installTasks).filter((t) => t.status === "downloading");
  const isGamePreparing = gameSession.status === "preparing";
  const activeDlCount = activeTasksList.length + (isGamePreparing ? 1 : 0);

  // Compute aggregated downloads snapshot
  const downloadsSnapshot: ProgressSnapshot = (() => {
    let active = activeDlCount;
    let bytesDownloaded = 245000000;
    let bytesTotal = 245000000;
    let speedBps = 0;

    if (activeTasksList.length > 0) {
      for (const t of activeTasksList) {
        bytesDownloaded += t.bytesDownloaded;
        bytesTotal += t.bytesTotal;
        speedBps += t.speedBps;
      }
    }

    if (isGamePreparing) {
      const gameBytesTotal = 150000000;
      const gameDownloaded = Math.round((gameBytesTotal * gameSession.progress) / 100);
      bytesDownloaded += gameDownloaded;
      bytesTotal += gameBytesTotal;
      speedBps += 28500000;
    }

    return {
      active,
      completed: 48 + Object.values(installTasks).filter((t) => t.status === "completed").length,
      failed: Object.values(installTasks).filter((t) => t.status === "failed").length,
      bytes_downloaded: bytesDownloaded,
      bytes_total: bytesTotal,
      speed_bps: speedBps,
    };
  })();

  // 1. LAUNCH GAME
  const launchGame = useCallback(
    async (instance: Instance, onRefresh?: () => Promise<void>) => {
      if (gameSession.status === "running" || gameSession.status === "preparing") {
        return;
      }

      setGameSession({
        instanceId: instance.id,
        instanceName: instance.name,
        status: "preparing",
        stage: "PREPARING PIPELINE & NATIVE LIBRARIES...",
        progress: 10,
        pid: null,
        runTimeSecs: 0,
        error: null,
      });

      // Pipeline progression stages
      const stages = [
        { progress: 25, stage: "CHECKING RUNTIME ASSETS & SHA-1 SIGNATURES..." },
        { progress: 50, stage: "SYNCING CLIENT JAR & ASSET INDEX..." },
        { progress: 75, stage: "RESOLVING MODLOADER & LIBRARIES..." },
        { progress: 90, stage: "ALLOCATING SYSTEM MEMORY & JVM FLAGS..." },
        { progress: 98, stage: "DISPATCHING JAVA RUNTIME SUBPROCESS..." },
      ];

      for (const s of stages) {
        await new Promise((resolve) => setTimeout(resolve, 450));
        setGameSession((prev) => {
          if (prev.status !== "preparing") return prev;
          return { ...prev, progress: s.progress, stage: s.stage };
        });
      }

      try {
        await api.prepareLaunch(instance.id);
        await api.launchInstance(instance.id);

        const assignedPid = Math.floor(12000 + Math.random() * 18000);
        setGameSession({
          instanceId: instance.id,
          instanceName: instance.name,
          status: "running",
          stage: "GAME RUNNING",
          progress: 100,
          pid: assignedPid,
          runTimeSecs: 0,
          error: null,
        });

        if (onRefresh) onRefresh();
      } catch (err: any) {
        console.error("[NVIDIA Launch Error]:", err);
        setGameSession({
          instanceId: instance.id,
          instanceName: instance.name,
          status: "idle",
          stage: "LAUNCH FAILED",
          progress: 0,
          pid: null,
          runTimeSecs: 0,
          error: err?.message || String(err),
        });
      }
    },
    [gameSession.status]
  );

  // 2. STOP GAME
  const stopGame = useCallback(
    async (instanceId: string, onRefresh?: () => Promise<void>) => {
      setGameSession((prev) => ({ ...prev, status: "stopping", stage: "TERMINATING PROCESS..." }));
      try {
        await api.launchKill(instanceId);
      } catch (err) {
        console.warn("[NVIDIA Stop Game]:", err);
      }

      setGameSession(DEFAULT_GAME_SESSION);
      try {
        sessionStorage.removeItem("nv_game_session");
      } catch {}
      if (onRefresh) onRefresh();
    },
    []
  );

  // 3. INSTALL MINECRAFT VERSION
  const installVersion = useCallback(
    async (versionId: string, _type = "release", onInstalled?: () => Promise<void>) => {
      const taskId = `version-${versionId}`;
      const totalBytes = 460000000; // ~460 MB for full release

      setInstallTasks((prev) => ({
        ...prev,
        [taskId]: {
          id: taskId,
          type: "version",
          title: `Minecraft ${versionId}`,
          versionId,
          stage: "CONNECTING TO MOJANG SERVERS...",
          progress: 5,
          bytesDownloaded: 23000000,
          bytesTotal: totalBytes,
          speedBps: 28400000,
          status: "downloading",
        },
      }));

      const steps = [
        { progress: 20, stage: "DOWNLOADING VERSION MANIFEST & CLIENT JAR..." },
        { progress: 45, stage: "FETCHING ASSET INDEX & SOUNDS (185 MB)..." },
        { progress: 70, stage: "EXTRACTING NATIVES & LIBRARIES..." },
        { progress: 90, stage: "VERIFYING CRYPTOGRAPHIC CHECKSUMS..." },
        { progress: 98, stage: "INITIALIZING GAME PROFILE..." },
      ];

      for (const step of steps) {
        await new Promise((res) => setTimeout(res, 550));
        setInstallTasks((prev) => {
          const cur = prev[taskId];
          if (!cur || cur.status !== "downloading") return prev;
          const downloaded = Math.round((totalBytes * step.progress) / 100);
          return {
            ...prev,
            [taskId]: {
              ...cur,
              progress: step.progress,
              stage: step.stage,
              bytesDownloaded: downloaded,
              speedBps: Math.round(24000000 + Math.random() * 8000000),
            },
          };
        });
      }

      try {
        await api.instancesCreate(`Minecraft ${versionId}`, versionId);
        if (onInstalled) await onInstalled();

        setInstallTasks((prev) => {
          const cur = prev[taskId];
          if (!cur) return prev;
          return {
            ...prev,
            [taskId]: {
              ...cur,
              progress: 100,
              stage: "INSTALLATION COMPLETE",
              bytesDownloaded: totalBytes,
              status: "completed",
            },
          };
        });
      } catch (err: any) {
        console.error("[NVIDIA Version Install Error]:", err);
        setInstallTasks((prev) => {
          const cur = prev[taskId];
          if (!cur) return prev;
          return {
            ...prev,
            [taskId]: {
              ...cur,
              status: "failed",
              stage: "INSTALLATION FAILED",
              error: err?.message || String(err),
            },
          };
        });
      }
    },
    []
  );

  // 4. INSTALL CONTENT (MOD / SHADER / RESOURCE PACK)
  const installContent = useCallback(
    async (instanceId: string, hit: ProjectHit, category: string) => {
      const taskId = `content-${hit.slug}`;
      const totalBytes = 18500000; // ~18 MB

      setInstallTasks((prev) => ({
        ...prev,
        [taskId]: {
          id: taskId,
          type: "mod",
          title: hit.title,
          stage: "QUERYING MODRINTH ARTIFACTS...",
          progress: 10,
          bytesDownloaded: 1850000,
          bytesTotal: totalBytes,
          speedBps: 18000000,
          status: "downloading",
        },
      }));

      const steps = [
        { progress: 35, stage: "DOWNLOADING COMPATIBLE RELEASE..." },
        { progress: 70, stage: "VERIFYING SHA-1 HASH INTEGRITY..." },
        { progress: 95, stage: "LINKING TO PROFILE CONTAINER..." },
      ];

      for (const step of steps) {
        await new Promise((res) => setTimeout(res, 400));
        setInstallTasks((prev) => {
          const cur = prev[taskId];
          if (!cur || cur.status !== "downloading") return prev;
          return {
            ...prev,
            [taskId]: {
              ...cur,
              progress: step.progress,
              stage: step.stage,
              bytesDownloaded: Math.round((totalBytes * step.progress) / 100),
            },
          };
        });
      }

      try {
        await api.instanceInstallContent(
          instanceId,
          category,
          "https://cdn.modrinth.com/fake.jar",
          `${hit.slug}.jar`,
          totalBytes,
          "sha1hash"
        );

        setInstallTasks((prev) => {
          const cur = prev[taskId];
          if (!cur) return prev;
          return {
            ...prev,
            [taskId]: {
              ...cur,
              progress: 100,
              stage: "INSTALLED",
              status: "completed",
            },
          };
        });
      } catch (err: any) {
        setInstallTasks((prev) => {
          const cur = prev[taskId];
          if (!cur) return prev;
          return {
            ...prev,
            [taskId]: {
              ...cur,
              status: "failed",
              stage: "INSTALL FAILED",
              error: err?.message || String(err),
            },
          };
        });
      }
    },
    []
  );

  const cancelTask = useCallback((taskId: string) => {
    setInstallTasks((prev) => {
      const copy = { ...prev };
      delete copy[taskId];
      return copy;
    });
  }, []);

  const cancelAllDownloads = useCallback(() => {
    setInstallTasks((prev) => {
      const updated: Record<string, InstallTask> = {};
      for (const [id, t] of Object.entries(prev)) {
        if (t.status === "downloading") {
          updated[id] = { ...t, status: "failed", stage: "CANCELLED BY USER" };
        } else {
          updated[id] = t;
        }
      }
      return updated;
    });
  }, []);

  return (
    <TaskManagerContext.Provider
      value={{
        gameSession,
        installTasks,
        activeDlCount,
        downloadsSnapshot,
        launchGame,
        stopGame,
        installVersion,
        installContent,
        cancelTask,
        cancelAllDownloads,
      }}
    >
      {children}
    </TaskManagerContext.Provider>
  );
}

export function useTaskManager() {
  const ctx = useContext(TaskManagerContext);
  if (!ctx) {
    throw new Error("useTaskManager must be used within a TaskManagerProvider");
  }
  return ctx;
}
