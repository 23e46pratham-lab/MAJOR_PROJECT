import React, { useEffect, useRef, useState, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TelemetryData, DriverBehavior } from "../types";
import {
  Navigation2, MapPin, Compass, Mountain, Gauge,
  Maximize2, Eye, RefreshCw, Layers, ShieldCheck,
  Flame, Zap, Fuel, Activity, Radio, Info, RotateCcw
} from "lucide-react";

export type MapDisplayMode = "standard" | "speed" | "behavior" | "fuel";

interface PathPoint {
  lat: number;
  lon: number;
  vss: number;
  behavior: DriverBehavior;
  mileage: number;
  timestamp: number;
  elevation?: number;
}

interface GPSMapProps {
  telemetry: TelemetryData;
  speedUnit?: "metric" | "imperial";
}

// Helpers for segment coloring
function getSpeedColor(vss: number): string {
  if (vss < 25) return "#00d4ff"; // slow/idle: cyan
  if (vss < 60) return "#00ff88"; // cruise: green
  if (vss < 90) return "#ffb800"; // moderate: amber
  return "#ff3333"; // high speed: red
}

function getBehaviorColor(behavior: DriverBehavior): string {
  if (behavior === "Economical") return "#00ff88";
  if (behavior === "Moderate") return "#ffb800";
  return "#ff3333";
}

function getFuelColor(mileage: number): string {
  if (mileage >= 18) return "#00ff88"; // high efficiency
  if (mileage >= 12) return "#76e060"; // good efficiency
  if (mileage >= 7) return "#ffb800"; // moderate
  if (mileage > 0) return "#ff5555"; // low efficiency
  return "#00d4ff"; // idle / 0
}

export const GPSMap: React.FC<GPSMapProps> = ({ telemetry, speedUnit = "metric" }) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.CircleMarker | null>(null);
  const polylineGroupRef = useRef<L.LayerGroup | null>(null);

  const [displayMode, setDisplayMode] = useState<MapDisplayMode>("standard");
  const [followVehicle, setFollowVehicle] = useState(true);
  const [mapStyle, setMapStyle] = useState<"dark" | "osm" | "satellite">("dark");
  const [traveledPath, setTraveledPath] = useState<PathPoint[]>([]);

  const isImperial = speedUnit === "imperial";
  const displaySpeed = telemetry.vss !== undefined
    ? (isImperial ? (telemetry.vss * 0.621371).toFixed(1) : telemetry.vss.toFixed(1))
    : "--";
  const speedUnitStr = isImperial ? "mph" : "km/h";

  const currentLat = telemetry.lat;
  const currentLon = telemetry.lon;
  const currentBearing = telemetry.gpsBearing ?? 0;
  const currentElevation = telemetry.elevationM;
  const hasLiveCoordinates = currentLat !== undefined && currentLon !== undefined && !isNaN(currentLat) && !isNaN(currentLon);

  // Accumulate live traversed GPS path dynamically as telemetry ticks arrive (NO PRE-DRAWN FUTURE DESTINATION PATH)
  useEffect(() => {
    if (!hasLiveCoordinates || currentLat === undefined || currentLon === undefined) return;

    const currentBehavior: DriverBehavior = telemetry.ml?.driver_behaviour?.label || "Moderate";
    const currentMileage = telemetry.ml?.fuel?.mileage_kmpl ?? 0;

    setTraveledPath((prev) => {
      // Check if coordinate is distinct enough or first point
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        const distSq = Math.pow(last.lat - currentLat, 2) + Math.pow(last.lon - currentLon, 2);
        // If practically same position (jitter < ~0.5 meter), update the values of current position without cluttering
        if (distSq < 0.000000001) {
          return prev;
        }
      }

      const newPoint: PathPoint = {
        lat: currentLat,
        lon: currentLon,
        vss: telemetry.vss,
        behavior: currentBehavior,
        mileage: currentMileage,
        timestamp: telemetry.timestamp,
        elevation: telemetry.elevationM,
      };

      // Keep recent 2000 points
      return [...prev.slice(-2000), newPoint];
    });
  }, [currentLat, currentLon, telemetry.vss, telemetry.timestamp, hasLiveCoordinates, telemetry.ml]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Default center (e.g. Mangalore/SJEC / India coordinate baseline)
    const initialCenter: [number, number] = [12.9134, 74.9018];

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: 16,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);
    polylineGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer based on style
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let url = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
    let attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

    if (mapStyle === "osm") {
      url = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    } else if (mapStyle === "satellite") {
      url = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      attribution = "Tiles &copy; Esri";
    }

    const newLayer = L.tileLayer(url, {
      maxZoom: 19,
      attribution,
    }).addTo(map);

    tileLayerRef.current = newLayer;
  }, [mapStyle]);

  // Render Traveled Path Segments with Heatmap coloring
  useEffect(() => {
    const group = polylineGroupRef.current;
    if (!group) return;

    group.clearLayers();

    if (traveledPath.length < 2) return;

    if (displayMode === "standard") {
      // Standard glowing cyan path for traversed route
      const latlngs: L.LatLngExpression[] = traveledPath.map((p) => [p.lat, p.lon]);
      L.polyline(latlngs, {
        color: "#00d4ff",
        weight: 5,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(group);
    } else {
      // Multi-segment Heatmap drawing based on telemetry values per segment
      for (let i = 0; i < traveledPath.length - 1; i++) {
        const p1 = traveledPath[i];
        const p2 = traveledPath[i + 1];

        let segColor = "#00d4ff";
        if (displayMode === "speed") {
          segColor = getSpeedColor(p2.vss);
        } else if (displayMode === "behavior") {
          segColor = getBehaviorColor(p2.behavior);
        } else if (displayMode === "fuel") {
          segColor = getFuelColor(p2.mileage);
        }

        L.polyline([[p1.lat, p1.lon], [p2.lat, p2.lon]], {
          color: segColor,
          weight: 5,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(group);
      }
    }
  }, [traveledPath, displayMode]);

  // Update Live Vehicle Marker and Follow
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (hasLiveCoordinates && currentLat !== undefined && currentLon !== undefined) {
      const pos: [number, number] = [currentLat, currentLon];

      const iconHtml = `
        <div class="relative flex items-center justify-center" style="transform: rotate(${currentBearing}deg); transform-origin: center;">
          <div class="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400/90 flex items-center justify-center shadow-[0_0_15px_rgba(0,212,255,0.8)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 19 21 12 17 5 21 12 2" fill="rgba(0,212,255,0.4)" />
            </svg>
          </div>
          <div class="absolute -top-1 w-2 h-2 rounded-full bg-cyan-300 animate-ping"></div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: "vehicle-custom-marker",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      if (!markerRef.current) {
        markerRef.current = L.marker(pos, { icon: customIcon, zIndexOffset: 1000 }).addTo(map);
      } else {
        markerRef.current.setLatLng(pos);
        markerRef.current.setIcon(customIcon);
      }

      if (!accuracyCircleRef.current) {
        accuracyCircleRef.current = L.circleMarker(pos, {
          radius: 12,
          color: "#00d4ff",
          fillColor: "#00d4ff",
          fillOpacity: 0.15,
          weight: 1,
        }).addTo(map);
      } else {
        accuracyCircleRef.current.setLatLng(pos);
      }

      if (followVehicle) {
        map.panTo(pos, { animate: true, duration: 0.4 });
      }
    }
  }, [currentLat, currentLon, currentBearing, followVehicle, hasLiveCoordinates]);

  const handleFitTraveled = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (traveledPath.length > 1) {
      const bounds = L.latLngBounds(traveledPath.map((p) => [p.lat, p.lon]));
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    } else if (hasLiveCoordinates && currentLat !== undefined && currentLon !== undefined) {
      map.setView([currentLat, currentLon], 16, { animate: true });
    }
  };

  const handleClearHistory = () => {
    setTraveledPath([]);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden relative" style={{ background: "var(--bg-deep)" }}>
      {/* ── Top Bar: Switchable Heatmap Display Modes ── */}
      <div
        className="px-5 py-3 border-b flex flex-wrap items-center justify-between gap-4 z-10 shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--bg-panel)" }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5" style={{ background: "rgba(0,212,255,0.1)", border: "1px solid var(--cyan)" }}>
              <Navigation2 size={16} style={{ color: "var(--cyan)" }} />
            </div>
            <div>
              <div className="hud-display text-sm font-bold tracking-wide" style={{ color: "var(--text-primary)" }}>
                GPS ROUTE TRACKING & HEATMAPS
              </div>
              <div className="hud-label text-[9px]" style={{ color: "var(--text-muted)" }}>
                REAL-TIME LIVE TELEMETRY PATH REPLAY
              </div>
            </div>
          </div>

          <div className="h-6 w-px bg-white/10 hidden sm:block" />

          {/* 4 Interactive Switchable Display Modes */}
          <div className="flex items-center border" style={{ borderColor: "var(--border)" }}>
            <button
              onClick={() => setDisplayMode("standard")}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                displayMode === "standard"
                  ? "bg-cyan-500/25 text-cyan-300 border-cyan-400"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Activity size={12} />
              <span>Standard Path</span>
            </button>

            <button
              onClick={() => setDisplayMode("speed")}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer border-l border-white/10 ${
                displayMode === "speed"
                  ? "bg-amber-500/25 text-amber-300 border-amber-400"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Flame size={12} />
              <span>Speed Heatmap</span>
            </button>

            <button
              onClick={() => setDisplayMode("behavior")}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer border-l border-white/10 ${
                displayMode === "behavior"
                  ? "bg-purple-500/25 text-purple-300 border-purple-400"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Zap size={12} />
              <span>Driving Behavior</span>
            </button>

            <button
              onClick={() => setDisplayMode("fuel")}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer border-l border-white/10 ${
                displayMode === "fuel"
                  ? "bg-green-500/25 text-green-300 border-green-400"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Fuel size={12} />
              <span>Fuel Efficiency Trace</span>
            </button>
          </div>
        </div>

        {/* Action Controls & Layer Switcher */}
        <div className="flex items-center gap-2">
          {/* Map style selector */}
          <div className="flex border" style={{ borderColor: "var(--border)" }}>
            {(["dark", "osm", "satellite"] as const).map((style) => (
              <button
                key={style}
                onClick={() => setMapStyle(style)}
                className={`px-2.5 py-1 text-[9px] font-bold uppercase transition-all cursor-pointer ${
                  mapStyle === style
                    ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {style === "dark" ? "Dark" : style === "osm" ? "OSM" : "Sat"}
              </button>
            ))}
          </div>

          <button
            onClick={() => setFollowVehicle(!followVehicle)}
            className={`px-3 py-1 text-[9px] font-bold uppercase transition-all border flex items-center gap-1.5 cursor-pointer ${
              followVehicle
                ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/50"
                : "bg-black/40 text-zinc-400 border-white/10"
            }`}
          >
            <Eye size={12} />
            <span>{followVehicle ? "FOLLOWING" : "FREE PAN"}</span>
          </button>

          <button
            onClick={handleFitTraveled}
            className="px-3 py-1 text-[9px] font-bold uppercase transition-all border border-white/15 bg-black/40 hover:bg-white/10 text-white flex items-center gap-1.5 cursor-pointer"
          >
            <Maximize2 size={12} />
            <span>FIT TRAVELED</span>
          </button>

          <button
            onClick={handleClearHistory}
            className="p-1.5 border border-white/15 bg-black/40 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer"
            title="Reset Traveled Path Trace"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      {/* ── Main Map Canvas Area ── */}
      <div className="flex-1 relative overflow-hidden">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* ── Floating Overlay HUD: Live Position & Telemetry ── */}
        <div className="absolute top-4 left-4 z-[400] flex flex-col gap-2 pointer-events-none">
          <div
            className="panel p-3 pointer-events-auto shadow-2xl backdrop-blur-md"
            style={{
              borderColor: "var(--border)",
              background: "rgba(7, 12, 18, 0.88)",
              minWidth: "230px",
            }}
          >
            <div className="hud-label text-[9px] mb-1 flex items-center justify-between" style={{ color: "var(--cyan)" }}>
              <span>LIVE POSITION & TELEMETRY</span>
              <Radio size={10} className={hasLiveCoordinates ? "animate-pulse text-cyan-400" : "text-zinc-600"} />
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="p-2 border" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.3)" }}>
                <div className="hud-label text-[8px]" style={{ color: "var(--text-muted)" }}>SPEED</div>
                <div className="text-xl font-black font-mono" style={{ color: "var(--cyan)" }}>
                  {displaySpeed}
                  <span className="text-[9px] ml-0.5 text-zinc-400">{speedUnitStr}</span>
                </div>
              </div>

              <div className="p-2 border" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.3)" }}>
                <div className="hud-label text-[8px]" style={{ color: "var(--text-muted)" }}>HEADING</div>
                <div className="text-xl font-black font-mono flex items-center gap-1" style={{ color: "var(--purple)" }}>
                  <Compass size={14} style={{ transform: `rotate(${currentBearing}deg)` }} />
                  <span>{currentBearing.toFixed(0)}°</span>
                </div>
              </div>
            </div>

            <div className="mt-2 pt-2 border-t font-mono text-[10px] space-y-1" style={{ borderColor: "var(--border)" }}>
              <div className="flex justify-between text-zinc-400">
                <span className="text-zinc-500">LAT:</span>
                <span className="text-zinc-200">{currentLat !== undefined ? currentLat.toFixed(6) : "--"}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span className="text-zinc-500">LON:</span>
                <span className="text-zinc-200">{currentLon !== undefined ? currentLon.toFixed(6) : "--"}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span className="text-zinc-500">ELEVATION:</span>
                <span className="text-amber-400">{currentElevation !== undefined ? `${currentElevation.toFixed(1)} m` : "--"}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span className="text-zinc-500">POINTS LOGGED:</span>
                <span className="text-green-400">{traveledPath.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Floating Overlay HUD: Dynamic Heatmap Legend (Bottom Left) ── */}
        <div className="absolute bottom-4 left-4 z-[400] flex flex-col gap-2 pointer-events-none">
          <div
            className="panel p-3 pointer-events-auto shadow-2xl backdrop-blur-md"
            style={{
              borderColor: "var(--border)",
              background: "rgba(7, 12, 18, 0.88)",
              minWidth: "260px",
            }}
          >
            {displayMode === "standard" && (
              <div className="space-y-1">
                <div className="hud-label text-[9px]" style={{ color: "var(--cyan)" }}>
                  STANDARD TRAVELED PATH
                </div>
                <div className="flex items-center gap-2 pt-1 font-mono text-[10px] text-zinc-300">
                  <div className="w-4 h-1.5 bg-[#00d4ff]" />
                  <span>Live Traversed Route</span>
                </div>
              </div>
            )}

            {displayMode === "speed" && (
              <div className="space-y-1.5">
                <div className="hud-label text-[9px]" style={{ color: "var(--amber)" }}>
                  SPEED HEATMAP GRADIENT
                </div>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[9px] text-zinc-300">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-none bg-[#00d4ff]" />
                    <span>&lt; 25 km/h (Slow)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-none bg-[#00ff88]" />
                    <span>25-60 km/h (Cruise)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-none bg-[#ffb800]" />
                    <span>60-90 km/h (Moderate)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-none bg-[#ff3333]" />
                    <span>&gt; 90 km/h (Fast)</span>
                  </div>
                </div>
              </div>
            )}

            {displayMode === "behavior" && (
              <div className="space-y-1.5">
                <div className="hud-label text-[9px]" style={{ color: "var(--purple)" }}>
                  DRIVING BEHAVIOR OVERLAY (XGBOOST ML)
                </div>
                <div className="grid grid-cols-3 gap-1 font-mono text-[9px]">
                  <div className="flex items-center gap-1 text-green-400">
                    <div className="w-2.5 h-2.5 bg-[#00ff88]" />
                    <span>Economical</span>
                  </div>
                  <div className="flex items-center gap-1 text-amber-400">
                    <div className="w-2.5 h-2.5 bg-[#ffb800]" />
                    <span>Moderate</span>
                  </div>
                  <div className="flex items-center gap-1 text-red-400">
                    <div className="w-2.5 h-2.5 bg-[#ff3333]" />
                    <span>Aggressive</span>
                  </div>
                </div>
              </div>
            )}

            {displayMode === "fuel" && (
              <div className="space-y-1.5">
                <div className="hud-label text-[9px]" style={{ color: "var(--green)" }}>
                  FUEL EFFICIENCY TRACE (KM/L)
                </div>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[9px] text-zinc-300">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-[#00ff88]" />
                    <span>&gt; 18 km/L (High)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-[#76e060]" />
                    <span>12-18 km/L (Good)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-[#ffb800]" />
                    <span>7-12 km/L (Mid)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 bg-[#ff5555]" />
                    <span>&lt; 7 km/L (Heavy Load)</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notice when waiting for live GPS coordinates */}
        {!hasLiveCoordinates && traveledPath.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm z-[450]">
            <div
              className="panel max-w-md p-6 space-y-3 text-center border-cyan-500/40"
              style={{ background: "rgba(7, 12, 18, 0.95)" }}
            >
              <div className="w-12 h-12 mx-auto flex items-center justify-center rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Navigation2 size={24} className="animate-pulse" />
              </div>
              <div className="hud-display text-lg font-bold text-cyan-400">
                STREAMING LIVE GPS TELEMETRY
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Awaiting incoming GPS fixes from the OBD-II telemetry stream.
                The traversed route and real-time heatmaps will render dynamically as coordinates are received.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
