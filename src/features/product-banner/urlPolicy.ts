/** Validate without rewriting the address that downstream exporters must preserve. */
export function validateProductUrl(raw: string, options: { allowLocalhost?: boolean } = {}): { valid: boolean; value: string } {
  const value = raw.trim();
  if (!value || /[\u0000-\u001f\u007f\s\\]/u.test(value) || !/^https:\/\//iu.test(value)) return { valid: false, value };
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return { valid: false, value };
    const host = url.hostname.toLowerCase().replace(/\.$/u, "").replace(/^\[|\]$/gu, "");
    const ipv6 = host.includes(":"), ipv4 = /^\d+\.\d+\.\d+\.\d+$/u.test(host);
    const loopback = host === "localhost" || host.endsWith(".localhost") || host === "::1" || /^127\./u.test(host);
    const localName = !host.includes(".") && !ipv6 || /\.(?:local|internal|lan|home|home\.arpa|test|invalid|example)$/u.test(host);
    const local4 = ipv4 && (/^(?:0|10|127)\./u.test(host) || /^192\.168\./u.test(host) || /^169\.254\./u.test(host) || /^172\.(?:1[6-9]|2\d|3[01])\./u.test(host) || /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./u.test(host) || Number(host.split(".")[0]) >= 224);
    // Mapped IPv4 addresses are rejected too, including URL's normalized hex spelling.
    const local6 = ipv6 && (host.startsWith("::") || /^(?:f[cd]|fe[89abcdef]|ff)/u.test(host));
    if ((loopback || localName || local4 || local6) && !(loopback && options.allowLocalhost)) return { valid: false, value };
    return { valid: true, value };
  } catch { return { valid: false, value }; }
}
