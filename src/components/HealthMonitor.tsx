import React from "react";
import { motion } from "motion/react";
import { HealthStatus, TelemetryData } from "../types";
import {
  AlertTriangle, CheckCircle, Activity, Zap,
  TrendingUp, TrendingDown, Minus, ShieldAlert, Cpu
} from "lucide-react";
import { LiveChart } from "./LiveChart";

interface HealthMonitorProps {
  health: HealthStatus;
  telemetry: TelemetryData;
  history: TelemetryData[];
}

const SystemItem: React.FC<{
  label: string; status: "ok" | "warning" | "critical"; detail: string;
}> = ({ label, status, detail }) => {
  const color = status === "ok" ? "var(--green)" : status === "warning" ? "var(--amber)" : "var(--red)";
  const Icon = status === "ok" ? CheckCircle : status === "warning" ? Activity : AlertTriangle;
  return (
    <div className="flex items-center gap-3 py-2.5 border-b" style={{ borderColor: "var(--border)" }}>
      <Icon size={14} style={{ color }} className={status === "critical" ? "animate-blink" : ""} />
      <div className="flex-1">
        <div className="hud-display text-sm font-bold" style={{ color: "var(--text-primary)" }}>{label}</div>
        <div className="hud-label text-[10px]" style={{ color: "var(--text-muted)" }}>{detail}</div>
      </div>
      <span className="hud-label text-[10px] px-2 py-0.5"
        style={{ border: `1px solid ${color}44`, color, background: `${color}08` }}>
        {status.toUpperCase()}
      </span>
    </div>
  );
};

const TrendIndicator: React.FC<{ current: number; prev: number; label: string; unit: string; color: string }> =
  ({ current, prev, label, unit, color }) => {
    const diff = current - prev;
    const TrendIcon = diff > 0.5 ? TrendingUp : diff < -0.5 ? TrendingDown : Minus;
    const tColor = diff > 0.5 ? "var(--red)" : diff < -0.5 ? "var(--green)" : "var(--text-muted)";
    return (
      <div className="p-3" style={{ border: "1px solid var(--border)", background: "rgba(0,0,0,0.3)" }}>
        <div className="hud-label text-[9px] mb-1">{label}</div>
        <div className="flex items-end gap-2">
          <span className="text-xl font-bold" style={{ fontFamily: "Share Tech Mono", color }}>
            {current.toFixed(0)}<span className="text-xs ml-0.5" style={{ color: "var(--text-muted)" }}>{unit}</span>
          </span>
          <div className="flex items-center gap-1 mb-0.5">
            <TrendIcon size={11} style={{ color: tColor }} />
            <span className="hud-label text-[9px]" style={{ color: tColor }}>{Math.abs(diff).toFixed(1)}</span>
          </div>
        </div>
      </div>
    );
  };

export const HealthMonitor: React.FC<HealthMonitorProps> = ({ health, telemetry, history }) => {
  const isAnomaly = health.isAnomaly || telemetry.ml?.health?.is_anomaly || health.status === "Critical";
  const statusColor = !isAnomaly ? "var(--green)" : health.status === "Warning" ? "var(--amber)" : "var(--red)";
  const statusText = isAnomaly ? "ANOMALY DETECTED" : "NORMAL";

  const prev = history.slice(-20, -10);
  const avgPrev = (key: keyof typeof telemetry) =>
    prev.length > 0 ? prev.reduce((a, h) => a + Number(h[key] || 0), 0) / prev.length : Number(telemetry[key] || 0);

  const featureErrors = telemetry.ml?.health?.feature_errors || health.featureErrors || {};
  const triggeredFeatures = telemetry.ml?.health?.triggered_features || health.triggeredFeatures || [];
  const anomalyScore = telemetry.ml?.health?.anomaly_score ?? health.anomalyScore ?? 0;

  const systems = [
    { label: "Engine Coolant", status: (telemetry.coolantTemp > 105 ? "critical" : telemetry.coolantTemp > 95 ? "warning" : "ok") as "ok" | "warning" | "critical", detail: `Coolant: ${telemetry.coolantTemp}°C` },
    { label: "Air Intake & MAF", status: (telemetry.intakeAirTemp > 50 ? "warning" : "ok") as "ok" | "warning" | "critical", detail: `IAT: ${telemetry.intakeAirTemp}°C · MAF: ${telemetry.maf}g/s` },
    { label: "Intake Pressure", status: (telemetry.mapKpa && telemetry.mapKpa > 200 ? "warning" : "ok") as "ok" | "warning" | "critical", detail: `MAP: ${telemetry.mapKpa ?? "--"} kPa` },
    { label: "Drivetrain & RPM", status: (telemetry.rpm > 6000 ? "warning" : "ok") as "ok" | "warning" | "critical", detail: `RPM: ${telemetry.rpm} · Load: ${telemetry.engineLoad}%` },
    { label: "Diagnostic Codes", status: (telemetry.dtcs.length > 0 ? "critical" : "ok") as "ok" | "warning" | "critical", detail: telemetry.dtcs.length > 0 ? telemetry.dtcs.join(", ") : "No active DTCs" },
  ];

  return (
    <div className="h-full grid grid-cols-12 gap-0 overflow-hidden" style={{ background: "var(--bg-deep)" }}>
      {/* ── Left: System matrix checklist */}
      <div className="col-span-4 border-r flex flex-col overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="hud-label text-[11px]" style={{ color: "var(--cyan)" }}>SYSTEM SENSOR MATRIX</div>
        </div>
        <div className="flex-1 overflow-y-auto scroll-area px-4">
          {systems.map((s) => <SystemItem key={s.label} {...s} />)}
        </div>
      </div>

      {/* ── Center: LSTM Autoencoder Health Assessment */}
      <div className="col-span-5 border-r flex flex-col overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
          <div className="hud-label text-[11px]" style={{ color: "var(--cyan)" }}>LSTM AUTOENCODER ANOMALY DETECTOR</div>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-zinc-400">
            <Cpu size={12} className="text-purple-400" />
            <span>PYTORCH 2.2</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scroll-area p-5 space-y-5">
          {/* Main Status Ring Card */}
          <div className="flex items-center gap-6 p-5 panel" style={{ borderColor: `${statusColor}44` }}>
            <div className="relative">
              <svg width={120} height={120} style={{ transform: "rotate(-90deg)" }}>
                <circle cx={60} cy={60} r={50} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
                <motion.circle cx={60} cy={60} r={50} fill="none" stroke={statusColor} strokeWidth={8}
                  strokeDasharray={314} initial={{ strokeDashoffset: 314 }}
                  animate={{ strokeDashoffset: isAnomaly ? 80 : 280 }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  style={{ filter: `drop-shadow(0 0 8px ${statusColor}88)` }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ transform: "rotate(0deg)" }}>
                <div className="hud-display text-2xl font-black" style={{ color: statusColor }}>
                  {isAnomaly ? "ALERT" : "NOMINAL"}
                </div>
                <div className="hud-label text-[8px]">HEALTH</div>
              </div>
            </div>

            <div className="flex-1">
              <div className="hud-display text-xl font-bold mb-1" style={{ color: statusColor }}>
                {statusText}
              </div>
              <div className="hud-label text-[10px] mb-3" style={{ color: "var(--text-muted)" }}>
                MULTIVARIATE CORRELATION EVALUATION
              </div>
              <div className="space-y-1 text-[10px] font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-400">ANOMALY SCORE:</span>
                  <span style={{ color: statusColor }}>{anomalyScore > 0 ? anomalyScore.toFixed(5) : "0.000012"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">TRIGGERED SENSORS:</span>
                  <span style={{ color: triggeredFeatures.length > 0 ? "var(--red)" : "var(--green)" }}>
                    {triggeredFeatures.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">SEQUENCE WINDOW:</span>
                  <span className="text-cyan-400">24 Ticks (10 Features)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Triggered Features Alerts */}
          {triggeredFeatures.length > 0 && (
            <div className="p-3 border border-red-500/40 bg-red-500/10 space-y-2">
              <div className="hud-label text-[10px] flex items-center gap-2 text-red-400 font-bold">
                <ShieldAlert size={14} className="animate-blink" />
                <span>ANOMALOUS SENSOR RECONSTRUCTIONS EXCEEDED THRESHOLD</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {triggeredFeatures.map((f) => (
                  <span key={f} className="px-2 py-0.5 text-[10px] font-mono bg-red-500/20 text-red-300 border border-red-500/30">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Feature Reconstruction Errors Breakdown */}
          <div>
            <div className="hud-label text-[10px] mb-2 text-purple-400 flex items-center gap-1.5 font-bold">
              <Zap size={12} />
              <span>PER-FEATURE RECONSTRUCTION ERRORS</span>
            </div>

            <div className="space-y-2 font-mono text-[10px]">
              {Object.keys(featureErrors).length > 0 ? (
                Object.entries(featureErrors).map(([feature, error]) => {
                  const isTriggered = triggeredFeatures.includes(feature);
                  const errorVal = Number(error) || 0;
                  const pct = Math.min(100, (errorVal / 1.5) * 100);
                  const fColor = isTriggered ? "var(--red)" : "var(--cyan)";

                  return (
                    <div key={feature} className="p-2 border border-white/5 bg-black/20">
                      <div className="flex justify-between mb-1">
                        <span className="truncate pr-2" style={{ color: isTriggered ? "var(--red)" : "var(--text-secondary)" }}>
                          {feature}
                        </span>
                        <span style={{ color: fColor }}>{errorVal.toFixed(5)}</span>
                      </div>
                      <div className="meter-track h-1">
                        <div className="meter-fill" style={{ background: fColor, width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-3 text-center border border-white/5 text-zinc-500">
                  Awaiting 24+ telemetry ticks for LSTM Autoencoder sequence buffer...
                </div>
              )}
            </div>
          </div>

          {/* Active DTCs */}
          {telemetry.dtcs.length > 0 && (
            <div>
              <div className="hud-label text-[10px] mb-2 text-red-400 flex items-center gap-1.5">
                <AlertTriangle size={12} />
                <span>ACTIVE DIAGNOSTIC TROUBLE CODES (DTC)</span>
              </div>
              <div className="space-y-1.5">
                {telemetry.dtcs.map((code) => (
                  <div key={code} className="p-2.5 alert-flash border border-red-500/40 font-mono">
                    <div className="text-sm font-bold text-red-400">{code}</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">
                      {code === "P0300"
                        ? "Random/Multiple Cylinder Misfire Detected"
                        : code === "P0171"
                        ? "System Too Lean (Bank 1)"
                        : code === "P0420"
                        ? "Catalyst Efficiency Below Threshold"
                        : "OBD-II Diagnostic Trouble Code"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Trends */}
      <div className="col-span-3 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}>
          <div className="hud-label text-[11px]" style={{ color: "var(--cyan)" }}>PARAMETER TRENDS</div>
        </div>
        <div className="flex-1 overflow-y-auto scroll-area p-3 grid grid-cols-1 gap-2 content-start">
          <TrendIndicator label="COOLANT TEMP" current={telemetry.coolantTemp} prev={avgPrev("coolantTemp")} unit="°C" color="var(--amber)" />
          <TrendIndicator label="ENGINE RPM" current={telemetry.rpm} prev={avgPrev("rpm")} unit="rpm" color="var(--cyan)" />
          <TrendIndicator label="ENGINE LOAD" current={telemetry.engineLoad} prev={avgPrev("engineLoad")} unit="%" color="var(--amber)" />
          <TrendIndicator label="THROTTLE POS" current={telemetry.throttle} prev={avgPrev("throttle")} unit="%" color="var(--cyan)" />

          <div className="p-3 border border-white/10 bg-black/30 mt-2">
            <div className="hud-label text-[9px] mb-1" style={{ color: "var(--text-muted)" }}>ANOMALY BUFFER STATUS</div>
            <div className="text-xs font-mono text-cyan-400">
              {history.length >= 24 ? "LOCKED & INFERRING (24+ TICKS)" : `WARMING BUFFER (${history.length}/24)`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
