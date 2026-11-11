import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { ToolDefinition } from "./nim";

const PAGE_TIMEOUT_MS = 15_000;
const MAX_PAGE_BYTES = 1_500_000;
// Every page read is fed back to the model, so long pages slow later calls until they time out.
const MAX_PAGE_CHARS = 4_000;
const MAX_REDIRECTS = 3;

export class ToolError extends Error {}

function isPrivateIPv4(address: string): boolean {
  const [a, b] = address.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

/** Expands any IPv6 text form (compressed, dotted IPv4 tail, zone id) into eight 16-bit groups. */
function ipv6Groups(address: string): number[] | null {
  let text = address.toLowerCase().split("%")[0];
  const dotted = text.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted[2].split(".").map(Number);
    text = `${dotted[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail].map((group) => parseInt(group, 16));
  return groups.length === 8 && groups.every((group) => Number.isInteger(group) && group >= 0 && group <= 0xffff) ? groups : null;
}

/** Loopback, private, link-local (incl. cloud metadata), CGNAT, unique-local and IPv6 transition ranges. */
export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const g = ipv6Groups(address);
    if (!g) return true; // Unparseable means unknown, so refuse it.
    const toV4 = (hi: number, lo: number) => `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
    // :: and ::1.
    if (g.slice(0, 7).every((group) => group === 0) && g[7] <= 1) return true;
    // IPv4-mapped (::ffff:a.b.c.d, in dotted or hex form), IPv4-compatible (::a.b.c.d) and SIIT (::ffff:0:a.b.c.d).
    if (g.slice(0, 5).every((group) => group === 0) && (g[5] === 0xffff || g[5] === 0)) return isPrivateIPv4(toV4(g[6], g[7]));
    if (g.slice(0, 4).every((group) => group === 0) && g[4] === 0xffff && g[5] === 0) return isPrivateIPv4(toV4(g[6], g[7]));
    if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
    if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
    if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((group) => group === 0)) return true; // 64:ff9b::/96 NAT64
    if (g[0] === 0x2002) return true; // 2002::/16 6to4
    return false;
  }
  return isPrivateIPv4(address);
}

// Search-result pages and "read it for me" proxies are ways around sites that block bots.
// Contestants search through web_search and respect sites that turn them away.
const PROXY_HOSTS = ["r.jina.ai", "12ft.io", "archive.ph", "archive.is", "archive.today", "webcache.googleusercontent.com"];
const SEARCH_ENGINES = /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com|search\.yahoo\.com|yandex\.[a-z]+|baidu\.com|startpage\.com|search\.brave\.com|ecosia\.org)$/;

function isScrapingWorkaround(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (PROXY_HOSTS.some((proxy) => host === proxy || host.endsWith(`.${proxy}`))) return true;
  return SEARCH_ENGINES.test(host) && /\/(search|html|lite|web|s)\b|[?&]q=/.test(`${url.pathname}${url.search}`);
}

// Contestants may only reach the public internet, never this machine or the local network.
async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ToolError("That is not a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new ToolError("Only http and https pages can be read.");
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new ToolError("Local and internal addresses are off limits.");
  }
  if (isScrapingWorkaround(url)) {
    throw new ToolError("Scraping search engines or reading through proxies is not allowed. Use web_search, and move on from sites that block you.");
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new ToolError(`Could not find ${host}.`);
  if (addresses.some((entry) => isPrivateAddress(entry.address))) throw new ToolError("Local and internal addresses are off limits.");
  return url;
}

function htmlToText(html: string): { title: string; text: string } {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
  const text = html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return { title, text };
}

/** Reads the body chunk by chunk and stops as soon as it passes the size cap, so a huge page is never held in memory. */
async function readCapped(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_PAGE_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new ToolError("The page is too large to read.");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_PAGE_BYTES) {
      await reader.cancel().catch(() => undefined);
      throw new ToolError("The page is too large to read.");
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

export async function readPage(rawUrl: string): Promise<string> {
  let url = await assertPublicUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": "Mozilla/5.0 (compatible; MissionControlContestant/1.0)", accept: "text/html,text/plain,application/json;q=0.9,*/*;q=0.5" },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new ToolError("The page redirected without saying where.");
        // Re-check every hop so a public page cannot bounce the reader onto a private address.
        url = await assertPublicUrl(new URL(location, url).toString());
        continue;
      }
      if (!response.ok) throw new ToolError(`The page returned ${response.status}.`);

      const type = response.headers.get("content-type") ?? "";
      if (!/text\/|json|xml/.test(type)) throw new ToolError(`That is a ${type || "binary"} file, not a readable page.`);

      const body = await readCapped(response);
      const { title, text } = type.includes("html") ? htmlToText(body) : { title: "", text: body };
      const clipped = text.length > MAX_PAGE_CHARS ? `${text.slice(0, MAX_PAGE_CHARS)}\n[page truncated]` : text;
      return `${title ? `Title: ${title}\n` : ""}URL: ${url.toString()}\n\n${clipped}`;
    } catch (error) {
      if (error instanceof ToolError) throw error;
      if (error instanceof Error && error.name === "AbortError") throw new ToolError("The page took too long to load.");
      throw new ToolError("The page could not be reached.");
    } finally {
      clearTimeout(timer);
    }
  }
  throw new ToolError("The page redirected too many times.");
}

export async function webSearch(query: string): Promise<string> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new ToolError("Web search is not set up yet.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ query, max_results: 5 }),
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) throw new ToolError("The search key was rejected.");
    if (response.status === 429 || response.status === 432) throw new ToolError("The free search quota is used up for now.");
    if (!response.ok) throw new ToolError(`Search returned ${response.status}.`);
    const payload = (await response.json()) as { results?: { title?: string; url?: string; content?: string }[] };
    const results = payload.results ?? [];
    if (results.length === 0) return "No results.";
    return results.map((result, index) => `${index + 1}. ${result.title ?? "Untitled"}\n${result.url ?? ""}\n${(result.content ?? "").slice(0, 500)}`).join("\n\n");
  } catch (error) {
    if (error instanceof ToolError) throw error;
    throw new ToolError("Search could not be reached.");
  } finally {
    clearTimeout(timer);
  }
}

const READ_PAGE: ToolDefinition = {
  type: "function",
  function: {
    name: "read_page",
    description: "Fetch a public web page and return its readable text. Use it to check real facts, prices and competitors.",
    parameters: { type: "object", properties: { url: { type: "string", description: "Full http or https URL" } }, required: ["url"] },
  },
};

const WEB_SEARCH: ToolDefinition = {
  type: "function",
  function: {
    name: "web_search",
    description: "Search the web and get the top results with short summaries and links.",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
};

/** Tools are only offered once they actually work, so a contestant never reaches for one that is not wired up. */
export function researchTools(): ToolDefinition[] {
  return process.env.TAVILY_API_KEY ? [WEB_SEARCH, READ_PAGE] : [READ_PAGE];
}

export async function runTool(name: string, rawArguments: string): Promise<string> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(rawArguments || "{}") as Record<string, unknown>;
  } catch {
    throw new ToolError("The tool arguments were not valid JSON.");
  }
  if (name === "read_page" && typeof args.url === "string") return readPage(args.url);
  if (name === "web_search" && typeof args.query === "string" && process.env.TAVILY_API_KEY) return webSearch(args.query);
  throw new ToolError(`There is no usable tool called ${name}.`);
}
