const MINI_APP_CSP = [
  "default-src 'none'",
  "base-uri 'none'",
  "connect-src 'none'",
  "font-src data:",
  "form-action 'none'",
  "frame-src 'none'",
  "img-src data: blob:",
  "media-src data: blob:",
  "object-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
].join('; ');

const CANOPY_BRIDGE = `
<script>
(function () {
  "use strict";
  function emit(action, data) {
    if (typeof action !== "string" || action.length === 0 || action.length > 100) return;
    var message = JSON.stringify({ type: "canopy_action", action: action, data: data == null ? {} : data });
    if (message.length > 32768) return;
    window.ReactNativeWebView.postMessage(message);
  }
  Object.defineProperty(window, "Canopy", {
    value: Object.freeze({ emit: emit, postMessage: emit }),
    configurable: false,
    writable: false
  });
  window.addEventListener("canopy:action", function (event) {
    var detail = event && event.detail ? event.detail : {};
    emit(detail.action, detail.data);
  });
})();
</script>`;

const SECURITY_HEAD = `
<meta http-equiv="Content-Security-Policy" content="${MINI_APP_CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  :root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  html, body { margin: 0; min-height: 100%; background: #fff; color: #1f2937; }
  body { box-sizing: border-box; padding: 12px; }
  *, *::before, *::after { box-sizing: inherit; }
</style>
${CANOPY_BRIDGE}`;

export function buildSandboxedMiniAppHtml(rawHtml: string): string {
  const html = typeof rawHtml === 'string' ? rawHtml : '';
  if (/<head[\s>]/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${SECURITY_HEAD}`);
  }
  if (/<html[\s>]/i.test(html)) {
    return html.replace(/<html([^>]*)>/i, `<html$1><head>${SECURITY_HEAD}</head>`);
  }
  return `<!doctype html><html><head>${SECURITY_HEAD}</head><body>${html}</body></html>`;
}

export function parseMiniAppMessage(raw: string): { action: string; data: unknown } | null {
  if (!raw || raw.length > 32_768) return null;
  try {
    const message = JSON.parse(raw);
    if (message?.type !== 'canopy_action') return null;
    if (typeof message.action !== 'string') return null;
    if (!/^[a-zA-Z0-9_.:-]{1,100}$/.test(message.action)) return null;
    return { action: message.action, data: message.data ?? {} };
  } catch {
    return null;
  }
}

export function isAllowedMiniAppNavigation(url: string): boolean {
  return url === 'about:blank' || url.startsWith('about:blank#');
}
