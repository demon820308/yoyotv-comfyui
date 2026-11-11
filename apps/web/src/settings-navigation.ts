export type SettingsSection =
  | "appearance"
  | "storage"
  | "connections"
  | "remote-projects"
  | "diagnostics"
  | "about";
export function openSettings(section: SettingsSection = "appearance") {
  window.dispatchEvent(new CustomEvent("yoyotv:open-settings", { detail: section }));
}
