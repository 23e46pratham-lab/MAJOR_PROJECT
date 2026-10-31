import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  TelemetryData, DriverBehavior, HealthStatus,
  ServiceCompanyDetails, RegisteredIssue,
  DriverMLResult, HealthMLResult, FuelMLResult
} from "../types";
import {
  mapSimulatedDataToTelemetry,
  getWebSocketUrl,
  getApiBaseUrl,
  setApiBaseUrl,
  checkBackendHealth,
  getLiveData
} from "./apiService";

export interface LiveTelemetryState {
  telemetry: TelemetryData;
  history: TelemetryData[];
  tripTime: number;
  totalDistance: number;
  isConnected: boolean;
  isBackendHealthy: boolean | null;
  speedUnit: "metric" | "imperial";
  setSpeedUnit: (unit: "metric" | "imperial") => void;
  tempUnit: "metric" | "imperial";
  setTempUnit: (unit: "metric" | "imperial") => void;
  resetStates: () => void;
  serviceCompany: ServiceCompanyDetails;
  setServiceCompany: React.Dispatch<React.SetStateAction<ServiceCompanyDetails>>;
  registeredIssues: RegisteredIssue[];
  setRegisteredIssues: React.Dispatch<React.SetStateAction<RegisteredIssue[]>>;
  telegramToken: string;
  setTelegramToken: (token: string) => void;
  telegramChatId: string;
  setTelegramChatId: (chatId: string) => void;
  telegramEnabled: boolean;
  setTelegramEnabled: (enabled: boolean) => void;
  savedUrl: string;
  tempUrl: string;
  setTempUrl: (url: string) => void;
  handleSaveUrl: () => void;
  healthStatus: HealthStatus;
  currentBehavior: DriverBehavior;
  driverML?: DriverMLResult;
  fuelML?: FuelMLResult;
}

export function useLiveTelemetry(): LiveTelemetryState {
  const [telemetry, setTelemetry] = useState<TelemetryData>(() =>
    mapSimulatedDataToTelemetry({
      rpm: 800,
      vss: 0,
      maf: 3.5,
      throttle_pos: 15,
      coolant_temp: 85,
      intake_air_temp: 25,
      ambient_temp: 24,
      map_kpa: 101,
      engine_load: 20,
      dtcs: [],
    })
  );

  const [history, setHistory] = useState<TelemetryData[]>([]);
  const [tripTime, setTripTime] = useState(0);
  const [totalDistance, setTotalDistance] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);

  const [speedUnit, setSpeedUnit] = useState<"metric" | "imperial">(() => {
    return (localStorage.getItem("obd_speed_unit") as "metric" | "imperial") || "metric";
  });
  const [tempUnit, setTempUnit] = useState<"metric" | "imperial">(() => {
    return (localStorage.getItem("obd_temp_unit") as "metric" | "imperial") || "metric";
  });

  useEffect(() => {
    localStorage.setItem("obd_speed_unit", speedUnit);
  }, [speedUnit]);

  useEffect(() => {
    localStorage.setItem("obd_temp_unit", tempUnit);
  }, [tempUnit]);

  // Maintenance state
  const [serviceCompany, setServiceCompany] = useState<ServiceCompanyDetails>(() => {
    try {
      const stored = localStorage.getItem("obd_service_company");
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return {
      name: "Apex Auto Services",
      email: "service@apexauto.com",
      phone: "+1 (555) 019-2834",
      address: "404 Performance Blvd, Detroit, MI",
    };
  });

  const [registeredIssues, setRegisteredIssues] = useState<RegisteredIssue[]>(() => {
    try {
      const stored = localStorage.getItem("obd_registered_issues");
      if (stored) return JSON.parse(stored);
    } catch (e) {}
    return [];
  });

  const [telegramToken, setTelegramToken] = useState<string>(() => {
    return localStorage.getItem("obd_telegram_token") || "";
  });
  const [telegramChatId, setTelegramChatId] = useState<string>(() => {
    return localStorage.getItem("obd_telegram_chat_id") || "";
  });
  const [telegramEnabled, setTelegramEnabled] = useState<boolean>(() => {
    return localStorage.getItem("obd_telegram_enabled") === "true";
  });

  useEffect(() => {
    localStorage.setItem("obd_service_company", JSON.stringify(serviceCompany));
  }, [serviceCompany]);

  useEffect(() => {
    localStorage.setItem("obd_registered_issues", JSON.stringify(registeredIssues));
  }, [registeredIssues]);

  useEffect(() => {
    localStorage.setItem("obd_telegram_token", telegramToken);
  }, [telegramToken]);

  useEffect(() => {
    localStorage.setItem("obd_telegram_chat_id", telegramChatId);
  }, [telegramChatId]);

  useEffect(() => {
    localStorage.setItem("obd_telegram_enabled", String(telegramEnabled));
  }, [telegramEnabled]);

  const [savedUrl, setSavedUrl] = useState(getApiBaseUrl());
  const [tempUrl, setTempUrl] = useState(getApiBaseUrl());

  const tripStartRef = useRef(Date.now());

  const resetStates = useCallback(() => {
    const zeroed = mapSimulatedDataToTelemetry({
      rpm: 0,
      vss: 0,
      maf: 0,
      throttle_pos: 0,
      coolant_temp: 20,
      intake_air_temp: 20,
      dtcs: [],
    });
    setTelemetry(zeroed);
    setHistory([]);
    setTripTime(0);
    setTotalDistance(0);
    tripStartRef.current = Date.now();
  }, []);

  const handleSaveUrl = useCallback(() => {
    setApiBaseUrl(tempUrl);
    setSavedUrl(tempUrl);
    resetStates();
  }, [tempUrl, resetStates]);

  // Check backend health periodically
  useEffect(() => {
    const check = async () => {
      try {
        const healthy = await checkBackendHealth();
        setIsBackendHealthy(healthy);
      } catch {
        setIsBackendHealthy(false);
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, [savedUrl]);

  // Trip timer
  useEffect(() => {
    const id = setInterval(() => setTripTime(Math.floor((Date.now() - tripStartRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  // Telemetry loop — Live WebSocket from FastAPI backend + HTTP polling fallback
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;
    let pollInterval: any = null;
    let isStopped = false;
    let usePolling = false;

    const startPolling = () => {
      if (pollInterval) clearInterval(pollInterval);
      pollInterval = setInterval(async () => {
        if (isStopped) return;
        try {
          const res = await getLiveData();
          const data = mapSimulatedDataToTelemetry(res);
          setTelemetry(data);
          setHistory((h) => [...h.slice(-120), data]);
          if (data.vss > 0) {
            setTotalDistance((d) => d + data.vss / 3600);
          }
          setIsConnected(true);
        } catch {
          setIsConnected(false);
        }
      }, 1000);
    };

    const connect = () => {
      if (isStopped) return;
      const wsUrl = getWebSocketUrl("/api/ws/live");

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setIsConnected(true);
          usePolling = false;
          if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
          }
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            const data = mapSimulatedDataToTelemetry(payload);
            setTelemetry(data);
            setHistory((h) => [...h.slice(-120), data]);
            if (data.vss > 0) {
              setTotalDistance((d) => d + data.vss / 3600);
            }
          } catch (err) {
            console.error("[WebSocket] Parse error:", err);
          }
        };

        ws.onerror = () => {
          if (!usePolling) {
            usePolling = true;
            startPolling();
          }
        };

        ws.onclose = () => {
          if (!isStopped) {
            if (!usePolling) {
              usePolling = true;
              startPolling();
            }
            reconnectTimeout = setTimeout(connect, 4000);
          }
        };
      } catch (e) {
        if (!usePolling) {
          usePolling = true;
          startPolling();
        }
      }
    };

    connect();

    return () => {
      isStopped = true;
      if (ws) {
        try {
          ws.close();
        } catch (e) {}
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (pollInterval) clearInterval(pollInterval);
      setIsConnected(false);
    };
  }, [savedUrl]);

  // Derived health status
  const healthStatus: HealthStatus = useMemo(() => {
    const mlHealth = telemetry.ml?.health;
    if (mlHealth) {
      const isAnomaly = mlHealth.is_anomaly;
      const anomalyScore = mlHealth.anomaly_score;
      const faults = [...(telemetry.dtcs || [])];
      if (isAnomaly) {
        faults.push(...(mlHealth.triggered_features || []).map((f) => `Anomaly: ${f}`));
      }
      const score = Math.max(0, 100 - (isAnomaly ? 35 : 0) - faults.length * 15);
      return {
        score,
        status: isAnomaly ? "Critical" : score < 80 ? "Warning" : "Healthy",
        anomalyScore,
        isAnomaly,
        featureErrors: mlHealth.feature_errors || {},
        triggeredFeatures: mlHealth.triggered_features || [],
        faults,
      };
    }

    const faults = [...(telemetry.dtcs || [])];
    if (telemetry.coolantTemp > 105) faults.push("Coolant Temp High");
    const score = Math.max(0, 95 - faults.length * 20);
    return {
      score,
      status: score < 60 || faults.length > 0 ? "Warning" : "Healthy",
      anomalyScore: 0,
      isAnomaly: false,
      featureErrors: {},
      triggeredFeatures: [],
      faults,
    };
  }, [telemetry]);

  const driverML = telemetry.ml?.driver_behaviour;
  const currentBehavior: DriverBehavior = driverML?.label || "Moderate";
  const fuelML = telemetry.ml?.fuel;

  return {
    telemetry,
    history,
    tripTime,
    totalDistance,
    isConnected,
    isBackendHealthy,
    speedUnit,
    setSpeedUnit,
    tempUnit,
    setTempUnit,
    resetStates,
    serviceCompany,
    setServiceCompany,
    registeredIssues,
    setRegisteredIssues,
    telegramToken,
    setTelegramToken,
    telegramChatId,
    setTelegramChatId,
    telegramEnabled,
    setTelegramEnabled,
    savedUrl,
    tempUrl,
    setTempUrl,
    handleSaveUrl,
    healthStatus,
    currentBehavior,
    driverML,
    fuelML,
  };
}
