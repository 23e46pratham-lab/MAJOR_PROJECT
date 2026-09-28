/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity, Gauge, AlertTriangle, User, Server,
  Thermometer, Wind, Zap, Loader2,
  LayoutDashboard, Wrench, Radio, MapPin, Navigation2,
  ChevronRight, ChevronDown, ChevronUp, Power, Database, Cpu, Eye,
  TrendingUp, AlertCircle, CheckCircle, Settings, Sliders,
  Fuel, Clock, Shield, BarChart3,
  Wifi, WifiOff, RefreshCw, Bell, BellOff, Sun, Moon, Volume2
} from "lucide-react";
import {
  TelemetryData, DriverBehavior, HealthStatus,
  ServiceCompanyDetails, RegisteredIssue,
  DriverMLResult, HealthMLResult, FuelMLResult, MLInference
} from "../types";
import {
  MaintenanceScheduleItem,
  fetchMaintenanceSchedule,
  getWebSocketUrl,
  mapSimulatedDataToTelemetry,
  getApiBaseUrl,
  setApiBaseUrl,
  checkBackendHealth,
  getLiveData,
  getLatestML,
  getActiveDtcCodes
} from "../services/apiService";
import { HUDGauge } from "./HUDGauge";
import { TelemetryPanel } from "./TelemetryPanel";
import { HealthMonitor } from "./HealthMonitor";
import { LiveChart } from "./LiveChart";
import { GPSMap } from "./GPSMap";

type Tab = "overview" | "telemetry" | "diagnostics" | "map" | "maintenance" | "settings";

// ─── DATA SOURCE HOOK ──────────────────────────────────────────
function useDataSource() {
  const [source, setSource] = useState<"obd" | "mock">("obd");
  const [isConnected, setIsConnected] = useState(false);

  return { source, setSource, isConnected, setIsConnected };
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────
export const Dashboard: React.FC = () => {
  const [telemetry, setTelemetry] = useState<TelemetryData>(() =>
    mapSimulatedDataToTelemetry({
      rpm: 800,
      vss: 0,
      maf: 3.5,
      throttle_pos: 15,
      coolant_temp: 85,
      intake_air_temp: 25,
      ambient_temp: 24,
      map_kpa: 101,
      engine_load: 20,
      dtcs: [],
    })
  );

  const [history, setHistory] = useState<TelemetryData[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [tripTime, setTripTime] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);

  const [speedUnit, setSpeedUnit] = useState<"metric" | "imperial">(() => {
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

  // Maintenance state (kept intact as requested)
  const [serviceCompany, setServiceCompany] = useState<ServiceCompanyDetails>(() => {
    try {
      const stored = localStorage.getItem("obd_service_company");
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return {
      name: "Apex Auto Services",
      email: "service@apexauto.com",
      phone: "+1 (555) 019-2834",
      address: "404 Performance Blvd, Detroit, MI",
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

  const { source, setSource, isConnected, setIsConnected } = useDataSource();
  const tripStartRef = useRef(Date.now());

  const resetStates = useCallback(() => {
    const zeroed = mapSimulatedDataToTelemetry({
      rpm: 0,
      vss: 0,
      maf: 0,
      throttle_pos: 0,
      coolant_temp: 20,
      intake_air_temp: 20,
      dtcs: [],
    });
    setTelemetry(zeroed);
    setHistory([]);
    setTripTime(0);
    setTotalDistance(0);
    tripStartRef.current = Date.now();
  }, []);

  const handleSaveUrl = () => {
    setApiBaseUrl(tempUrl);
    setSavedUrl(tempUrl);
    resetStates();
  };

  // Check backend health periodically
  useEffect(() => {
    const check = async () => {
      try {
        const healthy = await checkBackendHealth();
        setIsBackendHealthy(healthy);
      } catch {
        setIsBackendHealthy(false);
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [savedUrl]);

  // Trip timer
  useEffect(() => {
    const id = setInterval(() => setTripTime(Math.floor((Date.now() - tripStartRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Telemetry loop — Live WebSocket from FastAPI backend + HTTP polling fallback
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let pollInterval: any = null;
    let isStopped = false;
    let usePolling = false;

    const startPolling = () => {
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(async () => {
        if (isStopped) return;
        try {
          const res = await getLiveData();
          const data = mapSimulatedDataToTelemetry(res);
          setTelemetry(data);
          setHistory((h) => [...h.slice(-120), data]);
          if (data.vss > 0) {
            setTotalDistance((d) => d + data.vss / 3600);
          }
          setIsConnected(true);
        } catch {
          setIsConnected(false);
        }
      }, 1000);
    };

    const connect = () => {
      if (isStopped) return;
      const wsUrl = getWebSocketUrl("/api/ws/live");

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setIsConnected(true);
          usePolling = false;
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            const data = mapSimulatedDataToTelemetry(payload);
            setTelemetry(data);
            setHistory((h) => [...h.slice(-120), data]);
            if (data.vss > 0) {
              setTotalDistance((d) => d + data.vss / 3600);
            }
          } catch (err) {
            console.error("[WebSocket] Parse error:", err);
          }
        };

        ws.onerror = () => {
          if (!usePolling) {
            usePolling = true;
            startPolling();
          }
        };

        ws.onclose = () => {
          if (!isStopped) {
            if (!usePolling) {
              usePolling = true;
              startPolling();
            }
            reconnectTimeout = setTimeout(connect, 4000);
          }
        };
      } catch (e) {
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
  }, [savedUrl, setIsConnected]);

  // Health Status object derived from real LSTM Autoencoder API
  const healthStatus: HealthStatus = useMemo(() => {
    const mlHealth = telemetry.ml?.health;
    if (mlHealth) {
      const isAnomaly = mlHealth.is_anomaly;
      const anomalyScore = mlHealth.anomaly_score;
      const faults = [...(telemetry.dtcs || [])];
      if (isAnomaly) {
        faults.push(...(mlHealth.triggered_features || []).map((f) => `Anomaly: ${f}`));
      }
      const score = Math.max(0, 100 - (isAnomaly ? 35 : 0) - faults.length * 15);
      return {
        score,
        status: isAnomaly ? "Critical" : score < 80 ? "Warning" : "Healthy",
        anomalyScore,
        isAnomaly,
        featureErrors: mlHealth.feature_errors || {},
        triggeredFeatures: mlHealth.triggered_features || [],
        faults,
      };
    }

    // Default when waiting for buffer (~24 ticks)
    const faults = [...(telemetry.dtcs || [])];
    if (telemetry.coolantTemp > 105) faults.push("Coolant Temp High");
    const score = Math.max(0, 95 - faults.length * 20);
    return {
      score,
      status: score < 60 || faults.length > 0 ? "Warning" : "Healthy",
      anomalyScore: 0,
      isAnomaly: false,
      featureErrors: {},
      triggeredFeatures: [],
      faults,
    };
  }, [telemetry]);

  // Driving mode from XGBoost ML
  const driverML = telemetry.ml?.driver_behaviour;
  const currentBehavior: DriverBehavior = driverML?.label || "Moderate";
  const bColor =
    currentBehavior === "Economical"
      ? "var(--green)"
      : currentBehavior === "Moderate"
      ? "var(--amber)"
      : "var(--red)";

  // Fuel from 3-tier physics engine
  const fuelML = telemetry.ml?.fuel;
  const mileageVal = fuelML?.mileage_kmpl ?? 0;

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0
      ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-deep)", fontFamily: "Barlow, sans-serif" }}>
      {/* ── LEFT SIDEBAR ────────────────────────────── */}
      <aside className="flex flex-col w-56 border-r relative z-20 shrink-0" style={{ background: "var(--bg-panel)", borderColor: "var(--border)" }}>
        {/* Logo */}
        <div className="px-4 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center" style={{ border: "1px solid var(--cyan-dim)", background: "rgba(0,212,255,0.08)" }}>
              <Cpu size={16} style={{ color: "var(--cyan)" }} />
            </div>
            <div>
              <div className="hud-display text-base font-bold" style={{ color: "var(--cyan)", letterSpacing: "0.05em" }}>
                AUTO<span style={{ color: "var(--text-primary)" }}>VUE</span>
              </div>
              <div className="hud-label text-[9px]" style={{ color: "var(--text-muted)" }}>
                ML DIAGNOSTICS & TELEMETRY
              </div>
            </div>
          </div>
        </div>

        {/* Status strip */}
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "rgba(0,212,255,0.03)" }}>
          <div className="flex items-center gap-2">
            <motion.div
              className="w-2 h-2 rounded-full"
              style={{ background: isConnected ? "var(--green)" : "var(--amber)" }}
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="hud-label text-[10px]">
              {isConnected ? "LIVE TELEMETRY STREAM" : "CONNECTING GATEWAY"}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-1">
          {([
            { id: "overview", icon: LayoutDashboard, label: "Overview" },
            { id: "telemetry", icon: Activity, label: "Telemetry" },
            { id: "diagnostics", icon: Shield, label: "Diagnostics" },
            { id: "map", icon: Navigation2, label: "Map (GPS)" },
            { id: "maintenance", icon: Wrench, label: "Maintenance" },
            { id: "settings", icon: Settings, label: "Settings" },
          ] as { id: Tab; icon: any; label: string }[]).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-none text-left relative group cursor-pointer"
              style={{
                color: activeTab === id ? "var(--cyan)" : "var(--text-secondary)",
                background: activeTab === id ? "rgba(0,212,255,0.06)" : "transparent",
                borderLeft: activeTab === id ? "2px solid var(--cyan)" : "2px solid transparent",
              }}
            >
              <Icon size={16} />
              <span>{label}</span>
              {id === "diagnostics" && healthStatus.faults.length > 0 && (
                <span
                  className="ml-auto w-4 h-4 text-[9px] flex items-center justify-center font-bold"
                  style={{ background: "var(--red)", color: "white" }}
                >
                  {healthStatus.faults.length}
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
              <div className="text-[10px] font-bold font-mono" style={{ color: "var(--text-secondary)" }}>FASTAPI</div>
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
                  <span className="text-[9px] font-mono" style={{ color: "var(--green)" }}>ONLINE</span>
                </>
              ) : (
                <>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--red)", boxShadow: "0 0 5px var(--red)" }} />
                  <span className="text-[9px] font-mono" style={{ color: "var(--red)" }}>OFFLINE</span>
                </>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-3 border-b shrink-0" style={{ background: "var(--bg-panel)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-6">
            <div>
              <div className="hud-display text-lg font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
                {activeTab === "overview" && "System Overview"}
                {activeTab === "telemetry" && "Live Telemetry & Waveforms"}
                {activeTab === "diagnostics" && "LSTM Autoencoder Anomaly Diagnostics"}
                {activeTab === "map" && "GPS Route Tracking & Telemetry Map"}
                {activeTab === "simulator" && "Simulator Playback & Sensor Override Dials"}
                {activeTab === "maintenance" && "Predictive Maintenance Logs"}
                {activeTab === "settings" && "System Settings"}
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: bColor }}
                  animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                <span className="hud-label text-[10px]">
                  XGBOOST DRIVER MODE: <span style={{ color: bColor }}>{currentBehavior.toUpperCase()}</span>
                </span>
                <span style={{ color: "var(--border)" }}>|</span>
                <span className="hud-label text-[10px]">TRIP: <span style={{ color: "var(--cyan)", fontFamily: "Share Tech Mono" }}>{formatTime(tripTime)}</span></span>
                <span style={{ color: "var(--border)" }}>|</span>
                <span className="hud-label text-[10px]">DIST: <span style={{ color: "var(--cyan)", fontFamily: "Share Tech Mono" }}>{totalDistance.toFixed(1)} km</span></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Health status badge */}
            <div
              className="flex items-center gap-2 px-3 py-1.5"
              style={{
                border: `1px solid ${healthStatus.status === "Healthy" ? "rgba(0,255,136,0.3)" : healthStatus.status === "Warning" ? "rgba(255,184,0,0.3)" : "rgba(255,51,51,0.3)"}`,
                background: healthStatus.status === "Healthy" ? "rgba(0,255,136,0.06)" : healthStatus.status === "Warning" ? "rgba(255,184,0,0.06)" : "rgba(255,51,51,0.06)",
              }}
            >
              {healthStatus.status === "Healthy" ? (
                <CheckCircle size={14} style={{ color: "var(--green)" }} />
              ) : healthStatus.status === "Warning" ? (
                <AlertCircle size={14} style={{ color: "var(--amber)" }} />
              ) : (
                <AlertTriangle size={14} style={{ color: "var(--red)" }} className="animate-blink" />
              )}
              <span
                className="hud-label text-[10px]"
                style={{ color: healthStatus.status === "Healthy" ? "var(--green)" : healthStatus.status === "Warning" ? "var(--amber)" : "var(--red)" }}
              >
                {healthStatus.score}% {healthStatus.status.toUpperCase()}
              </span>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="px-3 py-1.5 flex items-center gap-2 transition-colors cursor-pointer"
              style={{ border: "1px solid var(--border)", background: "rgba(0,0,0,0.3)" }}
            >
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
            <motion.div
              key={activeTab}
              className="h-full"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === "overview" && (
                <OverviewTab
                  telemetry={telemetry}
                  history={history}
                  behavior={currentBehavior}
                  driverML={driverML}
                  fuelML={fuelML}
                  healthStatus={healthStatus}
                  speedUnit={speedUnit}
                  tempUnit={tempUnit}
                />
              )}
              {activeTab === "telemetry" && (
                <TelemetryPanel telemetry={telemetry} history={history} speedUnit={speedUnit} tempUnit={tempUnit} />
              )}
              {activeTab === "diagnostics" && (
                <HealthMonitor health={healthStatus} telemetry={telemetry} history={history} />
              )}
              {activeTab === "map" && (
                <GPSMap telemetry={telemetry} speedUnit={speedUnit} />
              )}
              {activeTab === "maintenance" && (
                <MaintenanceTab
                  health={healthStatus}
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
  telemetry: TelemetryData;
  history: TelemetryData[];
  behavior: DriverBehavior;
  driverML?: DriverMLResult;
  fuelML?: FuelMLResult;
  healthStatus: HealthStatus;
  speedUnit?: "metric" | "imperial";
  tempUnit?: "metric" | "imperial";
}> = ({
  telemetry,
  history,
  behavior,
  driverML,
  fuelML,
  healthStatus,
  speedUnit = "metric",
  tempUnit = "metric",
}) => {
  const bColor =
    behavior === "Economical"
      ? "var(--green)"
      : behavior === "Moderate"
      ? "var(--amber)"
      : "var(--red)";

  const isImperialSpeed = speedUnit === "imperial";
  const isImperialTemp = tempUnit === "imperial";

  const displayVss = isImperialSpeed ? Math.round(telemetry.vss * 0.621371) : telemetry.vss;
  const displayCoolant = isImperialTemp ? Math.round(telemetry.coolantTemp * 1.8 + 32) : telemetry.coolantTemp;
  const displayIntake = isImperialTemp ? Math.round(telemetry.intakeAirTemp * 1.8 + 32) : telemetry.intakeAirTemp;

  const mileageVal = fuelML?.mileage_kmpl ?? 0;
  const fcrVal = fuelML?.fcr_gs ?? 0;
  const fuelTier = fuelML?.tier ?? 1;
  const fuelMethod = fuelML?.method ?? "maf";

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
          <MiniStat label="MAP" value={telemetry.mapKpa ? `${telemetry.mapKpa}kPa` : "N/A"} color="var(--purple)" />
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
          <MiniStat label="AMBIENT" value={telemetry.ambientTemp !== undefined ? `${telemetry.ambientTemp}°C` : "24°C"} color="var(--amber)" />
        </div>
      </div>

      {/* ── Health Score (col 10-12, row 1-3) */}
      <div className="col-span-3 row-span-3 border-b panel flex flex-col p-5"
        style={{ borderColor: "var(--border)" }}>
        <div className="hud-label mb-3" style={{ color: healthStatus.status === "Healthy" ? "var(--green)" : healthStatus.status === "Warning" ? "var(--amber)" : "var(--red)" }}>
          LSTM AUTOENCODER HEALTH
        </div>
        <div className="text-center mb-4">
          <div className="hud-display text-7xl font-black"
            style={{ color: healthStatus.status === "Healthy" ? "var(--green)" : healthStatus.status === "Warning" ? "var(--amber)" : "var(--red)" }}>
            {healthStatus.score}
          </div>
          <div className="hud-label text-xs">{healthStatus.status.toUpperCase()} INTEGRITY</div>
        </div>

        <div className="space-y-2 flex-1">
          <div>
            <div className="flex justify-between mb-1">
              <span className="hud-label text-[9px]">ANOMALY SCORE</span>
              <span style={{ fontFamily: "Share Tech Mono", fontSize: "10px", color: healthStatus.isAnomaly ? "var(--red)" : "var(--green)" }}>
                {healthStatus.anomalyScore > 0 ? healthStatus.anomalyScore.toFixed(4) : "0.0000"}
              </span>
            </div>
            <div className="meter-track h-1.5">
              <motion.div className="meter-fill"
                style={{ background: healthStatus.isAnomaly ? "var(--red)" : "var(--green)", width: `${healthStatus.isAnomaly ? 100 : 15}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="hud-label text-[9px]">TRIGGERED ANOMALIES</span>
              <span style={{ fontFamily: "Share Tech Mono", fontSize: "10px", color: "var(--cyan)" }}>
                {healthStatus.triggeredFeatures.length} FEATURES
              </span>
            </div>
          </div>
        </div>

        {healthStatus.faults.length > 0 && (
          <div className="mt-3 p-2 alert-flash" style={{ border: "1px solid rgba(255,51,51,0.3)" }}>
            <div className="hud-label text-[9px]" style={{ color: "var(--red)" }}>
              {healthStatus.faults.length} ACTIVE FAULT{healthStatus.faults.length > 1 ? "S" : ""} / DTCs
            </div>
          </div>
        )}
      </div>

      {/* ── Fuel / Mileage 3-Tier (col 1-4, row 4-6) */}
      <div className="col-span-4 row-span-3 border-r panel p-5 flex flex-col"
        style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="hud-label" style={{ color: "var(--green)" }}>3-TIER FUEL PHYSICS ENGINE</div>
          <span className="px-1.5 py-0.5 text-[9px] font-mono border text-green-400 border-green-500/30 bg-green-500/10">
            TIER {fuelTier}: {fuelMethod.toUpperCase()}
          </span>
        </div>

        <div className="flex items-end gap-4 mb-4">
          <div>
            <div className="hud-display text-5xl font-black" style={{ color: "var(--green)" }}>
              {mileageVal !== null && mileageVal > 0 ? mileageVal.toFixed(1) : "--"}
            </div>
            <div className="hud-label">KM/L INSTANT</div>
          </div>
          <div className="flex-1 pb-1">
            <div className="hud-label text-[9px] mb-1">CONSUMPTION RATE (FCR)</div>
            <div className="text-lg font-bold" style={{ fontFamily: "Share Tech Mono", color: "var(--text-secondary)" }}>
              {fcrVal > 0 ? `${fcrVal.toFixed(2)} g/s` : "--"}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <LiveChart
            data={history.map((h, i) => ({ t: i, v: h.ml?.fuel?.mileage_kmpl ?? 0 }))}
            color="var(--green)"
            label="km/L"
            maxPoints={60}
            height={80}
          />
        </div>
      </div>

      {/* ── Driver Behavior (col 5-8, row 4-6) */}
      <div className="col-span-4 row-span-3 border-r panel p-5 flex flex-col"
        style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="hud-label" style={{ color: "var(--purple)" }}>XGBOOST DRIVER BEHAVIOUR</div>
          {driverML?.confidence && (
            <span className="text-[10px] font-mono text-purple-400">
              CONFIDENCE: {Math.round(driverML.confidence * 100)}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 mb-3">
          <div className="flex-1 p-3" style={{ border: `1px solid ${bColor}33`, background: `${bColor}08` }}>
            <div className="hud-display text-2xl font-black" style={{ color: bColor }}>
              {behavior.toUpperCase()}
            </div>
            <div className="hud-label text-[9px]">DRIVING PROFILE</div>
          </div>
        </div>

        {/* TTS message from XGBoost */}
        {driverML?.tts_message && (
          <div className="p-2 border border-purple-500/20 bg-purple-500/5 mb-3 text-[11px] text-zinc-300 font-sans flex items-start gap-2">
            <Volume2 size={14} className="text-purple-400 shrink-0 mt-0.5" />
            <span className="leading-tight">{driverML.tts_message}</span>
          </div>
        )}

        <div className="flex-1 min-h-0">
          <LiveChart
            data={history.map((h, i) => ({ t: i, v: h.throttle }))}
            color={bColor}
            label="Throttle"
            maxPoints={60}
            height={60}
          />
        </div>
      </div>

      {/* ── DTC / Status (col 9-12, row 4-6) */}
      <div className="col-span-4 row-span-3 panel p-5 flex flex-col"
        style={{ borderColor: "var(--border)" }}>
        <div className="hud-label mb-3" style={{ color: "var(--red)" }}>OBD-II FAULT CODES (/api/dtc)</div>
        {telemetry.dtcs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2">
            <CheckCircle size={32} style={{ color: "var(--green)", opacity: 0.7 }} />
            <div className="hud-label text-center" style={{ color: "var(--text-muted)" }}>
              NO ACTIVE FAULTS<br />ALL SYSTEMS NOMINAL
            </div>
          </div>
        ) : (
          <div className="space-y-2 overflow-y-auto max-h-36">
            {telemetry.dtcs.map((code) => (
              <div key={code} className="p-2 alert-flash" style={{ border: "1px solid rgba(255,51,51,0.3)" }}>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={12} style={{ color: "var(--red)" }} className="animate-blink" />
                  <span className="hud-display text-sm font-bold" style={{ color: "var(--red)" }}>{code}</span>
                </div>
                <div className="text-xs mt-1 text-zinc-400 font-mono">
                  {code === "P0300"
                    ? "Random/Multiple Misfire Detected"
                    : code === "P0171"
                    ? "System Too Lean (Bank 1)"
                    : code === "P0420"
                    ? "Catalyst System Low Efficiency"
                    : "Diagnostic Trouble Code"}
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

// ─── MINI STAT ────────────────────────────────────────────────
export const MiniStat: React.FC<{ label: string; value: string | number; color: string }> = ({ label, value, color }) => (
  <div className="p-2" style={{ border: "1px solid var(--border)", background: "rgba(0,0,0,0.3)" }}>
    <div className="hud-label text-[9px] mb-0.5">{label}</div>
    <div className="text-sm font-bold" style={{ fontFamily: "Share Tech Mono", color }}>{value}</div>
  </div>
);

// ─── MAINTENANCE TAB (KEPT INTACT AS REQUESTED) ───────────────
const CollapsibleCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}> = ({ title, icon, badge, isOpen, onToggle, children, headerRight }) => {
  return (
    <div
      className="panel overflow-hidden transition-all duration-200"
      style={{
        borderColor: "var(--border)",
        background: "var(--bg-panel)",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between text-left transition-colors hover:bg-white/[0.03] cursor-pointer focus:outline-none select-none group"
      >
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <div className="shrink-0">{icon}</div>
          <span className="hud-display text-sm font-bold truncate tracking-wide" style={{ color: "var(--text-primary)" }}>
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {headerRight}
          {badge}
          <div
            className="p-1 border transition-colors text-[var(--text-muted)] group-hover:text-white"
            style={{
              borderColor: isOpen ? "var(--border)" : "transparent",
              background: isOpen ? "rgba(255,255,255,0.05)" : "transparent",
            }}
          >
            {isOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="p-5 pt-3 border-t space-y-4" style={{ borderColor: "var(--border)" }}>
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

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
  const [expanded, setExpanded] = useState<{ [key: string]: boolean }>({
    activeAlerts: true,
    fileIssue: true,
    history: true,
    company: false,
    telegram: false,
    decoder: false,
  });

  const toggleSection = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<"low" | "medium" | "high">("medium");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const activeCodes = telemetry.dtcs;

  const handleRegisterIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    const newIssue: RegisteredIssue = {
      id: `TKT-${Date.now().toString(36).toUpperCase()}`,
      date: new Date().toISOString(),
      dtcCodes: activeCodes.length > 0 ? activeCodes : ["USER_REPORTED_SYMPTOM"],
      description: description || "Routine vehicle inspection or reported performance concern.",
      urgency,
      status: "pending",
      companyDetails: serviceCompany,
    };

    setRegisteredIssues((prev) => [newIssue, ...prev]);

    if (telegramEnabled && telegramToken && telegramChatId) {
      try {
        const messageText = `<b>🚗 AUTOVUE SERVICE TICKET DISPATCH</b>\n\n` +
          `• <b>Ticket ID:</b> <code>${newIssue.id}</code>\n` +
          `• <b>Urgency:</b> ${urgency.toUpperCase()}\n` +
          `• <b>DTCs:</b> <code>${newIssue.dtcCodes.join(", ")}</code>\n` +
          `• <b>Assigned To:</b> ${serviceCompany.name}\n` +
          `• <b>Description:</b> ${newIssue.description}\n` +
          `• <b>Timestamp:</b> <code>${new Date().toLocaleString()}</code>`;

        await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: messageText,
            parse_mode: "HTML",
          }),
        });
      } catch (err) {
        console.error("Telegram notification failed:", err);
      }
    }

    setIsSubmitting(false);
    setDescription("");
    setFeedback("Service ticket successfully logged and dispatched!");
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="h-full overflow-y-auto scroll-area p-6" style={{ background: "var(--bg-deep)" }}>
      <div className="max-w-6xl mx-auto space-y-5">
        <div>
          <div className="hud-display text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            PREDICTIVE MAINTENANCE & SERVICE DISPATCH
          </div>
          <div className="hud-label text-[10px]" style={{ color: "var(--text-muted)" }}>
            TRACK VEHICLE FAULTS, AUTOMATE SERVICE TICKETS, AND NOTIFY WORKSHOPS
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            {/* Active DTC Alert Card */}
            {activeCodes.length > 0 && (
              <CollapsibleCard
                title="ACTIVE FAULT CODES REQUIRING ATTENTION"
                icon={<AlertTriangle size={16} className="text-red-400 animate-blink" />}
                isOpen={expanded.activeAlerts}
                onToggle={() => toggleSection("activeAlerts")}
                badge={
                  <span className="px-2 py-0.5 text-[9px] font-mono border border-red-500/40 bg-red-500/10 text-red-400">
                    {activeCodes.length} DTC CODES
                  </span>
                }
              >
                <div className="space-y-2">
                  {activeCodes.map((code) => (
                    <div key={code} className="p-3 border border-red-500/30 bg-red-500/5 font-mono">
                      <div className="text-sm font-bold text-red-400">{code}</div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {code === "P0300"
                          ? "Random/Multiple Cylinder Misfire Detected"
                          : code === "P0171"
                          ? "Air-Fuel Ratio System Too Lean (Bank 1)"
                          : code === "P0420"
                          ? "Catalytic Converter Efficiency Below Threshold"
                          : "Active Diagnostic Trouble Code"}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleCard>
            )}

            {/* File Service Ticket */}
            <CollapsibleCard
              title="REGISTER NEW SERVICE DISPATCH TICKET"
              icon={<Wrench size={16} style={{ color: "var(--cyan)" }} />}
              isOpen={expanded.fileIssue}
              onToggle={() => toggleSection("fileIssue")}
            >
              <form onSubmit={handleRegisterIssue} className="space-y-4">
                <div>
                  <label className="hud-label text-[10px] block mb-1" style={{ color: "var(--text-muted)" }}>
                    ISSUE SYMPTOMS / DRIVER OBSERVATIONS
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe vehicle noise, engine vibration, or maintenance requests..."
                    className="w-full bg-black/40 text-xs p-3 outline-none font-mono"
                    style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="hud-label text-[10px]" style={{ color: "var(--text-muted)" }}>PRIORITY:</span>
                    {(["low", "medium", "high"] as const).map((lvl) => (
                      <button
                        type="button"
                        key={lvl}
                        onClick={() => setUrgency(lvl)}
                        className={`px-2.5 py-1 text-[9px] font-bold uppercase transition-all border ${
                          urgency === lvl
                            ? lvl === "high"
                              ? "bg-red-500/20 text-red-300 border-red-500"
                              : lvl === "medium"
                              ? "bg-amber-500/20 text-amber-300 border-amber-500"
                              : "bg-cyan-500/20 text-cyan-300 border-cyan-500"
                            : "text-zinc-400 border-white/10"
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-xs font-bold transition-all border border-cyan-500/40 uppercase"
                  >
                    DISPATCH TICKET
                  </button>
                </div>

                {feedback && (
                  <div className="text-xs text-green-400 font-mono">
                    ✓ {feedback}
                  </div>
                )}
              </form>
            </CollapsibleCard>

            {/* Ticket History */}
            <CollapsibleCard
              title="SERVICE TICKET LOGS"
              icon={<Shield size={16} style={{ color: "var(--purple)" }} />}
              isOpen={expanded.history}
              onToggle={() => toggleSection("history")}
              badge={
                <span className="px-2 py-0.5 text-[9px] font-mono border border-purple-500/40 bg-purple-500/10 text-purple-300">
                  {registeredIssues.length} LOGGED
                </span>
              }
            >
              <div className="space-y-2">
                {registeredIssues.length === 0 ? (
                  <div className="p-4 text-center text-xs font-mono text-zinc-500 border border-dashed border-white/10">
                    NO SERVICE TICKETS LOGGED
                  </div>
                ) : (
                  registeredIssues.map((issue) => (
                    <div key={issue.id} className="p-3 border border-white/10 bg-black/30 font-mono space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-cyan-400">{issue.id}</span>
                        <span className="text-[10px] text-zinc-400">{new Date(issue.date).toLocaleDateString()}</span>
                      </div>
                      <div className="text-xs text-zinc-200">{issue.description}</div>
                      <div className="flex gap-2 text-[10px] text-zinc-400 pt-1">
                        <span>Assigned: {issue.companyDetails.name}</span>
                        <span>•</span>
                        <span className="uppercase text-amber-400">{issue.urgency} Urgency</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CollapsibleCard>
          </div>

          {/* Right Column: Service Provider info & Telegram Gateway status */}
          <div className="space-y-5">
            <CollapsibleCard
              title="ASSIGNED WORKSHOP DETAILS"
              icon={<Wrench size={16} style={{ color: "var(--cyan)" }} />}
              isOpen={expanded.company}
              onToggle={() => toggleSection("company")}
            >
              <div className="space-y-2 font-mono text-xs">
                <div>
                  <div className="hud-label text-[9px]" style={{ color: "var(--text-muted)" }}>COMPANY NAME</div>
                  <div className="text-sm font-bold text-cyan-400">{serviceCompany.name}</div>
                </div>
                <div>
                  <div className="hud-label text-[9px]" style={{ color: "var(--text-muted)" }}>PHONE</div>
                  <div className="text-zinc-300">{serviceCompany.phone || "Not set"}</div>
                </div>
                <div>
                  <div className="hud-label text-[9px]" style={{ color: "var(--text-muted)" }}>EMAIL</div>
                  <div className="text-zinc-300">{serviceCompany.email || "Not set"}</div>
                </div>
                <div>
                  <div className="hud-label text-[9px]" style={{ color: "var(--text-muted)" }}>ADDRESS</div>
                  <div className="text-zinc-300">{serviceCompany.address || "Not set"}</div>
                </div>
              </div>
            </CollapsibleCard>

            <CollapsibleCard
              title="TELEGRAM BOT GATEWAY"
              icon={<Radio size={16} style={{ color: telegramEnabled ? "var(--green)" : "var(--text-muted)" }} />}
              isOpen={expanded.telegram}
              onToggle={() => toggleSection("telegram")}
            >
              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-400">GATEWAY STATUS:</span>
                  <span className={telegramEnabled ? "text-green-400 font-bold" : "text-zinc-500"}>
                    {telegramEnabled ? "ACTIVE (LIVE)" : "DISABLED"}
                  </span>
                </div>
                {telegramEnabled && (
                  <div>
                    <span className="text-[9px] text-zinc-500 block">CHAT ID:</span>
                    <span className="text-zinc-200">{telegramChatId || "Empty"}</span>
                  </div>
                )}
              </div>
            </CollapsibleCard>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── SYSTEM SETTINGS TAB ──────────────────────────────────────
// NOTE: DTC INJECTOR REMOVED FROM SETTINGS AS IT IS FETCHED FROM API!
const SettingsTab: React.FC<{
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
  serviceCompany: ServiceCompanyDetails;
  setServiceCompany: React.Dispatch<React.SetStateAction<ServiceCompanyDetails>>;
  telegramToken: string;
  setTelegramToken: (token: string) => void;
  telegramChatId: string;
  setTelegramChatId: (chatId: string) => void;
  telegramEnabled: boolean;
  setTelegramEnabled: (enabled: boolean) => void;
}> = ({
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

  const [compName, setCompName] = useState(serviceCompany.name);
  const [compEmail, setCompEmail] = useState(serviceCompany.email);
  const [compPhone, setCompPhone] = useState(serviceCompany.phone);
  const [compAddress, setCompAddress] = useState(serviceCompany.address);

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
      address: compAddress,
    });
    setCompanySuccessMsg("Service provider details updated successfully!");
    setTimeout(() => setCompanySuccessMsg(null), 3000);
  };

  const handleSave = () => {
    onSaveUrl();
    setSuccessMsg("Backend URL updated successfully!");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleTestTelegram = async () => {
    if (!telegramToken || !telegramChatId) {
      setTelegramErrorMsg("Bot Token and Chat ID are required.");
      setTimeout(() => setTelegramErrorMsg(null), 4000);
      return;
    }

    setIsTestingTelegram(true);
    setTelegramSuccessMsg(null);
    setTelegramErrorMsg(null);

    try {
      const testMsg = `<b>🚗 AUTOVUE: GATEWAY TEST SUCCESSFUL</b>\n\n` +
        `This is a test notification confirming your Telegram Bot API connection is functional.\n\n` +
        `• <b>Chat ID:</b> <code>${telegramChatId}</code>\n` +
        `• <b>Timestamp:</b> <code>${new Date().toLocaleTimeString()}</code>`;

      const res = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: testMsg,
          parse_mode: "HTML",
        }),
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

  return (
    <div className="h-full overflow-y-auto scroll-area p-6" style={{ background: "var(--bg-deep)" }}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <div className="hud-display text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            SYSTEM CONFIGURATION
          </div>
          <div className="hud-label text-[10px]" style={{ color: "var(--text-muted)" }}>
            MANAGE FASTAPI BACKEND TARGET, UNITS, AND NOTIFICATION GATEWAYS
          </div>
        </div>

        {/* ─── BACKEND URL CONFIGURATION ─── */}
        <div className="panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
          <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: "var(--border)" }}>
            <Server size={16} style={{ color: "var(--cyan)" }} />
            <span className="hud-display text-base font-bold" style={{ color: "var(--text-primary)" }}>
              FASTAPI BACKEND GATEWAY
            </span>
          </div>

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
                  placeholder="e.g., https://ecu-backend-95fz.onrender.com or http://localhost:8000"
                  className="flex-1 bg-black/40 text-xs px-3 py-2 outline-none font-mono"
                  style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
                <button
                  onClick={handleSave}
                  className="px-4 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-bold transition-all border border-cyan-500/40"
                >
                  SAVE ENDPOINT
                </button>
              </div>
            </div>

            {successMsg && (
              <div className="text-xs text-green-400 font-mono">
                ✓ {successMsg}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3 border flex items-center justify-between" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.1)" }}>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">BACKEND STATUS:</span>
                <span className="text-xs font-bold font-mono" style={{ color: isBackendHealthy ? "var(--green)" : "var(--red)" }}>
                  {isBackendHealthy === null ? "CHECKING..." : isBackendHealthy ? "ONLINE (REACHABLE)" : "OFFLINE"}
                </span>
              </div>

              <div className="p-3 border flex items-center justify-between" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.1)" }}>
                <span className="text-[10px] text-[var(--text-muted)] font-mono">LIVE WS CHANNEL:</span>
                <span className="text-xs font-bold font-mono" style={{ color: isConnected ? "var(--green)" : "var(--amber)" }}>
                  {isConnected ? "CONNECTED" : "DISCONNECTED"}
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
            <div className="space-y-2">
              <span className="hud-label text-[10px] block" style={{ color: "var(--text-muted)" }}>
                SPEED UNITS
              </span>
              <div className="flex border" style={{ borderColor: "var(--border)" }}>
                <button
                  onClick={() => setSpeedUnit("metric")}
                  className={`flex-1 py-1.5 text-[10px] font-bold transition-all ${
                    speedUnit === "metric" ? "bg-purple-500/20 text-purple-300" : "text-zinc-500"
                  }`}
                >
                  METRIC (KM/H)
                </button>
                <button
                  onClick={() => setSpeedUnit("imperial")}
                  className={`flex-1 py-1.5 text-[10px] font-bold transition-all ${
                    speedUnit === "imperial" ? "bg-purple-500/20 text-purple-300" : "text-zinc-500"
                  }`}
                >
                  IMPERIAL (MPH)
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <span className="hud-label text-[10px] block" style={{ color: "var(--text-muted)" }}>
                TEMPERATURE UNITS
              </span>
              <div className="flex border" style={{ borderColor: "var(--border)" }}>
                <button
                  onClick={() => setTempUnit("metric")}
                  className={`flex-1 py-1.5 text-[10px] font-bold transition-all ${
                    tempUnit === "metric" ? "bg-amber-500/20 text-amber-300" : "text-zinc-500"
                  }`}
                >
                  CELSIUS (°C)
                </button>
                <button
                  onClick={() => setTempUnit("imperial")}
                  className={`flex-1 py-1.5 text-[10px] font-bold transition-all ${
                    tempUnit === "imperial" ? "bg-amber-500/20 text-amber-300" : "text-zinc-500"
                  }`}
                >
                  FAHRENHEIT (°F)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── WORKSHOP DETAILS ─── */}
        <div className="panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
          <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: "var(--border)" }}>
            <Wrench size={16} style={{ color: "var(--cyan)" }} />
            <span className="hud-display text-base font-bold" style={{ color: "var(--text-primary)" }}>
              PREFERRED SERVICE WORKSHOP DETAILS
            </span>
          </div>

          <form onSubmit={handleSaveCompany} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="hud-label text-[10px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
                  COMPANY / WORKSHOP NAME
                </label>
                <input
                  type="text"
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  className="w-full bg-black/40 text-xs px-3 py-2 outline-none font-mono"
                  style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
              </div>

              <div>
                <label className="hud-label text-[10px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
                  PHONE NUMBER
                </label>
                <input
                  type="text"
                  value={compPhone}
                  onChange={(e) => setCompPhone(e.target.value)}
                  className="w-full bg-black/40 text-xs px-3 py-2 outline-none font-mono"
                  style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
              </div>

              <div>
                <label className="hud-label text-[10px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
                  EMAIL ADDRESS
                </label>
                <input
                  type="email"
                  value={compEmail}
                  onChange={(e) => setCompEmail(e.target.value)}
                  className="w-full bg-black/40 text-xs px-3 py-2 outline-none font-mono"
                  style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
              </div>

              <div>
                <label className="hud-label text-[10px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
                  WORKSHOP ADDRESS
                </label>
                <input
                  type="text"
                  value={compAddress}
                  onChange={(e) => setCompAddress(e.target.value)}
                  className="w-full bg-black/40 text-xs px-3 py-2 outline-none font-mono"
                  style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {companySuccessMsg ? (
                <span className="text-xs text-green-400 font-mono">
                  ✓ {companySuccessMsg}
                </span>
              ) : (
                <span />
              )}
              <button
                type="submit"
                className="px-4 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-bold transition-all border border-cyan-500/40"
              >
                UPDATE WORKSHOP DETAILS
              </button>
            </div>
          </form>
        </div>

        {/* ─── TELEGRAM NOTIFICATION GATEWAY ─── */}
        <div className="panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <Radio size={16} style={{ color: "var(--green)" }} />
              <span className="hud-display text-base font-bold" style={{ color: "var(--text-primary)" }}>
                TELEGRAM FAULT DISPATCH GATEWAY
              </span>
            </div>
            <button
              type="button"
              onClick={() => setTelegramEnabled(!telegramEnabled)}
              className={`px-3 py-1 text-[10px] font-bold border transition-all flex items-center gap-2 ${
                telegramEnabled ? "bg-green-500/15 text-green-400 border-green-500/40" : "bg-black/30 text-zinc-500 border-white/10"
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${telegramEnabled ? "bg-green-400 animate-pulse" : "bg-zinc-600"}`} />
              <span>{telegramEnabled ? "ENABLED" : "DISABLED"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="hud-label text-[10px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
                BOT API TOKEN
              </label>
              <input
                type="password"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
                placeholder="From @BotFather"
                className="w-full bg-black/40 text-xs px-3 py-2 outline-none font-mono"
                style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>

            <div>
              <label className="hud-label text-[10px] block mb-1.5" style={{ color: "var(--text-muted)" }}>
                TARGET CHAT ID
              </label>
              <input
                type="text"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="From @userinfobot"
                className="w-full bg-black/40 text-xs px-3 py-2 outline-none font-mono"
                style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div>
              {telegramSuccessMsg && <span className="text-xs text-green-400 font-mono">✓ {telegramSuccessMsg}</span>}
              {telegramErrorMsg && <span className="text-xs text-red-400 font-mono">⚠️ {telegramErrorMsg}</span>}
            </div>

            <button
              type="button"
              onClick={handleTestTelegram}
              disabled={isTestingTelegram}
              className="px-4 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-bold transition-all border border-green-500/40 uppercase"
            >
              {isTestingTelegram ? "DISPATCHING TEST..." : "TEST DISPATCH GATEWAY"}
            </button>
          </div>
        </div>

        {/* ─── RESET SYSTEM TRIP CACHES ─── */}
        <div className="panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-zinc-200">
                RESET SYSTEM TRIP DATA
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Clears live trip distance counter, timer, and rolling waveform chart buffers.
              </p>
            </div>

            <button
              onClick={resetStates}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold border border-white/20 uppercase"
            >
              RESET ALL TRIP DATA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
