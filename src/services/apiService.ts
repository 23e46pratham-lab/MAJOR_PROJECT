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

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
