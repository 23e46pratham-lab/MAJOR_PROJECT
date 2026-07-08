import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createProxyMiddleware } from "http-proxy-middleware";
import http from "http";

const PORT = 3000;
let targetUrl = "https://ecu-backend-95fz.onrender.com";

async function startServer() {
  const app = express();
  app.use(express.json());

  // Log requests
  app.use((req, res, next) => {
    console.log(`[Server] ${req.method} ${req.url}`);
    next();
  });

  // API to get current proxy target URL
  app.get("/api/proxy-config", (req, res) => {
    res.json({ targetUrl });
  });

  // API to set current proxy target URL dynamically
  app.post("/api/proxy-config", (req, res) => {
    const { url } = req.body;
    if (url) {
      targetUrl = url.trim().replace(/\/+$/, "");
      console.log(`[Proxy] Dynamic target URL updated to: ${targetUrl}`);
      res.json({ success: true, targetUrl });
    } else {
      res.status(400).json({ error: "Missing url parameter" });
    }
  });

  // Setup the dynamic proxy middleware
  const proxyMiddleware = createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
    secure: false, // Ignore self-signed/invalid certificates for Pinggy/Ngrok tunnels
    ws: true,
    router: () => targetUrl, // Dynamically route requests to the current targetUrl
    on: {
      error: (err, req, res: any) => {
        console.error(`[Proxy Error] Error forwarding to ${targetUrl}:`, err);
        if (res && typeof res.status === "function") {
          res.status(502).json({ error: "Proxy connection failed", details: err.message });
        } else if (res && typeof res.writeHead === "function") {
          res.writeHead(502, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Proxy connection failed", details: err.message }));
        }
      }
    }
  });

  // Proxy any requests to /api or /ws to the target url
  app.use("/api", (req, res, next) => {
    // Exclude our internal configuration endpoints from the proxy
    if (req.path === "/proxy-config") {
      return next();
    }
    proxyMiddleware(req, res, next);
  });

  // Setup Vite dev server or static serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = http.createServer(app);

  // Upgrade websocket connections for the proxy
  server.on("upgrade", (req, socket, head) => {
    console.log(`[Server WebSocket Upgrade] Path: ${req.url}`);
    if (req.url && (req.url.startsWith("/api/ws") || req.url.startsWith("/ws"))) {
      proxyMiddleware.upgrade(req, socket as any, head);
    } else {
      socket.destroy();
    }
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Proxy target: ${targetUrl}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
