/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Activity, Gauge, AlertTriangle, User,
  Thermometer, Wind, Zap, Sparkles, Loader2,
  LayoutDashboard, Wrench, MessageSquare, Radio,
  ChevronRight, Power, Database, Cpu, Eye,
  TrendingUp, AlertCircle, CheckCircle, Settings,
  Fuel, Clock, Shield, BarChart3, Navigation2,
  Wifi, WifiOff, RefreshCw, Bell, BellOff
} from "lucide-react";
import { TelemetryData, DriverBehavior, HealthStatus, DriverPredictResponse } from "../types";
import { simulateECUData } from "../services/ecuSimulator";
import { classifyDriverBehavior } from "../logic/driverBehavior";
import { analyzeVehicleHealth } from "../logic/mlHealth";
import { calculateMileage } from "../logic/mileage";
import { getAISuggestions } from "../services/geminiService";
import { HUDGauge } from "./HUDGauge";
import { TelemetryPanel } from "./TelemetryPanel";
import { HealthMonitor } from "./HealthMonitor";
import { ChatInterface } from "./ChatInterface";
import { LiveChart } from "./LiveChart";
import { DiagnosticsPanel } from "./DiagnosticsPanel";

type Tab = "overview" | "telemetry" | "diagnostics" | "assistant" | "maintenance" | "upload";

// ─── DATA SOURCE HOOK ──────────────────────────────────────────
function useDataSource() {
  const [source, setSource] = useState<"mock" | "obd" | "dataset">("mock");
  const [isConnected, setIsConnected] = useState(false);

  // Real OBD-II connection placeholder
  const connectOBD = useCallback(async () => {
    console.log("[OBD] Attempting real data connection...");
    setIsConnected(false); 
    return null;
  }, []);

  return { source, setSource, isConnected, connectOBD };
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
  const [aiSuggestion, setAiSuggestion] = useState("Analyzing driving patterns...");
  const [apiResponse, setApiResponse] = useState<DriverPredictResponse | null>(null);
  const [dataset, setDataset] = useState<TelemetryData[]>([]);
  const [datasetIndex, setDatasetIndex] = useState(0);
  const [isAuthReady, setIsAuthReady] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [tripTime, setTripTime] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasAlerts, setHasAlerts] = useState(false);
  const [alertCount, setAlertCount] = useState(0);

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
    setAiSuggestion("System reset. Analyzing new data stream...");
    lastAiUpdate.current = 0;
  }, []);

  const { source, setSource, isConnected, connectOBD } = useDataSource();
  const lastAiUpdate = useRef(0);
  const tripStartRef = useRef(Date.now());

  // Handle data source switch
  const handleToggleDataSource = async () => {
    const newSource = source === "mock" ? "obd" : "mock";
    
    // Always reset states when switching
    resetStates();
    
    setSource(newSource);
    
    if (newSource === "obd") {
      await connectOBD();
    }
  };

  // Trip timer
  useEffect(() => {
    const id = setInterval(() => setTripTime(Math.floor((Date.now() - tripStartRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Telemetry loop — mock OR real OBD OR dataset
  useEffect(() => {
    if (source === "obd") {
      console.log("[OBD] Waiting for real hardware data stream...");
      return;
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
  }, [source, dataset]);

  // Logic updates
  useEffect(() => {
    const newBehavior = classifyDriverBehavior(telemetry);
    const newHealth = analyzeVehicleHealth(telemetry, history);
    const newMileage = calculateMileage(telemetry);

    setBehavior(newBehavior);
    setHealth(newHealth);
    setMileage(newMileage);

    const alerts = newHealth.faults.length + (newHealth.status === "Critical" ? 1 : 0);
    setAlertCount(alerts);
    setHasAlerts(alerts > 0);

    const now = Date.now();
    if (now - lastAiUpdate.current > 30000 || (newHealth.status === "Critical" && health.status !== "Critical")) {
      lastAiUpdate.current = now;
      getAISuggestions(telemetry, newBehavior, newHealth).then(setAiSuggestion);
    }
  }, [telemetry]);

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
              <div className="hud-display text-base font-bold" style={{ color: "var(--cyan)", letterSpacing: "0.05em" }}>ECU<span style={{ color: "var(--text-primary)" }}> G</span></div>
              <div className="hud-label text-[9px]" style={{ color: "var(--text-muted)" }}>GUARDIAN v2.4</div>
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
            { id: "assistant", icon: Sparkles, label: "AI Assistant" },
            { id: "maintenance", icon: Wrench, label: "Maintenance" },
            { id: "upload", icon: Database, label: "Upload Dataset" },
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

        {/* Debug / Data Source Toggle */}
        <div className="px-3 py-3 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="p-3" style={{ border: "1px solid var(--border)", background: "rgba(0,0,0,0.3)" }}>
            <div className="hud-label text-[10px] mb-2" style={{ color: "var(--text-muted)" }}>DATA SOURCE</div>
            <div className="flex items-center gap-2 mb-2">
              <Database size={12} style={{ color: "var(--text-muted)" }} />
              <span className="text-xs" style={{ color: "var(--text-secondary)", fontFamily: "Share Tech Mono" }}>
                {source === "obd" ? "OBD-II LIVE" : source === "dataset" ? "DATASET" : "MOCK SIM"}
              </span>
            </div>
            <button
              onClick={handleToggleDataSource}
              className="btn-hud w-full py-1.5 text-[10px] flex items-center justify-center gap-2"
              style={{
                borderColor: source === "obd" ? "rgba(255,184,0,0.4)" : "rgba(0,212,255,0.3)",
                color: source === "obd" ? "var(--amber)" : "var(--cyan)",
                background: source === "obd" ? "rgba(255,184,0,0.06)" : "rgba(0,212,255,0.06)",
              }}
            >
              {source === "obd" ? <WifiOff size={11} /> : <Wifi size={11} />}
              {source === "obd" ? "DISCONNECT" : "CONNECT OBD"}
            </button>
          </div>
        </div>

        {/* User */}
        <div className="px-3 py-3 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-none flex items-center justify-center" style={{ border: "1px solid var(--border)", background: "rgba(255,255,255,0.05)" }}>
              <User size={14} style={{ color: "var(--text-muted)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate" style={{ color: "var(--text-primary)", fontFamily: "Barlow Condensed" }}>GUEST DRIVER</div>
              <div className="hud-label text-[9px] truncate" style={{ color: "var(--text-muted)" }}>OFFLINE MODE</div>
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
                {activeTab === "assistant" && "AI Assistant"}
                {activeTab === "maintenance" && "Maintenance Logs"}
                {activeTab === "upload" && "Dataset Upload"}
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

            {/* RPM live */}
            <div className="px-3 py-1.5" style={{ border: "1px solid var(--border)", background: "rgba(0,0,0,0.3)" }}>
              <span className="hud-label text-[9px]">RPM </span>
              <span className="text-sm font-bold" style={{ fontFamily: "Share Tech Mono", color: telemetry.rpm > 5000 ? "var(--red)" : "var(--cyan)" }}>
                {telemetry.rpm.toLocaleString()}
              </span>
            </div>

            <button onClick={() => setIsChatOpen(v => !v)}
              className="btn-hud btn-cyan px-3 py-1.5 flex items-center gap-2 text-xs relative">
              <MessageSquare size={14} />
              AI CHAT
              {hasAlerts && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-bold"
                style={{ background: "var(--red)", color: "white" }}>{alertCount}</span>}
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
                <OverviewTab telemetry={telemetry} history={history} behavior={behavior} health={health} mileage={mileage} apiResponse={apiResponse} />
              )}
              {activeTab === "telemetry" && (
                <TelemetryPanel telemetry={telemetry} history={history} />
              )}
              {activeTab === "diagnostics" && (
                <HealthMonitor health={health} telemetry={telemetry} history={history} />
              )}
              {activeTab === "assistant" && (
                <DiagnosticsPanel telemetry={telemetry} health={health} behavior={behavior} aiSuggestion={aiSuggestion} />
              )}
              {activeTab === "maintenance" && (
                <MaintenanceTab health={health} />
              )}
              {activeTab === "upload" && (
                <UploadTab 
                  onDatasetReady={(data, resp) => {
                    setDataset(data);
                    setApiResponse(resp);
                    setSource("dataset");
                    setActiveTab("overview");
                  }} 
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Chat */}
      <ChatInterface isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} telemetry={telemetry} />
    </div>
  );
};

// ─── UPLOAD TAB ───────────────────────────────────────────────
const UploadTab: React.FC<{ onDatasetReady: (data: TelemetryData[], resp: DriverPredictResponse) => void }> = ({ onDatasetReady }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter(l => l.trim());
      if (lines.length < 2) throw new Error("Dataset is too small");

      const headers = lines[0].split(/[,\t]/).map(h => h.trim());
      const rows = lines.slice(1).map(l => l.split(/[,\t]/).map(v => v.trim()));

      // Map headers to indices
      const idx = {
        coolant: headers.findIndex(h => h.includes("Coolant")),
        rpm: headers.findIndex(h => h.includes("RPM")),
        vss: headers.findIndex(h => h.includes("Speed")),
        iat: headers.findIndex(h => h.includes("Intake Air Temperature")),
        maf: headers.findIndex(h => h.includes("Air Flow Rate")),
        throttle: headers.findIndex(h => h.includes("Throttle")),
      };

      const telemetryData: TelemetryData[] = rows.map(row => ({
        rpm: Number(row[idx.rpm]) || 0,
        vss: Number(row[idx.vss]) || 0,
        maf: Number(row[idx.maf]) || 0,
        throttle: Number(row[idx.throttle]) || 0,
        engineLoad: 0, // Not in dataset
        coolantTemp: Number(row[idx.coolant]) || 0,
        oilTemp: 0, // Not in dataset
        intakeAirTemp: Number(row[idx.iat]) || 0,
        shortTermFuelTrim: 0,
        longTermFuelTrim: 0,
        o2Voltage: 0,
        brakeSwitch: false,
        dtcs: [],
        timestamp: Date.now(),
      }));

      // Prepare API request
      const apiData = {
        rpm_values: telemetryData.map(d => d.rpm),
        speed_values: telemetryData.map(d => d.vss),
        throttle_values: telemetryData.map(d => d.throttle),
      };

      const { predictDriverBehavior } = await import("../services/apiService");
      const response = await predictDriverBehavior(apiData);

      onDatasetReady(telemetryData, response);
    } catch (err: any) {
      setError(err.message || "Failed to process dataset");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="h-full flex items-center justify-center p-6" style={{ background: "var(--bg-deep)" }}>
      <div className="panel p-10 max-w-lg w-full text-center glow-cyan">
        <Database size={48} className="mx-auto mb-6" style={{ color: "var(--cyan)" }} />
        <h2 className="hud-display text-2xl mb-4">UPLOAD VEHICLE DATASET</h2>
        <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
          Select a CSV or TSV file containing vehicle telemetry. The system will analyze the data using the backend ML model.
        </p>
        
        <label className="btn-hud btn-cyan w-full py-4 cursor-pointer flex items-center justify-center gap-3">
          {isUploading ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          {isUploading ? "ANALYZING DATA..." : "SELECT DATASET FILE"}
          <input type="file" className="hidden" accept=".csv,.tsv,.txt" onChange={handleFileUpload} disabled={isUploading} />
        </label>

        {error && (
          <div className="mt-4 p-3 text-xs" style={{ border: "1px solid var(--red)", background: "rgba(255,51,51,0.06)", color: "var(--red)", fontFamily: "Share Tech Mono" }}>
            ERROR: {error}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── OVERVIEW TAB ─────────────────────────────────────────────
const OverviewTab: React.FC<{
  telemetry: TelemetryData; history: TelemetryData[];
  behavior: DriverBehavior; health: HealthStatus; mileage: number;
  apiResponse?: DriverPredictResponse | null;
}> = ({ telemetry, history, behavior, health, mileage, apiResponse }) => {
  const currentBehavior = apiResponse?.behaviour_class || behavior;
  const bColor = currentBehavior === "Economical" ? "var(--green)" : currentBehavior === "Moderate" ? "var(--amber)" : "var(--red)";

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
        <HUDGauge value={telemetry.vss} max={240} color="var(--purple)" unit="KM/H"
          warning={130} critical={180} size={180} />
        <div className="mt-4 grid grid-cols-2 gap-4 w-full">
          <MiniStat label="MAF" value={`${telemetry.maf}g/s`} color="var(--purple)" />
          <MiniStat label="GEAR" value="AUTO" color="var(--purple)" />
        </div>
      </div>

      {/* ── Temp Gauge (col 7-9, row 1-3) */}
      <div className="col-span-3 row-span-3 border-r border-b panel flex flex-col items-center justify-center p-6"
        style={{ borderColor: "var(--border)" }}>
        <div className="hud-label mb-4" style={{ color: "var(--amber)" }}>COOLANT TEMP</div>
        <HUDGauge value={telemetry.coolantTemp} max={130} color="var(--amber)" unit="°C"
          warning={100} critical={115} size={180} />
        <div className="mt-4 grid grid-cols-2 gap-4 w-full">
          <MiniStat label="OIL" value={telemetry.oilTemp > 0 ? `${telemetry.oilTemp}°C` : "N/A"} color="var(--amber)" />
          <MiniStat label="IAT" value={`${telemetry.intakeAirTemp}°C`} color="var(--amber)" />
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
            { label: "FUEL SYS", val: Math.min(100, 100 - Math.abs(telemetry.shortTermFuelTrim) * 3), color: "var(--cyan)" },
            { label: "O2 SENSOR", val: Math.round(telemetry.o2Voltage * 111), color: "var(--purple)" },
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
            <div className="hud-label">MPG INSTANT</div>
          </div>
          <div className="flex-1 pb-1">
            <div className="hud-label text-[9px] mb-1">L/100KM EQUIV</div>
            <div className="text-lg font-bold" style={{ fontFamily: "Share Tech Mono", color: "var(--text-secondary)" }}>
              {mileage > 0 ? (235.215 / mileage).toFixed(1) : "--"}
            </div>
          </div>
        </div>
        {/* Mileage sparkline */}
        <div className="flex-1 min-h-0">
          <LiveChart data={history.map((h, i) => ({ t: i, v: calculateMileage(h) }))}
            color="var(--green)" label="MPG" maxPoints={60} height={80} />
        </div>
        {/* Fuel trim indicators */}
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <div className="hud-label text-[9px] mb-1">STFT</div>
            <div className="text-sm font-bold" style={{
              fontFamily: "Share Tech Mono",
              color: Math.abs(telemetry.shortTermFuelTrim) > 10 ? "var(--red)" : "var(--cyan)"
            }}>
              {telemetry.shortTermFuelTrim > 0 ? "+" : ""}{telemetry.shortTermFuelTrim.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="hud-label text-[9px] mb-1">LTFT</div>
            <div className="text-sm font-bold" style={{
              fontFamily: "Share Tech Mono",
              color: Math.abs(telemetry.longTermFuelTrim) > 8 ? "var(--amber)" : "var(--cyan)"
            }}>
              {telemetry.longTermFuelTrim > 0 ? "+" : ""}{telemetry.longTermFuelTrim.toFixed(1)}%
            </div>
          </div>
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
                { label: "BRAKE INTENSITY", val: telemetry.brakeSwitch ? 80 : 10, max: 100 },
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
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="O2 VOLT" value={`${telemetry.o2Voltage.toFixed(2)}V`} color="var(--cyan)" />
            <MiniStat label="IAT" value={`${telemetry.intakeAirTemp}°C`} color="var(--amber)" />
            <MiniStat label="BRAKE" value={telemetry.brakeSwitch ? "ON" : "OFF"} color={telemetry.brakeSwitch ? "var(--red)" : "var(--green)"} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── MAINTENANCE TAB ──────────────────────────────────────────
const MaintenanceTab: React.FC<{ health: HealthStatus }> = ({ health }) => {
  const items = [
    { type: "Oil Change", due: "1,200 km", status: "upcoming", priority: "medium" },
    { type: "Brake Inspection", due: "500 km", status: "urgent", priority: "high" },
    { type: "Air Filter", due: "3,400 km", status: "ok", priority: "low" },
    { type: "Tire Rotation", due: "2,100 km", status: "upcoming", priority: "medium" },
    { type: "Spark Plugs", due: "12,000 km", status: "ok", priority: "low" },
  ];

  return (
    <div className="h-full overflow-auto scroll-area p-6" style={{ background: "var(--bg-deep)" }}>
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="hud-display text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
          MAINTENANCE SCHEDULE
        </div>
        {health.predictions.length > 0 && (
          <div className="panel p-4 panel-amber">
            <div className="hud-label mb-2" style={{ color: "var(--amber)" }}>AI PREDICTIONS</div>
            <div className="space-y-2">
              {health.predictions.map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <Zap size={12} style={{ color: "var(--amber)", marginTop: 2 }} />
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{p}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.type} className="panel p-4 flex items-center justify-between"
              style={{ borderLeftColor: item.priority === "high" ? "var(--red)" : item.priority === "medium" ? "var(--amber)" : "var(--green)", borderLeftWidth: 2 }}>
              <div className="flex items-center gap-3">
                <Wrench size={16} style={{ color: item.priority === "high" ? "var(--red)" : item.priority === "medium" ? "var(--amber)" : "var(--green)" }} />
                <div>
                  <div className="hud-display text-base font-bold" style={{ color: "var(--text-primary)" }}>{item.type}</div>
                  <div className="hud-label text-[10px]">DUE IN {item.due}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-0.5 hud-label text-[10px]"
                  style={{
                    border: `1px solid ${item.priority === "high" ? "rgba(255,51,51,0.4)" : item.priority === "medium" ? "rgba(255,184,0,0.4)" : "rgba(0,255,136,0.4)"}`,
                    color: item.priority === "high" ? "var(--red)" : item.priority === "medium" ? "var(--amber)" : "var(--green)",
                  }}>
                  {item.status.toUpperCase()}
                </span>
                <button className="btn-hud btn-cyan px-3 py-1 text-[10px]">SCHEDULE</button>
              </div>
            </div>
          ))}
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
