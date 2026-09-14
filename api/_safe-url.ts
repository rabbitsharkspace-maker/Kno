import { promises as dns } from 'dns';
import net from 'net';

/*
 * Guards for a URL that came from whoever is on the other end of the request.
 *
 * `fetch-url` exists so Kno can read a page somebody pasted, which means it
 * cannot work from a list of allowed sites — the whole point is that the site is
 * one we have never seen. What it can refuse is an address that was never meant
 * to be reachable from outside: the loopback interface, the private ranges of
 * whatever network the function is running on, and the link-local address every
 * major cloud parks its instance credentials on.
 *
 * The check is on the resolved address rather than the hostname, because a name
 * anyone controls can be pointed at 127.0.0.1 — and it runs again on every
 * redirect, because a public URL is free to send you somewhere private on the
 * second hop.
 */

const BLOCKED_V4 = [
  [0, 8],          // 0.0.0.0/8      this network
  [10, 8],         // 10.0.0.0/8     private
  [127, 8],        // 127.0.0.0/8    loopback
  [169, 16, 254],  // 169.254.0.0/16 link-local, and cloud instance metadata
  [172, 12],       // 172.16.0.0/12  private
  [192, 16, 168],  // 192.168.0.0/16 private
  [100, 10],       // 100.64.0.0/10  carrier NAT
  [192, 24, 0, 2], // 192.0.2.0/24   documentation
] as const;

function v4Blocked(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function v6Blocked(ip: string): boolean {
  const s = ip.toLowerCase();
  if (s === '::' || s === '::1') return true;
  if (s.startsWith('fe80') || s.startsWith('fc') || s.startsWith('fd')) return true;
  // ::ffff:127.0.0.1 and friends
  const mapped = s.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? v4Blocked(mapped[1]) : false;
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Not a URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https are supported');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host)
    ? [{ address: host, family: net.isIP(host) }]
    : await dns.lookup(host, { all: true });
  if (!addresses.length) throw new Error('Host does not resolve');
  for (const { address, family } of addresses) {
    const blocked = family === 6 ? v6Blocked(address) : v4Blocked(address);
    if (blocked) throw new Error('That address is not reachable from here');
  }
  return url;
}

/* Follows redirects by hand so every hop is checked, not only the first. */
export async function safeFetch(raw: string, init: RequestInit = {}, maxHops = 3): Promise<Response> {
  let target = raw;
  for (let hop = 0; hop <= maxHops; hop++) {
    await assertPublicUrl(target);
    const response = await fetch(target, { ...init, redirect: 'manual' });
    if (response.status < 300 || response.status > 399) return response;
    const next = response.headers.get('location');
    if (!next) return response;
    target = new URL(next, target).toString();
  }
  throw new Error('Too many redirects');
}

/* Reads at most `limit` bytes, so one enormous file cannot hold the function open. */
export async function readCapped(response: Response, limit: number): Promise<string> {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > limit) throw new Error('That page is too large to read');
  const reader = response.body?.getReader();
  if (!reader) return (await response.text()).slice(0, limit);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) { await reader.cancel(); throw new Error('That page is too large to read'); }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks.map(c => Buffer.from(c))));
}
