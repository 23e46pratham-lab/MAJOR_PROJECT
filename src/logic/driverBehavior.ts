import { TelemetryData, DriverBehavior } from "../types";

/**
 * Simulates K-Means clustering for driver behavior classification.
 * In a real app, this would use a library or a pre-trained model.
 */
let observedMinThrottle = 100;

export function classifyDriverBehavior(data: TelemetryData): DriverBehavior {
  const { vss, rpm, throttle } = data;

  // Dynamically auto-calibrate to the minimum observed throttle sensor value 
  // (e.g. if the sensor has a high zero-offset of 81-83% at idle/stop)
  if (vss < 2 && throttle < observedMinThrottle && throttle > 0) {
    observedMinThrottle = throttle;
  }

  // Calculate the relative/effective throttle position based on the calibrated minimum
  let effectiveThrottle = throttle;
  if (observedMinThrottle > 40 && observedMinThrottle < 95) {
    // Re-scale range from [observedMinThrottle, 100] to [0, 100]
    effectiveThrottle = Math.max(0, ((throttle - observedMinThrottle) / (100 - observedMinThrottle)) * 100);
  }

  // Guard: If vehicle is practically stationary, do not classify as Harsh unless engine is aggressively revved
  if (vss < 5) {
    if (rpm > 4500) {
      return "Harsh";
    }
    return "Moderate";
  }

  // Harsh: High effective throttle, or extremely high engine RPM
  if (effectiveThrottle > 45 || rpm > 4500) {
    return "Harsh";
  }

  // Economical: Low effective throttle, moderate RPM, and cruising speed
  if (effectiveThrottle < 20 && rpm < 2500 && vss > 30 && vss < 90) {
    return "Economical";
  }

  // Moderate: Standard operating conditions
  return "Moderate";
}
