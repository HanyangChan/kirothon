import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import cors from "cors";
import FormData from "form-data";
import fs from "fs";

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

  // Pushover API
  app.post("/api/pushover", async (req, res) => {
    const { userKey, appToken, title, message, url, url_title, imageName } = req.body;
    
    if (!userKey || !appToken || !message) {
      return res.status(400).json({ error: "Missing required Pushover parameters" });
    }

    try {
      const form = new FormData();
      form.append("token", appToken);
      form.append("user", userKey);
      form.append("title", title);
      form.append("message", message);
      form.append("sound", "pushover");
      if (url) form.append("url", url);
      if (url_title) form.append("url_title", url_title);

      if (imageName) {
        // Find image path in public/characters folder
        const imagePath = path.join(process.cwd(), "public", "characters", imageName);
        if (fs.existsSync(imagePath)) {
          form.append("attachment", fs.createReadStream(imagePath));
        }
      }

      const response = await axios.post("https://api.pushover.net/1/messages.json", form, {
        headers: form.getHeaders(),
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("Pushover API Error:", error.response?.data || error.message);
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
