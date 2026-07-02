import { DriverPredictResponse } from "../types";

const API_BASE_URL = "http://localhost:8000";

export async function predictDriverBehavior(data: {
  rpm_values: number[];
  speed_values: number[];
  throttle_values: number[];
}): Promise<DriverPredictResponse> {
  const response = await fetch(`${API_BASE_URL}/api/driver/predict`, {
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

export interface MaintenanceScheduleItem {
  type: string;
  due: string;
  status: "upcoming" | "urgent" | "ok";
  priority: "low" | "medium" | "high";
}

export async function fetchMaintenanceSchedule(): Promise<MaintenanceScheduleItem[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/maintenance`);
    if (!response.ok) throw new Error("Failed to fetch");
    return await response.json();
  } catch (err) {
    console.error("Error fetching maintenance schedule", err);
    return [];
  }
}
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
