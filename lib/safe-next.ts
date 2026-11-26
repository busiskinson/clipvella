/** Only same-origin relative paths are allowed as post-login redirects (blocks //host, /\host, schemes). */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\s]/.test(next.slice(0, 3))) return "/";
  try {
    const base = "https://clipvella.invalid";
    const url = new URL(next, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}
