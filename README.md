# AutoVue

**Real-time vehicle telemetry dashboard for OBD-II monitoring and predictive maintenance.**
Part of the AutoVue ecosystem, interfacing with the [AutoVue Backend](https://github.com/23e46pratham-lab/ecu-backend).

![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)
![React](https://img.shields.io/badge/React-19-blue.svg)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [Data Reference Table](#data-reference-table)
- [Testing and Usage Tips](#testing-and-usage-tips)
- [Deployment](#deployment)
- [Extending the System](#extending-the-system)
- [Roadmap](#roadmap)
- [License](#license)

## Overview

AutoVue is a high-performance web dashboard designed to visualize vehicle telemetry data in real-time. It connects to a backend ML engine to analyze live data streams, predicting potential vehicle health issues before they become critical and evaluating driver behavior for safety and efficiency.

The system solves the problem of disconnected vehicle diagnostics by bringing raw OBD-II sensor data into a unified, cyber-physical user interface. It abstracts the complexity of data streaming and machine learning inference into actionable insights for the user.

This project is intended for automotive developers, fleet managers, and car enthusiasts who require deep visibility into vehicle performance and predictive maintenance alerts.

## Architecture

```text
┌─────────────┐       HTTP / WS        ┌──────────────┐       HTTP / WS        ┌─────────────────┐
│             │ ◄────────────────────► │              │ ◄────────────────────► │                 │
│ React SPA   │                        │ Express Proxy│                        │ Python ML       │
│ (Frontend)  │                        │ (Node.js)    │                        │ Backend         │
│             │                        │              │                        │                 │
└─────────────┘                        └──────────────┘                        └─────────────────┘
```

The architecture decouples the visualization layer from the data processing layer. The React frontend strictly handles rendering and user interaction. The Node.js Express server acts as a proxy to prevent CORS issues and encapsulate the external ML backend.

This decoupling allows the machine learning models and dataset management to be scaled or modified independently in the Python backend without requiring changes to the frontend client. The React dashboard is strictly configured to use GET and WebSocket endpoints to consume telemetry.

## Project Structure

```text
.
├── src/                      # Source code root
│   ├── components/           # React UI components
│   │   ├── Dashboard.tsx     # Main dashboard layout
│   │   ├── HealthMonitor.tsx # Vehicle health display
│   │   ├── HUDGauge.tsx      # Circular gauge component
│   │   ├── LiveChart.tsx     # Real-time data visualization
│   │   └── TelemetryPanel.tsx# Raw sensor data readouts
│   ├── logic/                # Core analytical logic
│   │   ├── driverBehavior.ts # Local heuristic behavior analysis
│   │   ├── mileage.ts        # Mileage calculation logic
│   │   └── mlHealth.ts       # Local fallback diagnostics
│   ├── services/             # External integration layers
│   │   ├── apiService.ts     # HTTP and WS client functions
│   │   └── ecuSimulator.ts   # Local data generation fallback
│   ├── main.tsx              # React entry point
│   ├── types.ts              # TypeScript interfaces
│   └── index.css             # Tailwind CSS entry and global styles
├── server.ts                 # Express API proxy and static file server
├── vite.config.ts            # Vite bundler configuration
├── package.json              # Project dependencies and scripts
├── .env.example              # Environment variables template
└── README.md                 # Project documentation
```

## Getting Started

### Prerequisites
- Node.js v20.0.0 or higher
- npm v10.0.0 or higher

### Installation
1. Clone the repository
```bash
git clone https://github.com/your-username/autovue.git
cd autovue
```
2. Install dependencies
```bash
npm install
```
3. Start the development server
```bash
npm run dev
```

### Where to go first
| URL | Purpose |
|---|---|
| `http://localhost:3000` | Main application dashboard |
| `http://localhost:3000/api/status` | Verify proxy connection to backend |
| `http://localhost:3000/api/live-data` | View raw telemetry JSON output |

## API Reference

### System

#### GET /health
Checks the health status of the backend server.

**Response 200**
```json
{
  "status": "ok",
  "version": "1.0.0"
}
```
**Errors**
| Code | Cause |
|---|---|
| 503 | Backend service unavailable |

### Dataset Management

#### GET /api/datasets
Retrieves a list of all available datasets.

**Response 200**
```json
{
  "datasets": [
    {
      "id": "219cf11c-d27a-4d1b-86dd-4b614f0a38b3",
      "name": "2017-07-28_Seat_Leon_KA_KA_Normal.csv",
      "total_rows": 13917,
      "duration_seconds": 1391.6
    }
  ]
}
```
**Errors**
| Code | Cause |
|---|---|
| 500 | Internal server error |

#### POST /api/upload
Uploads a new `.csv` or `.xlsx` dataset.

**Request body**
Multipart form data with field name `file`.

**Response 200**
```json
{
  "message": "Dataset uploaded successfully",
  "dataset_id": "8b23c91a-b32c-491a-a23d-c782b13f9c2d"
}
```
**Errors**
| Code | Cause |
|---|---|
| 400 | Invalid file format |
| 422 | Unprocessable entity |

#### DELETE /api/datasets/{id}
Deletes an uploaded dataset.

**Response 200**
```json
{
  "message": "Dataset deleted successfully"
}
```
**Errors**
| Code | Cause |
|---|---|
| 404 | Dataset not found |

#### PATCH /api/datasets/{id}/rename
Renames an existing dataset.

**Request body**
```json
{
  "dataset_id": "219cf11c-d27a-4d1b-86dd-4b614f0a38b3",
  "new_name": "highway_driving.csv"
}
```
Constraints: `new_name` must end with `.csv` or `.xlsx`.

**Response 200**
```json
{
  "message": "Dataset renamed successfully"
}
```
**Errors**
| Code | Cause |
|---|---|
| 400 | Invalid name format |
| 404 | Dataset not found |

#### POST /api/change-dataset
Switches the active dataset for streaming.

**Request body**
```json
{
  "dataset_id": "219cf11c-d27a-4d1b-86dd-4b614f0a38b3"
}
```

**Response 200**
```json
{
  "message": "Active dataset changed successfully"
}
```
**Errors**
| Code | Cause |
|---|---|
| 404 | Dataset not found |

### Playback Control

#### POST /api/start
Starts streaming telemetry data.

**Request body**
```json
{
  "dataset_id": "219cf11c-d27a-4d1b-86dd-4b614f0a38b3",
  "speed": 1.0,
  "loop": true
}
```
Constraints: `speed` must be one of 0.5, 1.0, 2.0, 5.0, or 10.0.

**Response 200**
```json
{
  "message": "Playback started"
}
```
**Errors**
| Code | Cause |
|---|---|
| 400 | Invalid speed multiplier |
| 404 | Dataset not found |

#### POST /api/pause
Pauses the active telemetry stream.

**Response 200**
```json
{
  "message": "Playback paused"
}
```
**Errors**
| Code | Cause |
|---|---|
| 400 | Playback not active |

#### POST /api/resume
Resumes a paused telemetry stream.

**Response 200**
```json
{
  "message": "Playback resumed"
}
```
**Errors**
| Code | Cause |
|---|---|
| 400 | Playback not paused |

#### POST /api/stop
Stops the telemetry stream entirely.

**Response 200**
```json
{
  "message": "Playback stopped"
}
```
**Errors**
| Code | Cause |
|---|---|
| 400 | Playback not active |

#### POST /api/reset
Restarts streaming from the first row of the dataset.

**Response 200**
```json
{
  "message": "Playback reset to start"
}
```
**Errors**
| Code | Cause |
|---|---|
| 400 | Playback not active |

#### POST /api/speed
Sets the playback speed of the active stream.

**Request body**
```json
{
  "speed": 5.0
}
```

**Response 200**
```json
{
  "message": "Speed updated to 5.0x"
}
```
**Errors**
| Code | Cause |
|---|---|
| 400 | Invalid speed multiplier |

#### POST /api/loop
Toggles looping mode for the active stream.

**Request body**
```json
{
  "loop": true
}
```

**Response 200**
```json
{
  "message": "Loop mode updated"
}
```
**Errors**
| Code | Cause |
|---|---|
| 400 | Playback not active |

#### GET /api/status
Returns the current playback state and progress.

**Response 200**
```json
{
  "state": "running",
  "dataset_id": "219cf11c-d27a-4d1b-86dd-4b614f0a38b3",
  "dataset_name": "2017-07-28_Seat_Leon_KA_KA_Normal.csv",
  "current_row": 11378,
  "total_rows": 13917,
  "speed": 1.0,
  "loop": true,
  "elapsed_playback_seconds": 1137.7,
  "dataset_duration_seconds": 1391.6,
  "playback_percent": 81.76
}
```
**Errors**
| Code | Cause |
|---|---|
| 500 | Playback engine error |

#### GET /api/live-data
Retrieves the most recent telemetry tick from the stream.

**Response 200**
```json
{
  "row_index": 11259,
  "total_rows": 13917,
  "elapsed_seconds": 1125.9,
  "playback_percent": 80.91,
  "data": {
    "coolant_temp": 92.0,
    "map_kpa": 109.0,
    "rpm": 934.0,
    "vss": 18.0,
    "intake_air_temp": 13.0,
    "maf": 7.72,
    "throttle_pos": 83.5,
    "ambient_temp": 18.0,
    "pedal_d": 14.1,
    "pedal_e": 14.5
  }
}
```
**Errors**
| Code | Cause |
|---|---|
| 404 | Stream not active |

#### GET /api/history
Retrieves a set of recent ticks for backfilling charts.

**Response 200**
```json
[
  {
    "row_index": 11258,
    "data": {
      "coolant_temp": 92.0,
      "rpm": 934.0,
      "vss": 18.0
    }
  },
  {
    "row_index": 11259,
    "data": {
      "coolant_temp": 92.0,
      "rpm": 934.0,
      "vss": 18.0
    }
  }
]
```
**Errors**
| Code | Cause |
|---|---|
| 400 | Limit parameter invalid |

### WebSockets

#### WS /api/ws/live
Provides a continuous live telemetry stream. Returns frames matching the `GET /api/live-data` structure.

#### WS /api/ws/logs
Provides a continuous stream of system logs, dataset changes, and errors from the backend.

## Data Reference Table

| Field | Meaning | Unit/Type |
|---|---|---|
| `rpm` | Engine revolutions per minute | Integer |
| `vss` | Vehicle speed sensor | km/h (Float) |
| `coolant_temp` | Engine coolant temperature | Celsius (Float) |
| `intake_air_temp` | Intake air temperature | Celsius (Float) |
| `maf` | Mass air flow | g/s (Float) |
| `throttle_pos` | Throttle position | Percentage (Float) |
| `map_kpa` | Manifold absolute pressure | kPa (Float) |
| `ambient_temp` | Ambient air temperature | Celsius (Float) |
| `pedal_d` | Accelerator pedal position D | Percentage (Float) |
| `pedal_e` | Accelerator pedal position E | Percentage (Float) |

These fields map directly to standard OBD-II PID specifications, ensuring stability when swapping backend implementations or dataset sources.

## Testing and Usage Tips

The React dashboard is designed strictly for `GET` and `WS` operations. Dataset management via `POST`, `PATCH`, and `DELETE` must be handled externally.

Use tools like Postman, Thunder Client, or curl to interact with control endpoints.

```bash
curl -X POST http://localhost:3000/api/start \
  -H "Content-Type: application/json" \
  -d '{"speed": 1.0, "loop": true}'
```

```bash
curl -X POST http://localhost:3000/api/pause
```

Ensure the Express proxy is running when attempting to access `/api/*` endpoints from the browser to avoid CORS violations from the ML backend.

## Deployment

The recommended deployment platform is Google Cloud Run, as it natively handles containerized full-stack Node.js applications with built-in HTTPS and auto-scaling.

1. Build the production assets
```bash
npm run build
```
2. Build the Docker image
```bash
docker build -t gcr.io/your-project/autovue .
```
3. Push to Container Registry
```bash
docker push gcr.io/your-project/autovue
```
4. Deploy to Cloud Run
```bash
gcloud run deploy autovue --image gcr.io/your-project/autovue --platform managed --allow-unauthenticated
```
Note: The Express proxy must bind to `0.0.0.0:3000`. Cloud Run routes external traffic to the container port defined by the platform environment.

## Extending the System

The architecture is designed with clear abstraction boundaries. To swap the data source from a pre-recorded dataset to a live physical OBD-II adapter, only the ML backend needs to change.

The frontend consumes standard JSON payloads via `/api/live-data` and WebSocket `/api/ws/live`. As long as the physical adapter interface exposes these endpoints in the same format, no React code requires modification. The Express proxy layer ensures that all routing remains consistent.

## Roadmap
- [ ] Add historical comparison charts for longitudinal dataset analysis
- [ ] Implement user authentication and session management
- [ ] Add direct support for ELM327 Bluetooth OBD-II adapters via Web Serial API
- [ ] Expand ML models to include real-time fuel efficiency predictions
- [ ] Add localization for metric/imperial unit toggling

## License
MIT License
