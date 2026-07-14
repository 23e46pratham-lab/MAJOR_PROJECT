import { TelemetryData } from "../types";

/**
 * Calculates real-time fuel efficiency in KMPL (Kilometers Per Liter)
 * using the stoichiometric formula:
 * KMPL = (VSS_kmh / Fuel_consumption_L_per_hr)
 * Where:
 * - Air-Fuel ratio for gasoline ≈ 14.7
 * - Density of gasoline ≈ 740 g/L (0.74 kg/L)
 * - Fuel consumption rate = MAF (g/s) / 14.7 (g/s fuel)
 * - L/hr = (MAF / 14.7) * 3600 / 740 ≈ 0.33094 * MAF
 * - KMPL = VSS_kmh / L_hr ≈ (3.0215 * VSS) / MAF
 */
export function calculateMileage(data: TelemetryData): number {
  const { vss, maf } = data;
  
  if (maf === 0) return 0;
  
  // KMPL = (3.0215 * VSS_kmh) / MAF_gps
  const kmpl = (3.0215 * vss) / maf;
  
  return Number(kmpl.toFixed(2));
}

/**
 * Converts KMPL to L/100km if needed.
 */
export function kmplToL100km(kmpl: number): number {
  if (kmpl === 0) return 0;
  return Number((100 / kmpl).toFixed(2));
}
