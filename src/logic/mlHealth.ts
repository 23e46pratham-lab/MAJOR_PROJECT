import { TelemetryData, HealthStatus } from "../types";

/**
 * Simulates ML-based health monitoring (Random Forest + LSTM).
 */
export function analyzeVehicleHealth(data: TelemetryData, history: TelemetryData[]): HealthStatus {
  const { coolantTemp, rpm, engineLoad, dtcs } = data;
  
  let score = 95;
  const predictions: string[] = [];
  const faults: string[] = [];

  // DTC / Active Fault deductions and warnings
  if (dtcs && dtcs.length > 0) {
    score -= dtcs.length * 15;
    dtcs.forEach(code => {
      let desc = "";
      if (code === "P0300") desc = "P0300: Random/Multiple Cylinder Misfire Detected";
      else if (code === "P0171") desc = "P0171: System Too Lean (Bank 1)";
      else if (code === "P0420") desc = "P0420: Catalyst System Efficiency Below Threshold";
      else desc = `${code}: Active Diagnostic Trouble Code`;
      
      faults.push(desc);
      
      // Also add forecasting / predictions
      if (code === "P0300") {
        predictions.push("Active cylinder misfire detected. Continuous operation can damage the exhaust catalytic converter.");
      } else if (code === "P0171") {
        predictions.push("System running lean. Potential vacuum leaks, oxygen sensor faults, or fuel delivery issues.");
      } else if (code === "P0420") {
        predictions.push("Catalytic converter efficiency degraded. Exhaust emissions likely elevated; sensor validation recommended.");
      }
    });
  }

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
