import { DriverPredictResponse, TelemetryData } from "../types";

const DEFAULT_BASE_URL = "https://ecu-backend-95fz.onrender.com";

export function getApiBaseUrl(): string {
  return localStorage.getItem("obd_api_base_url") || DEFAULT_BASE_URL;
}

// Update local state AND notify the full-stack server-side proxy
export async function setApiBaseUrl(url: string) {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (trimmed) {
    localStorage.setItem("obd_api_base_url", trimmed);
  } else {
    localStorage.removeItem("obd_api_base_url");
  }

  // Notify backend of the proxy target update
  try {
    await fetch("/api/proxy-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: trimmed || DEFAULT_BASE_URL }),
    });
    console.log("[Proxy] Successfully notified server of proxy target change:", trimmed);
  } catch (err) {
    console.error("[Proxy] Failed to notify server of proxy target change:", err);
  }
}

// Auto-sync initial URL with the backend proxy on module load
if (typeof window !== "undefined") {
  setTimeout(() => {
    fetch("/api/proxy-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: getApiBaseUrl() }),
    }).catch(err => console.error("[Proxy] Init sync error:", err));
  }, 100);
}

export const API_BASE_URL = DEFAULT_BASE_URL; // Keep for backward compatibility

export function getWebSocketUrl(path: string): string {
  // Use the same host/protocol as the frontend to bypass CORS / Secure WS connection blocks
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path}`;
}

export async function predictDriverBehavior(data: {
  rpm_values: number[];
  speed_values: number[];
  throttle_values: number[];
}): Promise<DriverPredictResponse> {
  const response = await fetch(`/api/driver/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

export async function predictVehicleHealth(data: {
  coolant_temp: number;
  rpm: number;
  speed: number;
  intake_air_temp: number;
  maf: number;
  throttle: number;
  engine_load?: number;
}): Promise<any> {
  const payload = {
    "Engine Coolant Temperature [°C]": data.coolant_temp,
    "Engine RPM [RPM]": data.rpm,
    "Vehicle Speed Sensor [km/h]": data.speed,
    "Intake Air Temperature [°C]": data.intake_air_temp,
    "Air Flow Rate from Mass Flow Sensor [g/s]": data.maf,
    "Absolute Throttle Position [%]": data.throttle,
    // Include standard keys as fallbacks
    coolant_temp: data.coolant_temp,
    rpm: data.rpm,
    speed: data.speed,
    intake_air_temp: data.intake_air_temp,
    maf: data.maf,
    throttle: data.throttle,
    engine_load: data.engine_load ?? 0
  };

  const response = await fetch(`/api/health/predict`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
}

export interface MaintenanceScheduleItem {
  type: string;
  due: string;
  status: "upcoming" | "urgent" | "ok";
  priority: "low" | "medium" | "high";
}

export async function fetchMaintenanceSchedule(): Promise<MaintenanceScheduleItem[]> {
  try {
    const response = await fetch(`/api/maintenance`);
    if (!response.ok) throw new Error("Failed to fetch");
    return await response.json();
  } catch (err) {
    console.error("Error fetching maintenance schedule", err);
    return [];
  }
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export function mapSimulatedDataToTelemetry(data: any): TelemetryData {
  const getVal = (keys: string[], defaultVal = 0): number => {
    for (const key of keys) {
      if (data[key] !== undefined && data[key] !== null) {
        return Number(data[key]);
      }
    }
    return defaultVal;
  };

  const rpm = getVal(["Engine RPM [RPM]", "Engine RPM", "engine_rpm", "rpm"]);
  const vss = getVal(["Vehicle Speed Sensor [km/h]", "Vehicle Speed Sensor", "vehicle_speed", "speed", "vss"]);
  const maf = getVal(["Air Flow Rate from Mass Flow Sensor [g/s]", "Air Flow Rate", "maf", "mass_air_flow"]);
  const throttle = getVal(["Absolute Throttle Position [%]", "Absolute Throttle Position", "throttle", "throttle_pos", "absolute_throttle_position"]);
  const coolantTemp = getVal(["Engine Coolant Temperature [°C]", "Engine Coolant Temperature", "coolant", "coolant_temp", "coolantTemp", "engine_coolant_temperature"]);
  const intakeAirTemp = getVal(["Intake Air Temperature [°C]", "Intake Air Temperature", "iat", "intake_air_temp", "intakeAirTemp"]);
  
  const rawLoad = getVal(["Engine Load [%]", "Engine Load", "engine_load", "engineLoad"]);
  const engineLoad = rawLoad > 0 ? rawLoad : Math.min(100, Math.round((rpm / 7000) * 100 + (throttle / 2)));

  return {
    rpm,
    vss,
    maf: Number(maf.toFixed(2)),
    throttle,
    engineLoad: Math.round(engineLoad),
    coolantTemp,
    intakeAirTemp,
    dtcs: data.dtcs || [],
    timestamp: data.timestamp || Date.now(),
  };
}

