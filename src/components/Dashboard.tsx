/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity, Gauge, AlertTriangle, User, Server,
  Thermometer, Wind, Zap, Loader2,
  LayoutDashboard, Wrench, Radio,
  ChevronRight, Power, Database, Cpu, Eye,
  TrendingUp, AlertCircle, CheckCircle, Settings,
  Fuel, Clock, Shield, BarChart3, Navigation2,
  Wifi, WifiOff, RefreshCw, Bell, BellOff, Sun, Moon
} from "lucide-react";
import { TelemetryData, DriverBehavior, HealthStatus, DriverPredictResponse, ServiceCompanyDetails, RegisteredIssue } from "../types";
import {
  MaintenanceScheduleItem,
  fetchMaintenanceSchedule,
  getWebSocketUrl,
  mapSimulatedDataToTelemetry,
  getApiBaseUrl,
  setApiBaseUrl
} from "../services/apiService";
import { simulateECUData } from "../services/ecuSimulator";
import { classifyDriverBehavior } from "../logic/driverBehavior";
import { analyzeVehicleHealth } from "../logic/mlHealth";
import { calculateMileage } from "../logic/mileage";
import { HUDGauge } from "./HUDGauge";
import { TelemetryPanel } from "./TelemetryPanel";
import { HealthMonitor } from "./HealthMonitor";
import { LiveChart } from "./LiveChart";

type Tab = "overview" | "telemetry" | "diagnostics" | "maintenance" | "upload" | "settings";

// ─── DATA SOURCE HOOK ──────────────────────────────────────────
function useDataSource() {
  const [source, setSource] = useState<"mock" | "obd" | "dataset">("obd");
  const [isConnected, setIsConnected] = useState(false);

  return { source, setSource, isConnected, setIsConnected };
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────
export const Dashboard: React.FC = () => {
  const [telemetry, setTelemetry] = useState<TelemetryData>(simulateECUData());
  const [history, setHistory] = useState<TelemetryData[]>([]);
  const [behavior, setBehavior] = useState<DriverBehavior>("Moderate");
  const [health, setHealth] = useState<HealthStatus>({
    score: 95, status: "Healthy", predictions: [], faults: [],
  });
  const [mileage, setMileage] = useState(0);
  const [apiResponse, setApiResponse] = useState<DriverPredictResponse | null>(null);
  const [dataset, setDataset] = useState<TelemetryData[]>([]);
  const [datasetIndex, setDatasetIndex] = useState(0);
  const [isAuthReady, setIsAuthReady] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [tripTime, setTripTime] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [hasAlerts, setHasAlerts] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const [speedUnit, setSpeedUnit] = useState<"metric" | "imperial" >(() => {
    return (localStorage.getItem("obd_speed_unit") as "metric" | "imperial") || "metric";
  });
  const [tempUnit, setTempUnit] = useState<"metric" | "imperial">(() => {
    return (localStorage.getItem("obd_temp_unit") as "metric" | "imperial") || "metric";
  });

  useEffect(() => {
    localStorage.setItem("obd_speed_unit", speedUnit);
  }, [speedUnit]);

  useEffect(() => {
    localStorage.setItem("obd_temp_unit", tempUnit);
  }, [tempUnit]);

  const [serviceCompany, setServiceCompany] = useState<ServiceCompanyDetails>(() => {
    try {
      const stored = localStorage.getItem("obd_service_company");
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return {
      name: "Apex Auto Services",
      email: "service@apexauto.com",
      phone: "+1 (555) 019-2834",
      address: "404 Performance Blvd, Detroit, MI"
    };
  });

  const [registeredIssues, setRegisteredIssues] = useState<RegisteredIssue[]>(() => {
    try {
      const stored = localStorage.getItem("obd_registered_issues");
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  });

  const [telegramToken, setTelegramToken] = useState<string>(() => {
    return localStorage.getItem("obd_telegram_token") || "";
  });
  const [telegramChatId, setTelegramChatId] = useState<string>(() => {
    return localStorage.getItem("obd_telegram_chat_id") || "";
  });
  const [telegramEnabled, setTelegramEnabled] = useState<boolean>(() => {
    return localStorage.getItem("obd_telegram_enabled") === "true";
  });

  useEffect(() => {
    localStorage.setItem("obd_service_company", JSON.stringify(serviceCompany));
  }, [serviceCompany]);

  useEffect(() => {
    localStorage.setItem("obd_registered_issues", JSON.stringify(registeredIssues));
  }, [registeredIssues]);

  useEffect(() => {
    localStorage.setItem("obd_telegram_token", telegramToken);
  }, [telegramToken]);

  useEffect(() => {
    localStorage.setItem("obd_telegram_chat_id", telegramChatId);
  }, [telegramChatId]);

  useEffect(() => {
    localStorage.setItem("obd_telegram_enabled", String(telegramEnabled));
  }, [telegramEnabled]);

  const [savedUrl, setSavedUrl] = useState(getApiBaseUrl());
  const [tempUrl, setTempUrl] = useState(getApiBaseUrl());

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const resetStates = useCallback(() => {
    const zeroed = simulateECUData(null);
    setTelemetry(zeroed);
    setHistory([]);
    setBehavior("Moderate");
    setHealth({
      score: 100,
      status: "Healthy",
      predictions: [],
      faults: [],
    });
    setMileage(0);
    setTripTime(0);
    setTotalDistance(0);
    setDataset([]);
    setDatasetIndex(0);
    setApiResponse(null);
    tripStartRef.current = Date.now();
  }, []);

  const { source, setSource, isConnected, setIsConnected } = useDataSource();
  const tripStartRef = useRef(Date.now());
  const lastBackendHealthTimeRef = useRef<number>(0);

  // Handle data source switch
  const handleToggleDataSource = async () => {
    const newSource = source === "mock" ? "obd" : "mock";
    
    // Always reset states when switching
    resetStates();
    
    setSource(newSource);
  };

  const handleSaveUrl = () => {
    setApiBaseUrl(tempUrl);
    setSavedUrl(tempUrl);
    resetStates();
  };

  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);

  // Check backend health periodically
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const { checkBackendHealth } = await import("../services/apiService");
        const healthy = await checkBackendHealth();
        setIsBackendHealthy(healthy);
      } catch (err) {
        setIsBackendHealthy(false);
      }
    };
    
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  // Trip timer
  useEffect(() => {
    const id = setInterval(() => setTripTime(Math.floor((Date.now() - tripStartRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Telemetry loop — mock OR real OBD OR dataset
  useEffect(() => {
    if (source === "obd") {
      let ws: WebSocket | null = null;
      let reconnectTimeout: any = null;
      let pollInterval: any = null;
      let isStopped = false;
      let usePolling = false;

      // Auto-detect list for HTTP polling fallback
      const HTTP_CANDIDATE_PATHS = [
        "/api/telemetry/demo/live",
        "/api/vehicle/demo/live",
        "/api/telemetry/1/live",
        "/api/vehicle/1/live",
        "/api/live",
        "/api/live-data"
      ];
      let successfulPollPath: string | null = null;

      // Auto-detect list for WebSocket paths
      const WS_CANDIDATE_PATHS = [
        "/ws/vehicle/demo",
        "/ws/vehicle/1",
        "/ws/live",
        "/api/ws/live"
      ];
      let wsPathIndex = 0;

      const startPolling = () => {
        if (pollInterval) clearInterval(pollInterval);
        console.log("[OBD Fallback] Starting auto-detecting HTTP polling loop...");
        
        pollInterval = setInterval(async () => {
          if (isStopped) return;
          
          const pathsToTry = successfulPollPath ? [successfulPollPath] : HTTP_CANDIDATE_PATHS;
          let dataLoaded = false;
          
          for (const path of pathsToTry) {
            try {
              const response = await fetch(path);
              if (!response.ok) continue;
              
              const resData = await response.json();
              const payload = resData.data || resData;
              
              // Validate that the payload actually has telemetry-like keys
              if (
                payload &&
                (payload.rpm !== undefined ||
                 payload.speed !== undefined ||
                 payload.vss !== undefined ||
                 payload.engine_rpm !== undefined ||
                 payload.vehicle_speed !== undefined)
              ) {
                const data = mapSimulatedDataToTelemetry(payload);
                setTelemetry(data);
                setHistory((h) => [...h.slice(-120), data]);
                setTotalDistance((d) => d + data.vss / 3600);
                setIsConnected(true);
                
                if (!successfulPollPath) {
                  console.log(`[OBD Fallback] Auto-detected active HTTP endpoint: ${path}`);
                  successfulPollPath = path;
                }
                dataLoaded = true;
                break; // Break the loop since we got valid data
              }
            } catch (err) {
              if (successfulPollPath) {
                console.error(`[OBD Fallback] Poll error on ${path}:`, err);
                successfulPollPath = null; // Reset to trigger discovery on next tick
              }
            }
          }
          
          if (!dataLoaded) {
            setIsConnected(false);
          }
        }, 800); // Poll every 800ms for high visual responsiveness
      };

      const connect = () => {
        if (isStopped) return;
        if (!usePolling) {
          setIsConnected(false); // Connecting state
        }
        
        // Safety timeout: if WS doesn't connect in 3.5 seconds, automatically fall back to HTTP polling
        const fallbackTimer = setTimeout(() => {
          if (!usePolling && (!ws || ws.readyState !== WebSocket.OPEN)) {
            console.log("[WebSocket] Connection slow or failing, falling back to HTTP polling");
            usePolling = true;
            startPolling();
          }
        }, 3500);

        const currentWsPath = WS_CANDIDATE_PATHS[wsPathIndex];
        const wsUrl = getWebSocketUrl(currentWsPath);
        console.log(`[WebSocket] Trying connection path [${wsPathIndex}]: ${wsUrl}`);
        
        try {
          ws = new WebSocket(wsUrl);

          ws.onopen = () => {
            console.log(`[WebSocket] Connected successfully to live OBD stream path: ${currentWsPath}`);
            clearTimeout(fallbackTimer);
            setIsConnected(true);
            usePolling = false;
            if (pollInterval) {
              clearInterval(pollInterval);
              pollInterval = null;
            }
          };

          ws.onmessage = (event) => {
            try {
              const resData = JSON.parse(event.data);
              const payload = resData.data || resData;
              const data = mapSimulatedDataToTelemetry(payload);
              setTelemetry(data);
              setHistory((h) => [...h.slice(-120), data]);
              setTotalDistance((d) => d + data.vss / 3600);
            } catch (err) {
              console.error("[WebSocket] Error parsing data:", err);
            }
          };

          ws.onerror = (err) => {
            console.error(`[WebSocket] Error on path ${currentWsPath}:`, err);
            clearTimeout(fallbackTimer);
            if (!usePolling) {
              usePolling = true;
              startPolling();
            }
          };

          ws.onclose = (event) => {
            console.log(`[WebSocket] Connection closed for path ${currentWsPath}:`, event.code, event.reason);
            clearTimeout(fallbackTimer);
            
            // Try next candidate WebSocket path on reconnect
            wsPathIndex = (wsPathIndex + 1) % WS_CANDIDATE_PATHS.length;

            if (!isStopped) {
              if (!usePolling) {
                usePolling = true;
                startPolling();
              }
              // Attempt to reconnect WebSocket in 6 seconds
              reconnectTimeout = setTimeout(connect, 6000);
            }
          };
        } catch (e) {
          console.error("[WebSocket] Synchronous connect error:", e);
          clearTimeout(fallbackTimer);
          wsPathIndex = (wsPathIndex + 1) % WS_CANDIDATE_PATHS.length;
          if (!usePolling) {
            usePolling = true;
            startPolling();
          }
        }
      };

      connect();

      return () => {
        isStopped = true;
        if (ws) {
          try {
            ws.close();
          } catch (e) {}
        }
        if (reconnectTimeout) clearTimeout(reconnectTimeout);
        if (pollInterval) clearInterval(pollInterval);
        setIsConnected(false);
      };
    }

    if (source === "dataset") {
      if (dataset.length === 0) return;
      const id = setInterval(() => {
        setDatasetIndex((prev) => {
          const next = (prev + 1) % dataset.length;
          const data = dataset[next];
          setTelemetry(data);
          setHistory((h) => [...h.slice(-120), data]);
          setTotalDistance((d) => d + data.vss / 3600);
          return next;
        });
      }, 500);
      return () => clearInterval(id);
    }

    // Mock data loop
    const id = setInterval(() => {
      setTelemetry((prev) => {
        const next = simulateECUData(prev);
        setHistory((h) => [...h.slice(-120), next]);
        setTotalDistance((d) => d + next.vss / 3600);
        return next;
      });
    }, 500);
    return () => clearInterval(id);
  }, [source, dataset, setIsConnected, savedUrl]);

  // Always use local heuristics and analytics to respect the strict "GET/WS only, no POST calls" policy.
  useEffect(() => {
    setApiResponse(null);
  }, [source]);

  // Logic updates
  useEffect(() => {
    const newBehavior = classifyDriverBehavior(telemetry);
    const newMileage = calculateMileage(telemetry);

    setBehavior(newBehavior);
    setMileage(newMileage);

    const newHealth = analyzeVehicleHealth(telemetry, history);
    setHealth(newHealth);
    
    const alerts = newHealth.faults.length + (newHealth.status === "Critical" ? 1 : 0);
    setAlertCount(alerts);
    setHasAlerts(alerts > 0);
  }, [telemetry, source]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0
      ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  if (!isAuthReady) return null;

  // ─── BEHAVIOUR COLORS ─────────────────────────────────────────
  const bColor = behavior === "Economical" ? "var(--green)" : behavior === "Moderate" ? "var(--amber)" : "var(--red)";

  // ─── MAIN APP ─────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-deep)", fontFamily: "Barlow, sans-serif" }}>

      {/* ── LEFT SIDEBAR ────────────────────────────── */}
      <aside className="flex flex-col w-56 border-r relative z-20" style={{ background: "var(--bg-panel)", borderColor: "var(--border)" }}>
        {/* Logo */}
        <div className="px-4 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center" style={{ border: "1px solid var(--cyan-dim)", background: "rgba(0,212,255,0.08)" }}>
              <Cpu size={16} style={{ color: "var(--cyan)" }} />
            </div>
            <div>
              <div className="hud-display text-base font-bold" style={{ color: "var(--cyan)", letterSpacing: "0.05em" }}>AUTO<span style={{ color: "var(--text-primary)" }}>VUE</span></div>
              <div className="hud-label text-[9px]" style={{ color: "var(--text-muted)" }}>OBD-II TELEMETRY</div>
            </div>
          </div>
        </div>

        {/* Status strip */}
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "rgba(0,212,255,0.03)" }}>
          <div className="flex items-center gap-2">
            <motion.div className="w-2 h-2 rounded-full" style={{ background: source === "obd" && isConnected ? "var(--green)" : source === "obd" ? "var(--amber)" : source === "dataset" ? "var(--purple)" : "var(--cyan)" }}
              animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
            <span className="hud-label text-[10px]">
              {source === "obd" ? (isConnected ? "OBD LIVE" : "SEARCHING") : source === "dataset" ? "DATASET PLAYBACK" : "SIMULATION"}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-1">
          {([
            { id: "overview", icon: LayoutDashboard, label: "Overview" },
            { id: "telemetry", icon: Activity, label: "Telemetry" },
            { id: "diagnostics", icon: Shield, label: "Diagnostics" },
            { id: "maintenance", icon: Wrench, label: "Maintenance" },
            { id: "settings", icon: Settings, label: "Settings" },
          ] as { id: Tab; icon: any; label: string }[]).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-none text-left relative group"
              style={{
                color: activeTab === id ? "var(--cyan)" : "var(--text-secondary)",
                background: activeTab === id ? "rgba(0,212,255,0.06)" : "transparent",
                borderLeft: activeTab === id ? "2px solid var(--cyan)" : "2px solid transparent",
              }}
            >
              <Icon size={16} />
              <span>{label}</span>
              {id === "diagnostics" && hasAlerts && (
                <span className="ml-auto w-4 h-4 rounded-none text-[9px] flex items-center justify-center font-bold"
                  style={{ background: "var(--red)", color: "white" }}>
                  {alertCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Backend Status */}
        <div className="px-3 py-3 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between p-2 rounded" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <Server size={14} style={{ color: "var(--text-muted)" }} />
              <div className="text-[10px] font-bold" style={{ color: "var(--text-secondary)", fontFamily: "Share Tech Mono" }}>BACKEND</div>
            </div>
            <div className="flex items-center gap-1.5">
              {isBackendHealthy === null ? (
                <>
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-pulse" />
                  <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>CHECKING</span>
                </>
              ) : isBackendHealthy ? (
                <>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--green)", boxShadow: "0 0 5px var(--green)" }} />
                  <span className="text-[9px]" style={{ color: "var(--green)", fontFamily: "Share Tech Mono" }}>ONLINE</span>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--red)", boxShadow: "0 0 5px var(--red)" }} />
                  <span className="text-[9px]" style={{ color: "var(--red)", fontFamily: "Share Tech Mono" }}>OFFLINE</span>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-3 border-b" style={{ background: "var(--bg-panel)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-6">
            <div>
              <div className="hud-display text-lg font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
                {activeTab === "overview" && "System Overview"}
                {activeTab === "telemetry" && "Live Telemetry"}
                {activeTab === "diagnostics" && "Diagnostics & Health"}
                {activeTab === "maintenance" && "Maintenance Logs"}
                {activeTab === "upload" && "Dataset Upload"}
                {activeTab === "settings" && "System Settings"}
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: bColor }}
                  animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                <span className="hud-label text-[10px]">
                  DRIVE MODE: <span style={{ color: bColor }}>{(apiResponse?.behaviour_class || behavior).toUpperCase()}</span>
                </span>
                <span style={{ color: "var(--border)" }}>|</span>
                <span className="hud-label text-[10px]">TRIP: <span style={{ color: "var(--cyan)", fontFamily: "Share Tech Mono" }}>{formatTime(tripTime)}</span></span>
                <span style={{ color: "var(--border)" }}>|</span>
                <span className="hud-label text-[10px]">DIST: <span style={{ color: "var(--cyan)", fontFamily: "Share Tech Mono" }}>{totalDistance.toFixed(1)} km</span></span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Health badge */}
            <div className="flex items-center gap-2 px-3 py-1.5"
              style={{
                border: `1px solid ${health.status === "Healthy" ? "rgba(0,255,136,0.3)" : health.status === "Warning" ? "rgba(255,184,0,0.3)" : "rgba(255,51,51,0.3)"}`,
                background: health.status === "Healthy" ? "rgba(0,255,136,0.06)" : health.status === "Warning" ? "rgba(255,184,0,0.06)" : "rgba(255,51,51,0.06)",
              }}>
              {health.status === "Healthy" ? <CheckCircle size={14} style={{ color: "var(--green)" }} /> :
               health.status === "Warning" ? <AlertCircle size={14} style={{ color: "var(--amber)" }} /> :
               <AlertTriangle size={14} style={{ color: "var(--red)" }} className="animate-blink" />}
              <span className="hud-label text-[10px]"
                style={{ color: health.status === "Healthy" ? "var(--green)" : health.status === "Warning" ? "var(--amber)" : "var(--red)" }}>
                {health.score}% {health.status.toUpperCase()}
              </span>
            </div>

            {/* Theme Toggle */}
            <button 
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="px-3 py-1.5 flex items-center gap-2 transition-colors" 
              style={{ border: "1px solid var(--border)", background: "rgba(0,0,0,0.3)" }}>
              {theme === "dark" ? <Sun size={14} style={{ color: "var(--amber)" }} /> : <Moon size={14} style={{ color: "var(--cyan)" }} />}
              <span className="hud-label text-[9px]">
                {theme === "dark" ? "LIGHT MODE" : "DARK MODE"}
              </span>
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} className="h-full"
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}>
              {activeTab === "overview" && (
                <OverviewTab telemetry={telemetry} history={history} behavior={behavior} health={health} mileage={mileage} apiResponse={apiResponse} speedUnit={speedUnit} tempUnit={tempUnit} />
              )}
              {activeTab === "telemetry" && (
                <TelemetryPanel telemetry={telemetry} history={history} speedUnit={speedUnit} tempUnit={tempUnit} />
              )}
              {activeTab === "diagnostics" && (
                <HealthMonitor health={health} telemetry={telemetry} history={history} />
              )}
              {activeTab === "maintenance" && (
                <MaintenanceTab
                  health={health}
                  telemetry={telemetry}
                  serviceCompany={serviceCompany}
                  registeredIssues={registeredIssues}
                  setRegisteredIssues={setRegisteredIssues}
                  telegramToken={telegramToken}
                  telegramChatId={telegramChatId}
                  telegramEnabled={telegramEnabled}
                />
              )}
              {activeTab === "settings" && (
                <SettingsTab
                  source={source}
                  onToggleMock={handleToggleDataSource}
                  tempUrl={tempUrl}
                  onUrlChange={setTempUrl}
                  onSaveUrl={handleSaveUrl}
                  isConnected={isConnected}
                  isBackendHealthy={isBackendHealthy}
                  speedUnit={speedUnit}
                  setSpeedUnit={setSpeedUnit}
                  tempUnit={tempUnit}
                  setTempUnit={setTempUnit}
                  resetStates={resetStates}
                  injectDtc={(code: string) => {
                    setTelemetry(prev => ({
                      ...prev,
                      dtcs: prev.dtcs.includes(code) ? prev.dtcs : [...prev.dtcs, code]
                    }));
                  }}
                  serviceCompany={serviceCompany}
                  setServiceCompany={setServiceCompany}
                  telegramToken={telegramToken}
                  setTelegramToken={setTelegramToken}
                  telegramChatId={telegramChatId}
                  setTelegramChatId={setTelegramChatId}
                  telegramEnabled={telegramEnabled}
                  setTelegramEnabled={setTelegramEnabled}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

// ─── OVERVIEW TAB ─────────────────────────────────────────────
const OverviewTab: React.FC<{
  telemetry: TelemetryData; history: TelemetryData[];
  behavior: DriverBehavior; health: HealthStatus; mileage: number;
  apiResponse?: DriverPredictResponse | null;
  speedUnit?: "metric" | "imperial";
  tempUnit?: "metric" | "imperial";
}> = ({ telemetry, history, behavior, health, mileage, apiResponse, speedUnit = "metric", tempUnit = "metric" }) => {
  const currentBehavior = apiResponse?.behaviour_class || behavior;
  const bColor = currentBehavior === "Economical" ? "var(--green)" : currentBehavior === "Moderate" ? "var(--amber)" : "var(--red)";

  const isImperialSpeed = speedUnit === "imperial";
  const isImperialTemp = tempUnit === "imperial";

  const displayVss = isImperialSpeed ? Math.round(telemetry.vss * 0.621371) : telemetry.vss;
  const displayCoolant = isImperialTemp ? Math.round(telemetry.coolantTemp * 1.8 + 32) : telemetry.coolantTemp;
  const displayIntake = isImperialTemp ? Math.round(telemetry.intakeAirTemp * 1.8 + 32) : telemetry.intakeAirTemp;

  return (
    <div className="h-full grid grid-cols-12 grid-rows-6 gap-0 p-0" style={{ background: "var(--bg-deep)" }}>
      
      {/* ── RPM Gauge (col 1-3, row 1-3) */}
      <div className="col-span-3 row-span-3 border-r border-b panel flex flex-col items-center justify-center p-6"
        style={{ borderColor: "var(--border)" }}>
        <div className="hud-label mb-4" style={{ color: "var(--cyan)" }}>ENGINE RPM</div>
        <HUDGauge value={telemetry.rpm} max={7000} color="var(--cyan)" unit="RPM"
          warning={5000} critical={6500} size={180} />
        <div className="mt-4 grid grid-cols-2 gap-4 w-full">
          <MiniStat label="LOAD" value={telemetry.engineLoad > 0 ? `${telemetry.engineLoad}%` : "N/A"} color="var(--cyan)" />
          <MiniStat label="THROTTLE" value={`${telemetry.throttle}%`} color="var(--cyan)" />
        </div>
      </div>

      {/* ── Speed Gauge (col 4-6, row 1-3) */}
      <div className="col-span-3 row-span-3 border-r border-b panel flex flex-col items-center justify-center p-6"
        style={{ borderColor: "var(--border)" }}>
        <div className="hud-label mb-4" style={{ color: "var(--purple)" }}>VEHICLE SPEED</div>
        <HUDGauge value={displayVss} max={isImperialSpeed ? 150 : 240} color="var(--purple)" unit={isImperialSpeed ? "MPH" : "KM/H"}
          warning={isImperialSpeed ? 80 : 130} critical={isImperialSpeed ? 110 : 180} size={180} />
        <div className="mt-4 grid grid-cols-2 gap-4 w-full">
          <MiniStat label="MAF" value={`${telemetry.maf}g/s`} color="var(--purple)" />
          <MiniStat label="GEAR" value="AUTO" color="var(--purple)" />
        </div>
      </div>

      {/* ── Temp Gauge (col 7-9, row 1-3) */}
      <div className="col-span-3 row-span-3 border-r border-b panel flex flex-col items-center justify-center p-6"
        style={{ borderColor: "var(--border)" }}>
        <div className="hud-label mb-4" style={{ color: "var(--amber)" }}>COOLANT TEMP</div>
        <HUDGauge value={displayCoolant} max={isImperialTemp ? 266 : 130} color="var(--amber)" unit={isImperialTemp ? "°F" : "°C"}
          warning={isImperialTemp ? 212 : 100} critical={isImperialTemp ? 240 : 115} size={180} />
        <div className="mt-4 grid grid-cols-2 gap-4 w-full">
          <MiniStat label="IAT" value={isImperialTemp ? `${displayIntake}°F` : `${displayIntake}°C`} color="var(--amber)" />
        </div>
      </div>

      {/* ── Health Score (col 10-12, row 1-3) */}
      <div className="col-span-3 row-span-3 border-b panel flex flex-col p-5"
        style={{ borderColor: "var(--border)" }}>
        <div className="hud-label mb-3" style={{ color: health.status === "Healthy" ? "var(--green)" : health.status === "Warning" ? "var(--amber)" : "var(--red)" }}>
          VEHICLE HEALTH
        </div>
        {/* Big score */}
        <div className="text-center mb-4">
          <div className="hud-display text-7xl font-black"
            style={{ color: health.status === "Healthy" ? "var(--green)" : health.status === "Warning" ? "var(--amber)" : "var(--red)" }}>
            {health.score}
          </div>
          <div className="hud-label text-xs">{health.status.toUpperCase()} INTEGRITY</div>
        </div>

        {/* Mini bars */}
        <div className="space-y-2 flex-1">
          {[
            { label: "ENGINE", val: Math.min(100, 100 - (telemetry.coolantTemp > 100 ? 20 : 0)), color: "var(--green)" },
            { label: "OVERALL", val: health.score, color: health.status === "Healthy" ? "var(--green)" : health.status === "Warning" ? "var(--amber)" : "var(--red)" },
          ].map(({ label, val, color }) => (
            <div key={label}>
              <div className="flex justify-between mb-1">
                <span className="hud-label text-[9px]">{label}</span>
                <span style={{ fontFamily: "Share Tech Mono", fontSize: "10px", color }}>{val}%</span>
              </div>
              <div className="meter-track h-1.5 rounded-none">
                <motion.div className="meter-fill rounded-none"
                  style={{ background: color, width: `${val}%`, boxShadow: `0 0 6px ${color}66` }}
                  animate={{ width: `${val}%` }} transition={{ duration: 0.5 }} />
              </div>
            </div>
          ))}
        </div>

        {health.faults.length > 0 && (
          <div className="mt-3 p-2 alert-flash" style={{ border: "1px solid rgba(255,51,51,0.3)" }}>
            <div className="hud-label text-[9px]" style={{ color: "var(--red)" }}>
              {health.faults.length} ACTIVE FAULT{health.faults.length > 1 ? "S" : ""} DETECTED
            </div>
          </div>
        )}
      </div>

      {/* ── Fuel / Mileage (col 1-4, row 4-6) */}
      <div className="col-span-4 row-span-3 border-r panel p-5 flex flex-col"
        style={{ borderColor: "var(--border)" }}>
        <div className="hud-label mb-3" style={{ color: "var(--green)" }}>EFFICIENCY</div>
        <div className="flex items-end gap-4 mb-4">
          <div>
            <div className="hud-display text-5xl font-black" style={{ color: "var(--green)" }}>
              {mileage > 0 ? mileage.toFixed(1) : "--"}
            </div>
            <div className="hud-label">KM/L INSTANT</div>
          </div>
          <div className="flex-1 pb-1">
            <div className="hud-label text-[9px] mb-1">L/100KM EQUIV</div>
            <div className="text-lg font-bold" style={{ fontFamily: "Share Tech Mono", color: "var(--text-secondary)" }}>
              {mileage > 0 ? (100 / mileage).toFixed(1) : "--"}
            </div>
          </div>
        </div>
        {/* Mileage sparkline */}
        <div className="flex-1 min-h-0">
          <LiveChart data={history.map((h, i) => ({ t: i, v: calculateMileage(h) }))}
            color="var(--green)" label="km/L" maxPoints={60} height={80} />
        </div>
      </div>

      {/* ── Driver Behavior (col 5-8, row 4-6) */}
      <div className="col-span-4 row-span-3 border-r panel p-5 flex flex-col"
        style={{ borderColor: "var(--border)" }}>
        <div className="hud-label mb-3" style={{ color: "var(--purple)" }}>DRIVER PROFILE</div>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 p-3" style={{ border: `1px solid ${bColor}33`, background: `${bColor}08` }}>
            <div className="hud-display text-2xl font-black" style={{ color: bColor }}>{currentBehavior.toUpperCase()}</div>
            <div className="hud-label text-[9px]">DRIVING MODE</div>
          </div>
          <div className="text-right">
            <div className="text-xs" style={{ fontFamily: "Share Tech Mono", color: "var(--text-secondary)" }}>CLUSTER {apiResponse?.cluster_id ?? 3}</div>
            <div className="text-xs" style={{ fontFamily: "Share Tech Mono", color: "var(--text-secondary)" }}>ML ENGINE</div>
          </div>
        </div>
        {/* Behavior bars or Debug features */}
        <div className="space-y-2 mb-4">
          {apiResponse ? (
            <>
              {[
                { label: "RPM STD", val: apiResponse.features_debug["Engine RPM [RPM]_std"], max: 500 },
                { label: "ACCEL STD", val: apiResponse.features_debug["acceleration_std"], max: 10 },
                { label: "THROTTLE STD", val: apiResponse.features_debug["Absolute Throttle Position [%]_std"], max: 10 },
              ].map(({ label, val, max }) => (
                <div key={label}>
                  <div className="flex justify-between mb-1">
                    <span className="hud-label text-[9px]">{label}</span>
                    <span style={{ fontFamily: "Share Tech Mono", fontSize: "10px", color: bColor }}>{val.toFixed(2)}</span>
                  </div>
                  <div className="meter-track h-1 rounded-none">
                    <motion.div className="meter-fill" style={{ background: bColor, width: `${Math.min(100, (val / max) * 100)}%` }}
                      animate={{ width: `${Math.min(100, (val / max) * 100)}%` }} transition={{ duration: 0.4 }} />
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              {[
                { label: "THROTTLE RESPONSE", val: telemetry.throttle, max: 100 },
                { label: "RPM VARIANCE", val: Math.min(100, (telemetry.rpm / 7000) * 100), max: 100 },
              ].map(({ label, val, max }) => (
                <div key={label}>
                  <div className="flex justify-between mb-1">
                    <span className="hud-label text-[9px]">{label}</span>
                    <span style={{ fontFamily: "Share Tech Mono", fontSize: "10px", color: bColor }}>{Math.round(val)}%</span>
                  </div>
                  <div className="meter-track h-1 rounded-none">
                    <motion.div className="meter-fill" style={{ background: bColor, width: `${(val / max) * 100}%` }}
                      animate={{ width: `${(val / max) * 100}%` }} transition={{ duration: 0.4 }} />
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
        <div className="flex-1 min-h-0">
          <LiveChart data={history.map((h, i) => ({ t: i, v: h.throttle }))}
            color={bColor} label="Throttle" maxPoints={60} height={70} />
        </div>
      </div>

      {/* ── DTC / Status (col 9-12, row 4-6) */}
      <div className="col-span-4 row-span-3 panel p-5 flex flex-col"
        style={{ borderColor: "var(--border)" }}>
        <div className="hud-label mb-3" style={{ color: "var(--red)" }}>FAULT CODES</div>
        {telemetry.dtcs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <CheckCircle size={32} style={{ color: "var(--green)", opacity: 0.7 }} />
            <div className="hud-label text-center" style={{ color: "var(--text-muted)" }}>
              NO ACTIVE FAULTS<br />ALL SYSTEMS NOMINAL
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {telemetry.dtcs.map((code) => (
              <div key={code} className="p-2 alert-flash" style={{ border: "1px solid rgba(255,51,51,0.3)" }}>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={12} style={{ color: "var(--red)" }} className="animate-blink" />
                  <span className="hud-display text-sm font-bold" style={{ color: "var(--red)" }}>{code}</span>
                </div>
                <div className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
                  {code === "P0300" ? "Random/Multiple Misfire Detected" : code === "P0171" ? "System Too Lean (Bank 1)" : "Diagnostic Trouble Code"}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto pt-3 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="ENGINE LOAD" value={`${telemetry.engineLoad}%`} color="var(--cyan)" />
            <MiniStat label="IAT" value={`${telemetry.intakeAirTemp}°C`} color="var(--amber)" />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── MAINTENANCE TAB ──────────────────────────────────────────
const MaintenanceTab: React.FC<{
  health: HealthStatus;
  telemetry: TelemetryData;
  serviceCompany: ServiceCompanyDetails;
  registeredIssues: RegisteredIssue[];
  setRegisteredIssues: React.Dispatch<React.SetStateAction<RegisteredIssue[]>>;
  telegramToken: string;
  telegramChatId: string;
  telegramEnabled: boolean;
}> = ({
  health,
  telemetry,
  serviceCompany,
  registeredIssues,
  setRegisteredIssues,
  telegramToken,
  telegramChatId,
  telegramEnabled,
}) => {
  // Form states
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<"low" | "medium" | "high">("medium");
  const [ticketSuccessMsg, setTicketSuccessMsg] = useState<string | null>(null);
  
  // Telegram status states
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<{ success: boolean; msg: string } | null>(null);

  const handleRegisterTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `#SR-${Math.floor(1000 + Math.random() * 9000)}`;
    const newTicket: RegisteredIssue = {
      id: newId,
      date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dtcCodes: [...telemetry.dtcs],
      description: description.trim() || "Regular vehicle check and maintenance",
      urgency,
      status: "pending",
      companyDetails: { ...serviceCompany }
    };
    
    setRegisteredIssues(prev => [newTicket, ...prev]);
    setDescription("");
    setTicketSuccessMsg(`Ticket ${newId} registered successfully for ${serviceCompany.name}!`);

    // TELEGRAM DISPATCH GATEWAY
    if (telegramEnabled && telegramToken && telegramChatId) {
      setIsSendingTelegram(true);
      setTelegramStatus(null);
      try {
        const escapeHtml = (text: string) => {
          return (text || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
        };

        const escapedId = escapeHtml(newId);
        const escapedDate = escapeHtml(newTicket.date);
        const escapedUrgency = escapeHtml(urgency.toUpperCase());
        const escapedName = escapeHtml(serviceCompany.name);
        const escapedPhone = escapeHtml(serviceCompany.phone || "Not configured");
        const escapedEmail = escapeHtml(serviceCompany.email || "Not configured");
        const escapedDescription = escapeHtml(newTicket.description);

        const codesStr = newTicket.dtcCodes.length > 0 
          ? newTicket.dtcCodes.map(c => `• <code>${escapeHtml(c)}</code>`).join("\n") 
          : "• <i>No active trouble codes</i>";

        const messageText = `<b>🚗 OBD-II GUARDIAN: VEHICLE TICKET FAULT REGISTERED</b>\n\n` +
          `<b>🎫 Ticket ID:</b> <code>${escapedId}</code>\n` +
          `<b>📅 Timestamp:</b> <code>${escapedDate}</code>\n` +
          `<b>⚠️ Urgency Class:</b> <code>${escapedUrgency}</code>\n\n` +
          `<b>🏢 Dispatch Target:</b> <b>${escapedName}</b>\n` +
          `<b>📞 Support Hotkey:</b> <code>${escapedPhone}</code>\n` +
          `<b>✉️ Support Email:</b> <code>${escapedEmail}</code>\n\n` +
          `<b>📝 Symptom Report / Details:</b>\n<i>"${escapedDescription}"</i>\n\n` +
          `<b>🚨 OBD-II Diagnostics (Attached ECU DTCs):</b>\n` +
          codesStr + `\n\n` +
          `<i>Sent automatically via integrated Telegram gateway.</i>`;

        const res = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: messageText,
            parse_mode: "HTML"
          })
        });

        const resData = await res.json();
        if (resData.ok) {
          setTelegramStatus({ success: true, msg: "Dispatched to Telegram Bot successfully!" });
        } else {
          setTelegramStatus({ success: false, msg: `Telegram API: ${resData.description}` });
        }
      } catch (err: any) {
        setTelegramStatus({ success: false, msg: `Network Fault: ${err.message}` });
      } finally {
        setIsSendingTelegram(false);
      }
    }

    setTimeout(() => {
      setTicketSuccessMsg(null);
      setTelegramStatus(null);
    }, 6000);
  };

  const handleCancelTicket = (id: string) => {
    setRegisteredIssues(prev => prev.filter(t => t.id !== id));
  };

  const handleMarkResolved = (id: string) => {
    setRegisteredIssues(prev => prev.map(t => t.id === id ? { ...t, status: "resolved" as const } : t));
  };

  return (
    <div className="h-full overflow-y-auto scroll-area p-6" style={{ background: "var(--bg-deep)" }}>
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <div className="hud-display text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            VEHICLE SERVICE & DISPATCH PORTAL
          </div>
          <div className="hud-label text-[10px]" style={{ color: "var(--text-muted)" }}>
            REGISTER FAULTS, MONITOR SENSOR INCIDENTS AND TRANSMIT TICKETS TO ROADSIDE PARTNERS OVER SECURE CHANNELS
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT AREA: Issue Reporter & History Log (col 8) */}
          <div className="lg:col-span-8 space-y-6">

            {/* ─── REGISTER ISSUE / REPORT FAULT ─── */}
            <div className="panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} style={{ color: "var(--red)" }} />
                  <span className="hud-display text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                    REGISTER A VEHICLE SERVICE FAULT TICKET
                  </span>
                </div>
                {telegramEnabled && telegramToken && telegramChatId && (
                  <span className="px-2 py-0.5 hud-label text-[8px] font-mono border border-green-500/30 text-green-400 bg-green-500/5 animate-pulse">
                    ● TELEGRAM GATEWAY ACTIVE
                  </span>
                )}
              </div>

              {telemetry.dtcs.length > 0 ? (
                <div className="p-3 border border-red-500/30 bg-red-500/5 flex items-start gap-3 animate-fade-in">
                  <AlertTriangle size={16} style={{ color: "var(--red)" }} className="animate-pulse mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-red-400 font-mono">
                      ACTIVE ECU DIAGNOSTIC FAULTS DETECTED: {telemetry.dtcs.join(", ")}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                      Car sensor relays registered active fault codes. Submitting this ticket will attach all active DTC configurations for accurate mechanic diagnostics.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 border border-green-500/20 bg-green-500/5 flex items-start gap-3">
                  <CheckCircle size={16} style={{ color: "var(--green)" }} className="mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-green-400 font-mono">
                      ALL ECU SENSORS HEALTHY
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                      No active trouble codes are present. You can still register custom issues (e.g., oil level, fluid leaks, transmission sound, squeaking brakes) manually below.
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleRegisterTicket} className="space-y-4">
                <div>
                  <label className="hud-label text-[10px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
                    ECU FAULT CODES TO ATTACH
                  </label>
                  <div className="p-2 border bg-black/30 font-mono text-xs flex flex-wrap gap-1.5" style={{ borderColor: "var(--border)" }}>
                    {telemetry.dtcs.length === 0 ? (
                      <span className="text-[11px] text-[var(--text-muted)] italic">No active trouble codes to attach</span>
                    ) : (
                      telemetry.dtcs.map(code => (
                        <span key={code} className="px-1.5 py-0.5 bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-bold">
                          {code} ({code === "P0300" ? "Misfire" : code === "P0171" ? "Lean Fuel Blend" : code === "P0420" ? "Catalyst Inefficient" : "Fault Code"})
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label className="hud-label text-[10px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
                    DETAILED SYMPTOMS & ISSUE DESCRIPTION
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe symptoms or service required (e.g. Engine knocking at idle, fluid leakage on garage floor, brake squeal under light load)"
                    required
                    className="w-full bg-black/40 text-xs p-3 outline-none font-mono focus:border-red-500/30 resize-none"
                    style={{
                      border: "1px solid var(--border)",
                      color: "var(--text-primary)",
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="hud-label text-[10px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
                      URGENCY LEVEL
                    </label>
                    <div className="flex border" style={{ borderColor: "var(--border)" }}>
                      {(["low", "medium", "high"] as const).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setUrgency(level)}
                          className="flex-1 py-1.5 text-[9px] font-mono font-bold transition-all uppercase"
                          style={{
                            background: urgency === level ? (level === "high" ? "rgba(255,51,51,0.15)" : level === "medium" ? "rgba(255,184,0,0.15)" : "rgba(0,255,136,0.15)") : "transparent",
                            color: urgency === level ? (level === "high" ? "var(--red)" : level === "medium" ? "var(--amber)" : "var(--green)") : "var(--text-muted)",
                            borderRight: level !== "high" ? "1px solid var(--border)" : "none"
                          }}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col justify-end">
                    <button
                      type="submit"
                      disabled={isSendingTelegram}
                      className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold transition-all border flex items-center justify-center gap-2 uppercase disabled:opacity-50"
                      style={{ borderColor: "rgba(255,51,51,0.4)" }}
                    >
                      {isSendingTelegram ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          DISPATCHING TICKET...
                        </>
                      ) : (
                        <>
                          <Wrench size={12} />
                          TRANSMIT TICKET TO {serviceCompany.name.toUpperCase()}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {ticketSuccessMsg && (
                  <div className="p-3.5 border border-green-500/30 bg-green-500/5 text-xs text-[var(--green)] font-mono space-y-1">
                    <div className="font-bold">✓ {ticketSuccessMsg}</div>
                    {telegramEnabled && telegramStatus && (
                      <div className={`text-[11px] font-bold ${telegramStatus.success ? "text-green-400" : "text-amber-400 animate-pulse"}`}>
                        {telegramStatus.success ? "✉ Telegram:" : "⚠️ Telegram:"} {telegramStatus.msg}
                      </div>
                    )}
                  </div>
                )}
              </form>
            </div>

            {/* ─── REGISTERED TICKETS LOG ─── */}
            <div className="panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
              <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: "var(--border)" }}>
                <Clock size={16} style={{ color: "var(--purple)" }} />
                <span className="hud-display text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  REGISTERED VEHICLE SERVICE RECORDS LOG ({registeredIssues.length})
                </span>
              </div>

              {registeredIssues.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-[var(--text-muted)] border border-dashed" style={{ borderColor: "var(--border)" }}>
                  NO CURRENT TICKETS ON FILE WITH YOUR SERVICE PROVIDER.<br />
                  SUBMIT A TICKET ABOVE WHEN A PROBLEM ARISES.
                </div>
              ) : (
                <div className="space-y-3">
                  {registeredIssues.map((ticket) => (
                    <div key={ticket.id} className="p-4 border flex flex-col sm:flex-row justify-between gap-4 animate-fade-in" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.2)" }}>
                      <div className="space-y-1.5 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold text-white">{ticket.id}</span>
                          <span className="text-[10px] text-[var(--text-muted)] font-mono">{ticket.date}</span>
                          <span className="px-1.5 py-0.5 text-[8px] font-mono border"
                            style={{
                              borderColor: ticket.urgency === "high" ? "rgba(255,51,51,0.3)" : ticket.urgency === "medium" ? "rgba(255,184,0,0.3)" : "rgba(0,255,136,0.3)",
                              color: ticket.urgency === "high" ? "var(--red)" : ticket.urgency === "medium" ? "var(--amber)" : "var(--green)"
                            }}>
                            {ticket.urgency.toUpperCase()} URGENCY
                          </span>
                          <span className="px-1.5 py-0.5 text-[8px] font-mono border"
                            style={{
                              borderColor: ticket.status === "resolved" ? "var(--green)" : "var(--amber)",
                              color: ticket.status === "resolved" ? "var(--green)" : "var(--amber)",
                              background: ticket.status === "resolved" ? "rgba(0,255,136,0.05)" : "rgba(255,184,0,0.05)"
                            }}>
                            {ticket.status === "resolved" ? "RESOLVED" : "PENDING GATEWAY DISPATCH"}
                          </span>
                        </div>

                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-mono">
                          {ticket.description}
                        </p>

                        {ticket.dtcCodes.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            <span className="text-[9px] font-mono text-[var(--text-muted)] self-center mr-1">CODES:</span>
                            {ticket.dtcCodes.map(code => (
                              <span key={code} className="px-1 py-0.5 bg-red-500/5 border border-red-500/20 text-red-400 text-[8px] font-mono font-bold">
                                {code}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="text-[10px] font-mono text-[var(--text-muted)] pt-1">
                          DISPATCHED TO: <span className="text-white">{ticket.companyDetails?.name || "Service Company"}</span>
                        </div>
                      </div>

                      <div className="flex sm:flex-col justify-end gap-2 sm:w-32">
                        {ticket.status !== "resolved" && (
                          <button
                            onClick={() => handleMarkResolved(ticket.id)}
                            className="flex-1 sm:flex-none px-2 py-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-[10px] font-bold border transition-all uppercase"
                            style={{ borderColor: "rgba(0,255,136,0.3)" }}
                          >
                            Mark Resolved
                          </button>
                        )}
                        <button
                          onClick={() => handleCancelTicket(ticket.id)}
                          className="flex-1 sm:flex-none px-2 py-1 bg-black/40 hover:bg-red-500/10 hover:text-red-400 text-[10px] font-mono text-[var(--text-muted)] border border-white/10 hover:border-red-500/30 transition-all uppercase"
                        >
                          Delete Ticket
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT AREA: Provider Card and Telegram Status Card (col 4) */}
          <div className="lg:col-span-4 space-y-6">

            {/* ─── CURRENT SERVICE PROVIDER CARD ─── */}
            <div className="panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
              <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: "var(--border)" }}>
                <User size={16} style={{ color: "var(--cyan)" }} />
                <span className="hud-display text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  CURRENT SERVICE PARTNER
                </span>
              </div>

              <div className="space-y-3 font-mono">
                <div>
                  <div className="hud-label text-[9px]" style={{ color: "var(--text-muted)" }}>COMPANY NAME</div>
                  <div className="text-sm font-bold text-[var(--cyan)]">{serviceCompany.name}</div>
                </div>

                <div>
                  <div className="hud-label text-[9px]" style={{ color: "var(--text-muted)" }}>SUPPORT CONTACT PHONE</div>
                  <div className="text-xs text-[var(--text-primary)]">{serviceCompany.phone || "Not set"}</div>
                </div>

                <div>
                  <div className="hud-label text-[9px]" style={{ color: "var(--text-muted)" }}>SUPPORT CONTACT EMAIL</div>
                  <div className="text-xs text-[var(--text-primary)]">{serviceCompany.email || "Not set"}</div>
                </div>

                <div>
                  <div className="hud-label text-[9px]" style={{ color: "var(--text-muted)" }}>FACILITY / DISPATCH CENTER</div>
                  <div className="text-xs text-[var(--text-primary)]">{serviceCompany.address || "Not set"}</div>
                </div>
              </div>

              <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
                <p className="text-[10px] text-[var(--text-muted)] leading-relaxed italic mb-2">
                  Need to change mechanic or roadside assistance partner? Update provider records in the settings dashboard.
                </p>
                <div className="hud-label text-[10px] text-[var(--cyan)] flex items-center gap-1 font-bold">
                  <span>SETTINGS TAB &gt; SYSTEM CONFIGURATION</span>
                </div>
              </div>
            </div>

            {/* ─── TELEGRAM BOT GATEWAY STATUS CARD ─── */}
            <div className="panel p-5 space-y-4 font-mono" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
              <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: "var(--border)" }}>
                <Radio size={16} style={{ color: telegramEnabled ? "var(--green)" : "var(--text-muted)" }} className={telegramEnabled ? "animate-pulse" : ""} />
                <span className="hud-display text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  TELEGRAM TELEMETRY GATEWAY
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-[var(--text-muted)]">GATEWAY STATUS:</span>
                  <span className={`font-bold px-1.5 py-0.5 border ${telegramEnabled ? "text-green-400 border-green-500/20 bg-green-500/5" : "text-[var(--text-muted)] border-white/10"}`}>
                    {telegramEnabled ? "ACTIVE (LIVE)" : "MUTED / DISABLED"}
                  </span>
                </div>

                {telegramEnabled ? (
                  <>
                    <div>
                      <span className="text-[9px] text-[var(--text-muted)] block">TARGET CHAT ID</span>
                      <span className="text-[11px] text-[var(--text-primary)] block break-all">{telegramChatId || "Empty"}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-[var(--text-muted)] block">BOT KEY PREFIX</span>
                      <span className="text-[11px] text-[var(--text-primary)] block">
                        {telegramToken ? `${telegramToken.slice(0, 8)}...` : "None"}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                    Telegram integration is currently disabled. Enable the bot gateway in settings to receive real-time fault tickets on your mobile device.
                  </p>
                )}
              </div>
            </div>

            {/* ─── DIAGNOSTIC CHECKS GUIDANCE ─── */}
            <div className="panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
              <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: "var(--border)" }}>
                <Shield size={16} style={{ color: "var(--amber)" }} />
                <span className="hud-display text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                  ECU TROUBLE CODES DECODER
                </span>
              </div>

              <div className="space-y-3">
                <div className="p-2.5 border" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.1)" }}>
                  <div className="text-xs font-bold text-red-400 font-mono">P0300</div>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">RANDOM/MULTIPLE ENGINE MISFIRE DETECTED</div>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                    Indicates spark plugs, ignition coils, or fuel injector delivery are failing under drive load. Urgent service required.
                  </p>
                </div>

                <div className="p-2.5 border" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.1)" }}>
                  <div className="text-xs font-bold text-red-400 font-mono">P0171</div>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">AIR-FUEL RATIO SYSTEM TOO LEAN (BANK 1)</div>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                    Indicates vacuum leaks or failing Mass Air Flow (MAF) sensors. Can degrade catalytic converters quickly.
                  </p>
                </div>

                <div className="p-2.5 border" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.1)" }}>
                  <div className="text-xs font-bold text-red-400 font-mono">P0420</div>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">CATALYST EFFICIENCY BELOW THRESHOLD</div>
                  <p className="text-[10px] text-[var(--text-secondary)] mt-1 leading-relaxed">
                    Exhaust gas levels entering or leaving the catalyst are abnormal. Check O2 sensor voltage.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

// ─── MINI STAT ────────────────────────────────────────────────
export const MiniStat: React.FC<{ label: string; value: string | number; color: string }> = ({ label, value, color }) => (
  <div className="p-2" style={{ border: "1px solid var(--border)", background: "rgba(0,0,0,0.3)" }}>
    <div className="hud-label text-[9px] mb-0.5">{label}</div>
    <div className="text-sm font-bold" style={{ fontFamily: "Share Tech Mono", color }}>{value}</div>
  </div>
);

// ─── SYSTEM SETTINGS TAB ──────────────────────────────────────
const SettingsTab: React.FC<{
  source: "mock" | "obd" | "dataset";
  onToggleMock: () => void;
  tempUrl: string;
  onUrlChange: (url: string) => void;
  onSaveUrl: () => void;
  isConnected: boolean;
  isBackendHealthy: boolean | null;
  speedUnit: "metric" | "imperial";
  setSpeedUnit: (unit: "metric" | "imperial") => void;
  tempUnit: "metric" | "imperial";
  setTempUnit: (unit: "metric" | "imperial") => void;
  resetStates: () => void;
  injectDtc: (code: string) => void;
  serviceCompany: ServiceCompanyDetails;
  setServiceCompany: React.Dispatch<React.SetStateAction<ServiceCompanyDetails>>;
  telegramToken: string;
  setTelegramToken: (token: string) => void;
  telegramChatId: string;
  setTelegramChatId: (chatId: string) => void;
  telegramEnabled: boolean;
  setTelegramEnabled: (enabled: boolean) => void;
}> = ({
  source,
  onToggleMock,
  tempUrl,
  onUrlChange,
  onSaveUrl,
  isConnected,
  isBackendHealthy,
  speedUnit,
  setSpeedUnit,
  tempUnit,
  setTempUnit,
  resetStates,
  injectDtc,
  serviceCompany,
  setServiceCompany,
  telegramToken,
  setTelegramToken,
  telegramChatId,
  setTelegramChatId,
  telegramEnabled,
  setTelegramEnabled,
}) => {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [companySuccessMsg, setCompanySuccessMsg] = useState<string | null>(null);
  const [telegramSuccessMsg, setTelegramSuccessMsg] = useState<string | null>(null);
  const [telegramErrorMsg, setTelegramErrorMsg] = useState<string | null>(null);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);

  const handleTestTelegram = async () => {
    if (!telegramToken || !telegramChatId) {
      setTelegramErrorMsg("Bot Token and Chat ID are required to test.");
      setTimeout(() => setTelegramErrorMsg(null), 4000);
      return;
    }

    setIsTestingTelegram(true);
    setTelegramSuccessMsg(null);
    setTelegramErrorMsg(null);

    try {
      const testMsg = `<b>🚗 OBD-II GUARDIAN: GATEWAY TEST SUCCESSFUL</b>\n\n` +
        `This is a test notification confirming your Telegram Bot API connection to AutoVue is functional!\n\n` +
        `• <b>Bot Token:</b> <code>Verified</code>\n` +
        `• <b>Chat ID:</b> <code>${telegramChatId}</code>\n` +
        `• <b>Timestamp:</b> <code>${new Date().toLocaleTimeString()}</code>`;

      const res = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: testMsg,
          parse_mode: "HTML"
        })
      });

      const resData = await res.json();
      if (resData.ok) {
        setTelegramSuccessMsg("Test message dispatched successfully! Check your Telegram chat.");
      } else {
        setTelegramErrorMsg(`Telegram API: ${resData.description}`);
      }
    } catch (err: any) {
      setTelegramErrorMsg(`Network Error: ${err.message}`);
    } finally {
      setIsTestingTelegram(false);
      setTimeout(() => {
        setTelegramSuccessMsg(null);
        setTelegramErrorMsg(null);
      }, 5000);
    }
  };

  const [compName, setCompName] = useState(serviceCompany.name);
  const [compEmail, setCompEmail] = useState(serviceCompany.email);
  const [compPhone, setCompPhone] = useState(serviceCompany.phone);
  const [compAddress, setCompAddress] = useState(serviceCompany.address);

  // Sync with prop when tab mounts / resets
  useEffect(() => {
    setCompName(serviceCompany.name);
    setCompEmail(serviceCompany.email);
    setCompPhone(serviceCompany.phone);
    setCompAddress(serviceCompany.address);
  }, [serviceCompany]);

  const handleSaveCompany = (e: React.FormEvent) => {
    e.preventDefault();
    setServiceCompany({
      name: compName,
      email: compEmail,
      phone: compPhone,
      address: compAddress
    });
    setCompanySuccessMsg("Service provider details updated successfully!");
    setTimeout(() => setCompanySuccessMsg(null), 3000);
  };

  const handleSave = () => {
    onSaveUrl();
    setSuccessMsg("Backend URL saved successfully!");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="h-full overflow-y-auto scroll-area p-6" style={{ background: "var(--bg-deep)" }}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <div className="hud-display text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            SYSTEM CONFIGURATION
          </div>
          <div className="hud-label text-[10px]" style={{ color: "var(--text-muted)" }}>
            MANAGE DATA SOURCES, DEVICE INTERFACES, DISPLAY UNITS AND CALIBRATION CONTROLS
          </div>
        </div>

        {/* ─── DATA SOURCE SELECTION ─── */}
        <div className="panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <Database size={16} style={{ color: "var(--cyan)" }} />
              <span className="hud-display text-base font-bold" style={{ color: "var(--text-primary)" }}>
                TELEMETRY SOURCE MODES
              </span>
            </div>
            <span className="px-2 py-0.5 hud-label text-[9px] font-mono border"
              style={{
                borderColor: source === "obd" ? "var(--green)" : "var(--cyan)",
                color: source === "obd" ? "var(--green)" : "var(--cyan)",
                background: source === "obd" ? "rgba(0,255,136,0.05)" : "rgba(0,212,255,0.05)"
              }}>
              {source === "obd" ? "LIVE OBD-II CH" : "LOCAL SIMULATOR"}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Live OBD Mode Info */}
            <div className="p-4 space-y-2 border" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.15)" }}>
              <div className="hud-label text-xs font-bold" style={{ color: source === "obd" ? "var(--green)" : "var(--text-muted)" }}>
                OBD-II LIVE OVER AIR (DEFAULT)
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Fetches real-time diagnostics parameters directly from physical vehicle gateways or remote emulator servers via REST and WebSockets.
              </p>
              <div className="pt-2 flex items-center gap-1.5 text-[10px] font-mono text-[var(--text-muted)]">
                <span>CHANNEL STATUS:</span>
                {isConnected ? (
                  <span className="text-[var(--green)]">CONNECTED</span>
                ) : (
                  <span className="text-[var(--amber)]">STANDBY / CONNECTING</span>
                )}
              </div>
            </div>

            {/* Mock Sim Mode Control */}
            <div className="p-4 space-y-3 border flex flex-col justify-between"
              style={{
                borderColor: source === "mock" ? "var(--cyan)" : "var(--border)",
                background: source === "mock" ? "rgba(0,212,255,0.04)" : "rgba(0,0,0,0.15)"
              }}>
              <div>
                <div className="hud-label text-xs font-bold" style={{ color: source === "mock" ? "var(--cyan)" : "var(--text-secondary)" }}>
                  MOCK SIMULATOR SWITCH
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-1">
                  Enables a comprehensive local synthetic drivecycle loop simulating RPM, Speed, Loads, and Temperatures for presentation.
                </p>
              </div>

              {/* Slider Toggle Button */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-[10px] font-mono text-[var(--text-muted)]">TOGGLE STATE:</span>
                <button
                  onClick={onToggleMock}
                  className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-bold transition-all border relative"
                  style={{
                    borderColor: source === "mock" ? "var(--cyan)" : "rgba(255,255,255,0.2)",
                    color: source === "mock" ? "var(--cyan)" : "var(--text-muted)",
                    background: source === "mock" ? "rgba(0,212,255,0.12)" : "transparent"
                  }}
                >
                  <motion.div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: source === "mock" ? "var(--cyan)" : "var(--text-muted)" }}
                    animate={source === "mock" ? { opacity: [1, 0.4, 1] } : {}}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  <span>{source === "mock" ? "ACTIVE" : "DISABLED"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── ENDPOINT & TUNNEL CONNECTION ─── */}
        <div className="panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
          <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: "var(--border)" }}>
            <Server size={16} style={{ color: "var(--amber)" }} />
            <span className="hud-display text-base font-bold" style={{ color: "var(--text-primary)" }}>
              OBD-II TUNNEL ENDPOINT
            </span>
          </div>

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Specify the REST and WebSocket gateway API endpoint of your local diagnostic logger (e.g. FastAPI/Pinggy proxy address).
          </p>

          <div className="space-y-3">
            <div>
              <label className="hud-label text-[10px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
                GATEWAY BASE URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tempUrl}
                  onChange={(e) => onUrlChange(e.target.value)}
                  placeholder="e.g., http://localhost:8000"
                  className="flex-1 bg-black/40 text-xs px-3 py-2 outline-none font-mono focus:border-amber-500/50"
                  style={{
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
                <button
                  onClick={handleSave}
                  className="px-4 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold transition-all border flex items-center gap-2"
                  style={{ borderColor: "rgba(255,184,0,0.5)" }}
                >
                  SAVE ENDPOINT
                </button>
              </div>
            </div>

            {successMsg && (
              <div className="text-xs text-[var(--green)] font-mono">
                ✓ {successMsg}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {/* Endpoint Health status card */}
              <div className="p-3 border flex items-center justify-between" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.1)" }}>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">BACKEND INSTANCE:</span>
                <span className="text-xs font-bold font-mono" style={{ color: isBackendHealthy ? "var(--green)" : "var(--red)" }}>
                  {isBackendHealthy === null ? "CHECKING..." : isBackendHealthy ? "ONLINE (CONNECTED)" : "OFFLINE (COULD NOT REACH)"}
                </span>
              </div>

              {/* Endpoint Socket status card */}
              <div className="p-3 border flex items-center justify-between" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.1)" }}>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">LIVE WS CHANNEL:</span>
                <span className="text-xs font-bold font-mono" style={{ color: isConnected ? "var(--green)" : "var(--amber)" }}>
                  {isConnected ? "ACTIVE" : "STANDBY"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── DISPLAY PREFERENCES ─── */}
        <div className="panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
          <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: "var(--border)" }}>
            <Eye size={16} style={{ color: "var(--purple)" }} />
            <span className="hud-display text-base font-bold" style={{ color: "var(--text-primary)" }}>
              DISPLAY PREFERENCES
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Speed units */}
            <div className="space-y-2">
              <span className="hud-label text-[10px] block" style={{ color: "var(--text-muted)" }}>
                VELOCITY UNIT SYSTEM
              </span>
              <div className="flex border" style={{ borderColor: "var(--border)" }}>
                <button
                  onClick={() => setSpeedUnit("metric")}
                  className="flex-1 py-1.5 text-[10px] font-bold transition-all"
                  style={{
                    background: speedUnit === "metric" ? "rgba(168,85,247,0.15)" : "transparent",
                    color: speedUnit === "metric" ? "var(--purple)" : "var(--text-muted)",
                    borderRight: "1px solid var(--border)"
                  }}
                >
                  METRIC (KM/H)
                </button>
                <button
                  onClick={() => setSpeedUnit("imperial")}
                  className="flex-1 py-1.5 text-[10px] font-bold transition-all"
                  style={{
                    background: speedUnit === "imperial" ? "rgba(168,85,247,0.15)" : "transparent",
                    color: speedUnit === "imperial" ? "var(--purple)" : "var(--text-muted)"
                  }}
                >
                  IMPERIAL (MPH)
                </button>
              </div>
            </div>

            {/* Thermal units */}
            <div className="space-y-2">
              <span className="hud-label text-[10px] block" style={{ color: "var(--text-muted)" }}>
                TEMPERATURE SCALING
              </span>
              <div className="flex border" style={{ borderColor: "var(--border)" }}>
                <button
                  onClick={() => setTempUnit("metric")}
                  className="flex-1 py-1.5 text-[10px] font-bold transition-all"
                  style={{
                    background: tempUnit === "metric" ? "rgba(255,184,0,0.15)" : "transparent",
                    color: tempUnit === "metric" ? "var(--amber)" : "var(--text-muted)",
                    borderRight: "1px solid var(--border)"
                  }}
                >
                  CELSIUS (°C)
                </button>
                <button
                  onClick={() => setTempUnit("imperial")}
                  className="flex-1 py-1.5 text-[10px] font-bold transition-all"
                  style={{
                    background: tempUnit === "imperial" ? "rgba(255,184,0,0.15)" : "transparent",
                    color: tempUnit === "imperial" ? "var(--amber)" : "var(--text-muted)"
                  }}
                >
                  FAHRENHEIT (°F)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── CAR SERVICE COMPANY DETAILS ─── */}
        <div className="panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
          <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: "var(--border)" }}>
            <Wrench size={16} style={{ color: "var(--cyan)" }} />
            <span className="hud-display text-base font-bold" style={{ color: "var(--text-primary)" }}>
              CAR SERVICE COMPANY DETAILS
            </span>
          </div>

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Update your preferred automotive service center, mechanic shop, or roadside assistance company details. These contact details are used to file service tickets whenever issues or diagnostic trouble codes (DTCs) arise.
          </p>

          <form onSubmit={handleSaveCompany} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="hud-label text-[10px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
                  COMPANY / SERVICE CENTER NAME
                </label>
                <input
                  type="text"
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  placeholder="e.g., Apex Auto Services"
                  required
                  className="w-full bg-black/40 text-xs px-3 py-2 outline-none font-mono focus:border-cyan-500/50"
                  style={{
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label className="hud-label text-[10px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
                  CONTACT PHONE NUMBER
                </label>
                <input
                  type="text"
                  value={compPhone}
                  onChange={(e) => setCompPhone(e.target.value)}
                  placeholder="e.g., +1 (555) 019-2834"
                  className="w-full bg-black/40 text-xs px-3 py-2 outline-none font-mono focus:border-cyan-500/50"
                  style={{
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label className="hud-label text-[10px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
                  SUPPORT EMAIL ADDRESS
                </label>
                <input
                  type="email"
                  value={compEmail}
                  onChange={(e) => setCompEmail(e.target.value)}
                  placeholder="e.g., service@apexauto.com"
                  className="w-full bg-black/40 text-xs px-3 py-2 outline-none font-mono focus:border-cyan-500/50"
                  style={{
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <div>
                <label className="hud-label text-[10px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
                  SERVICE CENTER ADDRESS
                </label>
                <input
                  type="text"
                  value={compAddress}
                  onChange={(e) => setCompAddress(e.target.value)}
                  placeholder="e.g., 404 Performance Blvd, Detroit, MI"
                  className="w-full bg-black/40 text-xs px-3 py-2 outline-none font-mono focus:border-cyan-500/50"
                  style={{
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {companySuccessMsg ? (
                <span className="text-xs text-[var(--green)] font-mono">
                  ✓ {companySuccessMsg}
                </span>
              ) : (
                <span />
              )}
              <button
                type="submit"
                className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-bold transition-all border flex items-center gap-2"
                style={{ borderColor: "rgba(0,212,255,0.4)" }}
              >
                UPDATE PROVIDER DETAILS
              </button>
            </div>
          </form>
        </div>

        {/* ─── TELEGRAM FAULT DISPATCH GATEWAY ─── */}
        <div className="panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <Radio size={16} style={{ color: "var(--green)" }} className={telegramEnabled ? "animate-pulse" : ""} />
              <span className="hud-display text-base font-bold" style={{ color: "var(--text-primary)" }}>
                TELEGRAM FAULT DISPATCH GATEWAY
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTelegramEnabled(!telegramEnabled)}
              className="px-3 py-1 text-[10px] font-bold border transition-all flex items-center gap-2"
              style={{
                borderColor: telegramEnabled ? "var(--green)" : "rgba(255,255,255,0.2)",
                color: telegramEnabled ? "var(--green)" : "var(--text-muted)",
                background: telegramEnabled ? "rgba(0,255,136,0.1)" : "transparent"
              }}
            >
              <div className={`w-2 h-2 rounded-full ${telegramEnabled ? "bg-green-400 animate-pulse" : "bg-zinc-600"}`} />
              <span>{telegramEnabled ? "ENABLED" : "DISABLED"}</span>
            </button>
          </div>

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            By connecting a custom Telegram Bot, AutoVue will dispatch rich diagnostic fault reports and ticket alerts directly to your mobile devices/group channels upon client-side generation.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="hud-label text-[10px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
                TELEGRAM BOT API TOKEN
              </label>
              <input
                type="password"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
                placeholder="e.g., 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                className="w-full bg-black/40 text-xs px-3 py-2 outline-none font-mono focus:border-green-500/50"
                style={{
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
              <span className="text-[9px] text-[var(--text-muted)] block mt-1">
                Obtained from Telegram's official <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">@BotFather</a>.
              </span>
            </div>

            <div>
              <label className="hud-label text-[10px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
                TELEGRAM TARGET CHAT ID
              </label>
              <input
                type="text"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="e.g., 987654321"
                className="w-full bg-black/40 text-xs px-3 py-2 outline-none font-mono focus:border-green-500/50"
                style={{
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />
              <span className="text-[9px] text-[var(--text-muted)] block mt-1">
                Your personal ID or Group chat ID (can be fetched using <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">@userinfobot</a>).
              </span>
            </div>
          </div>

          {/* Collapsible Quick-Start Guide */}
          <details className="border p-3 border-white/10 bg-black/10 group">
            <summary className="hud-label text-[10px] cursor-pointer text-cyan-400 hover:text-cyan-300 list-none flex items-center justify-between font-bold">
              <span>📖 TELEGRAM BOT CONNECTION SETUP GUIDE (CLICK TO EXPAND)</span>
              <span className="transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="mt-3 text-xs text-[var(--text-secondary)] space-y-2 leading-relaxed">
              <p>
                Follow these simple steps to configure your own real-time dispatch gateway:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-[11px] font-mono">
                <li>Search for <strong className="text-white">@BotFather</strong> on Telegram and start a chat.</li>
                <li>Send the command <code className="text-amber-400">/newbot</code> and follow instructions to name your bot.</li>
                <li>Copy the generated <strong className="text-white">HTTP API Access Token</strong> and paste it above.</li>
                <li>Search for <strong className="text-white">@userinfobot</strong> on Telegram and start it to instantly receive your unique <strong className="text-white">Chat ID</strong>. Paste it above.</li>
                <li><strong>CRITICAL:</strong> Send a <strong>/start</strong> message to your newly created bot first, otherwise Telegram will block its messages!</li>
                <li>Click <strong>TEST DISPATCH GATEWAY</strong> below to verify.</li>
              </ol>
            </div>
          </details>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            <div>
              {telegramSuccessMsg && (
                <span className="text-xs text-[var(--green)] font-mono block">
                  ✓ {telegramSuccessMsg}
                </span>
              )}
              {telegramErrorMsg && (
                <span className="text-xs text-red-400 font-mono block animate-pulse">
                  ⚠️ {telegramErrorMsg}
                </span>
              )}
            </div>
            
            <button
              type="button"
              onClick={handleTestTelegram}
              disabled={isTestingTelegram}
              className="px-4 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-bold transition-all border flex items-center justify-center gap-2 uppercase disabled:opacity-50"
              style={{ borderColor: "rgba(0,255,136,0.4)" }}
            >
              {isTestingTelegram ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  TESTING DISPATCH...
                </>
              ) : (
                <>
                  <Radio size={12} />
                  TEST DISPATCH GATEWAY
                </>
              )}
            </button>
          </div>
        </div>

        {/* ─── TESTING AND DIAGNOSTICS CONTROL ─── */}
        <div className="panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
          <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: "var(--border)" }}>
            <Shield size={16} style={{ color: "var(--red)" }} />
            <span className="hud-display text-base font-bold" style={{ color: "var(--text-primary)" }}>
              OBD-II INJECTOR / FAULT CODE SIMULATOR
            </span>
          </div>

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Verify DTC notification handlers and health metrics scoring maps inside your diagnostics module by injecting diagnostic trouble codes.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <button
              onClick={() => injectDtc("P0300")}
              className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold transition-all"
            >
              INJECT P0300 (MISFIRE)
            </button>
            <button
              onClick={() => injectDtc("P0171")}
              className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold transition-all"
            >
              INJECT P0171 (SYSTEM TOO LEAN)
            </button>
            <button
              onClick={() => injectDtc("P0420")}
              className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold transition-all"
            >
              INJECT P0420 (CATALYST LOW)
            </button>
          </div>
        </div>

        {/* ─── MAINTENANCE & APP CACHE ─── */}
        <div className="panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
          <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: "var(--border)" }}>
            <Wrench size={16} style={{ color: "var(--text-muted)" }} />
            <span className="hud-display text-base font-bold" style={{ color: "var(--text-primary)" }}>
              DASHBOARD CALIBRATION & RESET
            </span>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold text-[var(--text-primary)]">
                RESET SYSTEM TRIP CACHES
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                Clears the active drive session timers, odometer distance logs, sensor graphs buffer history, and restores diagnostic scoring metrics back to standard defaults.
              </p>
            </div>

            <button
              onClick={resetStates}
              className="px-4 py-2 hover:bg-white/10 text-white text-[10px] font-bold transition-all border border-white/20 uppercase"
            >
              RESET ALL TRIP DATA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
