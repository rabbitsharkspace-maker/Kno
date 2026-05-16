import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { getSubtitles } from 'youtube-captions-scraper';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Fetch YouTube Transcript
  app.get("/api/youtube-transcript", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      // Extract video ID
      let videoId = "";
      try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes("youtube.com")) {
          videoId = urlObj.searchParams.get("v") || "";
        } else if (urlObj.hostname.includes("youtu.be")) {
          videoId = urlObj.pathname.slice(1);
        }
      } catch (e) {
        return res.status(400).json({ error: "Invalid URL format" });
      }

      if (!videoId) {
        return res.status(400).json({ error: "Could not extract video ID" });
      }

      try {
        const transcript = await getSubtitles({
          videoID: videoId,
          lang: 'en' // default lang
        });
        const fullText = transcript.map((t: any) => t.text).join(" ");
        res.json({ text: fullText });
      } catch (transcriptError: any) {
        console.warn(`Transcript failed for ${videoId}, falling back to Jina:`, transcriptError.message);
        // Fallback to Jina to at least get the title and description
        const response = await fetch(`https://r.jina.ai/${url}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch transcript and fallback failed: ${response.statusText}`);
        }
        const text = await response.text();
        res.json({ text: `[Note: Transcript unavailable, using video metadata]\n\n${text}` });
      }
    } catch (error: any) {
      console.error("YouTube Transcript Error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch transcript" });
    }
  });

  // Fetch generic URL content
  app.get("/api/fetch-url", async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      // Use Jina to extract markdown
      const response = await fetch(`https://r.jina.ai/${url}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch from Jina: ${response.statusText}`);
      }
      const text = await response.text();
      res.json({ text });
    } catch (error: any) {
      console.error("Fetch URL Error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch URL" });
    }
  });

  // Process Action (formerly Upgrade Plan Checkout)
  // Deprecated for offline logic
  app.post("/api/process-action", async (_req, res) => {
      res.json({ error: "Local version cannot process online checkouts" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
