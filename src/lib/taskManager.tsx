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
  stopGame: (instanceId?: string, onRefresh?: () => Promise<void>) => Promise<void>;
  installVersion: (versionId: string, type?: string, useFabric?: boolean, onInstalled?: () => Promise<void>) => Promise<void>;
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
    let bytesDownloaded = 0;
    let bytesTotal = 0;
    let speedBps = 0;

    for (const t of activeTasksList) {
      bytesDownloaded += t.bytesDownloaded || 0;
      bytesTotal += t.bytesTotal || 0;
      speedBps += t.speedBps || 0;
    }

    return {
      active: activeDlCount,
      completed: Object.values(installTasks).filter((t) => t.status === "completed").length,
      failed: Object.values(installTasks).filter((t) => t.status === "failed").length,
      bytes_downloaded: bytesDownloaded,
      bytes_total: bytesTotal,
      speed_bps: speedBps,
      active_files: [],
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
        stage: "PREPARING GAME FILES...",
        progress: 0,
        pid: null,
        runTimeSecs: 0,
        error: null,
      });

      const progressInterval = setInterval(async () => {
        try {
          const snap = await api.downloadsProgress();
          setGameSession((prev) => {
            if (prev.status !== "preparing") return prev;
            const progress = snap.bytes_total > 0
              ? Math.min(Math.round((snap.bytes_downloaded / snap.bytes_total) * 100), 99)
              : prev.progress;
            return {
              ...prev,
              progress,
              stage: snap.active > 0 ? "DOWNLOADING GAME FILES..." : prev.stage,
            };
          });
        } catch {}
      }, 500);

      try {
        await api.prepareLaunch(instance.id);
        clearInterval(progressInterval);
        
        const pid = await api.launchInstance(instance.id) as number;

        setGameSession({
          instanceId: instance.id,
          instanceName: instance.name,
          status: "running",
          stage: "GAME RUNNING",
          progress: 100,
          pid,
          runTimeSecs: 0,
          error: null,
        });

        if (onRefresh) onRefresh();
      } catch (err: any) {
        clearInterval(progressInterval);
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
    async (instanceId?: string, onRefresh?: () => Promise<void>) => {
      setGameSession((prev) => ({ ...prev, status: "stopping", stage: "TERMINATING PROCESS..." }));
      try {
        if (instanceId) {
          await api.launchKill(instanceId);
        }
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
    async (versionId: string, _type = "release", useFabric = false, onInstalled?: () => Promise<void>) => {
      const taskId = `version-${versionId}${useFabric ? "-fabric" : ""}`;

      setInstallTasks((prev) => ({
        ...prev,
        [taskId]: {
          id: taskId,
          type: "version",
          title: `Minecraft ${versionId}${useFabric ? " (Fabric)" : ""}`,
          versionId,
          stage: "CREATING GAME PROFILE...",
          progress: 0,
          bytesDownloaded: 0,
          bytesTotal: 0,
          speedBps: 0,
          status: "downloading",
        },
      }));

      try {
        let newInstance = await api.instancesCreate(`Minecraft ${versionId}${useFabric ? " Fabric" : ""}`, versionId);
        if (useFabric) {
          newInstance.mod_loader = { kind: "fabric", version: "0.16.5" };
          await api.instancesUpdate(newInstance);
        }
        
        setInstallTasks((prev) => {
          const cur = prev[taskId];
          if (!cur) return prev;
          return {
            ...prev,
            [taskId]: {
              ...cur,
              stage: "DOWNLOADING GAME FILES...",
              progress: 10,
            },
          };
        });

        const progressInterval = setInterval(async () => {
          try {
            const snap = await api.downloadsProgress();
            setInstallTasks((prev) => {
              const cur = prev[taskId];
              if (!cur || cur.status !== "downloading") return prev;
              const progress = snap.bytes_total > 0
                ? Math.min(Math.round((snap.bytes_downloaded / snap.bytes_total) * 100), 99)
                : cur.progress;
              return {
                ...prev,
                [taskId]: {
                  ...cur,
                  progress,
                  bytesDownloaded: snap.bytes_downloaded,
                  bytesTotal: snap.bytes_total,
                  speedBps: snap.speed_bps,
                  stage: snap.active > 0 ? "DOWNLOADING GAME FILES..." : cur.stage,
                },
              };
            });
          } catch {}
        }, 500);

        await api.prepareLaunch(newInstance.id);
        clearInterval(progressInterval);
        
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
              bytesDownloaded: cur.bytesTotal,
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
      setInstallTasks((prev) => ({
        ...prev,
        [taskId]: {
          id: taskId,
          type: "mod",
          title: hit.title,
          stage: "RESOLVING COMPATIBLE VERSION...",
          progress: 5,
          bytesDownloaded: 0,
          bytesTotal: 0,
          speedBps: 0,
          status: "downloading",
        },
      }));

      try {
        // Get real versions from Modrinth
        const versions = await api.modrinthVersions(hit.slug);
        if (!versions || versions.length === 0) {
          throw new Error(`No versions found for ${hit.title}`);
        }
        const version = versions[0];
        const file = version.files.find((f: any) => f.primary) || version.files[0];
        if (!file) {
          throw new Error(`No downloadable file found for ${hit.title}`);
        }

        setInstallTasks((prev) => {
          const cur = prev[taskId];
          if (!cur) return prev;
          return {
            ...prev,
            [taskId]: {
              ...cur,
              stage: "DOWNLOADING...",
              progress: 20,
              bytesTotal: file.size,
            },
          };
        });

        // Start polling real progress
        const progressInterval = setInterval(async () => {
          try {
            const snap = await api.downloadsProgress();
            setInstallTasks((prev) => {
              const cur = prev[taskId];
              if (!cur || cur.status !== "downloading") return prev;
              const progress = snap.bytes_total > 0
                ? Math.min(Math.round((snap.bytes_downloaded / snap.bytes_total) * 100), 95)
                : cur.progress;
              return {
                ...prev,
                [taskId]: {
                  ...cur,
                  progress,
                  bytesDownloaded: snap.bytes_downloaded,
                  bytesTotal: snap.bytes_total || file.size,
                  speedBps: snap.speed_bps,
                  stage: snap.active > 0 ? "DOWNLOADING..." : cur.stage,
                },
              };
            });
          } catch {}
        }, 500);

        await api.instanceInstallContent(
          instanceId,
          category,
          file.url,
          file.filename,
          file.size,
          file.hashes.sha1
        );

        clearInterval(progressInterval);

        setInstallTasks((prev) => {
          const cur = prev[taskId];
          if (!cur) return prev;
          return {
            ...prev,
            [taskId]: {
              ...cur,
              progress: 100,
              bytesDownloaded: file.size,
              bytesTotal: file.size,
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
