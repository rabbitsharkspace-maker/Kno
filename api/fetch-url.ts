import { VercelRequest, VercelResponse } from '@vercel/node';
import { safeFetch, readCapped } from './_safe-url';

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
  }

  /*
   * This used to hand whatever arrived straight to `fetch`. Anyone who could
   * reach the endpoint could therefore make this server open any address it
   * could reach — the loopback interface, the private network around it, and
   * the link-local address every major cloud parks its instance credentials
   * on — and read the answer back out of the response.
   *
   * `safeFetch` resolves the host first and refuses those ranges, and does it
   * again on every redirect. The timeout and the byte cap are for the other
   * half of it: a request that never ends, or a file with no end to it.
   */
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Missing url in body' });
    }
    const response = await safeFetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 Config' },
      signal: controller.signal,
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }
    const text = await readCapped(response, MAX_BYTES);
    res.status(200).json({ text });
  } catch (error: any) {
    console.error("Fetch URL Error:", error);
    res.status(500).json({ error: error.message || 'Failed to fetch URL' });
  } finally {
    clearTimeout(timer);
  }
}
