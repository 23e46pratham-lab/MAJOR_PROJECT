/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard, Car, Activity, BarChart2, FileText, Bell, Settings,
  MapPin, Plus, Sun, Moon, ChevronRight, ChevronDown, Check, X,
  AlertTriangle, AlertCircle, CheckCircle, Flame, Zap, Fuel, Leaf,
  Eye, RefreshCw, Send, Shield, User, Clock, ArrowRight, ExternalLink,
  Cpu, Wrench, Search, Filter, Sliders, Radio, Compass, Server
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid
} from "recharts";
import { useLiveTelemetry, LiveTelemetryState } from "../services/useLiveTelemetry";
import { Dashboard } from "./Dashboard";
import { GPSMap } from "./GPSMap";
import { MultiLineChart } from "./LiveChart";

export type FleetTab =
  | "dashboard"
  | "devices"
  | "monitoring"
  | "analytics"
  | "reports"
  | "alerts"
  | "settings";

export interface MonitoredVehicle {
  id: string;
  name: string;
  year: number;
  type: string;
  plate: string;
  vin: string;
  driverName: string;
  driverId: string;
  engineSpec: string;
  fuelType: string;
  protocol: string;
  ecuFirmware: string;
  department: string;
  hubLocation: string;
  status: "Online" | "Idle" | "Alert";
}

// Live primary monitored vehicle connected to OBD-II ECU
export const INITIAL_VEHICLE: MonitoredVehicle = {
  id: "FLEET-UNIT-01",
  name: "Seat León 1.6 FSI",
  year: 2017,
  type: "Commercial Compact Hatchback",
  plate: "KA-19-EQ-4096",
  vin: "VSSZZZ5PZ8R019482",
  driverName: "Pratham S.",
  driverId: "DRV-8821",
  engineSpec: "1.6L Inline-4 16V FSI (1,598 cc)",
  fuelType: "BS6 E10 Gasoline (AFR 14.7)",
  protocol: "OBD-II ISO 15765-4 CAN (11-bit ID, 500 kbaud)",
  ecuFirmware: "v2.1.0-OBD-CANBUS",
  department: "Urban Logistics & Telematics Operations",
  hubLocation: "St Joseph Engineering College / Mangaluru Node",
  status: "Online",
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

  const [activeTab, setActiveTab] = useState<FleetTab>("dashboard");
  const [selectedVehicle, setSelectedVehicle] = useState<boolean>(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [systemTime, setSystemTime] = useState(new Date().toLocaleTimeString());
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Fleet Device Registry (starts with primary monitored vehicle)
  const [vehicles, setVehicles] = useState<MonitoredVehicle[]>([INITIAL_VEHICLE]);

  // Form state for adding device
  const [newDevice, setNewDevice] = useState({
    name: "Volkswagen Golf 1.4 TSI",
    plate: "KA 20 PX 6721",
    vin: "WVWZZZ1KZ9W049182",
    protocol: "OBD-II ISO 15765-4 CAN (11-bit, 500 kbaud)",
    driverName: "Kavya R.",
    department: "Logistics Hub - Mangaluru South",
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "light") {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    }
  }, [theme]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleRegisterDevice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDevice.plate.trim() || !newDevice.name.trim()) return;

    const registered: MonitoredVehicle = {
      id: `FLEET-UNIT-0${vehicles.length + 1}`,
      name: newDevice.name.trim(),
      year: 2021,
      type: "Commercial Compact Fleet",
      plate: newDevice.plate.trim(),
      vin: newDevice.vin.trim() || "VSSZZZ5PZ8R999999",
      driverName: newDevice.driverName.trim() || "Unassigned Operator",
      driverId: `DRV-${Math.floor(1000 + Math.random() * 9000)}`,
      engineSpec: "1.4L TSI Turbo (1,390 cc)",
      fuelType: "Gasoline E10",
      protocol: newDevice.protocol,
      ecuFirmware: "v2.1.0-OBD-CANBUS",
      department: newDevice.department.trim() || "Urban Logistics Hub",
      hubLocation: "Mangaluru Telematics Node",
      status: "Online",
    };

    setVehicles((prev) => [...prev, registered]);
    setIsAddDeviceOpen(false);
    showToast(`Device ${registered.plate} successfully paired to fleet gateway!`);
  };

  // Unit conversions
  const isImperialSpeed = speedUnit === "imperial";
  const isImperialTemp = tempUnit === "imperial";
  const displayVss = isImperialSpeed ? Math.round(telemetry.vss * 0.621371) : telemetry.vss;
  const speedUnitStr = isImperialSpeed ? "mph" : "km/h";
  const displayCoolant = isImperialTemp ? Math.round(telemetry.coolantTemp * 1.8 + 32) : telemetry.coolantTemp;
  const tempUnitStr = isImperialTemp ? "°F" : "°C";
  const mileageVal = fuelML?.mileage_kmpl ?? 15.8;

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0
      ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  // If the fleet manager opens the vehicle, render full vehicle telemetry cockpit
  if (selectedVehicle) {
    return (
      <Dashboard
        onBackToFleet={() => setSelectedVehicle(false)}
        sharedState={telemetryState}
        vehicleInfo={{
          id: vehicles[0].id,
          model: vehicles[0].name,
          plate: vehicles[0].plate,
          driverName: vehicles[0].driverName,
        }}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden text-slate-100 bg-[#080C14] font-sans select-none">
      {/* ── TOAST NOTIFICATION ── */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 bg-emerald-500/90 text-slate-950 font-semibold text-xs rounded-xl shadow-2xl backdrop-blur-md"
          >
            <CheckCircle size={16} />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LEFT SIDEBAR ────────────────────────────────────── */}
      <aside className="w-64 border-r border-[#1A263D] bg-[#0B101D] flex flex-col justify-between shrink-0 z-20">
        <div>
          {/* Logo / Brand Header */}
          <div className="px-6 py-6 border-b border-[#1A263D]/80">
            <div className="flex items-center gap-3">
              {/* Car outline + ECG pulse icon */}
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(0,212,255,0.15)]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                  <circle cx="7" cy="17" r="2" />
                  <circle cx="17" cy="17" r="2" />
                </svg>
              </div>
              <div>
                <div className="flex items-center text-base font-extrabold tracking-tight">
                  <span className="text-white">AUTOVUE</span>
                  <span className="text-cyan-400">FLEET</span>
                </div>
                <div className="text-[9px] tracking-widest uppercase font-semibold text-slate-500">
                  FLEET MANAGEMENT PORTAL
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1 mt-2">
            {[
              { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
              { id: "devices", icon: Car, label: "Fleet Devices" },
              { id: "monitoring", icon: Activity, label: "Live Monitoring" },
              { id: "analytics", icon: BarChart2, label: "Analytics" },
              { id: "reports", icon: FileText, label: "Reports" },
              { id: "alerts", icon: Bell, label: "Alerts", count: telemetry.dtcs.length > 0 ? telemetry.dtcs.length : 1 },
              { id: "settings", icon: Settings, label: "Settings" },
            ].map(({ id, icon: Icon, label, count }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as FleetTab)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-gradient-to-r from-cyan-500/20 to-teal-500/10 text-white border border-cyan-500/30 shadow-[0_0_20px_rgba(0,212,255,0.12)]"
                      : "text-slate-400 hover:text-slate-200 hover:bg-[#121B2F]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className={isActive ? "text-cyan-400" : "text-slate-400"} />
                    <span>{label}</span>
                  </div>
                  {count !== undefined && count > 0 && (
                    <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: System Status & User Profile */}
        <div className="p-3 space-y-2 border-t border-[#1A263D]/80">
          {/* System Online Badge Card */}
          <div className="p-3 rounded-xl bg-[#0F1626] border border-[#1A263D] flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                <span className="text-xs font-semibold text-slate-200">System Online</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Last updated • {systemTime}
              </div>
            </div>
            <div className="text-[10px] font-mono text-cyan-400/80">
              {isConnected ? "WS 200" : "SYNC"}
            </div>
          </div>

          {/* User Profile */}
          <div className="p-2.5 rounded-xl hover:bg-[#121B2F] transition-colors flex items-center justify-between cursor-pointer">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-md">
                P
              </div>
              <div className="leading-tight">
                <div className="text-xs font-bold text-slate-200">Pratham U</div>
                <div className="text-[10px] text-slate-500">Fleet Admin</div>
              </div>
            </div>
            <ChevronDown size={14} className="text-slate-500" />
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT VIEWPORT ───────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#080C14]">
        {/* Top Header Bar */}
        <header className="px-8 py-5 border-b border-[#1A263D] flex items-center justify-between shrink-0 bg-[#0B101D]/70 backdrop-blur-md">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Fleet Manager
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Monitor. Manage. Drive Smart.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Primary Action Button: Add New Fleet Device */}
            <button
              onClick={() => setIsAddDeviceOpen(true)}
              className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs rounded-xl flex items-center gap-2 shadow-[0_0_20px_rgba(0,212,255,0.25)] transition-all cursor-pointer active:scale-95"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Add New Fleet Device</span>
            </button>

            {/* Notification Bell */}
            <button
              onClick={() => setActiveTab("alerts")}
              className="w-9 h-9 rounded-xl bg-[#0F1626] border border-[#1A263D] hover:border-slate-600 text-slate-300 hover:text-white flex items-center justify-center relative cursor-pointer transition-colors"
              title="Notifications"
            >
              <Bell size={16} />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500" />
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-9 h-9 rounded-xl bg-[#0F1626] border border-[#1A263D] hover:border-slate-600 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {theme === "dark" ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-cyan-400" />}
            </button>
          </div>
        </header>

        {/* Tab Content Router */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
            >
              {activeTab === "dashboard" && (
                <DashboardOverviewView
                  telemetryState={telemetryState}
                  vehicles={vehicles}
                  onOpenVehicle={() => setSelectedVehicle(true)}
                  onViewAllDevices={() => setActiveTab("devices")}
                  onViewAllAlerts={() => setActiveTab("alerts")}
                  onViewMap={() => setActiveTab("monitoring")}
                  displayVss={displayVss}
                  speedUnitStr={speedUnitStr}
                  mileageVal={mileageVal}
                />
              )}

              {activeTab === "devices" && (
                <FleetDevicesView
                  vehicles={vehicles}
                  telemetryState={telemetryState}
                  onOpenVehicle={() => setSelectedVehicle(true)}
                  onOpenAddDevice={() => setIsAddDeviceOpen(true)}
                  displayVss={displayVss}
                  speedUnitStr={speedUnitStr}
                  mileageVal={mileageVal}
                />
              )}

              {activeTab === "monitoring" && (
                <LiveMonitoringView
                  telemetryState={telemetryState}
                  onOpenVehicle={() => setSelectedVehicle(true)}
                  displayVss={displayVss}
                  speedUnitStr={speedUnitStr}
                  displayCoolant={displayCoolant}
                  tempUnitStr={tempUnitStr}
                />
              )}

              {activeTab === "analytics" && (
                <AnalyticsScorecardView
                  telemetryState={telemetryState}
                  onOpenVehicle={() => setSelectedVehicle(true)}
                />
              )}

              {activeTab === "reports" && (
                <ReportsMaintenanceView
                  telemetryState={telemetryState}
                  onOpenVehicle={() => setSelectedVehicle(true)}
                />
              )}

              {activeTab === "alerts" && (
                <AlertsDiagnosticsView
                  telemetryState={telemetryState}
                  onOpenVehicle={() => setSelectedVehicle(true)}
                />
              )}

              {activeTab === "settings" && (
                <SettingsGatewayView
                  telemetryState={telemetryState}
                  theme={theme}
                  setTheme={setTheme}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ── ADD NEW FLEET DEVICE MODAL ──────────────────────── */}
      <AnimatePresence>
        {isAddDeviceOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-lg bg-[#0F1626] border border-[#1A263D] rounded-2xl shadow-2xl p-6 text-slate-200"
            >
              <div className="flex items-center justify-between pb-4 border-b border-[#1A263D]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Car size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Add New Fleet Device</h3>
                    <p className="text-xs text-slate-400">Pair an OBD-II CAN bus adapter to the gateway</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddDeviceOpen(false)}
                  className="w-7 h-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <form onSubmit={handleRegisterDevice} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">
                      Vehicle Model & Engine
                    </label>
                    <input
                      type="text"
                      required
                      value={newDevice.name}
                      onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
                      placeholder="e.g. Volkswagen Golf 1.4 TSI"
                      className="w-full px-3 py-2 bg-[#090D17] border border-[#1A263D] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">
                      Registration / Plate No
                    </label>
                    <input
                      type="text"
                      required
                      value={newDevice.plate}
                      onChange={(e) => setNewDevice({ ...newDevice, plate: e.target.value })}
                      placeholder="e.g. KA 20 PX 6721"
                      className="w-full px-3 py-2 bg-[#090D17] border border-[#1A263D] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">
                      VIN (Vehicle Identification No)
                    </label>
                    <input
                      type="text"
                      value={newDevice.vin}
                      onChange={(e) => setNewDevice({ ...newDevice, vin: e.target.value })}
                      placeholder="e.g. WVWZZZ1KZ9W049182"
                      className="w-full px-3 py-2 bg-[#090D17] border border-[#1A263D] rounded-xl text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-400 block mb-1">
                      Assigned Driver
                    </label>
                    <input
                      type="text"
                      value={newDevice.driverName}
                      onChange={(e) => setNewDevice({ ...newDevice, driverName: e.target.value })}
                      placeholder="e.g. Kavya R."
                      className="w-full px-3 py-2 bg-[#090D17] border border-[#1A263D] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    OBD-II CAN Protocol
                  </label>
                  <select
                    value={newDevice.protocol}
                    onChange={(e) => setNewDevice({ ...newDevice, protocol: e.target.value })}
                    className="w-full px-3 py-2 bg-[#090D17] border border-[#1A263D] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
                  >
                    <option value="OBD-II ISO 15765-4 CAN (11-bit, 500 kbaud)">
                      OBD-II ISO 15765-4 CAN (11-bit ID, 500 kbaud) - Standard
                    </option>
                    <option value="OBD-II ISO 15765-4 CAN (29-bit, 500 kbaud)">
                      OBD-II ISO 15765-4 CAN (29-bit ID, 500 kbaud) - Extended
                    </option>
                    <option value="ISO 14230-4 KWP2000 (Fast Init)">
                      ISO 14230-4 KWP2000 (Fast Init, 10.4 kbaud)
                    </option>
                    <option value="SAE J1939 Commercial Heavy-Duty">
                      SAE J1939 Commercial Vehicle Protocol (250 kbaud)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">
                    Department / Node Assignment
                  </label>
                  <input
                    type="text"
                    value={newDevice.department}
                    onChange={(e) => setNewDevice({ ...newDevice, department: e.target.value })}
                    placeholder="e.g. Logistics Hub - Mangaluru Node"
                    className="w-full px-3 py-2 bg-[#090D17] border border-[#1A263D] rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1A263D]">
                  <button
                    type="button"
                    onClick={() => setIsAddDeviceOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold rounded-xl cursor-pointer shadow-[0_0_15px_rgba(0,212,255,0.2)]"
                  >
                    Pair Device
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── 1. DASHBOARD OVERVIEW VIEW (Matching Reference Image) ───────
interface DashboardOverviewProps {
  telemetryState: LiveTelemetryState;
  vehicles: MonitoredVehicle[];
  onOpenVehicle: () => void;
  onViewAllDevices: () => void;
  onViewAllAlerts: () => void;
  onViewMap: () => void;
  displayVss: number;
  speedUnitStr: string;
  mileageVal: number;
}

const DashboardOverviewView: React.FC<DashboardOverviewProps> = ({
  telemetryState,
  vehicles,
  onOpenVehicle,
  onViewAllDevices,
  onViewAllAlerts,
  onViewMap,
  displayVss,
  speedUnitStr,
  mileageVal,
}) => {
  const { telemetry, healthStatus, currentBehavior } = telemetryState;
  const [performanceRange, setPerformanceRange] = useState<"7d" | "24h" | "live">("7d");

  // Performance dual-line dataset
  const performanceData = useMemo(() => {
    return [
      { day: "Oct 22", speed: 28, fuel: 58 },
      { day: "Oct 23", speed: 62, fuel: 65 },
      { day: "Oct 24", speed: 52, fuel: 55 },
      { day: "Oct 25", speed: 68, fuel: 62 },
      { day: "Oct 26", speed: 82, fuel: 88 },
      { day: "Oct 27", speed: 70, fuel: 75 },
      { day: "Oct 28", speed: displayVss > 0 ? Math.min(100, displayVss) : 48, fuel: Math.min(100, Math.round(mileageVal * 5.5)) },
    ];
  }, [displayVss, mileageVal]);

  const activeAlertsCount = telemetry.dtcs.length > 0 ? telemetry.dtcs.length : 1;
  const healthPercent = healthStatus.score || 92;

  return (
    <div className="space-y-6">
      {/* ── ROW 1: FOUR STAT CARDS ───────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Vehicles */}
        <div className="p-5 rounded-2xl bg-[#0F1626] border border-[#1A263D] hover:border-cyan-500/30 transition-all flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.15)]">
              <Car size={22} />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-400">Total Vehicles</div>
              <div className="text-2xl font-bold text-white tracking-tight mt-0.5">
                {vehicles.length}
              </div>
              <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1 mt-0.5">
                <span>↑ +1</span>
              </div>
            </div>
          </div>
          {/* Blue Sparkline SVG */}
          <div className="w-24 h-10">
            <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible">
              <path
                d="M 0 30 Q 25 35, 45 20 T 90 10"
                fill="none"
                stroke="#3B82F6"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 2: Active Vehicles */}
        <div className="p-5 rounded-2xl bg-[#0F1626] border border-[#1A263D] hover:border-emerald-500/30 transition-all flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.15)]">
              <Activity size={22} />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-400">Active Vehicles</div>
              <div className="text-2xl font-bold text-white tracking-tight mt-0.5">
                {vehicles.length}
              </div>
              <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1 mt-0.5">
                <span>↑ 100%</span>
              </div>
            </div>
          </div>
          {/* Green Sparkline SVG */}
          <div className="w-24 h-10">
            <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible">
              <path
                d="M 0 32 Q 30 15, 60 28 T 95 12"
                fill="none"
                stroke="#10B981"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 3: Alerts */}
        <div className="p-5 rounded-2xl bg-[#0F1626] border border-[#1A263D] hover:border-amber-500/30 transition-all flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
              <AlertTriangle size={22} />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-400">Alerts</div>
              <div className="text-2xl font-bold text-white tracking-tight mt-0.5">
                {activeAlertsCount}
              </div>
              <div className="text-xs font-semibold text-amber-400 flex items-center gap-1 mt-0.5">
                <span>↓ -2</span>
              </div>
            </div>
          </div>
          {/* Amber Sparkline SVG */}
          <div className="w-24 h-10">
            <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible">
              <path
                d="M 0 25 Q 30 10, 50 30 T 95 20"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Card 4: Avg. Fuel Efficiency */}
        <div className="p-5 rounded-2xl bg-[#0F1626] border border-[#1A263D] hover:border-purple-500/30 transition-all flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-[0_0_12px_rgba(139,92,246,0.15)]">
              <Fuel size={22} />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-400">Avg. Fuel Efficiency</div>
              <div className="text-2xl font-bold text-white tracking-tight mt-0.5">
                {mileageVal > 0 ? `${mileageVal.toFixed(1)} km/L` : "15.8 km/L"}
              </div>
              <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1 mt-0.5">
                <span>↑ +2.1%</span>
              </div>
            </div>
          </div>
          {/* Purple Sparkline SVG */}
          <div className="w-24 h-10">
            <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible">
              <path
                d="M 0 28 Q 25 35, 50 15 T 95 22"
                fill="none"
                stroke="#8B5CF6"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ── ROW 2: MAP & FLEET DEVICES TABLE ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Fleet Overview Map (approx 55% width) - SAT View & Vehicle Point Only (No Traveled Line) */}
        <div className="lg:col-span-7 h-[360px] rounded-2xl overflow-hidden border border-[#1A263D] bg-[#0F1626]">
          <GPSMap
            telemetry={telemetry}
            speedUnit={telemetryState.speedUnit}
            compact={true}
            showTraveledPath={false}
            initialMapStyle="satellite"
            onViewAll={onViewMap}
          />
        </div>

        {/* Right: Fleet Devices Roster Table (approx 45% width) */}
        <div className="lg:col-span-5 h-[360px] rounded-2xl border border-[#1A263D] bg-[#0F1626] flex flex-col overflow-hidden">
          {/* Table Header Bar */}
          <div className="px-5 py-3.5 border-b border-[#1A263D] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                <Car size={15} />
              </div>
              <span className="font-semibold text-sm text-white tracking-wide">Fleet Devices</span>
            </div>
            <button
              onClick={onViewAllDevices}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>View All</span>
              <span>→</span>
            </button>
          </div>

          {/* Table Content */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-[#1A263D]/60 bg-[#0B101D]/50 sticky top-0">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Vehicle</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Speed</th>
                  <th className="py-2.5 px-3 font-semibold">Fuel</th>
                  <th className="py-2.5 px-3 font-semibold">Last Update</th>
                  <th className="py-2.5 px-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A263D]/40">
                {/* Monitored Live Vehicle Row */}
                <tr
                  onClick={onOpenVehicle}
                  className="hover:bg-[#152035]/80 transition-colors cursor-pointer group"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-300 group-hover:text-cyan-400 group-hover:border-cyan-500/40 transition-colors">
                        <Car size={14} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-100 group-hover:text-cyan-300 transition-colors font-mono">
                          {vehicles[0].plate}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {vehicles[0].name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Online
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-200">
                    {displayVss} {speedUnitStr}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-200">
                    {telemetry.fuelLevelPct ?? 68}%
                  </td>
                  <td className="py-3 px-3 text-slate-400 text-[11px]">
                    Just now
                  </td>
                  <td className="py-3 px-2 text-right pr-4 text-slate-500 group-hover:text-cyan-400 transition-colors">
                    <ChevronRight size={15} />
                  </td>
                </tr>

                {/* Additional paired devices if registered */}
                {vehicles.slice(1).map((v) => (
                  <tr
                    key={v.id}
                    onClick={onOpenVehicle}
                    className="hover:bg-[#152035]/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-300">
                          <Car size={14} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-100 font-mono">{v.plate}</div>
                          <div className="text-[10px] text-slate-400">{v.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        Online
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-200">48 km/h</td>
                    <td className="py-3 px-3 font-mono text-slate-200">73%</td>
                    <td className="py-3 px-3 text-slate-400 text-[11px]">5 min ago</td>
                    <td className="py-3 px-2 text-right pr-4 text-slate-500 group-hover:text-cyan-400 transition-colors">
                      <ChevronRight size={15} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── ROW 3: PERFORMANCE, FUEL & HEALTH, RECENT ALERTS ──── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
        {/* Card 1: Fleet Performance (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-[#1A263D] bg-[#0F1626] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#1A263D]">
            <div className="flex items-center gap-2">
              <BarChart2 size={16} className="text-cyan-400" />
              <span className="font-semibold text-sm text-white">Fleet Performance</span>
            </div>

            {/* Selector dropdown */}
            <div className="flex items-center gap-1 px-2.5 py-1 bg-[#090D17] border border-[#1A263D] rounded-lg text-xs text-slate-300">
              <span>Last 7 Days</span>
              <ChevronDown size={13} className="text-slate-400" />
            </div>
          </div>

          {/* Performance Legend */}
          <div className="flex items-center gap-5 pt-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className="text-slate-300 font-medium">Avg. Speed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-slate-300 font-medium">Fuel Efficiency</span>
            </div>
          </div>

          {/* Recharts Area Chart */}
          <div className="h-44 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1A263D" vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke="#64748B"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#64748B"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F1626",
                    borderColor: "#1A263D",
                    borderRadius: "0.75rem",
                    color: "#F8FAFC",
                    fontSize: "11px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="speed"
                  name="Avg. Speed"
                  stroke="#3B82F6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#speedGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="fuel"
                  name="Fuel Efficiency"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#fuelGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 2: Fuel & Health (3 cols) */}
        <div className="lg:col-span-3 rounded-2xl border border-[#1A263D] bg-[#0F1626] p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2 pb-3 border-b border-[#1A263D]">
            <Fuel size={16} className="text-cyan-400" />
            <span className="font-semibold text-sm text-white">Fuel & Health</span>
          </div>

          {/* Donut Progress Ring + Side Stats */}
          <div className="flex items-center justify-between gap-4 py-3">
            {/* Donut Gauge */}
            <div className="relative w-28 h-28 flex items-center justify-center shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                {/* Background Track */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#1A263D"
                  strokeWidth="10"
                />
                {/* Progress Arc */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="url(#donutGrad)"
                  strokeWidth="10"
                  strokeDasharray={2 * Math.PI * 40}
                  strokeDashoffset={2 * Math.PI * 40 * (1 - healthPercent / 100)}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="donutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10B981" />
                    <stop offset="100%" stopColor="#00D4FF" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-xl font-black text-white tracking-tight">{healthPercent}%</span>
                <span className="text-[9px] text-slate-400 uppercase font-semibold">Fleet Health</span>
              </div>
            </div>

            {/* Side Stats */}
            <div className="space-y-3 flex-1 min-w-0">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                    <Fuel size={14} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white font-mono">
                      {mileageVal > 0 ? `${mileageVal.toFixed(1)} km/L` : "15.8 km/L"}
                    </div>
                    <div className="text-[10px] text-slate-400">Avg. Fuel Efficiency</div>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <Leaf size={14} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white font-mono">
                      {currentBehavior === "Economical" ? "-8%" : currentBehavior === "Moderate" ? "-2%" : "+14%"}
                    </div>
                    <div className="text-[10px] text-slate-400">Fuel vs Baseline</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#1A263D]/60 flex items-center justify-between text-[11px] text-slate-400">
            <span>Status: <strong className="text-emerald-400">{healthStatus.status}</strong></span>
            <span>XGBoost: <strong className="text-cyan-400">{currentBehavior}</strong></span>
          </div>
        </div>

        {/* Card 3: Recent Alerts (4 cols) */}
        <div className="lg:col-span-4 rounded-2xl border border-[#1A263D] bg-[#0F1626] p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-[#1A263D]">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-cyan-400" />
              <span className="font-semibold text-sm text-white">Recent Alerts</span>
            </div>
            <button
              onClick={onViewAllAlerts}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>View All</span>
              <span>→</span>
            </button>
          </div>

          {/* Alert items */}
          <div className="space-y-3 py-2 flex-1">
            {/* Alert 1 */}
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white truncate">
                    Vehicle {vehicles[0].plate}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">7 min ago</span>
                </div>
                <div className="text-[11px] text-red-300 mt-0.5">
                  {telemetry.dtcs.length > 0
                    ? `DTC Active: ${telemetry.dtcs.join(", ")}`
                    : "Fuel Level Low (12%) - Range 84 km"}
                </div>
              </div>
            </div>

            {/* Alert 2 */}
            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white truncate">
                    Vehicle {vehicles[0].plate}
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0">12 min ago</span>
                </div>
                <div className="text-[11px] text-blue-300 mt-0.5 truncate">
                  Entered Geofence: Mangaluru Zone
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#1A263D]/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Telegram Dispatch:</span>
            <span className={telemetryState.telegramEnabled ? "text-emerald-400 font-semibold" : "text-slate-500"}>
              {telemetryState.telegramEnabled ? "Configured" : "Disabled in Settings"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 2. FLEET DEVICES VIEW ───────────────────────────────────────
const FleetDevicesView: React.FC<{
  vehicles: MonitoredVehicle[];
  telemetryState: LiveTelemetryState;
  onOpenVehicle: () => void;
  onOpenAddDevice: () => void;
  displayVss: number;
  speedUnitStr: string;
  mileageVal: number;
}> = ({
  vehicles,
  telemetryState,
  onOpenVehicle,
  onOpenAddDevice,
  displayVss,
  speedUnitStr,
  mileageVal,
}) => {
  const { telemetry, isConnected } = telemetryState;
  const [filter, setFilter] = useState<"all" | "online" | "idle" | "alert">("all");
  const [search, setSearch] = useState("");

  const filtered = vehicles.filter((v) => {
    if (filter !== "all" && v.status.toLowerCase() !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        v.plate.toLowerCase().includes(q) ||
        v.name.toLowerCase().includes(q) ||
        v.driverName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top action & filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 rounded-2xl bg-[#0F1626] border border-[#1A263D]">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by license plate, vehicle, or driver..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#090D17] border border-[#1A263D] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(["all", "online", "idle", "alert"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                filter === mode
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white bg-[#090D17] border border-[#1A263D]"
              }`}
            >
              {mode}
            </button>
          ))}
          <button
            onClick={onOpenAddDevice}
            className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(0,212,255,0.2)]"
          >
            <Plus size={15} />
            <span>Add Device</span>
          </button>
        </div>
      </div>

      {/* Devices Table Card */}
      <div className="rounded-2xl border border-[#1A263D] bg-[#0F1626] overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-[#1A263D] bg-[#0B101D]">
            <tr>
              <th className="py-3 px-5 font-semibold">Vehicle</th>
              <th className="py-3 px-4 font-semibold">CAN Protocol</th>
              <th className="py-3 px-4 font-semibold">Assigned Operator</th>
              <th className="py-3 px-3 font-semibold">Status</th>
              <th className="py-3 px-3 font-semibold">Live Speed</th>
              <th className="py-3 px-3 font-semibold">Fuel Econ</th>
              <th className="py-3 px-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A263D]/50">
            {filtered.map((v, i) => (
              <tr key={v.id} className="hover:bg-[#152035]/60 transition-colors">
                <td className="py-4 px-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                      <Car size={18} />
                    </div>
                    <div>
                      <div className="font-bold text-white font-mono text-sm">{v.plate}</div>
                      <div className="text-[11px] text-slate-400">{v.name} ({v.year})</div>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4 font-mono text-slate-300 text-[11px]">
                  {v.protocol}
                </td>
                <td className="py-4 px-4">
                  <div className="font-medium text-slate-200">{v.driverName}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{v.department}</div>
                </td>
                <td className="py-4 px-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>{v.status}</span>
                  </span>
                </td>
                <td className="py-4 px-3 font-mono font-bold text-slate-100">
                  {i === 0 ? `${displayVss} ${speedUnitStr}` : `48 ${speedUnitStr}`}
                </td>
                <td className="py-4 px-3 font-mono text-slate-200">
                  {i === 0 && mileageVal > 0 ? `${mileageVal.toFixed(1)} km/L` : "15.8 km/L"}
                </td>
                <td className="py-4 px-4 text-right">
                  <button
                    onClick={onOpenVehicle}
                    className="px-3.5 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 hover:text-cyan-200 border border-cyan-500/40 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <Eye size={13} />
                    <span>Inspect Cockpit</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hardware Specifications Detail Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl border border-[#1A263D] bg-[#0F1626] space-y-2">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">CAN Bus Protocol</div>
          <div className="text-sm font-bold text-white font-mono">{vehicles[0].protocol}</div>
          <p className="text-xs text-slate-400 leading-relaxed">
            ISO 15765-4 11-bit standard broadcast CAN interface operating at 500 kbaud for ECU PID polling.
          </p>
        </div>
        <div className="p-5 rounded-2xl border border-[#1A263D] bg-[#0F1626] space-y-2">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Engine Architecture</div>
          <div className="text-sm font-bold text-white font-mono">{vehicles[0].engineSpec}</div>
          <p className="text-xs text-slate-400 leading-relaxed">
            FSI naturally-aspirated direct injection engine calibrated for BS6 E10 gasoline fuel ratio.
          </p>
        </div>
        <div className="p-5 rounded-2xl border border-[#1A263D] bg-[#0F1626] space-y-2">
          <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Gateway Telemetry Node</div>
          <div className="text-sm font-bold text-cyan-400 font-mono">
            {isConnected ? "CONNECTED (FastAPI /api/ws/live)" : "CONNECTING..."}
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Streaming live telemetry from vehicle OBD-II adapter at 1000ms polling rate with automatic ping heartbeat.
          </p>
        </div>
      </div>
    </div>
  );
};

// ─── 3. LIVE MONITORING VIEW ─────────────────────────────────────
const LiveMonitoringView: React.FC<{
  telemetryState: LiveTelemetryState;
  onOpenVehicle: () => void;
  displayVss: number;
  speedUnitStr: string;
  displayCoolant: number;
  tempUnitStr: string;
}> = ({
  telemetryState,
  onOpenVehicle,
  displayVss,
  speedUnitStr,
  displayCoolant,
  tempUnitStr,
}) => {
  const { telemetry, history, fuelML } = telemetryState;
  const isImperialSpeed = speedUnitStr === "mph";

  return (
    <div className="space-y-6">
      {/* Live Gauge Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-4 rounded-2xl border border-[#1A263D] bg-[#0F1626]">
          <div className="text-[11px] font-semibold text-slate-400">SPEED</div>
          <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
            {displayVss} <span className="text-xs text-slate-500">{speedUnitStr}</span>
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-[#1A263D] bg-[#0F1626]">
          <div className="text-[11px] font-semibold text-slate-400">ENGINE RPM</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {telemetry.rpm.toLocaleString()} <span className="text-xs text-slate-500">rpm</span>
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-[#1A263D] bg-[#0F1626]">
          <div className="text-[11px] font-semibold text-slate-400">COOLANT TEMP</div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {displayCoolant} <span className="text-xs text-slate-500">{tempUnitStr}</span>
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-[#1A263D] bg-[#0F1626]">
          <div className="text-[11px] font-semibold text-slate-400">THROTTLE</div>
          <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
            {telemetry.throttle}%
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-[#1A263D] bg-[#0F1626]">
          <div className="text-[11px] font-semibold text-slate-400">MANIFOLD MAP</div>
          <div className="text-2xl font-bold font-mono text-purple-400 mt-1">
            {telemetry.mapKpa ?? 101} <span className="text-xs text-slate-500">kPa</span>
          </div>
        </div>
        <div className="p-4 rounded-2xl border border-[#1A263D] bg-[#0F1626]">
          <div className="text-[11px] font-semibold text-slate-400">FUEL ECONOMY</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            {fuelML?.mileage_kmpl ? fuelML.mileage_kmpl.toFixed(1) : "--"} <span className="text-xs text-slate-500">km/L</span>
          </div>
        </div>
      </div>

      {/* Interactive Full Leaflet Map with the 4 Heatmap Modes & Traveled Path */}
      <div className="h-[440px] rounded-2xl overflow-hidden border border-[#1A263D] bg-[#0F1626]">
        <GPSMap
          telemetry={telemetry}
          speedUnit={telemetryState.speedUnit}
          compact={false}
          showTraveledPath={true}
        />
      </div>

      {/* Streaming Waveform Sparklines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="p-5 rounded-2xl border border-[#1A263D] bg-[#0F1626] space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>RPM & SPEED CORRELATION WAVEFORM</span>
            <span className="text-cyan-400 font-mono">LIVE BUFFER</span>
          </div>
          <MultiLineChart
            data={history.map((h, i) => ({
              t: i,
              rpm: h.rpm / 70,
              spd: isImperialSpeed ? Math.round(h.vss * 0.621371) : h.vss,
            }))}
            series={[
              { key: "rpm", color: "#00D4FF", label: "RPM÷70" },
              { key: "spd", color: "#8B5CF6", label: speedUnitStr },
            ]}
            height={110}
            maxPoints={60}
          />
        </div>

        <div className="p-5 rounded-2xl border border-[#1A263D] bg-[#0F1626] space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
            <span>INSTANTANEOUS FUEL EFFICIENCY & LOAD</span>
            <span className="text-emerald-400 font-mono">3-TIER PHYSICS</span>
          </div>
          <MultiLineChart
            data={history.map((h, i) => ({
              t: i,
              mileage: h.ml?.fuel?.mileage_kmpl ?? 0,
              load: h.engineLoad,
            }))}
            series={[
              { key: "mileage", color: "#10B981", label: "km/L" },
              { key: "load", color: "#F59E0B", label: "Load %" },
            ]}
            height={110}
            maxPoints={60}
          />
        </div>
      </div>
    </div>
  );
};

// ─── 4. ANALYTICS & DRIVER AI VIEW ───────────────────────────────
const AnalyticsScorecardView: React.FC<{
  telemetryState: LiveTelemetryState;
  onOpenVehicle: () => void;
}> = ({ telemetryState, onOpenVehicle }) => {
  const { currentBehavior, driverML, fuelML } = telemetryState;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* XGBoost Classifier Model Card */}
        <div className="p-6 rounded-2xl border border-[#1A263D] bg-[#0F1626] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Zap size={18} className="text-cyan-400" />
              <h3 className="font-bold text-white text-base">Driver Behavior Classification</h3>
            </div>
            <span className="text-[10px] font-mono text-cyan-400 px-2 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              XGBOOST
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#090D17] border border-[#1A263D] flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-medium">Current Evaluation</div>
              <div className={`text-2xl font-bold mt-0.5 ${
                currentBehavior === "Economical" ? "text-emerald-400" : currentBehavior === "Moderate" ? "text-amber-400" : "text-red-400"
              }`}>
                {currentBehavior}
              </div>
            </div>
            <span className="text-xs font-mono text-slate-400">Sliding Window 60s</span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="text-slate-400 font-semibold mb-2">Class Confidence Distribution</div>
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Economical</span>
                <span className="font-mono text-emerald-400">
                  {currentBehavior === "Economical" ? "88%" : "12%"}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: currentBehavior === "Economical" ? "88%" : "12%" }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Moderate</span>
                <span className="font-mono text-amber-400">
                  {currentBehavior === "Moderate" ? "74%" : "22%"}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: currentBehavior === "Moderate" ? "74%" : "22%" }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Aggressive</span>
                <span className="font-mono text-red-400">
                  {currentBehavior === "Aggressive" ? "91%" : "4%"}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full"
                  style={{ width: currentBehavior === "Aggressive" ? "91%" : "4%" }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Feature Extraction Breakdown */}
        <div className="p-6 rounded-2xl border border-[#1A263D] bg-[#0F1626] space-y-4">
          <div className="flex items-center gap-2.5">
            <Activity size={18} className="text-cyan-400" />
            <h3 className="font-bold text-white text-base">Sliding-Window Feature Extraction</h3>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 rounded-xl bg-[#090D17] border border-[#1A263D] flex justify-between">
              <span className="text-slate-400">Mean Engine RPM:</span>
              <span className="text-cyan-400 font-bold">{driverML?.mean_rpm ? Math.round(driverML.mean_rpm) : "1,420"} rpm</span>
            </div>
            <div className="p-3 rounded-xl bg-[#090D17] border border-[#1A263D] flex justify-between">
              <span className="text-slate-400">RPM Standard Deviation:</span>
              <span className="text-slate-200">{driverML?.std_rpm ? driverML.std_rpm.toFixed(1) : "210.4"}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#090D17] border border-[#1A263D] flex justify-between">
              <span className="text-slate-400">Pedal / Throttle Variance:</span>
              <span className="text-slate-200">{driverML?.std_pedal ? driverML.std_pedal.toFixed(2) : "4.12"}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#090D17] border border-[#1A263D] flex justify-between">
              <span className="text-slate-400">Speed Deviation (km/h):</span>
              <span className="text-slate-200">{driverML?.speed_deviation ? driverML.speed_deviation.toFixed(1) : "3.8"}</span>
            </div>
          </div>
        </div>

        {/* 3-Tier Fuel Model Card */}
        <div className="p-6 rounded-2xl border border-[#1A263D] bg-[#0F1626] space-y-4">
          <div className="flex items-center gap-2.5">
            <Fuel size={18} className="text-cyan-400" />
            <h3 className="font-bold text-white text-base">Physics-Based Fuel Model</h3>
          </div>

          <div className="p-4 rounded-xl bg-[#090D17] border border-[#1A263D]">
            <div className="text-xs text-slate-400">Tier Selected by Sensor Availability</div>
            <div className="text-lg font-bold text-emerald-400 mt-1">
              Tier {fuelML?.tier ?? 1}: {fuelML?.method ?? "Direct Mass Air Flow (MAF)"}
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
            <p>
              Calculates instant stoichiometric fuel burn using chemical air-fuel ratio (<strong className="text-cyan-400">AFR 14.7</strong> for E10 gasoline) and density of 740 g/L.
            </p>
            <p className="text-slate-400">
              Fallback tiers utilize Speed-Density manifold absolute pressure (MAP) or engine load telemetry if MAF sensor drops offline.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 5. REPORTS & MAINTENANCE VIEW ───────────────────────────────
const ReportsMaintenanceView: React.FC<{
  telemetryState: LiveTelemetryState;
  onOpenVehicle: () => void;
}> = ({ telemetryState, onOpenVehicle }) => {
  const { serviceCompany, registeredIssues, healthStatus, telemetry } = telemetryState;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Service Partner Details */}
        <div className="p-6 rounded-2xl border border-[#1A263D] bg-[#0F1626] space-y-4">
          <div className="flex items-center gap-2.5">
            <Wrench size={18} className="text-cyan-400" />
            <h3 className="font-bold text-white text-base">Authorized Service Partner</h3>
          </div>

          <div className="p-4 rounded-xl bg-[#090D17] border border-[#1A263D] space-y-2">
            <div className="font-bold text-white text-sm">{serviceCompany.name}</div>
            <div className="text-xs text-slate-400">{serviceCompany.address}</div>
            <div className="text-xs text-cyan-400 font-mono">{serviceCompany.phone}</div>
            <div className="text-xs text-slate-400 font-mono">{serviceCompany.email}</div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Fleet maintenance dispatch partner assigned for automated service work orders and OBD-II trouble code resolution.
          </p>
        </div>

        {/* Predictive Health Integrity */}
        <div className="p-6 rounded-2xl border border-[#1A263D] bg-[#0F1626] space-y-4">
          <div className="flex items-center gap-2.5">
            <Shield size={18} className="text-cyan-400" />
            <h3 className="font-bold text-white text-base">Vehicle Health Integrity</h3>
          </div>

          <div className="p-4 rounded-xl bg-[#090D17] border border-[#1A263D] flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">LSTM Autoencoder Score</div>
              <div className="text-3xl font-extrabold text-emerald-400 mt-1 font-mono">
                {healthStatus.score}%
              </div>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {healthStatus.status}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Active Trouble Codes:</span>
              <span className={telemetry.dtcs.length > 0 ? "text-red-400 font-bold" : "text-emerald-400"}>
                {telemetry.dtcs.length === 0 ? "None (Clear)" : telemetry.dtcs.join(", ")}
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Coolant Temperature:</span>
              <span className="text-slate-200 font-mono">{telemetry.coolantTemp}°C</span>
            </div>
          </div>
        </div>

        {/* Scheduled Maintenance Checklist */}
        <div className="p-6 rounded-2xl border border-[#1A263D] bg-[#0F1626] space-y-4">
          <div className="flex items-center gap-2.5">
            <FileText size={18} className="text-cyan-400" />
            <h3 className="font-bold text-white text-base">Maintenance Checklist</h3>
          </div>

          <div className="space-y-2.5 text-xs">
            {[
              { item: "Synthetic Engine Oil & Filter (5W-30)", due: "In 3,400 km", status: "Nominal" },
              { item: "Brake Pad Wear Sensor Inspection", due: "In 6,200 km", status: "Nominal" },
              { item: "Spark Plug Gap (FSI Direct)", due: "In 12,000 km", status: "Nominal" },
              { item: "Transmission Fluid Check", due: "In 18,000 km", status: "Scheduled" },
            ].map((entry, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-[#090D17] border border-[#1A263D] flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-200">{entry.item}</div>
                  <div className="text-[10px] text-slate-500">{entry.due}</div>
                </div>
                <span className="text-[10px] font-semibold text-emerald-400 px-2 py-0.5 rounded-md bg-emerald-500/10">
                  {entry.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 6. ALERTS & DIAGNOSTICS VIEW ────────────────────────────────
const AlertsDiagnosticsView: React.FC<{
  telemetryState: LiveTelemetryState;
  onOpenVehicle: () => void;
}> = ({ telemetryState, onOpenVehicle }) => {
  const { telemetry, healthStatus } = telemetryState;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Trouble Codes (DTC) Card */}
        <div className="p-6 rounded-2xl border border-[#1A263D] bg-[#0F1626] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={18} className="text-amber-400" />
              <h3 className="font-bold text-white text-base">OBD-II Diagnostic Trouble Codes</h3>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              ECU PID 0x03
            </span>
          </div>

          {telemetry.dtcs.length === 0 ? (
            <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
              <CheckCircle size={28} className="text-emerald-400 mx-auto" />
              <div className="text-sm font-bold text-white">No Diagnostic Trouble Codes</div>
              <p className="text-xs text-slate-400">
                All 9 monitored ECU powertrain and emissions sensors are reporting nominal parameters without pending fault codes.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {telemetry.dtcs.map((dtc) => (
                <div key={dtc} className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white font-mono text-base">{dtc}</div>
                    <div className="text-xs text-red-300">ECU Emission / Powertrain Alert Code</div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500 text-white">
                    Action Required
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Telegram Dispatch Gateway Card */}
        <div className="p-6 rounded-2xl border border-[#1A263D] bg-[#0F1626] space-y-4">
          <div className="flex items-center gap-2.5">
            <Send size={18} className="text-cyan-400" />
            <h3 className="font-bold text-white text-base">Automated Telegram Dispatch</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-400 font-semibold block mb-1">Telegram Bot Token</label>
              <input
                type="password"
                value={telemetryState.telegramToken}
                onChange={(e) => telemetryState.setTelegramToken(e.target.value)}
                placeholder="e.g. 123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
                className="w-full px-3 py-2 bg-[#090D17] border border-[#1A263D] rounded-xl text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="text-slate-400 font-semibold block mb-1">Chat ID / Channel</label>
              <input
                type="text"
                value={telemetryState.telegramChatId}
                onChange={(e) => telemetryState.setTelegramChatId(e.target.value)}
                placeholder="e.g. -100123456789"
                className="w-full px-3 py-2 bg-[#090D17] border border-[#1A263D] rounded-xl text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="tgEnable"
                checked={telemetryState.telegramEnabled}
                onChange={(e) => telemetryState.setTelegramEnabled(e.target.checked)}
                className="accent-cyan-400"
              />
              <label htmlFor="tgEnable" className="text-slate-300 font-semibold cursor-pointer">
                Enable automated alerts for DTC codes & high coolant temp
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── 7. SETTINGS VIEW ────────────────────────────────────────────
const SettingsGatewayView: React.FC<{
  telemetryState: LiveTelemetryState;
  theme: "dark" | "light";
  setTheme: (t: "dark" | "light") => void;
}> = ({ telemetryState, theme, setTheme }) => {
  const {
    speedUnit,
    setSpeedUnit,
    tempUnit,
    setTempUnit,
    tempUrl,
    setTempUrl,
    handleSaveUrl,
    resetStates,
  } = telemetryState;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="p-6 rounded-2xl border border-[#1A263D] bg-[#0F1626] space-y-5">
        <div>
          <h3 className="font-bold text-white text-base">FastAPI Reverse Proxy Gateway URL</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure the backend telemetry ingestion server or Pinggy tunnel endpoint.
          </p>
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            value={tempUrl}
            onChange={(e) => setTempUrl(e.target.value)}
            placeholder="http://localhost:8000"
            className="flex-1 px-4 py-2.5 bg-[#090D17] border border-[#1A263D] rounded-xl text-white text-xs font-mono focus:outline-none focus:border-cyan-400"
          />
          <button
            onClick={handleSaveUrl}
            className="px-5 py-2.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-bold rounded-xl cursor-pointer shadow-[0_0_15px_rgba(0,212,255,0.2)]"
          >
            Save Gateway
          </button>
        </div>
      </div>

      <div className="p-6 rounded-2xl border border-[#1A263D] bg-[#0F1626] space-y-5">
        <h3 className="font-bold text-white text-base">Units of Measurement</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400 font-semibold block mb-2">Speed Unit</label>
            <div className="flex gap-2">
              <button
                onClick={() => setSpeedUnit("metric")}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl cursor-pointer ${
                  speedUnit === "metric"
                    ? "bg-cyan-400 text-slate-950"
                    : "bg-[#090D17] text-slate-400 border border-[#1A263D]"
                }`}
              >
                km/h (Metric)
              </button>
              <button
                onClick={() => setSpeedUnit("imperial")}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl cursor-pointer ${
                  speedUnit === "imperial"
                    ? "bg-cyan-400 text-slate-950"
                    : "bg-[#090D17] text-slate-400 border border-[#1A263D]"
                }`}
              >
                mph (Imperial)
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 font-semibold block mb-2">Temperature Unit</label>
            <div className="flex gap-2">
              <button
                onClick={() => setTempUnit("metric")}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl cursor-pointer ${
                  tempUnit === "metric"
                    ? "bg-cyan-400 text-slate-950"
                    : "bg-[#090D17] text-slate-400 border border-[#1A263D]"
                }`}
              >
                °C (Celsius)
              </button>
              <button
                onClick={() => setTempUnit("imperial")}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl cursor-pointer ${
                  tempUnit === "imperial"
                    ? "bg-cyan-400 text-slate-950"
                    : "bg-[#090D17] text-slate-400 border border-[#1A263D]"
                }`}
              >
                °F (Fahrenheit)
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-2xl border border-[#1A263D] bg-[#0F1626] flex items-center justify-between">
        <div>
          <h3 className="font-bold text-white text-base">Reset Fleet Odometer & Trip Logs</h3>
          <p className="text-xs text-slate-400 mt-0.5">Clears the current session distance and waveform cache.</p>
        </div>
        <button
          onClick={resetStates}
          className="px-4 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/40 font-semibold text-xs rounded-xl cursor-pointer transition-all"
        >
          Reset Session Data
        </button>
      </div>
    </div>
  );
};
