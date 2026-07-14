import { TelemetryData } from "../types";

/**
 * Calculates real-time fuel efficiency in KMPL (Kilometers Per Liter)
 * using the stoichiometric formula:
 *
 * KMPL = VSS_kmh / Fuel_consumption_L_per_hr
 *
 * Where:
 * - Air-Fuel ratio for gasoline (AFR)      ≈ 14.7
 * - Density of gasoline (ρ)                ≈ 740 g/L
 * - Fuel consumption rate (g/s)            = MAF / AFR
 * - Fuel consumption rate (L/hr)           = (MAF / AFR) * 3600 / ρ
 *                                          = MAF * (AFR * ρ / 3600)⁻¹   ... (see CONVERSION_FACTOR)
 * - KMPL                                   = (VSS_kmh * AFR * ρ / 3600) / MAF
 *
 * CONVERSION_FACTOR = (AFR * ρ) / 3600 = (14.7 * 740) / 3600 ≈ 3.021667
 * so:  KMPL ≈ (3.021667 * VSS_kmh) / MAF_gps
 */

const AFR = 14.7; // stoichiometric air-fuel ratio for gasoline
const FUEL_DENSITY_G_PER_L = 740; // approx. gasoline density, g/L
const CONVERSION_FACTOR = (AFR * FUEL_DENSITY_G_PER_L) / 3600; // ≈ 3.021667

// Below this, MAF readings are dominated by sensor noise (e.g. fuel-cut on
// deceleration, idle jitter) and produce unstable/unrealistic KMPL spikes.
const MIN_VALID_MAF_GPS = 0.5;

/**
 * Calculates real-time fuel efficiency in KMPL from live telemetry.
 * Returns 0 for invalid, missing, or noise-level sensor readings.
 */
export function calculateMileage(data: TelemetryData): number {
  const { vss, maf } = data;

  // Guard against missing/invalid airflow readings and sensor noise
  // (negative or near-zero MAF can occur during fuel cut-off/idle).
  if (!Number.isFinite(maf) || maf < MIN_VALID_MAF_GPS) return 0;

  // Guard against invalid/negative speed readings.
  if (!Number.isFinite(vss) || vss < 0) return 0;

  // Vehicle stationary (idling in traffic, etc.) -> 0 km covered per liter.
  if (vss === 0) return 0;

  const kmpl = (CONVERSION_FACTOR * vss) / maf;

  return Number(kmpl.toFixed(2));
}

/**
 * Converts KMPL to L/100km if needed.
 * Returns 0 for non-positive or invalid KMPL to avoid divide-by-zero
 * or unrealistic spikes (e.g. very small KMPL from noisy input).
 */
export function kmplToL100km(kmpl: number): number {
  if (!Number.isFinite(kmpl) || kmpl <= 0) return 0;

  return Number((100 / kmpl).toFixed(2));
}