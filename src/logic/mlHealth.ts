import { TelemetryData, HealthStatus } from "../types";

/**
 * Simulates ML-based health monitoring (Random Forest + LSTM).
 */
export function analyzeVehicleHealth(data: TelemetryData, history: TelemetryData[]): HealthStatus {
  const { coolantTemp, rpm, engineLoad, dtcs } = data;
  
  let score = 95;
  const predictions: string[] = [];
  const faults: string[] = [...dtcs];

  // Random Forest Simulation (Multivariate Fault Detection)
  if (coolantTemp > 105) {
    score -= 20;
    faults.push("Engine Overheating Detected");
  }

  if (rpm > 6000 && engineLoad > 90) {
    score -= 10;
    predictions.push("High engine stress detected. Potential wear on piston rings.");
  }

  // LSTM Simulation (Time-series forecasting)
  // We check the trend of intake air temp
  if (history.length > 10) {
    const recentIAT = history.slice(-10).map(d => d.intakeAirTemp);
    const avgIAT = recentIAT.reduce((a, b) => a + b, 0) / recentIAT.length;
    
    if (avgIAT > 50) {
      score -= 15;
      predictions.push("Intake air temperature rising. Potential cooling system inefficiency predicted.");
    }
  }

  // Final status
  let status: "Healthy" | "Warning" | "Critical" = "Healthy";
  if (score < 60 || faults.length > 0) status = "Critical";
  else if (score < 85) status = "Warning";

  return {
    score: Math.max(0, score),
    status,
    predictions,
    faults,
  };
}
