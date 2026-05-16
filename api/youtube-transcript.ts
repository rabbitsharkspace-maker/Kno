import { VercelRequest, VercelResponse } from '@vercel/node';
import { getSubtitles } from 'youtube-captions-scraper';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers explicitly
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*'); // Or restrict to your frontend domain
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
     return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'Missing url in body' });
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
          lang: 'en'
        });
        const text = transcript.map((t: any) => t.text).join(' ');
        res.status(200).json({ text });
    } catch (err: any) {
        // fallback
        console.warn(`Transcript failed for ${videoId}, falling back to Jina:`, err.message);
        const response = await fetch(`https://r.jina.ai/${url}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch transcript and fallback failed: ${response.statusText}`);
        }
        const text = await response.text();
        res.json({ text: `[Note: Transcript unavailable, using video metadata]\n\n${text}` });
    }
  } catch (error: any) {
    console.error("Youtube Transcript Error:", error);
    res.status(500).json({ error: error.message || 'Failed to fetch transcript' });
  }
}
