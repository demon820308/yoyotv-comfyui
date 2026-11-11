export type YoYoTVTheme = "noir" | "light" | "chroma";
// shortcut: TakeBoardTheme alias for backward compatibility, remove in v2.0.0
export type TakeBoardTheme = YoYoTVTheme;

// shortcut: legacy takeboard.theme / takeboard_theme read fallback for pre-rebrand browser storage, remove in v2.0.0
export const themeStorageKey = "yoyotv.theme";
const legacyThemeStorageKey = "takeboard.theme";
export const themeCookieName = "yoyotv_theme";
const legacyThemeCookieName = "takeboard_theme";
export const defaultTheme: YoYoTVTheme = "noir";
const themeChangeEvent = "yoyotv:theme";
let sessionTheme: YoYoTVTheme | null = null;

export function parseTheme(value: string | null | undefined): YoYoTVTheme | null {
  return value === "noir" || value === "light" || value === "chroma" ? value : null;
}

export function themeFromCookie(cookie: string): YoYoTVTheme | null {
  const entries = cookie.split(";").map((entry) => entry.trim());
  const current = entries
    .find((entry) => entry.startsWith(`${themeCookieName}=`))
    ?.slice(themeCookieName.length + 1);
  if (current !== undefined) return parseTheme(current);
  const legacy = entries
    .find((entry) => entry.startsWith(`${legacyThemeCookieName}=`))
    ?.slice(legacyThemeCookieName.length + 1);
  return parseTheme(legacy);
}

export function readThemePreference(): YoYoTVTheme {
  if (sessionTheme) return sessionTheme;
  // Desktop service ports may change on restart. Host-only cookies survive that
  // change, unlike origin-scoped localStorage. This contains only a theme enum,
  // never identity, authentication or project data.
  try {
    const cookieTheme = themeFromCookie(document.cookie);
    if (cookieTheme) return cookieTheme;
  } catch {
    // Sandboxed/blocked storage must not prevent the app from opening.
  }
  try {
    return (
      parseTheme(
        window.localStorage.getItem(themeStorageKey) ??
          window.localStorage.getItem(legacyThemeStorageKey),
      ) ?? defaultTheme
    );
  } catch {
    return parseTheme(document.documentElement.dataset.theme) ?? defaultTheme;
  }
}

export function rememberTheme(theme: YoYoTVTheme) {
  sessionTheme = theme;
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(themeStorageKey, theme);
  } catch {
    // The current session can still change appearance when storage is unavailable.
  }
  try {
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    // biome-ignore lint/suspicious/noDocumentCookie: Synchronous first paint and WKWebView compatibility; non-sensitive enum only.
    document.cookie = `${themeCookieName}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
  } catch {
    // localStorage is the fallback when cookies are blocked.
  }
  window.dispatchEvent(new Event(themeChangeEvent));
}

export function subscribeToTheme(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === themeStorageKey ||
      event.key === legacyThemeStorageKey ||
      event.key === null
    ) {
      sessionTheme = null;
      listener();
    }
  };
  window.addEventListener(themeChangeEvent, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(themeChangeEvent, listener);
    window.removeEventListener("storage", onStorage);
  };
}
