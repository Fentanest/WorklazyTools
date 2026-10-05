/** HTML text and quoted attributes share character escaping, but script JSON does not. */
export const escapeHtml = (value: string) => value.replace(/[&<>"']/gu, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const scriptJson = (value: unknown) => JSON.stringify(value).replace(/[<>&\u2028\u2029]/gu, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
export const utf8Bytes = (value: string) => new TextEncoder().encode(value).byteLength;
