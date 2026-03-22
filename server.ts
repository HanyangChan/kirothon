import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());

  // Canvas API Proxy
  app.post("/api/canvas/proxy", async (req, res) => {
    const { canvasUrl, apiToken, endpoint, method = "GET", params = {} } = req.body;

    if (!canvasUrl || !apiToken || !endpoint) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    try {
      const url = `${canvasUrl.replace(/\/$/, "")}/api/v1/${endpoint.replace(/^\//, "")}`;
      const response = await axios({
        method,
        url,
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
        params,
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("Canvas API Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: error.message });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
