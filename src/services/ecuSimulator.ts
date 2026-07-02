import { TelemetryData } from "../types";

export function simulateECUData(prevData?: TelemetryData | null): TelemetryData {
  const now = Date.now();

  if (prevData === null) {
    return {
      rpm: 0,
      vss: 0,
      maf: 0,
      throttle: 0,
      engineLoad: 0,
      coolantTemp: 20,
      intakeAirTemp: 20,
      dtcs: [],
      timestamp: now,
    };
  }
  
  // Base values
  let rpm = prevData ? prevData.rpm : 800;
  let vss = prevData ? prevData.vss : 0;
  let throttle = prevData ? prevData.throttle : 15;

  // Randomly simulate driving states: Idle, Accelerating, Cruising, Braking
  const rand = Math.random();
  let isBraking = false;
  
  if (rand < 0.05) { // Sudden change in state
    isBraking = Math.random() < 0.3;
  }

  if (isBraking) {
    vss = Math.max(0, vss - Math.random() * 5);
    rpm = Math.max(800, rpm - Math.random() * 200);
    throttle = Math.max(0, throttle - 5);
  } else {
    if (vss < 10) { // Starting or idling
      throttle = 15 + Math.random() * 10;
      vss += Math.random() * 2;
      rpm = 800 + vss * 50 + Math.random() * 100;
    } else if (vss > 120) { // High speed
      throttle = 40 + Math.random() * 20;
      vss -= Math.random() * 3;
      rpm = 3000 + Math.random() * 500;
    } else { // Normal driving
      const accel = (Math.random() - 0.4) * 4;
      vss = Math.max(0, vss + accel);
      throttle = Math.min(100, Math.max(0, throttle + accel * 2));
      rpm = 1000 + vss * 30 + (throttle * 10) + Math.random() * 100;
    }
  }

  // Other parameters
  const engineLoad = Math.min(100, (rpm / 7000) * 100 + (throttle / 2));
  const maf = (rpm * engineLoad) / 1000 + Math.random() * 5;
  const coolantTemp = 85 + Math.sin(now / 100000) * 5;
  const intakeAirTemp = 25 + Math.random() * 5;

  // Simulate DTCs occasionally
  const dtcs: string[] = [];
  if (Math.random() < 0.001) dtcs.push("P0300"); // Random Misfire
  if (Math.random() < 0.001) dtcs.push("P0171"); // System Too Lean

  return {
    rpm: Math.round(rpm),
    vss: Math.round(vss),
    maf: Number(maf.toFixed(2)),
    throttle: Math.round(throttle),
    engineLoad: Math.round(engineLoad),
    coolantTemp: Math.round(coolantTemp),
    intakeAirTemp: Math.round(intakeAirTemp),
    dtcs,
    timestamp: now,
  };
}
