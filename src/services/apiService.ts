import {
  DriverMLResult,
  HealthMLResult,
  FuelMLResult,
  MLInference,
  TelemetryData,
  SimulatorStatus,
  DatasetItem,
  RouteData,
  TripSummary
} from "../types";

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
    }).catch((err) => console.error("[Proxy] Init sync error:", err));
  }, 100);
}

export const API_BASE_URL = DEFAULT_BASE_URL;

export function getWebSocketUrl(path: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path}`;
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`/health`);
    return response.ok;
  } catch {
    return false;
  }
}

// ─── MACHINE LEARNING API ───────────────────────────────────────

export async function predictDriverBehavior(data: {
  rpm_values: number[];
  speed_values: number[];
  throttle_values: number[];
  window_index?: number;
}): Promise<DriverMLResult> {
  const response = await fetch(`/api/driver/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Driver Predict Error: ${response.statusText}`);
  }
  return response.json();
}

export async function predictVehicleHealth(data: {
  ticks: Array<{
    rpm?: number;
    vss?: number;
    maf?: number;
    throttle_pos?: number;
    map_kpa?: number;
    coolant_temp?: number;
    intake_air_temp?: number;
    ambient_temp?: number;
    pedal_d?: number;
    pedal_e?: number;
  }>;
}): Promise<HealthMLResult> {
  const response = await fetch(`/api/health/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Health Predict Error: ${response.statusText}`);
  }
  return response.json();
}

export async function predictFuelEfficiency(data: {
  ticks: Array<{
    rpm?: number;
    vss?: number;
    maf?: number;
    throttle_pos?: number;
    map_kpa?: number;
    pedal_d?: number;
    pedal_e?: number;
  }>;
}): Promise<FuelMLResult> {
  const response = await fetch(`/api/fuel/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Fuel Predict Error: ${response.statusText}`);
  }
  return response.json();
}

// ─── SIMULATOR CONTROL API ──────────────────────────────────────

export async function getSimulatorStatus(): Promise<SimulatorStatus> {
  const response = await fetch(`/api/status`);
  if (!response.ok) throw new Error("Failed to fetch simulator status");
  return response.json();
}

export async function startSimulator(options?: {
  dataset_id?: string;
  speed?: number;
  loop?: boolean;
}): Promise<SimulatorStatus> {
  const response = await fetch(`/api/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options || {}),
  });
  if (!response.ok) throw new Error("Failed to start simulator");
  return response.json();
}

export async function pauseSimulator(): Promise<SimulatorStatus> {
  const response = await fetch(`/api/pause`, { method: "POST" });
  if (!response.ok) throw new Error("Failed to pause simulator");
  return response.json();
}

export async function resumeSimulator(): Promise<SimulatorStatus> {
  const response = await fetch(`/api/resume`, { method: "POST" });
  if (!response.ok) throw new Error("Failed to resume simulator");
  return response.json();
}

export async function stopSimulator(): Promise<SimulatorStatus> {
  const response = await fetch(`/api/stop`, { method: "POST" });
  if (!response.ok) throw new Error("Failed to stop simulator");
  return response.json();
}

export async function resetSimulator(): Promise<SimulatorStatus> {
  const response = await fetch(`/api/reset`, { method: "POST" });
  if (!response.ok) throw new Error("Failed to reset simulator");
  return response.json();
}

export async function setSimulatorSpeed(speed: number): Promise<SimulatorStatus> {
  const response = await fetch(`/api/speed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ speed }),
  });
  if (!response.ok) throw new Error("Failed to set simulator speed");
  return response.json();
}

export async function setSimulatorLoop(loop: boolean): Promise<SimulatorStatus> {
  const response = await fetch(`/api/loop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loop }),
  });
  if (!response.ok) throw new Error("Failed to set loop status");
  return response.json();
}

// ─── DATASET MANAGEMENT ─────────────────────────────────────────

export async function getDatasets(): Promise<DatasetItem[]> {
  const response = await fetch(`/api/datasets`);
  if (!response.ok) throw new Error("Failed to fetch datasets");
  const data = await response.json();
  return data.datasets || [];
}

export async function uploadDataset(file: File): Promise<DatasetItem> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`/api/upload`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) throw new Error("Failed to upload dataset");
  return response.json();
}

export async function changeDataset(datasetId: string): Promise<{ active_dataset_id: string }> {
  const response = await fetch(`/api/change-dataset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataset_id: datasetId }),
  });
  if (!response.ok) throw new Error("Failed to change dataset");
  return response.json();
}

export async function deleteDataset(datasetId: string): Promise<{ deleted: boolean }> {
  const response = await fetch(`/api/datasets/${datasetId}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete dataset");
  return response.json();
}

// ─── LIVE DATA & ML POLLING ─────────────────────────────────────

export async function getLiveData(): Promise<any> {
  const response = await fetch(`/api/live-data`);
  if (!response.ok) throw new Error("Failed to fetch live data");
  return response.json();
}

export async function getLatestML(): Promise<MLInference> {
  const response = await fetch(`/api/ml/latest`);
  if (!response.ok) throw new Error("Failed to fetch latest ML");
  return response.json();
}

export async function getHistory(limit = 100): Promise<any[]> {
  const response = await fetch(`/api/history?limit=${limit}`);
  if (!response.ok) throw new Error("Failed to fetch history");
  return response.json();
}

// ─── SENSOR OVERRIDE DIALS ──────────────────────────────────────

export async function getActiveDials(): Promise<Record<string, number>> {
  try {
    const response = await fetch(`/api/dials`);
    if (!response.ok) return {};
    const data = await response.json();
    return data.overrides || {};
  } catch {
    return {};
  }
}

export async function setSensorDial(field: string, value: number): Promise<Record<string, number>> {
  const response = await fetch(`/api/dials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ field, value }),
  });
  if (!response.ok) throw new Error("Failed to set sensor override");
  const data = await response.json();
  return data.overrides || {};
}

export async function resetAllSensorDials(): Promise<Record<string, number>> {
  const response = await fetch(`/api/dials`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to reset dials");
  const data = await response.json();
  return data.overrides || {};
}

export async function resetSensorDial(field: string): Promise<Record<string, number>> {
  const response = await fetch(`/api/dials/${field}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(`Failed to reset dial for ${field}`);
  const data = await response.json();
  return data.overrides || {};
}

// ─── DIAGNOSTIC TROUBLE CODES (DTCs) ────────────────────────────

export async function getActiveDtcCodes(): Promise<string[]> {
  try {
    const response = await fetch(`/api/dtc`);
    if (!response.ok) return [];
    const data = await response.json();
    return data.dtcs || [];
  } catch {
    return [];
  }
}

export async function setDtcCodes(codes: string[]): Promise<string[]> {
  const response = await fetch(`/api/dtc`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codes }),
  });
  if (!response.ok) throw new Error("Failed to update DTC codes");
  const data = await response.json();
  return data.dtcs || [];
}

export async function clearAllDtcCodes(): Promise<string[]> {
  const response = await fetch(`/api/dtc`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to clear DTC codes");
  const data = await response.json();
  return data.dtcs || [];
}

export async function clearDtcCode(code: string): Promise<string[]> {
  const response = await fetch(`/api/dtc/${code}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(`Failed to clear DTC code ${code}`);
  const data = await response.json();
  return data.dtcs || [];
}

// ─── GPS ROUTE & TRIP STATS ─────────────────────────────────────

export async function getRouteData(): Promise<RouteData | null> {
  try {
    const response = await fetch(`/api/route`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function getTripSummary(): Promise<TripSummary | null> {
  try {
    const response = await fetch(`/api/trip-summary`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

// ─── MAINTENANCE (KEPT INTACT AS REQUESTED) ─────────────────────

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
    return [];
  }
}

// ─── PAYLOAD DATA MAPPER ────────────────────────────────────────

export function mapSimulatedDataToTelemetry(payload: any): TelemetryData {
  // Support both raw tick shapes { data: {...}, ml: {...}, dtcs: [...] } or direct flat sensor objects
  const sensorData = payload.data || payload;
  const ml: MLInference | undefined = payload.ml || undefined;
  const overrides: string[] = payload.overrides || [];
  const datasetData = payload.dataset_data || undefined;

  const getVal = (keys: string[], defaultVal = 0): number => {
    for (const key of keys) {
      if (sensorData[key] !== undefined && sensorData[key] !== null) {
        return Number(sensorData[key]);
      }
    }
    return defaultVal;
  };

  const rpm = getVal(["rpm", "Engine RPM [RPM]", "Engine RPM", "engine_rpm"]);
  const vss = getVal(["vss", "Vehicle Speed Sensor [km/h]", "Vehicle Speed Sensor", "vehicle_speed", "speed"]);
  const maf = getVal(["maf", "Air Flow Rate from Mass Flow Sensor [g/s]", "Air Flow Rate", "mass_air_flow"]);
  const throttle = getVal([
    "throttle_pos",
    "Absolute Throttle Position [%]",
    "Absolute Throttle Position",
    "throttle",
    "absolute_throttle_position",
  ]);
  const coolantTemp = getVal([
    "coolant_temp",
    "Engine Coolant Temperature [°C]",
    "Engine Coolant Temperature",
    "coolant",
    "coolantTemp",
    "engine_coolant_temperature",
  ]);
  const intakeAirTemp = getVal([
    "intake_air_temp",
    "Intake Air Temperature [°C]",
    "Intake Air Temperature",
    "iat",
    "intakeAirTemp",
  ]);
  const ambientTemp = getVal([
    "ambient_temp",
    "Ambient Air Temperature [°C]",
    "Ambient Air Temperature",
    "ambientTemp",
  ]);
  const mapKpa = getVal([
    "map_kpa",
    "Intake Manifold Absolute Pressure [kPa]",
    "map",
  ]);
  const pedalD = getVal(["pedal_d", "Accelerator Pedal Position D [%]"]);
  const pedalE = getVal(["pedal_e", "Accelerator Pedal Position E [%]"]);

  // GPS fields
  const lat = sensorData.lat !== undefined ? Number(sensorData.lat) : undefined;
  const lon = sensorData.lon !== undefined ? Number(sensorData.lon) : undefined;
  const elevationM = sensorData.elevation_m !== undefined ? Number(sensorData.elevation_m) : undefined;
  const gpsBearing = sensorData.gps_bearing !== undefined ? Number(sensorData.gps_bearing) : undefined;
  const gpsSpeedMs = sensorData.gps_speed_ms !== undefined ? Number(sensorData.gps_speed_ms) : undefined;
  const gpsFix = sensorData.gps_fix !== undefined ? Number(sensorData.gps_fix) : undefined;

  const rawLoad = getVal(["engine_load", "Engine Load [%]", "Engine Load", "engineLoad"]);
  const engineLoad = rawLoad > 0 ? rawLoad : Math.min(100, Math.round((rpm / 7000) * 100 + throttle / 2));

  // Extract DTCs (either from payload.dtcs or sensorData.dtcs)
  const dtcs: string[] = payload.dtcs || sensorData.dtcs || [];

  return {
    rpm,
    vss,
    maf: Number(maf.toFixed(2)),
    throttle,
    engineLoad: Math.round(engineLoad),
    coolantTemp,
    intakeAirTemp,
    ambientTemp,
    mapKpa,
    pedalD,
    pedalE,
    lat,
    lon,
    elevationM,
    gpsBearing,
    gpsSpeedMs,
    gpsFix,
    dtcs,
    timestamp: payload.timestamp || sensorData.timestamp || Date.now(),
    ml,
    overrides,
    datasetData,
  };
}
