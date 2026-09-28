export type DriverBehavior = "Economical" | "Moderate" | "Aggressive";

export interface DriverMLResult {
  label: DriverBehavior;
  confidence: number; // 0.0 - 1.0
  tts_message: string;
  feature_values?: {
    window?: number;
    avg_speed?: number;
    vs_dev?: number;
    mean_rpm?: number;
    rpm_std?: number;
    mean_pedal?: number;
    pedal_std?: number;
    max_speed?: number;
    accel_std?: number;
    [key: string]: number | undefined;
  };
}

export interface HealthMLResult {
  is_anomaly: boolean;
  status: "Normal" | "Anomaly";
  anomaly_score: number;
  feature_errors: Record<string, number>;
  triggered_features: string[];
}

export interface FuelMLResult {
  fcr_gs: number;
  mileage_kmpl: number | null;
  vss_kmph: number;
  method: "maf" | "map_rpm" | "throttle_heuristic" | "stopped" | string;
  tier: number; // 0-3
}

export interface MLInference {
  driver_behaviour?: DriverMLResult;
  health?: HealthMLResult;
  fuel?: FuelMLResult;
}

export interface SensorData {
  coolant_temp: number; // °C
  map_kpa: number; // kPa
  rpm: number; // RPM
  vss: number; // km/h
  intake_air_temp: number; // °C
  maf: number; // g/s
  throttle_pos: number; // %
  ambient_temp: number; // °C
  pedal_d: number; // %
  pedal_e: number; // %
  // GPS fields (present when dataset has GPS)
  lat?: number;
  lon?: number;
  elevation_m?: number;
  gps_bearing?: number;
  gps_speed_ms?: number;
  gps_fix?: number;
}

export interface TelemetryData {
  rpm: number;
  vss: number; // Vehicle Speed Sensor (km/h)
  maf: number; // Mass Air Flow (g/s)
  throttle: number; // % (from throttle_pos)
  engineLoad: number; // %
  coolantTemp: number; // °C
  intakeAirTemp: number; // °C
  ambientTemp?: number;
  mapKpa?: number;
  pedalD?: number;
  pedalE?: number;
  lat?: number;
  lon?: number;
  elevationM?: number;
  gpsBearing?: number;
  gpsSpeedMs?: number;
  gpsFix?: number;
  dtcs: string[]; // Diagnostic Trouble Codes
  timestamp: number;
  ml?: MLInference;
  overrides?: string[];
  datasetData?: Partial<SensorData>;
}

export interface SimulatorStatus {
  state: "stopped" | "running" | "paused" | "finished";
  dataset_id: string;
  dataset_name: string;
  current_row: number;
  total_rows: number;
  speed: number;
  loop: boolean;
  elapsed_playback_seconds: number;
  dataset_duration_seconds: number;
  playback_percent: number;
}

export interface DatasetItem {
  dataset_id: string;
  filename: string;
  row_count: number;
  duration_seconds: number;
  missing_value_report: Record<string, number>;
}

export interface RouteData {
  has_gps: boolean;
  point_count: number;
  polyline: [number, number][]; // [lat, lon][]
  summary?: {
    has_gps: boolean;
    point_count: number;
    bbox: { min_lat: number; max_lat: number; min_lon: number; max_lon: number };
    center: { lat: number; lon: number };
  };
}

export interface TripSummary {
  has_gps: boolean;
  trip_stats: {
    avg_rpm: number;
    max_rpm: number;
    avg_speed_kmh: number;
    max_speed_kmh: number;
    avg_throttle: number;
    distance_km?: number;
    gps_points?: number;
    route_summary?: any;
  };
}

export interface HealthStatus {
  score: number; // 0-100
  status: "Healthy" | "Warning" | "Critical";
  anomalyScore: number;
  isAnomaly: boolean;
  featureErrors: Record<string, number>;
  triggeredFeatures: string[];
  faults: string[];
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  vehicleModel: string;
  createdAt: number;
}

export interface ServiceCompanyDetails {
  name: string;
  email: string;
  phone: string;
  address: string;
}

export interface RegisteredIssue {
  id: string;
  date: string;
  dtcCodes: string[];
  description: string;
  urgency: "low" | "medium" | "high";
  status: "pending" | "scheduled" | "resolved";
  companyDetails: ServiceCompanyDetails;
}

export interface MaintenanceLog {
  id: string;
  uid: string;
  type: string;
  description: string;
  timestamp: number;
  status: "pending" | "completed";
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: number;
}
