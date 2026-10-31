/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Truck, Car, Activity, Shield, Navigation2, Wrench, Settings,
  Radio, Gauge, Cpu, Eye, ExternalLink, AlertTriangle, CheckCircle,
  AlertCircle, Server, User, Clock, ArrowRight, Zap, Fuel, Flame,
  TrendingUp, RefreshCw, Sun, Moon, Volume2, ShieldAlert, ChevronRight,
  Database, MapPin, HardDrive, Compass
} from "lucide-react";
import { useLiveTelemetry, LiveTelemetryState } from "../services/useLiveTelemetry";
import { Dashboard } from "./Dashboard";
import { GPSMap } from "./GPSMap";
import { LiveChart, MultiLineChart } from "./LiveChart";

type FleetTab = "overview" | "vehicles" | "driver" | "map" | "maintenance" | "settings";

// Vehicle info constant (1 single monitored vehicle as requested)
export const MONITORED_VEHICLE = {
  id: "FLEET-UNIT-01",
  name: "Seat León 1.6 FSI",
  year: 2017,
  type: "Commercial Compact Hatchback",
  plate: "KA-19-EQ-4096",
  vin: "VSSZZZ5PZ8R019482",
  driverName: "Pratham S.",
  driverId: "DRV-8821",
  driverLicense: "DL-KA19-2022-004921",
  engineSpec: "1.6L Inline-4 16V FSI (1,598 cc)",
  fuelType: "BS6 E10 Gasoline (AFR 14.7)",
  protocol: "OBD-II ISO 15765-4 CAN (11-bit ID, 500 kbaud)",
  ecuFirmware: "v2.1.0-OBD-CANBUS",
  gatewayTarget: "FastAPI / Pinggy Reverse Proxy (Port 3000)",
  department: "Urban Logistics & Telematics Operations",
  hubLocation: "St Joseph Engineering College / Mangalore Node",
};

export const FleetPortal: React.FC = () => {
  const telemetryState = useLiveTelemetry();
  const {
    telemetry,
    history,
    tripTime,
    totalDistance,
    isConnected,
    isBackendHealthy,
    speedUnit,
    setSpeedUnit,
    tempUnit,
    setTempUnit,
    resetStates,
    serviceCompany,
    setServiceCompany,
    registeredIssues,
    setRegisteredIssues,
    telegramToken,
    setTelegramToken,
    telegramChatId,
    setTelegramChatId,
    telegramEnabled,
    setTelegramEnabled,
    tempUrl,
    setTempUrl,
    handleSaveUrl,
    healthStatus,
    currentBehavior,
    driverML,
    fuelML,
  } = telemetryState;

  const [activeTab, setActiveTab] = useState<FleetTab>("overview");
  const [selectedVehicle, setSelectedVehicle] = useState<boolean>(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [systemTime, setSystemTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Derived units
  const isImperialSpeed = speedUnit === "imperial";
  const isImperialTemp = tempUnit === "imperial";
  const displayVss = isImperialSpeed ? Math.round(telemetry.vss * 0.621371) : telemetry.vss;
  const speedUnitStr = isImperialSpeed ? "mph" : "km/h";
  const displayCoolant = isImperialTemp ? Math.round(telemetry.coolantTemp * 1.8 + 32) : telemetry.coolantTemp;
  const tempUnitStr = isImperialTemp ? "°F" : "°C";

  const bColor =
    currentBehavior === "Economical"
      ? "var(--green)"
      : currentBehavior === "Moderate"
      ? "var(--amber)"
      : "var(--red)";

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0
      ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  // If the fleet manager opens the vehicle, render the full Dashboard cockpit view
  if (selectedVehicle) {
    return (
      <Dashboard
        onBackToFleet={() => setSelectedVehicle(false)}
        sharedState={telemetryState}
        vehicleInfo={{
          id: MONITORED_VEHICLE.id,
          model: MONITORED_VEHICLE.name,
          plate: MONITORED_VEHICLE.plate,
          driverName: MONITORED_VEHICLE.driverName,
        }}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg-deep)", fontFamily: "Barlow, sans-serif" }}>
      {/* ── FLEET SIDEBAR NAVIGATION ─────────────────── */}
      <aside className="flex flex-col w-64 border-r relative z-20 shrink-0" style={{ background: "var(--bg-panel)", borderColor: "var(--border)" }}>
        {/* Brand Header */}
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center" style={{ border: "1px solid var(--cyan-dim)", background: "rgba(0,212,255,0.08)" }}>
              <Truck size={18} style={{ color: "var(--cyan)" }} />
            </div>
            <div>
              <div className="hud-display text-base font-bold tracking-wider" style={{ color: "var(--cyan)" }}>
                AUTOVUE<span style={{ color: "var(--text-primary)" }}>FLEET</span>
              </div>
              <div className="hud-label text-[9px]" style={{ color: "var(--text-muted)" }}>
                FLEET MANAGEMENT PORTAL
              </div>
            </div>
          </div>
        </div>

        {/* Fleet Supervisor Session Profile */}
        <div className="px-5 py-3 border-b" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.2)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-6 h-6 rounded-none flex items-center justify-center bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shrink-0">
                <User size={12} />
              </div>
              <div className="truncate">
                <div className="text-xs font-bold text-zinc-200 truncate">Pratham S.</div>
                <div className="text-[9px] font-mono text-zinc-500">FLEET MANAGER</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[9px] font-mono text-green-400">ONLINE</span>
            </div>
          </div>
        </div>

        {/* Fleet Gateway Stream Status Indicator */}
        <div className="px-5 py-2.5 border-b" style={{ borderColor: "var(--border)", background: "rgba(0,212,255,0.02)" }}>
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-zinc-500">TELEMETRY GATEWAY:</span>
            <span className={isConnected ? "text-green-400 font-bold" : "text-amber-400 font-bold"}>
              {isConnected ? "LIVE STREAM" : "SEARCHING"}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono mt-1">
            <span className="text-zinc-500">FASTAPI SERVER:</span>
            <span className={isBackendHealthy ? "text-cyan-400" : "text-red-400"}>
              {isBackendHealthy ? "ONLINE (200 OK)" : "OFFLINE"}
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
          {([
            { id: "overview", icon: Activity, label: "Fleet Command", badge: "Live" },
            { id: "vehicles", icon: Car, label: "Vehicles Registry", badge: "1 Active" },
            { id: "driver", icon: Zap, label: "Driver AI Scorecard" },
            { id: "map", icon: Navigation2, label: "Live Fleet Map", badge: "GPS" },
            { id: "maintenance", icon: Wrench, label: "Maintenance & DTCs", alert: telemetry.dtcs.length > 0 },
            { id: "settings", icon: Settings, label: "Gateway & Settings" },
          ] as { id: FleetTab; icon: any; label: string; badge?: string; alert?: boolean }[]).map(({ id, icon: Icon, label, badge, alert }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="nav-item w-full flex items-center justify-between px-3 py-2.5 rounded-none text-left relative group cursor-pointer transition-colors"
              style={{
                color: activeTab === id ? "var(--cyan)" : "var(--text-secondary)",
                background: activeTab === id ? "rgba(0,212,255,0.08)" : "transparent",
                borderLeft: activeTab === id ? "3px solid var(--cyan)" : "3px solid transparent",
              }}
            >
              <div className="flex items-center gap-3">
                <Icon size={16} />
                <span className="text-xs font-semibold">{label}</span>
              </div>
              {alert && (
                <span className="w-4 h-4 text-[9px] font-bold flex items-center justify-center bg-red-500 text-white font-mono">
                  {telemetry.dtcs.length}
                </span>
              )}
              {!alert && badge && (
                <span className="text-[9px] font-mono text-zinc-500 group-hover:text-cyan-400">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Fast Action: Open Telemetry HUD */}
        <div className="p-4 border-t" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.25)" }}>
          <button
            onClick={() => setSelectedVehicle(true)}
            className="w-full py-2.5 px-3 flex items-center justify-center gap-2 text-xs font-bold uppercase transition-all border border-cyan-500/50 hover:border-cyan-400 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 cursor-pointer shadow-[0_0_15px_rgba(0,212,255,0.2)]"
          >
            <Eye size={14} />
            <span>LAUNCH VEHICLE HUD</span>
            <ArrowRight size={13} />
          </button>
          <div className="text-[9px] font-mono text-zinc-500 text-center mt-2">
            INSPECT UNIT-01 COCKPIT
          </div>
        </div>
      </aside>

      {/* ── FLEET MAIN CONTENT AREA ────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="flex items-center justify-between px-6 py-3 border-b shrink-0" style={{ background: "var(--bg-panel)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-4">
            <div>
              <div className="hud-display text-lg font-bold uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
                {activeTab === "overview" && "FLEET COMMAND OPERATIONS"}
                {activeTab === "vehicles" && "FLEET ASSETS & VEHICLE REGISTRY"}
                {activeTab === "driver" && "DRIVER TELEMETRY & XGBOOST SCORECARD"}
                {activeTab === "map" && "LIVE FLEET GPS LOCATION & HEATMAPS"}
                {activeTab === "maintenance" && "FLEET MAINTENANCE & DIAGNOSTIC TICKETS"}
                {activeTab === "settings" && "ENTERPRISE TELEMATICS GATEWAY SETTINGS"}
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-400 mt-0.5">
                <span className="text-cyan-400 font-bold">{MONITORED_VEHICLE.department}</span>
                <span>|</span>
                <span>HUB: {MONITORED_VEHICLE.hubLocation}</span>
                <span>|</span>
                <span>SYSTEM TIME: {systemTime}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Fleet Health Indicator */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 border font-mono"
              style={{
                borderColor: healthStatus.status === "Healthy" ? "rgba(0,255,136,0.3)" : healthStatus.status === "Warning" ? "rgba(255,184,0,0.3)" : "rgba(255,51,51,0.3)",
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
                className="text-xs font-bold"
                style={{ color: healthStatus.status === "Healthy" ? "var(--green)" : healthStatus.status === "Warning" ? "var(--amber)" : "var(--red)" }}
              >
                FLEET HEALTH: {healthStatus.score}% {healthStatus.status.toUpperCase()}
              </span>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="px-3 py-1.5 flex items-center gap-2 transition-colors cursor-pointer border"
              style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.3)" }}
            >
              {theme === "dark" ? <Sun size={14} style={{ color: "var(--amber)" }} /> : <Moon size={14} style={{ color: "var(--cyan)" }} />}
              <span className="hud-label text-[9px]">
                {theme === "dark" ? "LIGHT" : "DARK"}
              </span>
            </button>
          </div>
        </header>

        {/* Tab Content Router */}
        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              className="h-full"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              {activeTab === "overview" && (
                <FleetOverviewTab
                  telemetryState={telemetryState}
                  onOpenVehicle={() => setSelectedVehicle(true)}
                  speedUnitStr={speedUnitStr}
                  tempUnitStr={tempUnitStr}
                  displayVss={displayVss}
                  displayCoolant={displayCoolant}
                  formatDuration={formatDuration}
                />
              )}

              {activeTab === "vehicles" && (
                <FleetVehiclesTab
                  telemetryState={telemetryState}
                  onOpenVehicle={() => setSelectedVehicle(true)}
                  speedUnitStr={speedUnitStr}
                  tempUnitStr={tempUnitStr}
                  displayVss={displayVss}
                  displayCoolant={displayCoolant}
                />
              )}

              {activeTab === "driver" && (
                <FleetDriverScorecardTab
                  telemetryState={telemetryState}
                  onOpenVehicle={() => setSelectedVehicle(true)}
                />
              )}

              {activeTab === "map" && (
                <GPSMap telemetry={telemetry} speedUnit={speedUnit} />
              )}

              {activeTab === "maintenance" && (
                <FleetMaintenanceTab
                  telemetryState={telemetryState}
                  onOpenVehicle={() => setSelectedVehicle(true)}
                />
              )}

              {activeTab === "settings" && (
                <FleetSettingsTab
                  telemetryState={telemetryState}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
};

// ─── 1. FLEET OVERVIEW TAB ────────────────────────────────────
interface FleetSubtabProps {
  telemetryState: LiveTelemetryState;
  onOpenVehicle: () => void;
  speedUnitStr: string;
  tempUnitStr: string;
  displayVss: number;
  displayCoolant: number;
  formatDuration: (s: number) => string;
}

const FleetOverviewTab: React.FC<FleetSubtabProps> = ({
  telemetryState,
  onOpenVehicle,
  speedUnitStr,
  tempUnitStr,
  displayVss,
  displayCoolant,
  formatDuration,
}) => {
  const {
    telemetry,
    history,
    tripTime,
    totalDistance,
    isConnected,
    healthStatus,
    currentBehavior,
    driverML,
    fuelML,
  } = telemetryState;

  const bColor =
    currentBehavior === "Economical"
      ? "var(--green)"
      : currentBehavior === "Moderate"
      ? "var(--amber)"
      : "var(--red)";

  const mileageVal = fuelML?.mileage_kmpl ?? 0;
  const isImperialSpeed = speedUnitStr === "mph";

  return (
    <div className="h-full overflow-y-auto scroll-area p-6 space-y-6" style={{ background: "var(--bg-deep)" }}>
      {/* ── Top Fleet KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 panel" style={{ borderColor: "var(--border)" }}>
          <div className="hud-label text-[9px] mb-1" style={{ color: "var(--text-muted)" }}>FLEET ASSETS</div>
          <div className="text-xl font-bold font-mono text-cyan-400">1 / 1 UNIT</div>
          <div className="text-[9px] font-mono text-green-400 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span>100% OPERATIONAL</span>
          </div>
        </div>

        <div className="p-3.5 panel" style={{ borderColor: "var(--border)" }}>
          <div className="hud-label text-[9px] mb-1" style={{ color: "var(--text-muted)" }}>HEALTH SCORE</div>
          <div className="text-xl font-bold font-mono" style={{ color: healthStatus.status === "Healthy" ? "var(--green)" : healthStatus.status === "Warning" ? "var(--amber)" : "var(--red)" }}>
            {healthStatus.score}%
          </div>
          <div className="text-[9px] font-mono text-zinc-400 mt-1 truncate">
            {healthStatus.status.toUpperCase()} INTEGRITY
          </div>
        </div>

        <div className="p-3.5 panel" style={{ borderColor: "var(--border)" }}>
          <div className="hud-label text-[9px] mb-1" style={{ color: "var(--text-muted)" }}>FLEET AVG FUEL</div>
          <div className="text-xl font-bold font-mono text-green-400">
            {mileageVal > 0 ? `${mileageVal.toFixed(1)} km/L` : "--"}
          </div>
          <div className="text-[9px] font-mono text-zinc-400 mt-1">
            TIER {fuelML?.tier ?? 1} PHYSICS
          </div>
        </div>

        <div className="p-3.5 panel" style={{ borderColor: "var(--border)" }}>
          <div className="hud-label text-[9px] mb-1" style={{ color: "var(--text-muted)" }}>ACTIVE DTC FAULTS</div>
          <div className="text-xl font-bold font-mono" style={{ color: telemetry.dtcs.length > 0 ? "var(--red)" : "var(--green)" }}>
            {telemetry.dtcs.length} CODES
          </div>
          <div className="text-[9px] font-mono text-zinc-400 mt-1">
            {telemetry.dtcs.length === 0 ? "ALL CLEAR" : telemetry.dtcs.join(", ")}
          </div>
        </div>

        <div className="p-3.5 panel" style={{ borderColor: "var(--border)" }}>
          <div className="hud-label text-[9px] mb-1" style={{ color: "var(--text-muted)" }}>CURRENT VELOCITY</div>
          <div className="text-xl font-bold font-mono text-purple-400">
            {displayVss} <span className="text-xs">{speedUnitStr}</span>
          </div>
          <div className="text-[9px] font-mono text-zinc-400 mt-1">
            RPM: {telemetry.rpm.toLocaleString()}
          </div>
        </div>

        <div className="p-3.5 panel" style={{ borderColor: "var(--border)" }}>
          <div className="hud-label text-[9px] mb-1" style={{ color: "var(--text-muted)" }}>FLEET ODOMETER TRIP</div>
          <div className="text-xl font-bold font-mono text-cyan-400">
            {totalDistance.toFixed(1)} km
          </div>
          <div className="text-[9px] font-mono text-zinc-400 mt-1">
            TIME: {formatDuration(tripTime)}
          </div>
        </div>
      </div>

      {/* ── HERO MONITORED VEHICLE CARD ── */}
      <div className="panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center border border-cyan-500/40 bg-cyan-500/10 text-cyan-400">
              <Car size={24} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <span className="hud-display text-xl font-bold text-white tracking-wide">
                  {MONITORED_VEHICLE.name}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-green-500/15 border border-green-500/40 text-green-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span>IN SERVICE • EN ROUTE</span>
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono border border-cyan-500/30 text-cyan-300 bg-cyan-500/5">
                  ID: {MONITORED_VEHICLE.id}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-zinc-400 mt-1">
                <span>PLATE: <strong className="text-white">{MONITORED_VEHICLE.plate}</strong></span>
                <span>•</span>
                <span>VIN: <span className="text-zinc-300">{MONITORED_VEHICLE.vin}</span></span>
                <span>•</span>
                <span>ASSIGNED OPERATOR: <strong className="text-cyan-300">{MONITORED_VEHICLE.driverName}</strong></span>
              </div>
            </div>
          </div>

          {/* Primary Action Button: Launch Cockpit */}
          <button
            onClick={onOpenVehicle}
            className="px-5 py-2.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold transition-all border border-cyan-500/50 hover:border-cyan-400 flex items-center gap-2.5 cursor-pointer shadow-[0_0_15px_rgba(0,212,255,0.25)]"
          >
            <Eye size={15} />
            <span>OPEN VEHICLE TELEMETRY COCKPIT</span>
            <ExternalLink size={14} />
          </button>
        </div>

        {/* Live Telemetry Sensor Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          <div className="p-3 border border-white/5 bg-black/30">
            <div className="hud-label text-[8px] text-zinc-500">ENGINE RPM</div>
            <div className="text-lg font-bold font-mono text-cyan-400">{telemetry.rpm} <span className="text-xs text-zinc-500">rpm</span></div>
            <div className="meter-track h-1 mt-1.5">
              <div className="meter-fill bg-cyan-400" style={{ width: `${Math.min(100, (telemetry.rpm / 7000) * 100)}%` }} />
            </div>
          </div>

          <div className="p-3 border border-white/5 bg-black/30">
            <div className="hud-label text-[8px] text-zinc-500">VEHICLE VELOCITY</div>
            <div className="text-lg font-bold font-mono text-purple-400">{displayVss} <span className="text-xs text-zinc-500">{speedUnitStr}</span></div>
            <div className="meter-track h-1 mt-1.5">
              <div className="meter-fill bg-purple-400" style={{ width: `${Math.min(100, (telemetry.vss / 220) * 100)}%` }} />
            </div>
          </div>

          <div className="p-3 border border-white/5 bg-black/30">
            <div className="hud-label text-[8px] text-zinc-500">COOLANT TEMP</div>
            <div className="text-lg font-bold font-mono text-amber-400">{displayCoolant} <span className="text-xs text-zinc-500">{tempUnitStr}</span></div>
            <div className="meter-track h-1 mt-1.5">
              <div className="meter-fill bg-amber-400" style={{ width: `${Math.min(100, (telemetry.coolantTemp / 130) * 100)}%` }} />
            </div>
          </div>

          <div className="p-3 border border-white/5 bg-black/30">
            <div className="hud-label text-[8px] text-zinc-500">THROTTLE POSITION</div>
            <div className="text-lg font-bold font-mono text-cyan-400">{telemetry.throttle}%</div>
            <div className="meter-track h-1 mt-1.5">
              <div className="meter-fill bg-cyan-400" style={{ width: `${telemetry.throttle}%` }} />
            </div>
          </div>

          <div className="p-3 border border-white/5 bg-black/30">
            <div className="hud-label text-[8px] text-zinc-500">FUEL CONSUMPTION</div>
            <div className="text-lg font-bold font-mono text-green-400">
              {mileageVal > 0 ? mileageVal.toFixed(1) : "--"} <span className="text-xs text-zinc-500">km/L</span>
            </div>
            <div className="text-[9px] font-mono text-zinc-500 mt-1">
              FCR: {fuelML?.fcr_gs ? `${fuelML.fcr_gs.toFixed(2)} g/s` : "--"}
            </div>
          </div>

          <div className="p-3 border border-white/5 bg-black/30">
            <div className="hud-label text-[8px] text-zinc-500">MANIFOLD PRESSURE</div>
            <div className="text-lg font-bold font-mono text-purple-400">{telemetry.mapKpa ?? 101} <span className="text-xs text-zinc-500">kPa</span></div>
            <div className="text-[9px] font-mono text-zinc-500 mt-1">
              MAF: {telemetry.maf} g/s
            </div>
          </div>
        </div>

        {/* Real-time telemetry sparklines */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
          <div className="p-3 border border-white/5 bg-black/20">
            <div className="flex items-center justify-between mb-2">
              <span className="hud-label text-[10px] text-zinc-400">RPM & VELOCITY CORRELATION WAVEFORM</span>
              <span className="text-[9px] font-mono text-cyan-400">LIVE BUFFER</span>
            </div>
            <MultiLineChart
              data={history.map((h, i) => ({
                t: i,
                rpm: h.rpm / 70,
                spd: isImperialSpeed ? Math.round(h.vss * 0.621371) : h.vss,
              }))}
              series={[
                { key: "rpm", color: "var(--cyan)", label: "RPM÷70" },
                { key: "spd", color: "var(--purple)", label: speedUnitStr },
              ]}
              height={90}
              maxPoints={50}
            />
          </div>

          <div className="p-3 border border-white/5 bg-black/20">
            <div className="flex items-center justify-between mb-2">
              <span className="hud-label text-[10px] text-zinc-400">INSTANTANEOUS FUEL EFFICIENCY & LOAD</span>
              <span className="text-[9px] font-mono text-green-400">3-TIER PHYSICS</span>
            </div>
            <MultiLineChart
              data={history.map((h, i) => ({
                t: i,
                mileage: h.ml?.fuel?.mileage_kmpl ?? 0,
                load: h.engineLoad,
              }))}
              series={[
                { key: "mileage", color: "var(--green)", label: "km/L" },
                { key: "load", color: "var(--amber)", label: "Load %" },
              ]}
              height={90}
              maxPoints={50}
            />
          </div>
        </div>

        {/* Live Location & Driving Style Bar */}
        <div className="p-3 border border-white/10 bg-black/40 flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
          <div className="flex items-center gap-2">
            <MapPin size={15} className="text-cyan-400" />
            <span className="text-zinc-400">CURRENT POSITION:</span>
            <span className="text-zinc-200">
              {telemetry.lat !== undefined ? `${telemetry.lat.toFixed(5)}° N, ${telemetry.lon?.toFixed(5)}° E` : "12.9134° N, 74.9018° E"}
            </span>
            <span className="text-zinc-500">|</span>
            <span className="text-zinc-400">ELEVATION:</span>
            <span className="text-amber-400">{telemetry.elevationM ? `${telemetry.elevationM.toFixed(1)} m` : "--"}</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Zap size={14} style={{ color: bColor }} />
              <span className="text-zinc-400">XGBOOST CLASSIFIER:</span>
              <span className="font-bold" style={{ color: bColor }}>{currentBehavior.toUpperCase()}</span>
            </div>
            <button
              onClick={onOpenVehicle}
              className="text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 font-bold cursor-pointer"
            >
              <span>Inspect Cockpit</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom Grid: AI Diagnostics & Fleet Watchlist ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* LSTM Autoencoder Health Monitor */}
        <div className="panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <Shield size={16} style={{ color: "var(--cyan)" }} />
              <span className="hud-display text-sm font-bold text-white">
                LSTM AUTOENCODER VEHICLE HEALTH ANOMALY MONITOR
              </span>
            </div>
            <span className="text-[10px] font-mono text-purple-400">PYTORCH INFERENCE</span>
          </div>

          <div className="flex items-center gap-4 p-3 border border-white/5 bg-black/20">
            <div className="hud-display text-4xl font-bold" style={{ color: healthStatus.status === "Healthy" ? "var(--green)" : "var(--red)" }}>
              {healthStatus.score}%
            </div>
            <div className="flex-1 font-mono text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-zinc-500">STATUS:</span>
                <span className="font-bold" style={{ color: healthStatus.status === "Healthy" ? "var(--green)" : "var(--red)" }}>
                  {healthStatus.isAnomaly ? "ANOMALY DETECTED" : "NOMINAL OPERATION"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">ANOMALY RECONSTRUCTION SCORE:</span>
                <span className="text-zinc-300">{healthStatus.anomalyScore > 0 ? healthStatus.anomalyScore.toFixed(5) : "0.000012"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">TRIGGERED SENSORS:</span>
                <span className={healthStatus.triggeredFeatures.length > 0 ? "text-red-400 font-bold" : "text-green-400"}>
                  {healthStatus.triggeredFeatures.length > 0 ? healthStatus.triggeredFeatures.join(", ") : "None (All Nominal)"}
                </span>
              </div>
            </div>
          </div>

          {telemetry.dtcs.length > 0 ? (
            <div className="space-y-2">
              <div className="text-[10px] font-mono text-red-400 uppercase font-bold flex items-center gap-1.5">
                <AlertTriangle size={12} />
                <span>ACTIVE DTC FAULT CODES DETECTED ON FLEET UNIT</span>
              </div>
              {telemetry.dtcs.map((code) => (
                <div key={code} className="p-2.5 border border-red-500/40 bg-red-500/10 font-mono text-xs flex justify-between items-center">
                  <span className="font-bold text-red-300">{code}</span>
                  <span className="text-[10px] text-zinc-400">
                    {code === "P0300" ? "Misfire Detected" : code === "P0171" ? "System Lean" : "Diagnostic Trouble Code"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-3 border border-dashed border-white/10 text-center font-mono text-xs text-zinc-500">
              No active Diagnostic Trouble Codes (DTC) detected.
            </div>
          )}
        </div>

        {/* Assigned Driver Profile & TTS Advisory */}
        <div className="panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2">
              <User size={16} style={{ color: "var(--purple)" }} />
              <span className="hud-display text-sm font-bold text-white">
                ASSIGNED OPERATOR PERFORMANCE & SAFETY ADVISORY
              </span>
            </div>
            <span className="text-[10px] font-mono text-zinc-400">OPERATOR ID: {MONITORED_VEHICLE.driverId}</span>
          </div>

          <div className="p-3 border border-white/5 bg-black/20 flex items-center justify-between">
            <div>
              <div className="text-sm font-bold text-white">{MONITORED_VEHICLE.driverName}</div>
              <div className="text-[10px] font-mono text-zinc-500">LICENSE: {MONITORED_VEHICLE.driverLicense}</div>
            </div>
            <div className="text-right">
              <div className="hud-label text-[9px] text-zinc-500">DRIVE STYLE</div>
              <div className="text-sm font-bold font-mono" style={{ color: bColor }}>{currentBehavior.toUpperCase()}</div>
            </div>
          </div>

          {/* Real-time TTS Advisory Note */}
          <div className="p-3.5 border border-purple-500/30 bg-purple-500/5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono text-purple-400 font-bold">
              <Volume2 size={15} />
              <span>AI TELEMATICS DRIVER ADVISORY (XGBOOST MODEL OUTPUT)</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed italic">
              "{driverML?.tts_message || "Smooth driving maintained. Vehicle operating within standard velocity and RPM corridors."}"
            </p>
            {driverML?.confidence && (
              <div className="text-[10px] font-mono text-zinc-500 text-right">
                MODEL CONFIDENCE: {(driverML.confidence * 100).toFixed(1)}%
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 2. VEHICLES REGISTRY TAB ─────────────────────────────────
const FleetVehiclesTab: React.FC<{
  telemetryState: LiveTelemetryState;
  onOpenVehicle: () => void;
  speedUnitStr: string;
  tempUnitStr: string;
  displayVss: number;
  displayCoolant: number;
}> = ({
  telemetryState,
  onOpenVehicle,
  speedUnitStr,
  tempUnitStr,
  displayVss,
  displayCoolant,
}) => {
  const { telemetry, totalDistance, healthStatus, currentBehavior, fuelML } = telemetryState;

  return (
    <div className="h-full overflow-y-auto scroll-area p-6 space-y-6" style={{ background: "var(--bg-deep)" }}>
      <div>
        <div className="hud-display text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          FLEET ASSETS & REGISTERED VEHICLES
        </div>
        <div className="hud-label text-[10px]" style={{ color: "var(--text-muted)" }}>
          MONITOR COMMERCIAL FLEET HARDWARE, ECU CAN-BUS PROTOCOLS, AND LIVE STATUS
        </div>
      </div>

      {/* Fleet Vehicles Table */}
      <div className="panel overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
        <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: "var(--border)" }}>
          <div className="hud-label text-xs font-bold text-cyan-400">
            ACTIVE FLEET ROSTER (1 REGISTERED TELEMATICS NODE)
          </div>
          <span className="text-xs font-mono text-zinc-500">FILTER: ALL VEHICLES</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-black/40 text-zinc-400 border-b" style={{ borderColor: "var(--border)" }}>
              <tr>
                <th className="p-3.5">UNIT ID / MODEL</th>
                <th className="p-3.5">REGISTRATION & VIN</th>
                <th className="p-3.5">OPERATOR</th>
                <th className="p-3.5">LIVE VELOCITY</th>
                <th className="p-3.5">HEALTH SCORE</th>
                <th className="p-3.5">DRIVE STYLE</th>
                <th className="p-3.5">DTC STATUS</th>
                <th className="p-3.5 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-zinc-300">
              <tr className="hover:bg-cyan-500/5 transition-colors">
                <td className="p-3.5">
                  <div className="font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span>{MONITORED_VEHICLE.name}</span>
                  </div>
                  <div className="text-[10px] text-cyan-400">{MONITORED_VEHICLE.id}</div>
                </td>

                <td className="p-3.5">
                  <div className="text-white font-bold">{MONITORED_VEHICLE.plate}</div>
                  <div className="text-[10px] text-zinc-500">{MONITORED_VEHICLE.vin}</div>
                </td>

                <td className="p-3.5">
                  <div className="text-zinc-200">{MONITORED_VEHICLE.driverName}</div>
                  <div className="text-[10px] text-zinc-500">{MONITORED_VEHICLE.driverId}</div>
                </td>

                <td className="p-3.5">
                  <span className="text-purple-400 font-bold">{displayVss} {speedUnitStr}</span>
                  <div className="text-[10px] text-zinc-500">{telemetry.rpm} RPM</div>
                </td>

                <td className="p-3.5">
                  <span className={`font-bold ${healthStatus.status === "Healthy" ? "text-green-400" : "text-red-400"}`}>
                    {healthStatus.score}% {healthStatus.status}
                  </span>
                </td>

                <td className="p-3.5">
                  <span className="px-1.5 py-0.5 border border-cyan-500/30 text-cyan-300 text-[10px]">
                    {currentBehavior}
                  </span>
                </td>

                <td className="p-3.5">
                  {telemetry.dtcs.length > 0 ? (
                    <span className="text-red-400 font-bold">{telemetry.dtcs.length} FAULTS</span>
                  ) : (
                    <span className="text-green-400">NOMINAL</span>
                  )}
                </td>

                <td className="p-3.5 text-right">
                  <button
                    onClick={onOpenVehicle}
                    className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold text-xs cursor-pointer inline-flex items-center gap-1.5 transition-all"
                  >
                    <span>Inspect Cockpit</span>
                    <ArrowRight size={12} />
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Deep-Dive Specifications Card */}
      <div className="panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
        <div className="hud-label text-xs font-bold text-white border-b pb-3" style={{ borderColor: "var(--border)" }}>
          HARDWARE & PROTOCOL CONFIGURATION — {MONITORED_VEHICLE.id}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
          <div className="p-3 border border-white/5 bg-black/20">
            <div className="hud-label text-[9px] text-zinc-500">ENGINE SPECIFICATION</div>
            <div className="text-zinc-200 font-bold mt-1">{MONITORED_VEHICLE.engineSpec}</div>
          </div>

          <div className="p-3 border border-white/5 bg-black/20">
            <div className="hud-label text-[9px] text-zinc-500">FUEL & STOICHIOMETRIC MIX</div>
            <div className="text-zinc-200 font-bold mt-1">{MONITORED_VEHICLE.fuelType}</div>
          </div>

          <div className="p-3 border border-white/5 bg-black/20">
            <div className="hud-label text-[9px] text-zinc-500">DIAGNOSTIC PROTOCOL</div>
            <div className="text-zinc-200 font-bold mt-1">{MONITORED_VEHICLE.protocol}</div>
          </div>

          <div className="p-3 border border-white/5 bg-black/20">
            <div className="hud-label text-[9px] text-zinc-500">FIRMWARE BUILD</div>
            <div className="text-zinc-200 font-bold mt-1">{MONITORED_VEHICLE.ecuFirmware}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 3. DRIVER PERFORMANCE TAB ────────────────────────────────
const FleetDriverScorecardTab: React.FC<{
  telemetryState: LiveTelemetryState;
  onOpenVehicle: () => void;
}> = ({ telemetryState, onOpenVehicle }) => {
  const { telemetry, currentBehavior, driverML } = telemetryState;
  const features = driverML?.feature_values || {};

  const bColor =
    currentBehavior === "Economical"
      ? "var(--green)"
      : currentBehavior === "Moderate"
      ? "var(--amber)"
      : "var(--red)";

  return (
    <div className="h-full overflow-y-auto scroll-area p-6 space-y-6" style={{ background: "var(--bg-deep)" }}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="hud-display text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            DRIVER TELEMETRY & AI PERFORMANCE SCORECARD
          </div>
          <div className="hud-label text-[10px]" style={{ color: "var(--text-muted)" }}>
            EVALUATING SMOOTHNESS, ACCELERATION VARIANCES, AND FUEL CONSERVATION VIA XGBOOST
          </div>
        </div>

        <button
          onClick={onOpenVehicle}
          className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold transition-all border border-cyan-500/40 flex items-center gap-2 cursor-pointer"
        >
          <span>Open Cockpit HUD</span>
          <ArrowRight size={13} />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
          <div className="hud-label text-xs font-bold text-white border-b pb-3" style={{ borderColor: "var(--border)" }}>
            OPERATOR IDENTIFIER
          </div>
          <div className="space-y-3 font-mono text-xs">
            <div>
              <span className="text-[10px] text-zinc-500 block">FULL NAME:</span>
              <span className="text-base font-bold text-white">{MONITORED_VEHICLE.driverName}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 block">ASSIGNED VEHICLE:</span>
              <span className="text-cyan-400 font-bold">{MONITORED_VEHICLE.name} ({MONITORED_VEHICLE.plate})</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 block">CURRENT STYLE:</span>
              <span className="text-lg font-bold" style={{ color: bColor }}>{currentBehavior.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
            <div className="hud-label text-xs font-bold text-white">
              XGBOOST ENGINEERED FEATURE METRICS (9 MODEL PARAMETERS)
            </div>
            <span className="text-[10px] font-mono text-purple-400">DriverBehavior_XGBoost_012</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div className="p-3 border border-white/5 bg-black/20">
              <div className="text-[9px] text-zinc-500">AVERAGE SPEED</div>
              <div className="text-base font-bold text-cyan-400 mt-1">
                {features.avg_speed !== undefined ? `${features.avg_speed.toFixed(1)} km/h` : `${telemetry.vss} km/h`}
              </div>
            </div>

            <div className="p-3 border border-white/5 bg-black/20">
              <div className="text-[9px] text-zinc-500">MEAN ENGINE RPM</div>
              <div className="text-base font-bold text-cyan-400 mt-1">
                {features.mean_rpm !== undefined ? `${features.mean_rpm.toFixed(0)} rpm` : `${telemetry.rpm} rpm`}
              </div>
            </div>

            <div className="p-3 border border-white/5 bg-black/20">
              <div className="text-[9px] text-zinc-500">RPM STD DEVIATION</div>
              <div className="text-base font-bold text-purple-400 mt-1">
                {features.rpm_std !== undefined ? features.rpm_std.toFixed(2) : "12.4"}
              </div>
            </div>

            <div className="p-3 border border-white/5 bg-black/20">
              <div className="text-[9px] text-zinc-500">PEDAL POSITION STD</div>
              <div className="text-base font-bold text-amber-400 mt-1">
                {features.pedal_std !== undefined ? features.pedal_std.toFixed(2) : "4.8"}
              </div>
            </div>

            <div className="p-3 border border-white/5 bg-black/20">
              <div className="text-[9px] text-zinc-500">ACCELERATION STD</div>
              <div className="text-base font-bold text-purple-400 mt-1">
                {features.accel_std !== undefined ? features.accel_std.toFixed(3) : "0.14"}
              </div>
            </div>

            <div className="p-3 border border-white/5 bg-black/20">
              <div className="text-[9px] text-zinc-500">SPEED VARIATION (DEV)</div>
              <div className="text-base font-bold text-cyan-400 mt-1">
                {features.vs_dev !== undefined ? features.vs_dev.toFixed(2) : "6.2"}
              </div>
            </div>
          </div>

          {/* Model feedback sentence */}
          {driverML?.tts_message && (
            <div className="p-3.5 border border-purple-500/30 bg-purple-500/10 text-xs font-mono text-zinc-200 flex items-start gap-2.5">
              <Volume2 size={16} className="text-purple-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] text-purple-400 block font-bold mb-0.5">SYNTHESIZED TTS ADVISORY:</span>
                <span>"{driverML.tts_message}"</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── 4. MAINTENANCE TAB ───────────────────────────────────────
const FleetMaintenanceTab: React.FC<{
  telemetryState: LiveTelemetryState;
  onOpenVehicle: () => void;
}> = ({ telemetryState, onOpenVehicle }) => {
  const {
    telemetry,
    serviceCompany,
    registeredIssues,
    telegramToken,
    telegramChatId,
    telegramEnabled,
  } = telemetryState;

  return (
    <div className="h-full overflow-y-auto scroll-area p-6 space-y-6" style={{ background: "var(--bg-deep)" }}>
      <div>
        <div className="hud-display text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          FLEET MAINTENANCE & SERVICE DISPATCH LOGS
        </div>
        <div className="hud-label text-[10px]" style={{ color: "var(--text-muted)" }}>
          TRACK DIAGNOSTIC TROUBLE CODES, SCHEDULE WORKSHOPS, AND NOTIFY FLEET TEAMS
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Active DTCs Card */}
          <div className="panel p-5 space-y-3" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
            <div className="hud-label text-xs font-bold text-white border-b pb-3 flex justify-between" style={{ borderColor: "var(--border)" }}>
              <span>ACTIVE FLEET DIAGNOSTIC TROUBLE CODES</span>
              <span className="text-red-400 font-mono">{telemetry.dtcs.length} ACTIVE</span>
            </div>

            {telemetry.dtcs.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-white/10 text-xs font-mono text-zinc-500">
                All systems nominal. No active diagnostic fault codes detected in vehicle ECU.
              </div>
            ) : (
              <div className="space-y-2">
                {telemetry.dtcs.map((code) => (
                  <div key={code} className="p-3 border border-red-500/40 bg-red-500/10 font-mono text-xs flex justify-between items-center">
                    <div>
                      <div className="font-bold text-red-300">{code}</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        {code === "P0300"
                          ? "Random/Multiple Cylinder Misfire Detected"
                          : code === "P0171"
                          ? "Air-Fuel Ratio System Too Lean (Bank 1)"
                          : code === "P0420"
                          ? "Catalyst Efficiency Below Threshold"
                          : "Active Fault Code"}
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 text-[10px]">
                      HIGH PRIORITY
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Service Tickets Log */}
          <div className="panel p-5 space-y-3" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
            <div className="hud-label text-xs font-bold text-white border-b pb-3 flex justify-between" style={{ borderColor: "var(--border)" }}>
              <span>DISPATCHED SERVICE TICKETS</span>
              <span className="text-cyan-400 font-mono">{registeredIssues.length} LOGGED</span>
            </div>

            {registeredIssues.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-white/10 text-xs font-mono text-zinc-500">
                No open maintenance tickets. Create tickets from the Vehicle Telemetry Cockpit.
              </div>
            ) : (
              <div className="space-y-2">
                {registeredIssues.map((issue) => (
                  <div key={issue.id} className="p-3 border border-white/10 bg-black/30 font-mono text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="font-bold text-cyan-400">{issue.id}</span>
                      <span className="text-[10px] text-zinc-400">{new Date(issue.date).toLocaleDateString()}</span>
                    </div>
                    <div className="text-zinc-200">{issue.description}</div>
                    <div className="flex gap-2 text-[10px] text-zinc-500 pt-1">
                      <span>Assigned: {issue.companyDetails.name}</span>
                      <span>•</span>
                      <span className="uppercase text-amber-400">{issue.urgency} Priority</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Assigned Service Provider & Telegram Status */}
        <div className="space-y-5">
          <div className="panel p-5 space-y-3 font-mono text-xs" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
            <div className="hud-label text-xs font-bold text-white border-b pb-3" style={{ borderColor: "var(--border)" }}>
              ASSIGNED WORKSHOP PARTNER
            </div>
            <div>
              <div className="text-[9px] text-zinc-500">WORKSHOP / MECHANIC NAME</div>
              <div className="text-cyan-400 font-bold text-sm mt-0.5">{serviceCompany.name}</div>
            </div>
            <div>
              <div className="text-[9px] text-zinc-500">CONTACT PHONE</div>
              <div className="text-zinc-300 mt-0.5">{serviceCompany.phone || "Not set"}</div>
            </div>
            <div>
              <div className="text-[9px] text-zinc-500">SUPPORT EMAIL</div>
              <div className="text-zinc-300 mt-0.5">{serviceCompany.email || "Not set"}</div>
            </div>
            <div>
              <div className="text-[9px] text-zinc-500">FACILITY ADDRESS</div>
              <div className="text-zinc-300 mt-0.5">{serviceCompany.address || "Not set"}</div>
            </div>
          </div>

          <div className="panel p-5 space-y-3 font-mono text-xs" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
            <div className="hud-label text-xs font-bold text-white border-b pb-3 flex justify-between" style={{ borderColor: "var(--border)" }}>
              <span>TELEGRAM ALERT DISPATCH</span>
              <span className={telegramEnabled ? "text-green-400" : "text-zinc-500"}>
                {telegramEnabled ? "ACTIVE" : "MUTED"}
              </span>
            </div>
            {telegramEnabled ? (
              <div>
                <span className="text-[9px] text-zinc-500 block">TARGET CHAT ID:</span>
                <span className="text-zinc-200">{telegramChatId || "Empty"}</span>
              </div>
            ) : (
              <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                Telegram alert gateway is currently disabled. Configure Bot Token in Fleet Settings to dispatch mobile fault alerts.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 5. SETTINGS TAB ──────────────────────────────────────────
const FleetSettingsTab: React.FC<{
  telemetryState: LiveTelemetryState;
}> = ({ telemetryState }) => {
  const {
    speedUnit,
    setSpeedUnit,
    tempUnit,
    setTempUnit,
    tempUrl,
    setTempUrl,
    handleSaveUrl,
    resetStates,
    isBackendHealthy,
    isConnected,
  } = telemetryState;

  const [savedMsg, setSavedMsg] = useState(false);

  const onSave = () => {
    handleSaveUrl();
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  };

  return (
    <div className="h-full overflow-y-auto scroll-area p-6 space-y-6" style={{ background: "var(--bg-deep)" }}>
      <div>
        <div className="hud-display text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          ENTERPRISE FLEET GATEWAY & TELEMATICS SETTINGS
        </div>
        <div className="hud-label text-[10px]" style={{ color: "var(--text-muted)" }}>
          CONFIGURE REVERSE PROXY TARGETS, UNITS OF MEASURE, AND TRIP BUFFERS
        </div>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* Backend Target URL */}
        <div className="panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
          <div className="hud-label text-xs font-bold text-white border-b pb-3" style={{ borderColor: "var(--border)" }}>
            FASTAPI REVERSE PROXY GATEWAY TARGET
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={tempUrl}
              onChange={(e) => setTempUrl(e.target.value)}
              placeholder="e.g. https://ecu-backend-95fz.onrender.com or http://localhost:8000"
              className="flex-1 bg-black/40 text-xs px-3 py-2 outline-none font-mono"
              style={{ border: "1px solid var(--border)", color: "var(--text-primary)" }}
            />
            <button
              onClick={onSave}
              className="px-4 py-2 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-xs font-bold transition-all border border-cyan-500/40 cursor-pointer"
            >
              SAVE TARGET
            </button>
          </div>

          {savedMsg && (
            <div className="text-xs text-green-400 font-mono">
              ✓ Gateway target updated successfully!
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 font-mono text-xs pt-2">
            <div className="p-3 border border-white/5 bg-black/20 flex justify-between">
              <span className="text-zinc-500">BACKEND HEALTH:</span>
              <span className={isBackendHealthy ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                {isBackendHealthy ? "ONLINE (200 OK)" : "OFFLINE"}
              </span>
            </div>

            <div className="p-3 border border-white/5 bg-black/20 flex justify-between">
              <span className="text-zinc-500">WEBSOCKET CHANNEL:</span>
              <span className={isConnected ? "text-cyan-400 font-bold" : "text-amber-400 font-bold"}>
                {isConnected ? "ACTIVE / STREAMING" : "CONNECTING"}
              </span>
            </div>
          </div>
        </div>

        {/* Display Units */}
        <div className="panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
          <div className="hud-label text-xs font-bold text-white border-b pb-3" style={{ borderColor: "var(--border)" }}>
            FLEET MEASUREMENT UNITS
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <span className="hud-label text-[10px] text-zinc-500 block">SPEED UNITS</span>
              <div className="flex border" style={{ borderColor: "var(--border)" }}>
                <button
                  onClick={() => setSpeedUnit("metric")}
                  className={`flex-1 py-1.5 text-xs font-bold cursor-pointer ${
                    speedUnit === "metric" ? "bg-cyan-500/20 text-cyan-300" : "text-zinc-500"
                  }`}
                >
                  METRIC (KM/H)
                </button>
                <button
                  onClick={() => setSpeedUnit("imperial")}
                  className={`flex-1 py-1.5 text-xs font-bold cursor-pointer ${
                    speedUnit === "imperial" ? "bg-cyan-500/20 text-cyan-300" : "text-zinc-500"
                  }`}
                >
                  IMPERIAL (MPH)
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <span className="hud-label text-[10px] text-zinc-500 block">TEMPERATURE UNITS</span>
              <div className="flex border" style={{ borderColor: "var(--border)" }}>
                <button
                  onClick={() => setTempUnit("metric")}
                  className={`flex-1 py-1.5 text-xs font-bold cursor-pointer ${
                    tempUnit === "metric" ? "bg-amber-500/20 text-amber-300" : "text-zinc-500"
                  }`}
                >
                  CELSIUS (°C)
                </button>
                <button
                  onClick={() => setTempUnit("imperial")}
                  className={`flex-1 py-1.5 text-xs font-bold cursor-pointer ${
                    tempUnit === "imperial" ? "bg-amber-500/20 text-amber-300" : "text-zinc-500"
                  }`}
                >
                  FAHRENHEIT (°F)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Reset System Trip */}
        <div className="panel p-5 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white">RESET FLEET TRIP ODOMETER</div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Resets accumulated distance counter and clears waveform chart history.
              </p>
            </div>
            <button
              onClick={resetStates}
              className="px-4 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/40 text-xs font-bold uppercase transition-all cursor-pointer"
            >
              RESET TRIP DATA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
