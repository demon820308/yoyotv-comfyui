import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type {
  ProjectBoardPreview,
  ProjectCatalogItem,
  TrashedProjectItem,
  WorkerStatus,
} from "./api";
import { projectApi } from "./api";
import { AccountButton, useAuth } from "./auth-ui";
import { DeviceIndicator } from "./device-indicator";
import { savedSceneQuality } from "./display-preferences";
import { DisplaySettings, type SceneQuality } from "./display-settings";
import { type ProjectLocationChoice, ProjectLocationPicker } from "./project-location-picker";
import { SettingsButton } from "./settings-center";
import { ThemeSwitcher } from "./theme-switcher";
import { VideoThumbnail } from "./video-preview";

const loadStudioUniverse = () =>
  import("./studio-universe").then((module) => ({ default: module.StudioUniverse }));
const StudioUniverse = lazy(loadStudioUniverse);
const OperationsCenter = lazy(() =>
  import("./operations-center").then((module) => ({ default: module.OperationsCenter })),
);
const GenerationConnectionPanel = lazy(() =>
  import("./generation-connection-panel").then((module) => ({
    default: module.GenerationConnectionPanel,
  })),
);

const hubChromeCss = `.hub-header {
  height: 64px;
  padding: 0 clamp(16px, 2.5vw, 36px);
  border-bottom: 1px solid var(--hub-line);
  background: color-mix(in srgb, var(--hub-surface) 96%, transparent);
  box-shadow: 0 4px 16px rgb(0 0 0 / 22%);
  backdrop-filter: blur(16px);
}

.hub-header-inner {
  width: min(100%, 1540px);
  height: 100%;
  margin: 0 auto;
}

.hub-header-actions {
  min-width: 0;
  padding: 4px;
  border: 1px solid var(--hub-line);
  border-radius: 8px;
  background: var(--hub-surface);
  box-shadow: 0 2px 8px rgb(0 0 0 / 18%);
  gap: 4px;
}

.hub-header-actions > :is(.hub-status-group, .hub-utility-control) {
  flex: none;
}

.hub-status-group {
  display: flex;
  height: 32px;
  align-items: stretch;
  padding: 2px;
  border: 1px solid var(--hub-line);
  border-radius: 6px;
  background: var(--hub-surface-raised);
}

.hub-status-divider {
  width: 1px;
  height: 20px;
  align-self: center;
  background: color-mix(in srgb, var(--hub-line) 86%, transparent);
}

.hub-brand {
  min-width: 0;
}

.hub-brand > div {
  min-width: 0;
}

.hub-brand strong {
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.hub-brand span:last-child {
  color: var(--hub-muted);
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.08em;
}

.hub-brand .brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--hub-accent) 55%, var(--hub-line));
  border-radius: 6px;
  color: var(--hub-accent);
  background: var(--hub-surface-raised);
  font-family: Inter, -apple-system, sans-serif;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  box-shadow: 0 2px 6px rgb(0 0 0 / 26%);
}

.hub-header .hub-status-group .operations-control.is-compact .operations-pill {
  min-width: 110px;
  height: 32px;
  padding: 0 10px;
  border: 0;
  border-radius: 8px;
  color: var(--hub-copy);
  background: transparent;
}

.hub-header .hub-status-group .operations-pill:hover,
.hub-header .hub-status-group .operations-pill[aria-expanded="true"] {
  background: color-mix(in srgb, var(--hub-surface-raised) 78%, transparent);
}

.hub-header .worker-pill {
  display: flex;
  width: auto;
  min-width: 128px;
  height: 32px;
  min-height: 32px;
  padding: 0 9px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  gap: 8px;
}

.hub-header .worker-pill > div {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.hub-header .worker-pill strong,
.hub-header .worker-pill span {
  line-height: 1;
}

.hub-header .worker-pill span {
  color: var(--hub-muted);
  font-size: calc(9px * var(--ui-scale));
}

.hub-header .worker-pill > b {
  font-size: 9px;
}

.worker-engine-mark {
  display: none;
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.25;
}

.hub-header .account-button.compact,
.hub-utility-trigger {
  width: 40px;
  min-width: 40px;
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  color: var(--text-1);
  background: transparent;
}

.hub-header .account-button.compact {
  display: flex;
  align-items: center;
  justify-content: center;
  grid-template-rows: none;
  line-height: 1;
}

.hub-header .account-button.compact > span {
  margin: 0;
  grid-row: auto;
}

.hub-header-create {
  display: inline-flex;
  min-width: 108px;
  height: 40px;
  align-items: center;
  justify-content: center;
  padding: 0 15px;
  border: 1px solid color-mix(in srgb, var(--hub-accent) 62%, var(--hub-line));
  border-radius: 10px;
  color: color-mix(in srgb, var(--hub-accent) 52%, var(--hub-copy));
  background:
    linear-gradient(145deg, color-mix(in srgb, white 8%, transparent), transparent 48%),
    color-mix(in srgb, var(--hub-accent) 13%, var(--hub-surface));
  box-shadow: 0 8px 22px color-mix(in srgb, var(--hub-accent) 11%, transparent);
  gap: 6px;
}

.hub-header-create b {
  font-size: calc(10px * var(--ui-scale));
  font-weight: 620;
}

.hub-header-create:hover {
  border-color: var(--hub-accent);
  background: color-mix(in srgb, var(--hub-accent) 18%, var(--hub-surface-raised));
}

.hub-utility-control {
  position: relative;
}

.hub-utility-trigger {
  display: grid;
  place-items: center;
  cursor: pointer;
}

.hub-utility-trigger svg {
  width: 18px;
  height: 18px;
  fill: var(--hub-bg);
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.35;
}

.hub-utility-trigger:hover,
.hub-utility-trigger[aria-expanded="true"] {
  border-color: var(--accent);
  background: var(--surface-2);
}

.hub-utility-panel {
  position: absolute;
  z-index: 380;
  top: calc(100% + 8px);
  right: 0;
  display: grid;
  width: min(360px, calc(100vw - 24px));
  max-height: calc(100dvh - 88px);
  overflow: auto;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 15px;
  color: var(--text-1);
  background: color-mix(in srgb, var(--surface-1) 97%, transparent);
  box-shadow: 0 28px 80px rgb(0 0 0 / 38%);
  backdrop-filter: blur(26px) saturate(120%);
  gap: 7px;
}

.hub-utility-panel > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 8px 10px;
}

.hub-utility-panel > header > div {
  display: grid;
  gap: 2px;
}

.hub-utility-panel > header strong {
  font-size: calc(14px * var(--ui-scale));
}

.hub-utility-panel > header span,
.hub-utility-section > span {
  color: var(--faint);
  font-size: calc(9px * var(--ui-scale));
}

.hub-utility-panel > header button {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  color: var(--text-2);
  background: transparent;
  cursor: pointer;
  font-size: 18px;
}

.hub-utility-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
}

.hub-utility-actions > button {
  display: flex;
  min-width: 0;
  min-height: 44px;
  align-items: center;
  padding: 10px 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  color: var(--text-2);
  background: color-mix(in srgb, var(--surface-2) 72%, transparent);
  cursor: pointer;
  font-size: calc(13px * var(--ui-scale));
  gap: 12px;
}

.hub-utility-actions > button:hover:not(:disabled) {
  border-color: var(--accent);
  color: var(--text-1);
}

.hub-utility-actions > button span {
  color: var(--accent-strong);
  font-size: 17px;
}

.hub-utility-section {
  display: grid;
  padding: 18px 0 0;
  border-top: 1px solid var(--line);
  gap: 12px;
}

.hub-utility-settings {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.hub-utility-section .theme-switcher {
  display: flex;
  width: 100%;
  margin: 0;
  min-width: 0;
}
.hub-utility-panel .hub-utility-section .theme-switcher button {
  flex: 1;
  width: auto;
  min-height: 42px;
  justify-content: center;
  font: inherit;
}
.hub-utility-panel .hub-utility-section .theme-switcher span {
  display: inline;
}
.hub-utility-settings :is(button, .display-settings) {
  width: 100%;
  min-width: 0;
}
.hub-utility-panel .hub-utility-settings button {
  min-height: 38px;
  padding: 8px;
  justify-content: center;
  font-size: calc(11px * var(--ui-scale));
  gap: 8px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface-2);
}

.worker-panel {
  position: absolute !important;
  top: calc(100% + 8px) !important;
  right: 0 !important;
  max-height: calc(100dvh - 88px) !important;
  overflow: auto !important;
}

@media (max-width: 1040px) {
  .hub-brand span:last-child,
  .hub-header .worker-pill span {
    display: none;
  }

  .hub-header .worker-pill {
    min-width: 94px;
  }
}

@media (max-width: 820px) {
  .hub-header .hub-status-group .operations-control.is-compact .operations-pill {
    min-width: 36px;
    width: 36px;
    padding: 0;
  }

  .hub-header .operations-compact-label,
  .hub-header .worker-pill span {
    display: none;
  }

  .hub-header .worker-pill {
    min-width: 84px;
  }

  .hub-header-create {
    width: 40px;
    min-width: 40px;
    padding: 0;
  }

  .hub-header-create b {
    display: none;
  }
}

@media (max-width: 640px) {
  .hub-header {
    height: 60px;
    padding-inline: 9px;
  }

  .hub-header-actions {
    gap: 5px;
  }

  .hub-brand .brand-mark {
    width: 30px;
    height: 30px;
  }

  .hub-brand strong {
    font-size: calc(13px * var(--ui-scale));
  }

  .hub-header .worker-pill {
    width: 36px;
    min-width: 36px;
    justify-content: center;
    padding: 0;
  }

  .hub-header .worker-pill > div,
  .hub-header .worker-pill > b {
    display: none;
  }

  .hub-header .worker-pill {
    position: relative;
  }

  .hub-header .worker-pill .worker-engine-mark {
    display: block;
  }

  .hub-header .worker-pill > i {
    position: absolute;
    right: 5px;
    bottom: 5px;
    width: 5px;
    height: 5px;
    border: 1px solid var(--hub-surface);
  }

  .hub-header-create span {
    margin: 0;
    font-size: 18px;
  }

  .hub-utility-panel {
    top: calc(100% + 8px) !important;
    right: 0 !important;
    left: auto !important;
    width: min(360px, calc(100vw - 16px)) !important;
    max-height: calc(100dvh - 74px) !important;
  }
  .worker-panel {
    position: fixed !important;
    top: 70px !important;
    right: 10px !important;
    left: 10px !important;
    width: auto !important;
    max-height: calc(100dvh - 90px) !important;
  }
}

@media (max-width: 470px) {
  .hub-brand > div {
    display: none;
  }

  .hub-status-divider {
    display: none;
  }
}

/* The 3D stage remains the backdrop; the project chapter itself carries the translucent veil. */
.hub-shell .hub-artifact-background {
  opacity: 1;
  filter: none;
  transform: none;
}

.hub-shell .hub-projects::before {
  background:
    radial-gradient(
      ellipse at 74% 5%,
      color-mix(in srgb, var(--hub-sage) 9%, transparent),
      transparent 32%
    ),
    radial-gradient(
      ellipse at 9% 62%,
      color-mix(in srgb, var(--hub-accent) 7%, transparent),
      transparent 34%
    ),
    linear-gradient(
      to bottom,
      color-mix(in srgb, var(--hub-bg) 62%, transparent),
      color-mix(in srgb, var(--hub-bg) 76%, transparent) 260px,
      color-mix(in srgb, var(--hub-bg) 84%, transparent)
  );
  box-shadow: 0 -24px 72px color-mix(in srgb, var(--hub-bg) 22%, transparent);
  backdrop-filter: none;
}

.hub-shell .hub-section-heading {
  background: linear-gradient(
    to bottom,
    color-mix(in srgb, var(--hub-bg) 84%, transparent),
    color-mix(in srgb, var(--hub-bg) 68%, transparent)
  );
}

.hub-hero.hub-object-hero.has-recent-project {
  min-height: auto !important;
  padding: 24px 0 12px !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  z-index: 5 !important;
  width: var(--hub-layout-width);
  pointer-events: auto !important;
}

.hero-recent-container,
.hero-recent-card,
.hero-recent-resume-btn {
  pointer-events: auto !important;
}

.hero-recent-container {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.hero-recent-card {
  width: 100%;
  padding: 22px 28px;
  border-radius: 12px;
  border: 1px solid var(--hub-line);
  background: var(--hub-surface);
  box-shadow: 0 6px 24px color-mix(in srgb, black 6%, transparent);
  cursor: pointer;
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hero-recent-card:hover,
.hero-recent-card:focus-visible {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--hub-accent) 45%, var(--hub-line));
  box-shadow: 0 12px 36px color-mix(in srgb, black 10%, transparent);
  outline: none;
}

.hero-recent-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hero-recent-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--hub-accent);
  font-weight: 600;
}

.hero-recent-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--hub-accent);
  box-shadow: 0 0 6px var(--hub-accent);
}

.hero-recent-time {
  font-size: 12px;
  color: var(--hub-muted);
}

.hero-recent-main {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.hero-recent-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.hero-recent-title {
  margin: 0;
  font-size: clamp(22px, 2.2vw, 32px);
  font-weight: 600;
  color: var(--hub-copy);
  letter-spacing: -0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hero-recent-meta {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--hub-muted);
}

.hero-recent-dot {
  opacity: 0.45;
}

.hero-recent-running {
  color: #10b981;
  font-weight: 500;
}

.hero-recent-resume-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 22px;
  border-radius: 99px;
  background: var(--hub-accent);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: filter 150ms ease, transform 150ms ease;
  box-shadow: 0 3px 12px color-mix(in srgb, var(--hub-accent) 28%, transparent);
}

.hero-recent-resume-btn:hover {
  filter: brightness(1.08);
  transform: scale(1.02);
}

.hero-recent-resume-btn:disabled {
  opacity: 0.6;
  cursor: wait;
  transform: none;
  filter: none;
}

.hub-object-hero.has-recent-project + .hub-projects {
  padding-top: 14px !important;
  opacity: 1 !important;
  transform: translateY(0) !important;
}

@media (max-width: 768px) {
  .hero-recent-main {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }
  .hero-recent-resume-btn {
    width: 100%;
    justify-content: center;
  }
}

.project-card-cover-wrapper {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.project-card-cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
  transition: transform 320ms cubic-bezier(0.2, 0, 0, 1);
}

.project-card:hover .project-card-cover-image {
  transform: scale(1.03);
}

.project-card-cover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.2) 0%, transparent 40%, rgba(0, 0, 0, 0.72) 100%);
  pointer-events: none;
}

.hero-recent-card.has-cover-bg {
  position: relative;
  overflow: hidden;
}

.hero-recent-cover-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  pointer-events: none;
}

.hero-recent-cover-bg img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  opacity: 0.22;
  filter: blur(1px);
  transform: scale(1.05);
}

.hero-recent-cover-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, var(--hub-surface) 30%, rgba(20, 24, 22, 0.75) 100%);
}

.hero-recent-card.has-cover-bg > :not(.hero-recent-cover-bg) {
  position: relative;
  z-index: 1;
}

/* Cover Modal */
.project-cover-modal {
  width: min(580px, calc(100vw - 32px));
  max-height: 85vh;
  overflow-y: auto;
  padding: 28px;
  border: 1px solid var(--hub-line);
  border-radius: 12px;
  color: var(--hub-copy);
  background: var(--hub-surface);
  box-shadow: 0 40px 120px rgba(0, 0, 0, 0.55);
}

.cover-modal-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin: 20px 0;
}

.cover-upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  border: 1px dashed var(--hub-line);
  border-radius: 8px;
  background: color-mix(in srgb, var(--hub-surface-raised) 50%, transparent);
  text-align: center;
  cursor: pointer;
  transition: border-color 160ms ease, background-color 160ms ease;
}

.cover-upload-zone:hover,
.cover-upload-zone:focus-visible {
  border-color: var(--hub-accent);
  background: color-mix(in srgb, var(--hub-accent) 8%, var(--hub-surface));
  outline: none;
}

.cover-upload-icon {
  width: 32px;
  height: 32px;
  margin-bottom: 8px;
  color: var(--hub-accent);
}

.cover-upload-icon svg {
  width: 100%;
  height: 100%;
}

.cover-upload-zone strong {
  font-size: 14px;
  color: var(--hub-copy);
  margin-bottom: 4px;
}

.cover-upload-zone p {
  margin: 0;
  font-size: 11px;
  color: var(--hub-muted);
}

.cover-browse-btn {
  margin-top: 12px;
  padding: 6px 16px;
  border-radius: 6px;
  border: 1px solid var(--hub-line);
  background: var(--hub-surface-raised);
  color: var(--hub-copy);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: 150ms ease;
}

.cover-browse-btn:hover {
  border-color: var(--hub-accent);
  color: var(--hub-accent);
}

.cover-board-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cover-picker-title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--hub-muted);
  text-transform: uppercase;
}

.cover-asset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
  padding: 2px;
}

.cover-asset-card {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--hub-line);
  background: #000;
  padding: 0;
  cursor: pointer;
  transition: border-color 150ms ease, transform 150ms ease;
}

.cover-asset-card:hover,
.cover-asset-card:focus-visible {
  border-color: var(--hub-accent);
  transform: translateY(-1px);
  outline: none;
}

.cover-asset-card img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.cover-asset-card-label {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 2px 4px;
  font-size: 9px;
  font-weight: 500;
  color: #fff;
  background: linear-gradient(to top, rgba(0,0,0,0.85), transparent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.cover-modal-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
}

.cover-remove-btn {
  padding: 8px 14px;
  border-radius: 6px;
  border: 1px solid color-mix(in srgb, var(--red, #e05252) 40%, var(--hub-line));
  background: transparent;
  color: var(--red, #e05252);
  font-size: 12px;
  cursor: pointer;
  transition: 150ms ease;
}

.cover-remove-btn:hover {
  background: color-mix(in srgb, var(--red, #e05252) 12%, transparent);
}

.cover-cancel-btn {
  padding: 8px 18px;
  border-radius: 6px;
  border: 1px solid var(--hub-line);
  background: var(--hub-surface-raised);
  color: var(--hub-copy);
  font-size: 13px;
  cursor: pointer;
  transition: 150ms ease;
}

.cover-cancel-btn:hover {
  border-color: var(--hub-accent);
  color: var(--hub-accent);
}
}`;

const companionMessages = {
  crew: "已打板",
  lens: "焦点确认",
  dragonfly: "收音就位",
  moth: "分镜标记",
} as const;

function CrewSlateGraphic({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      className="companion-svg companion-slate"
      aria-hidden="true"
    >
      <circle
        cx="60"
        cy="60"
        r="54"
        fill="none"
        stroke="var(--hub-accent)"
        strokeWidth="1"
        strokeDasharray="3 4"
        opacity={active ? 0.8 : 0.25}
      />
      <rect
        x="16"
        y="44"
        width="88"
        height="60"
        rx="6"
        fill="var(--hub-surface-raised)"
        stroke="var(--hub-line)"
        strokeWidth="1.5"
      />
      <rect x="22" y="49" width="76" height="13" rx="3" fill="var(--hub-bg)" opacity="0.7" />
      <circle cx="28" cy="55.5" r="2.8" fill={active ? "var(--hub-sage)" : "var(--hub-accent)"} />
      <text
        x="35"
        y="58"
        fill="var(--hub-copy)"
        fontSize="6"
        fontFamily="ui-monospace, monospace"
        fontWeight="600"
        letterSpacing="0.08em"
      >
        YOYO CINEMA
      </text>
      <text
        x="92"
        y="58"
        textAnchor="end"
        fill="var(--hub-accent)"
        fontSize="5.5"
        fontFamily="ui-monospace, monospace"
      >
        SYNC
      </text>

      <line
        x1="22"
        y1="66"
        x2="98"
        y2="66"
        stroke="var(--hub-line)"
        strokeWidth="1"
        opacity="0.6"
      />
      <line
        x1="47"
        y1="66"
        x2="47"
        y2="81"
        stroke="var(--hub-line)"
        strokeWidth="1"
        opacity="0.6"
      />
      <line
        x1="73"
        y1="66"
        x2="73"
        y2="81"
        stroke="var(--hub-line)"
        strokeWidth="1"
        opacity="0.6"
      />

      <text
        x="25"
        y="72"
        fill="var(--hub-muted)"
        fontSize="4.8"
        fontFamily="ui-monospace, monospace"
      >
        SCENE
      </text>
      <text
        x="34"
        y="79"
        fill="var(--hub-copy)"
        fontSize="6.5"
        fontWeight="bold"
        fontFamily="ui-monospace, monospace"
      >
        04
      </text>
      <text
        x="51"
        y="72"
        fill="var(--hub-muted)"
        fontSize="4.8"
        fontFamily="ui-monospace, monospace"
      >
        TAKE
      </text>
      <text
        x="60"
        y="79"
        fill="var(--hub-accent)"
        fontSize="6.5"
        fontWeight="bold"
        fontFamily="ui-monospace, monospace"
      >
        02
      </text>
      <text
        x="77"
        y="72"
        fill="var(--hub-muted)"
        fontSize="4.8"
        fontFamily="ui-monospace, monospace"
      >
        FPS
      </text>
      <text
        x="85"
        y="79"
        fill="var(--hub-copy)"
        fontSize="6.5"
        fontWeight="bold"
        fontFamily="ui-monospace, monospace"
      >
        24
      </text>

      <rect
        x="22"
        y="84"
        width="76"
        height="14"
        rx="3"
        fill="var(--hub-bg)"
        stroke="var(--hub-line)"
        strokeWidth="1"
      />
      <text
        x="60"
        y="93.5"
        textAnchor="middle"
        fill={active ? "var(--hub-sage)" : "var(--hub-accent)"}
        fontSize="7.5"
        fontFamily="ui-monospace, monospace"
        fontWeight="bold"
        letterSpacing="0.08em"
      >
        {active ? "00:00:01:00" : "01:24:32:18"}
      </text>

      <g className={`slate-clapper-stick ${active ? "is-slapped" : ""}`}>
        <rect
          x="14"
          y="27"
          width="92"
          height="15"
          rx="3"
          fill="var(--hub-surface)"
          stroke="var(--hub-line)"
          strokeWidth="1.5"
        />
        <line x1="28" y1="27" x2="36" y2="42" stroke="var(--hub-accent)" strokeWidth="4" />
        <line x1="46" y1="27" x2="54" y2="42" stroke="var(--hub-accent)" strokeWidth="4" />
        <line x1="64" y1="27" x2="72" y2="42" stroke="var(--hub-accent)" strokeWidth="4" />
        <line x1="82" y1="27" x2="90" y2="42" stroke="var(--hub-accent)" strokeWidth="4" />
        <circle
          cx="20"
          cy="34.5"
          r="3.5"
          fill="var(--hub-surface-raised)"
          stroke="var(--hub-copy)"
          strokeWidth="1"
        />
        <circle cx="20" cy="34.5" r="1.2" fill="var(--hub-accent)" />
      </g>
    </svg>
  );
}

function LensOpticsGraphic({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      className="companion-svg companion-lens"
      aria-hidden="true"
    >
      <circle
        cx="60"
        cy="60"
        r="54"
        fill="none"
        stroke="var(--hub-line)"
        strokeWidth="1.8"
        strokeDasharray="3 3"
        opacity="0.65"
      />
      <circle
        cx="60"
        cy="60"
        r="48"
        fill="var(--hub-surface-raised)"
        stroke="var(--hub-line)"
        strokeWidth="1.5"
      />

      <circle
        cx="60"
        cy="60"
        r="41"
        fill="none"
        stroke="var(--hub-accent)"
        strokeWidth="0.8"
        opacity="0.5"
        strokeDasharray="1 7"
      />
      <text
        x="60"
        y="23"
        textAnchor="middle"
        fill="var(--hub-accent)"
        fontSize="4.5"
        fontFamily="ui-monospace, monospace"
        letterSpacing="0.06em"
      >
        35mm T1.5
      </text>
      <text
        x="60"
        y="103"
        textAnchor="middle"
        fill="var(--hub-muted)"
        fontSize="4.5"
        fontFamily="ui-monospace, monospace"
      >
        Ø 95mm
      </text>
      <text
        x="23"
        y="62"
        textAnchor="middle"
        fill="var(--hub-muted)"
        fontSize="4.5"
        fontFamily="ui-monospace, monospace"
      >
        1.2m
      </text>
      <text
        x="97"
        y="62"
        textAnchor="middle"
        fill="var(--hub-accent)"
        fontSize="4.5"
        fontFamily="ui-monospace, monospace"
      >
        ∞
      </text>

      <g className={`lens-iris-assembly ${active ? "is-focused" : ""}`}>
        <circle
          cx="60"
          cy="60"
          r="32"
          fill="var(--hub-surface)"
          stroke="var(--hub-line)"
          strokeWidth="1.2"
        />
        <path
          d="M 44 48 L 76 48 L 68 72 L 36 72 Z"
          fill="none"
          stroke="var(--hub-line)"
          strokeWidth="1"
          opacity="0.7"
        />
        <path
          d="M 48 40 L 72 40 L 80 66 L 56 66 Z"
          fill="none"
          stroke="var(--hub-accent)"
          strokeWidth="1"
          opacity="0.4"
        />
        <circle
          cx="60"
          cy="60"
          r="16"
          fill="var(--hub-bg)"
          stroke={active ? "var(--hub-sage)" : "var(--hub-accent)"}
          strokeWidth="1.5"
        />
      </g>

      <line
        x1="60"
        y1="47"
        x2="60"
        y2="54"
        stroke={active ? "var(--hub-sage)" : "var(--hub-copy)"}
        strokeWidth="1"
      />
      <line
        x1="60"
        y1="66"
        x2="60"
        y2="73"
        stroke={active ? "var(--hub-sage)" : "var(--hub-copy)"}
        strokeWidth="1"
      />
      <line
        x1="47"
        y1="60"
        x2="54"
        y2="60"
        stroke={active ? "var(--hub-sage)" : "var(--hub-copy)"}
        strokeWidth="1"
      />
      <line
        x1="66"
        y1="60"
        x2="73"
        y2="60"
        stroke={active ? "var(--hub-sage)" : "var(--hub-copy)"}
        strokeWidth="1"
      />
      <circle cx="60" cy="60" r="2.5" fill={active ? "var(--hub-sage)" : "var(--hub-accent)"} />

      <ellipse
        cx="60"
        cy="60"
        rx="36"
        ry="6"
        fill="none"
        stroke="var(--hub-sage)"
        strokeWidth="0.8"
        opacity={active ? 0.75 : 0.28}
        transform="rotate(-25 60 60)"
      />
    </svg>
  );
}

function BoomSoundGraphic({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      className="companion-svg companion-sound"
      aria-hidden="true"
    >
      <path
        d="M 30 70 A 38 38 0 1 1 90 70"
        fill="none"
        stroke="var(--hub-line)"
        strokeWidth="1"
        strokeDasharray="2 3"
        opacity="0.6"
      />
      <path
        d="M 40 70 A 26 26 0 1 1 80 70"
        fill="none"
        stroke="var(--hub-sage)"
        strokeWidth="1"
        strokeDasharray="3 3"
        opacity={active ? 0.8 : 0.35}
      />

      <path
        d="M 46 26 A 18 18 0 0 1 74 26"
        fill="none"
        stroke="var(--hub-accent)"
        strokeWidth="1.2"
        opacity={active ? 0.9 : 0.3}
        className="sound-wave-1"
      />
      <path
        d="M 40 18 A 26 26 0 0 1 80 18"
        fill="none"
        stroke="var(--hub-accent)"
        strokeWidth="1"
        opacity={active ? 0.6 : 0.15}
        className="sound-wave-2"
      />

      <rect
        x="54"
        y="32"
        width="12"
        height="52"
        rx="6"
        fill="var(--hub-surface-raised)"
        stroke="var(--hub-line)"
        strokeWidth="1.2"
      />
      {[-8, -4, 0, 4, 8, 12, 16].map((offset) => (
        <line
          key={offset}
          x1="56"
          y1={52 + offset}
          x2="64"
          y2={52 + offset}
          stroke="var(--hub-copy)"
          strokeWidth="1"
          opacity="0.7"
        />
      ))}
      <circle cx="60" cy="38" r="3" fill="var(--hub-accent)" />

      <ellipse
        cx="60"
        cy="62"
        rx="20"
        ry="12"
        fill="none"
        stroke="var(--hub-line)"
        strokeWidth="1.2"
      />
      <line
        x1="42"
        y1="56"
        x2="54"
        y2="68"
        stroke="var(--hub-sage)"
        strokeWidth="1"
        opacity="0.7"
      />
      <line
        x1="78"
        y1="56"
        x2="66"
        y2="68"
        stroke="var(--hub-sage)"
        strokeWidth="1"
        opacity="0.7"
      />

      <g className="audio-meter-left">
        {[
          { y: 88, h: 3, c: "var(--hub-sage)" },
          { y: 83, h: 3, c: "var(--hub-sage)" },
          { y: 78, h: 3, c: "var(--hub-sage)" },
          { y: 73, h: 3, c: "var(--hub-accent)" },
          { y: 68, h: 3, c: "var(--hub-accent)" },
        ].map((bar, i) => (
          <rect
            key={bar.y}
            x="26"
            y={bar.y}
            width="5"
            height={bar.h}
            rx="1"
            fill={bar.c}
            opacity={active || i < 3 ? 0.9 : 0.25}
          />
        ))}
      </g>
      <g className="audio-meter-right">
        {[
          { y: 88, h: 3, c: "var(--hub-sage)" },
          { y: 83, h: 3, c: "var(--hub-sage)" },
          { y: 78, h: 3, c: "var(--hub-sage)" },
          { y: 73, h: 3, c: "var(--hub-accent)" },
          { y: 68, h: 3, c: "var(--hub-accent)" },
        ].map((bar, i) => (
          <rect
            key={bar.y}
            x="89"
            y={bar.y}
            width="5"
            height={bar.h}
            rx="1"
            fill={bar.c}
            opacity={active || i < 4 ? 0.9 : 0.25}
          />
        ))}
      </g>

      <text
        x="60"
        y="100"
        textAnchor="middle"
        fill="var(--hub-muted)"
        fontSize="4.5"
        fontFamily="ui-monospace, monospace"
        letterSpacing="0.05em"
      >
        32-BIT FLOAT · 48kHz
      </text>
    </svg>
  );
}

function StoryboardFilmGraphic({ active }: { active: boolean }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      className="companion-svg companion-storyboard"
      aria-hidden="true"
    >
      <rect
        x="20"
        y="24"
        width="80"
        height="72"
        rx="4"
        fill="var(--hub-surface-raised)"
        stroke="var(--hub-line)"
        strokeWidth="1.2"
      />

      {[28, 40, 52, 64, 76, 88].map((y) => (
        <g key={y}>
          <rect
            x="23"
            y={y - 3}
            width="5"
            height="6"
            rx="1.2"
            fill="var(--hub-bg)"
            stroke="var(--hub-line)"
            strokeWidth="0.8"
          />
          <rect
            x="92"
            y={y - 3}
            width="5"
            height="6"
            rx="1.2"
            fill="var(--hub-bg)"
            stroke="var(--hub-line)"
            strokeWidth="0.8"
          />
        </g>
      ))}

      <rect
        x="33"
        y="32"
        width="54"
        height="38"
        rx="2"
        fill="var(--hub-bg)"
        stroke={active ? "var(--hub-accent)" : "var(--hub-line)"}
        strokeWidth="1"
      />

      <path d="M 37 39 L 37 36 L 41 36" fill="none" stroke="var(--hub-accent)" strokeWidth="1" />
      <path d="M 83 39 L 83 36 L 79 36" fill="none" stroke="var(--hub-accent)" strokeWidth="1" />
      <path d="M 37 63 L 37 66 L 41 66" fill="none" stroke="var(--hub-accent)" strokeWidth="1" />
      <path d="M 83 63 L 83 66 L 79 66" fill="none" stroke="var(--hub-accent)" strokeWidth="1" />

      <circle cx="60" cy="51" r="5" fill="none" stroke="var(--hub-sage)" strokeWidth="1" />
      <circle cx="60" cy="51" r="2" fill={active ? "var(--hub-sage)" : "var(--hub-copy)"} />
      <polygon points="68,48 74,44 74,58 68,54" fill="var(--hub-sage)" opacity="0.8" />

      <g className="storyboard-nodes">
        <line x1="38" y1="82" x2="82" y2="82" stroke="var(--hub-line)" strokeWidth="1" />
        <circle
          cx="42"
          cy="82"
          r="3"
          fill="var(--hub-surface)"
          stroke="var(--hub-sage)"
          strokeWidth="1.2"
        />
        <circle
          cx="60"
          cy="82"
          r="4.5"
          fill={active ? "var(--hub-accent)" : "var(--hub-surface)"}
          stroke="var(--hub-accent)"
          strokeWidth="1.5"
        />
        <circle
          cx="78"
          cy="82"
          r="3"
          fill="var(--hub-surface)"
          stroke="var(--hub-line)"
          strokeWidth="1.2"
        />
        <text
          x="60"
          y="83.8"
          textAnchor="middle"
          fill="var(--hub-surface)"
          fontSize="4.2"
          fontWeight="bold"
          fontFamily="ui-monospace, monospace"
        >
          ✓
        </text>
      </g>

      <text
        x="60"
        y="93"
        textAnchor="middle"
        fill="var(--hub-muted)"
        fontSize="4"
        fontFamily="ui-monospace, monospace"
        letterSpacing="0.08em"
      >
        {active ? "CUT #04 · SELECTED" : "TAKE LINEAGE · 2.39:1"}
      </text>
    </svg>
  );
}

function CompanionGraphic({
  kind,
  active,
}: {
  kind: keyof typeof companionMessages;
  active: boolean;
}) {
  switch (kind) {
    case "crew":
      return <CrewSlateGraphic active={active} />;
    case "lens":
      return <LensOpticsGraphic active={active} />;
    case "dragonfly":
      return <BoomSoundGraphic active={active} />;
    case "moth":
      return <StoryboardFilmGraphic active={active} />;
    default:
      return null;
  }
}

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const prefix = sameDay
    ? "今天"
    : date.toDateString() === yesterday.toDateString()
      ? "昨天"
      : date.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
  return `${prefix} ${date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 更新`;
}

function projectChapterTop(shell: HTMLElement, section: HTMLElement) {
  const header = shell.querySelector<HTMLElement>(".hub-header");
  const headerHeight = header?.offsetHeight ?? 72;
  return Math.max(0, section.offsetTop - headerHeight);
}

function projectScrollLimit(shell: HTMLElement, section: HTMLElement) {
  const header = shell.querySelector<HTMLElement>(".hub-header");
  const headerHeight = header?.offsetHeight ?? 72;
  const chapterTop = projectChapterTop(shell, section);
  const chapterViewportHeight = Math.max(0, shell.clientHeight - headerHeight);
  const contentBottom = Array.from(section.children).reduce((bottom, child) => {
    if (!(child instanceof HTMLElement)) return bottom;
    return Math.max(bottom, child.offsetTop + child.offsetHeight);
  }, 0);
  const breathingRoom = 24;
  const overflow = Math.max(0, contentBottom + breathingRoom - chapterViewportHeight);
  return Math.min(chapterTop + overflow, Math.max(0, shell.scrollHeight - shell.clientHeight));
}

type NewProjectInput = {
  title: string;
  storageRootId?: string;
  storageFolder?: string;
};

function ActionIcon({ name }: { name: "open" | "rename" | "delete" | "export" | "cover" }) {
  if (name === "cover") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="m21 15-5-5L5 21" />
      </svg>
    );
  }
  if (name === "rename") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m4 20 4.2-1 10.6-10.6a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" />
        <path d="m14.5 6.5 3 3" />
      </svg>
    );
  }
  if (name === "delete") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v5m4-5v5" />
      </svg>
    );
  }
  if (name === "export") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v11m-4-4 4 4 4-4" />
        <path d="M5 16v4h14v-4" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h13m-5-5 5 5-5 5" />
    </svg>
  );
}

function boardLayout(board: ProjectBoardPreview | undefined, aspectRatio: number) {
  if (!board || board.nodes.length === 0) return { nodes: [], edges: [] };
  const minX = Math.min(...board.nodes.map((node) => node.x));
  const minY = Math.min(...board.nodes.map((node) => node.y));
  const maxX = Math.max(...board.nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...board.nodes.map((node) => node.y + node.height));
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const scale = Math.min(84 / spanX, 70 / (spanY * aspectRatio));
  const offsetX = (100 - spanX * scale) / 2;
  const offsetY = (80 - spanY * scale * aspectRatio) / 2;
  const nodes = board.nodes.map((node) => ({
    ...node,
    left: offsetX + (node.x - minX) * scale,
    top: offsetY + (node.y - minY) * scale * aspectRatio,
    previewWidth: node.width * scale,
    previewHeight: node.height * scale * aspectRatio,
  }));
  const positions = new Map(
    nodes.map((node) => [
      node.id,
      {
        x: node.left + node.previewWidth / 2,
        y: node.top + node.previewHeight / 2,
      },
    ]),
  );
  return {
    nodes,
    edges: board.edges.flatMap((edge) => {
      const source = positions.get(edge.sourceItemId);
      const target = positions.get(edge.targetItemId);
      return source && target ? [{ ...edge, source, target }] : [];
    }),
  };
}

function ProjectCard({
  busy,
  index,
  onDelete,
  onOpen,
  onRename,
  onSetCover,
  project,
}: {
  busy: boolean;
  index: number;
  onDelete: () => void;
  onOpen: () => void;
  onRename: () => void;
  onSetCover: () => void;
  project: ProjectCatalogItem;
}) {
  const [boardIndex, setBoardIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"cover" | "board">(project.hasCover ? "cover" : "board");
  const previewRef = useRef<HTMLButtonElement>(null);
  const [previewAspect, setPreviewAspect] = useState(2);
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    if (project.hasCover) {
      setViewMode("cover");
    } else {
      setViewMode("board");
    }
  }, [project.hasCover, project.coverUpdatedAt]);

  useEffect(() => {
    const element = previewRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.height > 0)
        setPreviewAspect(entry.contentRect.width / entry.contentRect.height);
    });
    observer.observe(element);
    const visibility = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setPreviewVisible(true);
          visibility.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    visibility.observe(element);
    return () => {
      observer.disconnect();
      visibility.disconnect();
    };
  }, []);
  const canManage = project.role !== "viewer" || project.accessSource === "instance_admin";
  const canDelete = project.role === "owner" || project.accessSource === "instance_admin";
  const accessLabel =
    project.accessSource === "instance_admin"
      ? "ADMIN ACCESS"
      : (project.membershipRole?.toUpperCase() ?? project.role.toUpperCase());
  const activeBoard = project.boards[Math.min(boardIndex, Math.max(project.boards.length - 1, 0))];
  const preview = useMemo(
    () => boardLayout(activeBoard, previewAspect),
    [activeBoard, previewAspect],
  );

  return (
    <article className="project-card project-card-managed">
      <div className={`project-card-art project-board-preview art-${(index % 3) + 1}`}>
        <div className="project-board-toolbar">
          <div
            className="project-board-tabs"
            role="tablist"
            aria-label={`${project.title} 的画板与封面`}
          >
            {project.hasCover ? (
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "cover"}
                className={viewMode === "cover" ? "active" : ""}
                onClick={() => setViewMode("cover")}
                title="项目封面"
              >
                封面
              </button>
            ) : null}
            {project.boards.slice(0, 3).map((board, boardPosition) => (
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === "board" && boardPosition === boardIndex}
                className={viewMode === "board" && boardPosition === boardIndex ? "active" : ""}
                key={board.sceneId}
                onClick={() => {
                  setViewMode("board");
                  setBoardIndex(boardPosition);
                }}
                title={board.title || board.label}
              >
                {board.label}
              </button>
            ))}
            {project.boards.length > 3 ? <span>+{project.boards.length - 3}</span> : null}
          </div>
          <small>
            {viewMode === "cover" && project.hasCover
              ? "项目封面"
              : activeBoard
                ? `${activeBoard.itemCount} 个节点`
                : "空画板"}
          </small>
        </div>
        <button
          className="project-board-open"
          ref={previewRef}
          type="button"
          onClick={onOpen}
          disabled={busy}
          aria-label={`打开 ${project.title} 的${viewMode === "cover" && project.hasCover ? "封面" : (activeBoard?.label ?? "画板")}`}
        >
          {viewMode === "cover" && project.hasCover ? (
            <div className="project-card-cover-wrapper">
              <img
                className="project-card-cover-image"
                key={project.coverUpdatedAt ?? project.key}
                src={projectApi.coverUrl(project.key, project.coverUpdatedAt || project.updatedAt)}
                alt={project.title}
              />
              <span className="project-card-cover-overlay" />
            </div>
          ) : activeBoard ? (
            <>
              <svg
                className="project-board-edges"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {preview.edges.map((edge) => (
                  <line
                    key={`${edge.sourceItemId}-${edge.targetItemId}`}
                    x1={edge.source.x}
                    y1={edge.source.y}
                    x2={edge.target.x}
                    y2={edge.target.y}
                  />
                ))}
              </svg>
              {preview.nodes.map((node) => (
                <span
                  className={`project-board-node node-${node.refType}`}
                  key={node.id}
                  style={{
                    left: `${node.left}%`,
                    top: `${node.top}%`,
                    width: `${node.previewWidth}%`,
                    height: `${node.previewHeight}%`,
                  }}
                >
                  {node.assetId && node.mediaType === "image" ? (
                    <img
                      loading="lazy"
                      src={projectApi.assetUrl(project.key, node.assetId)}
                      alt=""
                    />
                  ) : node.assetId && node.mediaType === "video" && previewVisible ? (
                    <VideoThumbnail
                      src={projectApi.assetUrl(project.key, node.assetId)}
                      label={`${node.label} 预览`}
                    />
                  ) : (
                    <i />
                  )}
                  <b>{node.label}</b>
                </span>
              ))}
            </>
          ) : (
            <span className="project-board-empty">尚未添加画板内容</span>
          )}
          <span className="project-board-title">
            <small>{String(index + 1).padStart(2, "0")}</small>
            <strong>
              {viewMode === "cover" && project.hasCover
                ? "项目封面"
                : activeBoard?.title || activeBoard?.label || "项目画板"}
            </strong>
          </span>
        </button>
      </div>
      <div className="project-card-copy">
        <div>
          <strong>{project.title}</strong>
          <span>
            {project.sceneCount} 场 · {project.shotCount} 镜头 · {project.aspectRatio}
          </span>
          <small>{formatUpdatedAt(project.updatedAt)}</small>
          <em
            className={`project-role role-${project.accessSource === "instance_admin" ? "admin" : project.role}`}
            title={
              project.accessSource === "instance_admin"
                ? "实例管理员可进行故障恢复；这不代表项目 Owner 成员关系"
                : undefined
            }
          >
            {accessLabel}
          </em>
        </div>
        <div className="project-card-actions">
          <button
            className="project-card-open-button"
            type="button"
            onClick={onOpen}
            disabled={busy}
          >
            {project.unavailable ? "项目位置不可用" : "打开画板"} <ActionIcon name="open" />
          </button>
          {canManage ? (
            <button
              type="button"
              onClick={onSetCover}
              aria-label={`设置 ${project.title} 封面`}
              title="设置项目封面"
            >
              <ActionIcon name="cover" />
            </button>
          ) : null}
          {canManage ? (
            <button type="button" onClick={onRename} aria-label={`重命名 ${project.title}`}>
              <ActionIcon name="rename" />
            </button>
          ) : null}
          {canDelete ? (
            project.activeRunCount === 0 ? (
              <a
                href={`/api/projects/${encodeURIComponent(project.key)}/export`}
                download
                aria-label={`导出 ${project.title}`}
                title="导出完整项目包"
              >
                <ActionIcon name="export" />
              </a>
            ) : (
              <button
                type="button"
                disabled
                aria-label={`${project.title} 正在生成，暂时不能导出`}
                title="等待生成任务结束后再导出"
              >
                <ActionIcon name="export" />
              </button>
            )
          ) : null}
          {canDelete ? (
            <button
              className="project-card-delete-button"
              type="button"
              onClick={onDelete}
              disabled={busy}
              aria-label={`删除 ${project.title}`}
            >
              <ActionIcon name="delete" />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function ProjectHub({
  busy,
  error,
  notice,
  onCreate,
  onDelete,
  onImport,
  onOpen,
  onRename,
  onRestore,
  onSetCover,
  onDeleteCover,
  projects,
  trashedProjects,
  worker,
  workerBusy,
}: {
  busy: boolean;
  error: string | null;
  notice: string | null;
  onCreate: (input: NewProjectInput) => Promise<void>;
  onDelete: (key: string) => Promise<void>;
  onImport: (file: File) => Promise<void>;
  onOpen: (key: string) => Promise<void>;
  onRename: (key: string, title: string) => Promise<void>;
  onRestore: (trashKey: string) => Promise<void>;
  onSetCover?: (key: string, input: File | { assetId: string }) => Promise<void>;
  onDeleteCover?: (key: string) => Promise<void>;
  projects: ProjectCatalogItem[];
  trashedProjects: TrashedProjectItem[];
  worker: WorkerStatus | null;
  workerBusy: boolean;
}) {
  const { local, accountsConfigured, openAccount } = useAuth();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<ProjectCatalogItem | null>(null);
  const [deleting, setDeleting] = useState<ProjectCatalogItem | null>(null);
  const [editingCover, setEditingCover] = useState<ProjectCatalogItem | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [coverUploading, setCoverUploading] = useState(false);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [title, setTitle] = useState("");
  const [projectLocation, setProjectLocation] = useState<ProjectLocationChoice | null>(null);
  const [projectLocationValid, setProjectLocationValid] = useState(false);
  const [projectQuery, setProjectQuery] = useState("");
  const [projectSort, setProjectSort] = useState<"recent" | "name">("recent");
  const [projectsVisible, setProjectsVisible] = useState(false);
  const [workerPanelOpen, setWorkerPanelOpen] = useState(false);
  const workerControl = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!workerPanelOpen) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !workerControl.current?.contains(event.target))
        setWorkerPanelOpen(false);
    };
    window.addEventListener("pointerdown", dismiss);
    return () => window.removeEventListener("pointerdown", dismiss);
  }, [workerPanelOpen]);
  const [helpOpen, setHelpOpen] = useState(false);
  const [recycleOpen, setRecycleOpen] = useState(false);
  const [utilityOpen, setUtilityOpen] = useState(false);
  const [sceneQuality, setSceneQuality] = useState<SceneQuality>(savedSceneQuality);
  const [companionMoment, setCompanionMoment] = useState<keyof typeof companionMessages | null>(
    null,
  );
  const titleInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const renameInput = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLElement>(null);
  const projectsRef = useRef<HTMLElement>(null);
  const utilityRef = useRef<HTMLDivElement>(null);
  const companionTimer = useRef<number | null>(null);
  const recentProject = useMemo(
    () =>
      [...projects].sort(
        (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
      )[0] ?? null,
    [projects],
  );
  const visibleProjects = useMemo(() => {
    const normalizedQuery = projectQuery.trim().toLocaleLowerCase("zh-CN");
    return [...projects]
      .filter((project) => project.title.toLocaleLowerCase("zh-CN").includes(normalizedQuery))
      .sort((left, right) =>
        projectSort === "name"
          ? left.title.localeCompare(right.title, "zh-CN")
          : Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
      );
  }, [projectQuery, projectSort, projects]);
  useEffect(() => {
    if (
      !creating &&
      !renaming &&
      !deleting &&
      !workerPanelOpen &&
      !helpOpen &&
      !recycleOpen &&
      !utilityOpen
    )
      return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setCreating(false);
      setRenaming(null);
      setDeleting(null);
      setWorkerPanelOpen(false);
      setHelpOpen(false);
      setRecycleOpen(false);
      setUtilityOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [creating, deleting, helpOpen, recycleOpen, renaming, utilityOpen, workerPanelOpen]);

  useEffect(() => {
    const closeMenus = () => {
      setWorkerPanelOpen(false);
      setUtilityOpen(false);
    };
    window.addEventListener("yoyotv:open-settings", closeMenus);
    return () => window.removeEventListener("yoyotv:open-settings", closeMenus);
  }, []);

  useEffect(() => {
    if (!utilityOpen) return;
    const closeUtility = (event: PointerEvent) => {
      if (!utilityRef.current?.contains(event.target as Node)) setUtilityOpen(false);
    };
    window.addEventListener("pointerdown", closeUtility);
    return () => window.removeEventListener("pointerdown", closeUtility);
  }, [utilityOpen]);

  useEffect(() => {
    if (creating) titleInput.current?.focus();
    if (renaming) renameInput.current?.focus();
  }, [creating, renaming]);

  useEffect(() => {
    if (projects.length > 0) {
      setProjectsVisible(true);
      return;
    }
    const section = projectsRef.current;
    if (!section || typeof IntersectionObserver === "undefined") {
      setProjectsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setProjectsVisible(true);
        observer.disconnect();
      },
      { threshold: 0.04 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [projects.length]);

  useEffect(
    () => () => {
      if (companionTimer.current !== null) window.clearTimeout(companionTimer.current);
    },
    [],
  );

  useEffect(() => {
    const changeQuality = (event: Event) => {
      const quality = (event as CustomEvent<SceneQuality>).detail;
      setSceneQuality(quality);
    };
    window.addEventListener("yoyotv:scene-quality", changeQuality);
    return () => window.removeEventListener("yoyotv:scene-quality", changeQuality);
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const handleWheel = (event: WheelEvent) => {
      if (projects.length > 0) return;
      const target = event.target;
      if (
        !(target instanceof Element) ||
        target.closest('.worker-panel, .modal-backdrop, [role="dialog"]')
      )
        return;
      if (event.deltaY === 0) return;
      const section = projectsRef.current;
      if (!section) return;
      const deltaUnit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? shell.clientHeight
            : 1;
      const maxTop = projectScrollLimit(shell, section);
      const chapterTop = projectChapterTop(shell, section);
      const requestedTop = Math.max(
        0,
        Math.min(maxTop, shell.scrollTop + event.deltaY * deltaUnit),
      );
      // A single large gesture reveals the project shelf without flying past
      // its heading. A later gesture can continue only when the shelf itself
      // is taller than the available viewport.
      const nextTop =
        event.deltaY > 0 && shell.scrollTop < chapterTop && requestedTop > chapterTop
          ? chapterTop
          : event.deltaY < 0 && shell.scrollTop > chapterTop && requestedTop < chapterTop
            ? chapterTop
            : requestedTop;
      event.preventDefault();
      if (shell.scrollTop !== nextTop) shell.scrollTop = nextTop;
    };
    shell.addEventListener("wheel", handleWheel, { capture: true, passive: false });
    return () => shell.removeEventListener("wheel", handleWheel, true);
  }, []);

  const revealCompanionMoment = (moment: keyof typeof companionMessages) => {
    if (companionTimer.current !== null) window.clearTimeout(companionTimer.current);
    setCompanionMoment(moment);
    companionTimer.current = window.setTimeout(() => {
      setCompanionMoment(null);
      companionTimer.current = null;
    }, 1800);
  };

  return (
    <main
      ref={shellRef}
      className="hub-shell"
      onScroll={(event) => {
        if (projects.length > 0) return;
        const shell = event.currentTarget;
        const section = projectsRef.current;
        const boundedTop = section
          ? Math.min(shell.scrollTop, projectScrollLimit(shell, section))
          : shell.scrollTop;
        if (shell.scrollTop !== boundedTop) shell.scrollTop = boundedTop;
      }}
    >
      <style>{hubChromeCss}</style>
      <header className="hub-header">
        <div className="hub-header-inner">
          <div className="brand hub-brand">
            <span className="brand-mark" aria-label="YoYo">
              <svg viewBox="0 0 512 512" fill="none" width="18" height="18" aria-hidden="true">
                <path d="M 130 148 C 130 230, 206 256, 256 256 C 306 256, 382 230, 382 148 C 382 108, 338 88, 290 102 C 238 116, 204 178, 172 232 C 142 284, 130 338, 158 382 C 188 428, 256 428, 256 428" stroke="var(--hub-accent)" strokeWidth="48" strokeLinecap="round"/>
                <path d="M 382 364 C 382 282, 306 256, 256 256 C 206 256, 130 282, 130 364 C 130 404, 174 424, 222 410 C 274 396, 308 334, 340 280 C 370 228, 382 174, 354 130 C 324 84, 256 84, 256 84" stroke="var(--hub-sage)" strokeWidth="42" strokeLinecap="round"/>
                <circle cx="256" cy="256" r="30" fill="var(--hub-bg)" stroke="var(--hub-accent)" strokeWidth="8"/>
                <circle cx="256" cy="256" r="12" fill="var(--hub-sage)"/>
              </svg>
            </span>
            <div>
              <strong>YoYo</strong>
              <span>FILMMAKING WORKSPACE</span>
            </div>
          </div>
          <div className="hub-header-actions">
            <DeviceIndicator />
            <div className="hub-status-group">
              <Suspense fallback={null}>
                <OperationsCenter compact onOpenProject={onOpen} />
              </Suspense>
              <span className="hub-status-divider" aria-hidden="true" />
              <div className="worker-control" ref={workerControl}>
                <button
                  className={`worker-pill worker-${worker?.status ?? "loading"}`}
                  type="button"
                  aria-expanded={workerPanelOpen}
                  aria-label="选择生成设备"
                  onClick={() => {
                    setUtilityOpen(false);
                    setWorkerPanelOpen((current) => !current);
                  }}
                >
                  <i />
                  <svg className="worker-engine-mark" viewBox="0 0 20 20" aria-hidden="true">
                    <rect x="5" y="5" width="10" height="10" rx="2" />
                    <path d="M8 8h4v4H8zM7 2.8v2.1M13 2.8v2.1M7 15.1v2.1M13 15.1v2.1M2.8 7h2.1M15.1 7h2.1M2.8 13h2.1M15.1 13h2.1" />
                  </svg>
                  <div>
                    <strong title={worker?.connection?.address}>
                      {worker?.status === "ready" ||
                      (worker?.connection && worker.connection.kind !== "existing")
                        ? worker.connection?.kind !== "existing"
                          ? worker.connection?.name || "ComfyUI"
                          : worker.connection?.address
                            ? new URL(worker.connection.address).host
                            : "ComfyUI"
                        : "生成设备"}
                    </strong>
                    <span>
                      {workerBusy
                        ? "检测中"
                        : worker?.status === "ready"
                          ? "使用中"
                          : worker?.status === "offline"
                            ? "服务未就绪"
                            : "连接中"}
                    </span>
                  </div>
                  <b aria-hidden="true">⌄</b>
                </button>
                {workerPanelOpen ? (
                  <aside className="worker-panel" aria-label="选择生成设备">
                    <div className="worker-panel-heading">
                      <div>
                        <span>GENERATION</span>
                        <strong>选择生成设备</strong>
                      </div>
                      <button
                        type="button"
                        aria-label="关闭 ComfyUI 面板"
                        onClick={() => setWorkerPanelOpen(false)}
                      >
                        ×
                      </button>
                    </div>
                    <Suspense fallback={<p>读取设备…</p>}>
                      <GenerationConnectionPanel />
                    </Suspense>
                  </aside>
                ) : null}
              </div>
            </div>
            <input
              ref={importInput}
              className="visually-hidden"
              type="file"
              accept=".tgz,.yoyotv.tgz,.takeboard.tgz,.gz,application/gzip,application/x-gzip"
              aria-label="选择 YoYo 项目包"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void onImport(file).catch(() => undefined);
              }}
            />
            <button
              className="hub-header-create"
              type="button"
              aria-label="新建项目"
              onClick={() => setCreating(true)}
            >
              <span aria-hidden="true">＋</span>
              <b>新建项目</b>
            </button>
            <AccountButton compact />
            <div className="hub-utility-control" ref={utilityRef}>
              <button
                className="hub-utility-trigger"
                type="button"
                aria-expanded={utilityOpen}
                aria-haspopup="dialog"
                aria-label="打开工作区选项"
                title="工作区选项"
                onClick={() => {
                  setWorkerPanelOpen(false);
                  setUtilityOpen((current) => !current);
                }}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M4 5h12M4 10h12M4 15h12" />
                  <circle cx="8" cy="5" r="1.7" />
                  <circle cx="13" cy="10" r="1.7" />
                  <circle cx="7" cy="15" r="1.7" />
                </svg>
              </button>
              {utilityOpen ? (
                <section className="hub-utility-panel" role="dialog" aria-label="工作区选项">
                  <header>
                    <div>
                      <strong>工作区选项</strong>
                      <span>项目包、回收区与偏好</span>
                    </div>
                    <button
                      type="button"
                      aria-label="关闭工作区选项"
                      onClick={() => setUtilityOpen(false)}
                    >
                      ×
                    </button>
                  </header>
                  <div className="hub-utility-actions">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setUtilityOpen(false);
                        importInput.current?.click();
                      }}
                    >
                      <span aria-hidden="true">＋</span>
                      导入项目包
                    </button>
                    <button
                      type="button"
                      disabled={trashedProjects.length === 0}
                      onClick={() => {
                        setUtilityOpen(false);
                        setRecycleOpen(true);
                      }}
                    >
                      <span aria-hidden="true">↶</span>
                      {trashedProjects.length > 0 ? `回收区 ${trashedProjects.length}` : "回收区"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUtilityOpen(false);
                        setHelpOpen(true);
                      }}
                    >
                      <span aria-hidden="true">?</span>
                      使用帮助
                    </button>
                  </div>
                  <div className="hub-utility-section">
                    <span>外观</span>
                    <ThemeSwitcher />
                    <div className="hub-utility-settings">
                      <DisplaySettings />
                      <SettingsButton />
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {projects.length === 0 ? (
        <div className="hub-artifact-background">
          <div className="scene-companions">
            {(Object.keys(companionMessages) as Array<keyof typeof companionMessages>).map(
              (companion) => (
                <button
                  className={`scene-companion scene-${companion} ${companionMoment === companion ? "is-active" : ""}`}
                  type="button"
                  key={companion}
                  aria-label={`${companionMessages[companion]}互动`}
                  onClick={() => revealCompanionMoment(companion)}
                >
                  <span className="scene-companion-visual" aria-hidden="true">
                    <CompanionGraphic kind={companion} active={companionMoment === companion} />
                  </span>
                  <em role="status">{companionMessages[companion]}</em>
                </button>
              ),
            )}
            <div className="scene-curiosities" aria-hidden="true">
              <div className="director-hud-overlay">
                <div className="hud-safe-brackets">
                  <span className="bracket bracket-tl" />
                  <span className="bracket bracket-tr" />
                  <span className="bracket bracket-bl" />
                  <span className="bracket bracket-br" />
                  <span className="hud-crosshair" />
                </div>
                <div className="hud-meta hud-meta-tl">
                  <span className="hud-rec-wrap">
                    <span className="hud-rec-dot" />
                    <span>REC</span>
                  </span>
                  <span>4K RAW · 24.00 FPS</span>
                  <small>PRORES 4444 XQ</small>
                </div>
                <div className="hud-meta hud-meta-tr">
                  <span>SHUTTER 180° · EI 800</span>
                  <small>5600K · T1.5 CINE</small>
                </div>
                <div className="hud-meta hud-meta-bl">
                  <span>TC 01:00:24:18 · MASTER</span>
                  <small>CH1/CH2 -18dB SYNC</small>
                </div>
                <div className="hud-meta hud-meta-br">
                  <span>STAGE A · VIRTUAL PROD</span>
                  <small>COMFYUI ENGINE</small>
                </div>
              </div>
              <span className="curiosity-constellation">
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="curiosity-loose-frame">
                <i />
                <i />
                <i />
              </span>
              <span className="curiosity-orbit">
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
          {sceneQuality !== "lite" ? (
            <Suspense
              fallback={
                <div className="studio-universe">
                  <div className="universe-fallback" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <span />
                  </div>
                </div>
              }
            >
              <StudioUniverse
                quality={sceneQuality === "full" ? "full" : "balanced"}
                workerReady={worker?.status === "ready"}
                projectCount={projects.length}
                recentProjectTitle={recentProject?.title ?? null}
              />
            </Suspense>
          ) : (
            <div
              className="studio-universe artifact-universe universe-lite-mode"
              role="img"
              aria-label="YoYo 导演板静态封面；可在显示设置中启用三维效果"
            >
              <span className="universe-fallback artifact-fallback" aria-hidden="true">
                <i />
                <i />
                <i />
                <span />
              </span>
            </div>
          )}
        </div>
      ) : null}

      <section className={`hub-hero hub-object-hero ${recentProject ? "has-recent-project" : ""}`}>
        {recentProject ? (
          <div className="hero-recent-container">
            <div
              className={`hero-recent-card ${recentProject.hasCover ? "has-cover-bg" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => void onOpen(recentProject.key)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  void onOpen(recentProject.key);
                }
              }}
            >
              {recentProject.hasCover ? (
                <div className="hero-recent-cover-bg" aria-hidden="true">
                  <img
                    key={recentProject.coverUpdatedAt ?? recentProject.key}
                    src={projectApi.coverUrl(
                      recentProject.key,
                      recentProject.coverUpdatedAt || recentProject.updatedAt,
                    )}
                    alt=""
                  />
                  <span className="hero-recent-cover-overlay" />
                </div>
              ) : null}
              <div className="hero-recent-top">
                <div className="hero-recent-badge">
                  <span className="hero-recent-pulse" />
                  <span>最近编辑 · 继续创作</span>
                </div>
                <span className="hero-recent-time">{formatUpdatedAt(recentProject.updatedAt)}</span>
              </div>
              <div className="hero-recent-main">
                <div className="hero-recent-info">
                  <h1 className="hero-recent-title">{recentProject.title}</h1>
                  <p className="hero-recent-meta">
                    <span>
                      {recentProject.shotCount > 0
                        ? `${recentProject.shotCount} 个镜头`
                        : "空白画板"}
                    </span>
                    <span className="hero-recent-dot">·</span>
                    <span>画幅 {recentProject.aspectRatio}</span>
                    {recentProject.activeRunCount > 0 ? (
                      <>
                        <span className="hero-recent-dot">·</span>
                        <span className="hero-recent-running">正在生成</span>
                      </>
                    ) : null}
                  </p>
                </div>
                <button
                  type="button"
                  className="hero-recent-resume-btn"
                  disabled={busy}
                  onClick={(event) => {
                    event.stopPropagation();
                    void onOpen(recentProject.key);
                  }}
                >
                  <b>{busy ? "正在进入…" : "进入画板继续编辑"}</b>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="visually-hidden">
            <span>YOYO / FILMMAKING WORKSPACE</span>
            <h1>从素材到成片，都在一张画布。</h1>
            <p>连接 ComfyUI，管理素材、镜头、Workflow 与生成结果。</p>
          </div>
        )}
      </section>

      <section className={`hub-projects ${projectsVisible ? "is-visible" : ""}`} ref={projectsRef}>
        <div className="hub-section-heading">
          <div>
            <span className="section-kicker">{local ? "此设备项目" : "你的项目"}</span>
            <h2>继续创作</h2>
          </div>
          <div className="project-library-tools">
            {projects.length > 1 ? (
              <label className="project-search">
                <span aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={projectQuery}
                  onChange={(event) => setProjectQuery(event.target.value)}
                  placeholder="搜索项目"
                  aria-label="搜索项目"
                />
              </label>
            ) : null}
            {projects.length > 1 ? (
              <select
                value={projectSort}
                onChange={(event) => setProjectSort(event.target.value as "recent" | "name")}
                aria-label="项目排序"
              >
                <option value="recent">最近更新</option>
                <option value="name">按名称</option>
              </select>
            ) : null}
            <span className="project-count">
              {projectQuery ? `${visibleProjects.length} / ` : ""}
              {projects.length} 个项目
            </span>
          </div>
        </div>
        <div className="project-grid">
          {local && accountsConfigured ? (
            <button className="no-projects" type="button" onClick={() => openAccount()}>
              <span>↗</span>
              <strong>查看账号项目</strong>
              <small>已有项目未删除，登录后按账号权限显示</small>
            </button>
          ) : null}
          {visibleProjects.map((project, index) => (
            <ProjectCard
              busy={busy}
              index={index}
              key={project.key}
              project={project}
              onOpen={() => void onOpen(project.key)}
              onRename={() => {
                setRenaming(project);
                setRenameTitle(project.title);
              }}
              onSetCover={() => {
                setCoverError(null);
                setEditingCover(project);
              }}
              onDelete={() => {
                if (project.activeRunCount > 0) {
                  setDeleting(project);
                  return;
                }
                void onDelete(project.key).catch(() => undefined);
              }}
            />
          ))}
          {projects.length === 0 ? (
            <button className="no-projects" type="button" onClick={() => setCreating(true)}>
              <span>＋</span>
              <strong>创建第一个项目</strong>
              <small>从一张空白工作画板开始</small>
            </button>
          ) : null}
          {projects.length > 0 && visibleProjects.length === 0 ? (
            <div className="project-search-empty">
              <span>⌕</span>
              <strong>没有匹配的项目</strong>
              <button type="button" onClick={() => setProjectQuery("")}>
                清除搜索
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {creating ? (
        <div className="modal-backdrop">
          <form
            className="new-project-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-title"
            onSubmit={(event) => {
              event.preventDefault();
              if (projectLocationValid) void onCreate({ title, ...projectLocation });
            }}
          >
            <div className="modal-title">
              <div>
                <span className="section-kicker">NEW WORKSPACE</span>
                <h2 id="new-project-title">新建项目</h2>
                <p>设置名称和保存位置，即可开始创作。</p>
              </div>
              <button type="button" aria-label="关闭新建项目" onClick={() => setCreating(false)}>
                ×
              </button>
            </div>
            <label>
              项目名称
              <input
                ref={titleInput}
                required
                maxLength={200}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="未命名作品"
              />
            </label>
            <ProjectLocationPicker
              onChange={setProjectLocation}
              onValid={setProjectLocationValid}
            />
            {error ? <p className="form-error">{error}</p> : null}
            <div className="modal-actions">
              <span>创建空白画布 · 保存到所选设备</span>
              <button type="submit" disabled={busy || !title.trim() || !projectLocationValid}>
                {busy ? "正在创建…" : "进入画布 →"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {helpOpen ? (
        <div className="modal-backdrop">
          <section
            className="start-guide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="start-guide-title"
          >
            <div className="modal-title">
              <div>
                <span className="section-kicker">QUICK START</span>
                <h2 id="start-guide-title">开始使用 YoYo</h2>
                <p>本机使用、远程连接和故障检查都有独立入口。</p>
              </div>
              <button type="button" aria-label="关闭开始使用" onClick={() => setHelpOpen(false)}>
                ×
              </button>
            </div>
            <div className="start-guide-grid">
              <article>
                <span>01</span>
                <strong>本机打开</strong>
                <p>
                  安装 YoYo 后，从“应用程序”或开始菜单打开即可。默认无需注册，
                  新建项目后就能导入素材；生成需要连接 ComfyUI。
                </p>
              </article>
              <article>
                <span>02</span>
                <strong>连接远程服务器</strong>
                <p>
                  在“设置 → 设备连接”添加 ComfyUI
                  设备。项目留在当前电脑，结果会下载到项目文件夹。需要服务器上的项目时，再打开“远程项目”。
                </p>
              </article>
              <article>
                <span>03</span>
                <strong>遇到打不开</strong>
                <p>
                  在“设置 → 运行诊断”点击开始检测，可复制或下载报告。App 更新在“设置 →
                  关于与更新”中检查。
                </p>
              </article>
            </div>
            <div className={`start-guide-status worker-${worker?.status ?? "loading"}`}>
              <i />
              <div>
                <strong>
                  {worker?.status === "ready" ? "现在可以生成" : "画布可用，生成端尚未连接"}
                </strong>
                <span>
                  {worker?.status === "ready"
                    ? (worker.device ?? "ComfyUI 已连接")
                    : "需要生成时，在设置中添加设备或安全启动服务。"}
                </span>
              </div>
            </div>
            <small className="start-guide-note">
              “导入项目包”用于恢复 YoYo 导出的 .yoyotv.tgz（及旧版 .takeboard.tgz）
              文件，不要求原来的文件夹结构。普通图片和视频请在项目画布或资产库中导入。
            </small>
          </section>
        </div>
      ) : null}

      {recycleOpen ? (
        <div className="modal-backdrop">
          <section
            className="recycle-project-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="recycle-project-title"
          >
            <div className="modal-title">
              <div>
                <span className="section-kicker">PROJECT RECOVERY</span>
                <h2 id="recycle-project-title">项目回收区</h2>
                <p>项目仍保存在原设备，恢复不会重新生成或复制素材。</p>
              </div>
              <button
                type="button"
                aria-label="关闭项目回收区"
                onClick={() => setRecycleOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="recycle-project-list">
              {trashedProjects.map((project) => (
                <article key={project.trashKey}>
                  <div>
                    <strong>{project.title}</strong>
                    <span>
                      {project.shotCount} 个镜头 · {formatUpdatedAt(project.deletedAt)}移入
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onRestore(project.trashKey).catch(() => undefined)}
                  >
                    {busy ? "正在恢复…" : "恢复项目"}
                  </button>
                </article>
              ))}
            </div>
            {error ? <p className="form-error">{error}</p> : null}
            <small className="recycle-project-note">
              回收区不会自动清空，项目可在确认备份后由文件系统管理员清理。
            </small>
          </section>
        </div>
      ) : null}
      {notice ? (
        <div className="toast success" role="status">
          <svg
            viewBox="0 0 16 16"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
          </svg>
          <span>{notice}</span>
        </div>
      ) : null}
      {error && !creating && !recycleOpen && !renaming && !deleting ? (
        <div className="toast error" role="alert">
          <svg
            viewBox="0 0 16 16"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="4" y1="4" x2="12" y2="12" />
            <line x1="12" y1="4" x2="4" y2="12" />
          </svg>
          <span>{error}</span>
        </div>
      ) : null}

      {renaming ? (
        <div className="modal-backdrop">
          <form
            className="rename-project-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-project-title"
            onSubmit={(event) => {
              event.preventDefault();
              void onRename(renaming.key, renameTitle)
                .then(() => setRenaming(null))
                .catch(() => undefined);
            }}
          >
            <div className="modal-title">
              <div>
                <span className="section-kicker">重命名项目</span>
                <h2 id="rename-project-title">修改项目名称</h2>
              </div>
              <button type="button" aria-label="关闭重命名" onClick={() => setRenaming(null)}>
                ×
              </button>
            </div>
            <label>
              新名称
              <input
                ref={renameInput}
                required
                maxLength={200}
                value={renameTitle}
                onChange={(event) => setRenameTitle(event.target.value)}
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="modal-actions">
              <span>文件夹标识保持不变，不会断开素材引用</span>
              <button type="submit" disabled={busy || !renameTitle.trim()}>
                {busy ? "正在保存…" : "保存名称"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deleting ? (
        <div className="modal-backdrop">
          <section
            className="delete-project-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-project-title"
          >
            <div className="delete-project-icon">
              <ActionIcon name="delete" />
            </div>
            <span className="section-kicker">项目管理</span>
            <h2 id="delete-project-title">停止生成并移除“{deleting.title}”？</h2>
            <p>
              YoYo 会先安全停止 {deleting.activeRunCount}
              个生成任务；只有执行端确认停止后，项目才会移入回收区。
            </p>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="delete-project-actions">
              <button type="button" onClick={() => setDeleting(null)} disabled={busy}>
                取消
              </button>
              <button
                className="confirm-delete-button"
                type="button"
                disabled={busy}
                onClick={() =>
                  void onDelete(deleting.key)
                    .then(() => setDeleting(null))
                    .catch(() => undefined)
                }
              >
                {busy ? "正在停止任务…" : `停止 ${deleting.activeRunCount} 个任务并移除`}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {editingCover ? (
        <div className="modal-backdrop">
          <section
            className="project-cover-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cover-modal-title"
          >
            <div className="modal-title">
              <div>
                <span className="section-kicker">PROJECT COVER</span>
                <h2 id="cover-modal-title">设置项目封面 · {editingCover.title}</h2>
                <p>上传本地图片，或直接选取画板中已有的镜头画面作为封面。</p>
              </div>
              <button
                type="button"
                aria-label="关闭设置封面"
                disabled={coverUploading}
                onClick={() => setEditingCover(null)}
              >
                <svg
                  viewBox="0 0 16 16"
                  width="14"
                  height="14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="4" y1="4" x2="12" y2="12" />
                  <line x1="12" y1="4" x2="4" y2="12" />
                </svg>
              </button>
            </div>

            <input
              ref={coverFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file || !onSetCover) return;
                setCoverUploading(true);
                setCoverError(null);
                void onSetCover(editingCover.key, file)
                  .then(() => setEditingCover(null))
                  .catch((err: unknown) =>
                    setCoverError(err instanceof Error ? err.message : "上传封面失败"),
                  )
                  .finally(() => {
                    setCoverUploading(false);
                    if (e.target) e.target.value = "";
                  });
              }}
            />

            <div className="cover-modal-body">
              <button
                type="button"
                className="cover-upload-zone"
                aria-label="点击上传本地封面图片"
                onClick={() => coverFileInputRef.current?.click()}
              >
                <div className="cover-upload-icon" aria-hidden="true">
                  <ActionIcon name="cover" />
                </div>
                <strong>本地上传图片</strong>
                <p>支持 JPG、PNG、WEBP 格式，建议 16:9 比例</p>
                <span className="cover-browse-btn">
                  {coverUploading ? "正在处理…" : "浏览本地文件"}
                </span>
              </button>

              {(() => {
                const boardAssets = editingCover.boards
                  .flatMap((b) => b.nodes)
                  .filter((node): node is typeof node & { assetId: string } =>
                    Boolean(node.assetId),
                  );
                const uniqueAssets = Array.from(
                  new Map(boardAssets.map((a) => [a.assetId, a])).values(),
                );

                if (uniqueAssets.length === 0) return null;

                return (
                  <div className="cover-board-picker">
                    <span className="cover-picker-title">
                      从画板镜头中选取（共 {uniqueAssets.length} 项）
                    </span>
                    <div className="cover-asset-grid">
                      {uniqueAssets.map((asset) => (
                        <button
                          key={asset.assetId}
                          type="button"
                          className="cover-asset-card"
                          disabled={coverUploading}
                          onClick={() => {
                            if (!onSetCover) return;
                            setCoverUploading(true);
                            setCoverError(null);
                            void onSetCover(editingCover.key, { assetId: asset.assetId })
                              .then(() => setEditingCover(null))
                              .catch((err: unknown) =>
                                setCoverError(err instanceof Error ? err.message : "设置封面失败"),
                              )
                              .finally(() => setCoverUploading(false));
                          }}
                        >
                          <img
                            src={projectApi.assetUrl(editingCover.key, asset.assetId, true)}
                            alt={asset.label}
                            loading="lazy"
                          />
                          <span className="cover-asset-card-label">{asset.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {coverError ? <p className="form-error">{coverError}</p> : null}

            <div className="modal-actions cover-modal-actions">
              {editingCover.hasCover ? (
                <button
                  type="button"
                  className="cover-remove-btn"
                  disabled={coverUploading}
                  onClick={() => {
                    if (!onDeleteCover) return;
                    setCoverUploading(true);
                    setCoverError(null);
                    void onDeleteCover(editingCover.key)
                      .then(() => setEditingCover(null))
                      .catch((err: unknown) =>
                        setCoverError(err instanceof Error ? err.message : "移除封面失败"),
                      )
                      .finally(() => setCoverUploading(false));
                  }}
                >
                  移除封面（恢复画板预览）
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                className="cover-cancel-btn"
                disabled={coverUploading}
                onClick={() => setEditingCover(null)}
              >
                取消
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
