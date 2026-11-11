import { Canvas, type ThreeEvent, useThree } from "@react-three/fiber";
import {
  Component,
  type ErrorInfo,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

type ThemeName = "noir" | "light" | "chroma";

const palettes: Record<
  ThemeName,
  {
    accent: string;
    signal: string;
    violet: string;
    surface: string;
    raised: string;
    ink: string;
    screen: string;
    line: string;
    dust: string;
  }
> = {
  noir: {
    accent: "#d9b477",
    signal: "#82c9a8",
    violet: "#9f8fe4",
    surface: "#141816",
    raised: "#1f2623",
    ink: "#f4f3ed",
    screen: "#080b0a",
    line: "#45504a",
    dust: "#c8d4cc",
  },
  light: {
    accent: "#a87332",
    signal: "#2e8a63",
    violet: "#715bd0",
    surface: "#dcd7c8",
    raised: "#ffffff",
    ink: "#1a1f1b",
    screen: "#f2f0e6",
    line: "#86928a",
    dust: "#58675e",
  },
  chroma: {
    accent: "#b89550",
    signal: "#4c9d8c",
    violet: "#8172cf",
    surface: "#1c2030",
    raised: "#272c42",
    ink: "#f0f2fa",
    screen: "#10121d",
    line: "#484f68",
    dust: "#747b91",
  },
};

function useBoardFaceTexture(
  palette: (typeof palettes)[ThemeName],
  face: "front" | "back",
  ready: boolean,
  projectCount: number,
  recentProjectTitle: string | null,
) {
  const texture = useMemo(() => {
    const textureScale = 1.5;
    const width = 1440;
    const height = 656;
    const canvas = document.createElement("canvas");
    canvas.width = width * textureScale;
    canvas.height = height * textureScale;
    const context = canvas.getContext("2d");
    if (!context) return new THREE.CanvasTexture(canvas);
    context.scale(textureScale, textureScale);

    const safeTitle = (recentProjectTitle?.trim() || "未命名项目").slice(0, 18);

    // Deep OLED Carbon background
    context.fillStyle = palette.screen;
    context.fillRect(0, 0, width, height);

    // Subtle anamorphic horizontal studio glow
    const wash = context.createLinearGradient(0, height / 2, width, height / 2);
    wash.addColorStop(0, "transparent");
    wash.addColorStop(0.2, `${palette.accent}0a`);
    wash.addColorStop(0.5, `${palette.signal}12`);
    wash.addColorStop(0.8, `${palette.accent}0a`);
    wash.addColorStop(1, "transparent");
    context.fillStyle = wash;
    context.fillRect(0, 0, width, height);

    // Fine technical grid
    context.strokeStyle = `${palette.line}24`;
    context.lineWidth = 1;
    for (let x = 0; x <= width; x += 64) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
    }
    for (let y = 0; y <= height; y += 64) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.stroke();
    }

    // Top Header / Monitor Telemetry
    context.textBaseline = "middle";

    // Glowing Red Tally Dot & REC tag
    context.fillStyle = "#ef4444";
    context.beginPath();
    context.arc(76, 54, 6, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#ef4444";
    context.font = "700 17px ui-monospace, monospace";
    context.letterSpacing = "2px";
    context.fillText("REC", 90, 54);

    context.fillStyle = palette.accent;
    context.font = "600 18px ui-monospace, monospace";
    context.letterSpacing = "2px";
    context.fillText(
      face === "front" ? "YOYO CINE-7 // VIRTUAL PRODUCTION" : "YOYO // CREATIVE LINEAGE PIPELINE",
      150,
      54,
    );

    // Right Status Pills
    context.textAlign = "right";
    context.fillStyle = ready ? palette.signal : palette.accent;
    context.beginPath();
    context.arc(1100, 54, 6, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = palette.ink;
    context.font = "600 16px ui-monospace, monospace";
    context.letterSpacing = "2px";
    context.fillText(ready ? "COMFYUI / READY" : "COMFYUI / STANDBY", 1085, 55);

    context.fillStyle = `${palette.accent}e6`;
    context.font = "600 15px ui-monospace, monospace";
    context.fillText("T1.5 · 180° · 4K DCI", 1372, 55);
    context.textAlign = "left";

    // Divider bar
    context.fillStyle = `${palette.line}88`;
    context.fillRect(68, 88, 1304, 2);

    if (face === "front") {
      // Left Headline section
      context.fillStyle = palette.accent;
      context.font = "600 17px ui-monospace, monospace";
      context.letterSpacing = "2.5px";
      context.fillText("AI FILMMAKING WORKSPACE // 2.39:1 SCOPE", 70, 136);

      context.fillStyle = palette.ink;
      context.font = "700 66px Inter, -apple-system, 'SF Pro Display', 'PingFang SC', sans-serif";
      context.letterSpacing = "-1.5px";
      context.fillText("从素材到成片，", 68, 218);
      context.fillText("都在一张无界画布。", 68, 298);

      context.fillStyle = `${palette.ink}b8`;
      context.font = "400 21px Inter, -apple-system, 'PingFang SC', sans-serif";
      context.letterSpacing = "0.5px";
      context.fillText("原生连接本地 ComfyUI，统一调度镜头、Workflow 与生成线索。", 70, 376);

      // Right Active Monitor Card
      const cardX = 860;
      const cardY = 120;
      const cardW = 512;
      const cardH = 300;
      context.fillStyle = `${palette.surface}f5`;
      context.roundRect(cardX, cardY, cardW, cardH, 12);
      context.fill();
      context.strokeStyle = `${palette.line}99`;
      context.lineWidth = 1.5;
      context.stroke();

      // Card Header
      context.fillStyle = palette.signal;
      context.font = "600 14px ui-monospace, monospace";
      context.letterSpacing = "1.5px";
      context.fillText("ACTIVE PIPELINE", cardX + 24, cardY + 34);
      context.fillStyle = palette.accent;
      context.textAlign = "right";
      context.fillText("WAN 2.1 I2V · READY", cardX + cardW - 24, cardY + 34);
      context.textAlign = "left";

      // Inner Waveform Scope
      const scopeX = cardX + 24;
      const scopeY = cardY + 58;
      const scopeW = cardW - 48;
      const scopeH = 150;
      context.fillStyle = `${palette.screen}f0`;
      context.roundRect(scopeX, scopeY, scopeW, scopeH, 8);
      context.fill();
      context.strokeStyle = `${palette.line}55`;
      context.lineWidth = 1;
      context.stroke();

      // Viewfinder Brackets inside scope
      context.strokeStyle = `${palette.accent}cc`;
      context.lineWidth = 2;
      const bCorners = [
        [scopeX + 16, scopeY + 16, 1, 1],
        [scopeX + scopeW - 16, scopeY + 16, -1, 1],
        [scopeX + 16, scopeY + scopeH - 16, 1, -1],
        [scopeX + scopeW - 16, scopeY + scopeH - 16, -1, -1],
      ] as const;
      for (const [x, y, dx, dy] of bCorners) {
        context.beginPath();
        context.moveTo(x, y + dy * 14);
        context.lineTo(x, y);
        context.lineTo(x + dx * 14, y);
        context.stroke();
      }

      // Bezier waveform
      context.strokeStyle = palette.signal;
      context.lineWidth = 2.5;
      context.beginPath();
      context.moveTo(scopeX + 32, scopeY + 100);
      context.bezierCurveTo(
        scopeX + 120,
        scopeY + 30,
        scopeX + 220,
        scopeY + 130,
        scopeX + scopeW - 40,
        scopeY + 45,
      );
      context.stroke();

      // Keyframe Reticle Dot
      context.fillStyle = palette.accent;
      context.beginPath();
      context.arc(scopeX + 270, scopeY + 82, 7, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = `${palette.accent}66`;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(scopeX + 270, scopeY + 82, 14, 0, Math.PI * 2);
      context.stroke();

      // Card Bottom Pipeline Flow
      context.fillStyle = palette.ink;
      context.font = "600 15px ui-monospace, monospace";
      context.letterSpacing = "1px";
      context.fillText("PROMPT → COMFYUI LATENT → 4K SHOT", cardX + 24, cardY + cardH - 36);

      context.textAlign = "right";
      context.fillStyle = palette.signal;
      context.font = "600 13px ui-monospace, monospace";
      context.fillText("24 FPS SYNC", cardX + cardW - 24, cardY + cardH - 36);
      context.textAlign = "left";

      // Bottom Metadata Row
      context.fillStyle = `${palette.line}88`;
      context.fillRect(68, 466, 1304, 2);

      const frontMeta = [
        { label: "PROJECTS", value: String(projectCount).padStart(2, "0") + " ACTIVE" },
        { label: "GPU ENGINE", value: ready ? "RTX 24GB READY" : "STANDBY" },
        { label: "STORAGE", value: "NVMe LOCAL" },
      ];
      for (let index = 0; index < frontMeta.length; index += 1) {
        const item = frontMeta[index];
        if (!item) continue;
        const x = 68 + index * 240;
        context.fillStyle = palette.line;
        context.font = "600 14px ui-monospace, monospace";
        context.letterSpacing = "2px";
        context.fillText(item.label, x, 513);
        context.fillStyle = palette.ink;
        context.font = "700 22px ui-monospace, monospace";
        context.fillText(item.value, x, 551);
      }
      context.fillStyle = palette.line;
      context.font = "600 14px ui-monospace, monospace";
      context.fillText("RECENT PROJECT", 860, 513);
      context.fillStyle = palette.ink;
      context.font = "600 22px 'PingFang SC', sans-serif";
      context.fillText(safeTitle, 860, 551, 490);
    } else {
      // Back face - Modern 4K Pipeline Lineage
      context.fillStyle = palette.ink;
      context.font = "700 48px Inter, -apple-system, 'SF Pro Display', 'PingFang SC', sans-serif";
      context.letterSpacing = "-1px";
      context.fillText("创作谱系与生成线索", 68, 148);
      context.fillStyle = palette.accent;
      context.font = "600 16px ui-monospace, monospace";
      context.letterSpacing = "2px";
      context.fillText("RAW ASSET → WORKFLOW GRAPH → 4K SHOT TAKES → MASTER CUT", 68, 191);

      const sources = [
        { y: 268, label: "IMAGE / 01", color: palette.signal },
        { y: 358, label: "VIDEO / 02", color: palette.accent },
        { y: 448, label: "REF / 03", color: palette.violet },
      ];
      for (const source of sources) {
        context.fillStyle = `${palette.surface}f2`;
        context.roundRect(68, source.y - 32, 220, 64, 8);
        context.fill();
        context.fillStyle = source.color;
        context.fillRect(68, source.y - 32, 5, 64);
        context.fillStyle = palette.ink;
        context.font = "600 15px ui-monospace, monospace";
        context.fillText(source.label, 92, source.y);
        context.fillStyle = source.color;
        context.beginPath();
        context.arc(288, source.y, 6, 0, Math.PI * 2);
        context.fill();
      }

      context.fillStyle = `${palette.surface}f5`;
      context.roundRect(504, 238, 350, 242, 12);
      context.fill();
      context.strokeStyle = `${palette.accent}d8`;
      context.lineWidth = 2;
      context.strokeRect(527, 261, 304, 154);
      context.fillStyle = `${palette.signal}28`;
      context.beginPath();
      context.moveTo(528, 415);
      context.lineTo(628, 326);
      context.lineTo(710, 375);
      context.lineTo(830, 284);
      context.lineTo(830, 415);
      context.closePath();
      context.fill();
      context.fillStyle = palette.ink;
      context.font = "700 17px ui-monospace, monospace";
      context.fillText("SHOT / 04 (WAN 2.1)", 527, 448);
      context.textAlign = "right";
      context.fillStyle = palette.accent;
      context.fillText("SELECTED 4K", 831, 448);
      context.textAlign = "left";

      const takes = [
        { y: 260, label: "TAKE 01", color: palette.line },
        { y: 350, label: "TAKE 02 (MASTER)", color: palette.accent },
        { y: 440, label: "TAKE 03", color: palette.signal },
      ];
      for (const take of takes) {
        context.fillStyle = `${palette.surface}f2`;
        context.roundRect(1060, take.y - 33, 312, 66, 8);
        context.fill();
        context.fillStyle = `${take.color}58`;
        context.fillRect(1072, take.y - 21, 62, 42);
        context.fillStyle = palette.ink;
        context.font = "600 15px ui-monospace, monospace";
        context.fillText(take.label, 1160, take.y - 7);
        context.fillStyle = take.color;
        context.font = "500 13px ui-monospace, monospace";
        context.fillText(
          take.label.includes("MASTER") ? "MASTER CUT" : "GENERATED",
          1160,
          take.y + 16,
        );
      }

      context.lineWidth = 2;
      for (const source of sources) {
        context.strokeStyle = `${source.color}a8`;
        context.beginPath();
        context.moveTo(294, source.y);
        context.bezierCurveTo(388, source.y, 406, 359, 504, 359);
        context.stroke();
      }
      for (const take of takes) {
        context.strokeStyle = `${take.color}a8`;
        context.beginPath();
        context.moveTo(854, 359);
        context.bezierCurveTo(942, 359, 966, take.y, 1054, take.y);
        context.stroke();
      }
      for (const x of [294, 504, 854, 1054]) {
        context.fillStyle = palette.accent;
        context.beginPath();
        context.arc(x, 359, 5, 0, Math.PI * 2);
        context.fill();
      }

      context.fillStyle = `${palette.line}88`;
      context.fillRect(68, 535, 1304, 2);
      context.fillStyle = palette.line;
      context.font = "600 14px ui-monospace, monospace";
      context.fillText("ACTIVE PROJECT", 68, 578);
      context.fillStyle = palette.ink;
      context.font = "600 20px 'PingFang SC', sans-serif";
      context.fillText(safeTitle, 220, 578, 420);
      context.textAlign = "right";
      context.fillStyle = palette.signal;
      context.font = "600 14px ui-monospace, monospace";
      context.fillText("4K DCI · NON-DESTRUCTIVE TRACE", 1372, 578);
      context.textAlign = "left";
    }

    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    result.anisotropy = 8;
    result.needsUpdate = true;
    return result;
  }, [face, palette, projectCount, ready, recentProjectTitle]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function usePageTheme() {
  const [theme, setTheme] = useState<ThemeName>(() => {
    const value = document.documentElement.dataset.theme;
    return value === "light" || value === "chroma" ? value : "noir";
  });
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const value = document.documentElement.dataset.theme;
      setTheme(value === "light" || value === "chroma" ? value : "noir");
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);
  return theme;
}

function EnvironmentController({ theme }: { theme: ThemeName }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    gl.toneMappingExposure = theme === "noir" ? 1.18 : 1.08;
    const generator = new THREE.PMREMGenerator(gl);
    const environment = generator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;
    return () => {
      scene.environment = null;
      environment.dispose();
      generator.dispose();
    };
  }, [gl, scene, theme]);
  return null;
}

function Dust({ color }: { color: string }) {
  const positions = useMemo(() => {
    const values = new Float32Array(210);
    for (let index = 0; index < values.length; index += 3) {
      values[index] = (Math.random() - 0.5) * 8;
      values[index + 1] = (Math.random() - 0.5) * 4.6;
      values[index + 2] = (Math.random() - 0.5) * 3.5;
    }
    return values;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.016} transparent opacity={0.25} sizeAttenuation />
    </points>
  );
}

function FrontFace({
  palette,
  ready,
  projectCount,
  recentProjectTitle,
}: {
  palette: (typeof palettes)[ThemeName];
  ready: boolean;
  projectCount: number;
  recentProjectTitle: string | null;
}) {
  const texture = useBoardFaceTexture(palette, "front", ready, projectCount, recentProjectTitle);
  return (
    <group position={[0, -0.16, 0.116]}>
      <mesh>
        <planeGeometry args={[2.68, 1.22]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

function BackFace({
  palette,
  ready,
  projectCount,
  recentProjectTitle,
}: {
  palette: (typeof palettes)[ThemeName];
  ready: boolean;
  projectCount: number;
  recentProjectTitle: string | null;
}) {
  const texture = useBoardFaceTexture(palette, "back", ready, projectCount, recentProjectTitle);
  return (
    <group position={[0, -0.15, -0.116]} rotation={[0, Math.PI, 0]}>
      <mesh>
        <planeGeometry args={[2.7, 1.24]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  );
}

function MonitorTopArmor({ palette }: { palette: (typeof palettes)[ThemeName] }) {
  return (
    <group position={[0, 0.82, 0]}>
      {/* Top industrial chassis bar */}
      <mesh>
        <boxGeometry args={[3.12, 0.16, 0.22]} />
        <meshPhysicalMaterial
          color={palette.surface}
          roughness={0.32}
          metalness={0.82}
          clearcoat={0.6}
          clearcoatRoughness={0.25}
        />
      </mesh>
      {/* Center glowing Red Tally indicator bar */}
      <mesh position={[0, 0.02, 0.113]}>
        <boxGeometry args={[0.48, 0.05, 0.01]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      <mesh position={[0, 0.02, -0.113]}>
        <boxGeometry args={[0.48, 0.05, 0.01]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      {/* NATO Rail & mounting grooves */}
      {[-1.15, -0.75, -0.35, 0.35, 0.75, 1.15].map((x) => (
        <mesh key={x} position={[x, 0, 0.113]}>
          <boxGeometry args={[0.07, 0.06, 0.01]} />
          <meshBasicMaterial color={palette.line} />
        </mesh>
      ))}
      {/* Top Left Green Status LED */}
      <mesh position={[-1.4, 0.02, 0.114]}>
        <circleGeometry args={[0.03, 16]} />
        <meshBasicMaterial color={palette.signal} />
      </mesh>
      {/* Top Right Amber Status LED */}
      <mesh position={[1.4, 0.02, 0.114]}>
        <circleGeometry args={[0.03, 16]} />
        <meshBasicMaterial color={palette.accent} />
      </mesh>
    </group>
  );
}

function BoardArtifact({
  palette,
  ready,
  projectCount,
  recentProjectTitle,
}: {
  palette: (typeof palettes)[ThemeName];
  ready: boolean;
  projectCount: number;
  recentProjectTitle: string | null;
}) {
  const artifact = useRef<THREE.Group>(null);
  const invalidate = useThree((state) => state.invalidate);
  const target = useRef({ x: -0.06, y: -0.12 });
  const drag = useRef({ active: false, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    document.body.style.cursor = dragging ? "grabbing" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [dragging]);

  const resetView = () => {
    target.current = { x: -0.06, y: -0.12 };
    artifact.current?.rotation.set(-0.06, -0.12, 0);
    invalidate();
  };
  const beginDrag = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const targetElement = event.nativeEvent.target as Element | null;
    targetElement?.setPointerCapture(event.pointerId);
    drag.current = { active: true, x: event.clientX, y: event.clientY };
    setDragging(true);
  };
  const moveDrag = (event: ThreeEvent<PointerEvent>) => {
    if (!drag.current.active) return;
    event.stopPropagation();
    const deltaX = event.clientX - drag.current.x;
    const deltaY = event.clientY - drag.current.y;
    target.current.y += deltaX * 0.009;
    target.current.x = THREE.MathUtils.clamp(target.current.x + deltaY * 0.006, -0.72, 0.72);
    drag.current.x = event.clientX;
    drag.current.y = event.clientY;
    artifact.current?.rotation.set(target.current.x, target.current.y, 0);
    invalidate();
  };
  const endDrag = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    drag.current.active = false;
    setDragging(false);
    const targetElement = event.nativeEvent.target as Element | null;
    if (targetElement?.hasPointerCapture(event.pointerId)) {
      targetElement.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <group>
      <group ref={artifact} rotation={[-0.06, -0.12, 0]}>
        <mesh position={[0, -0.15, 0]}>
          <boxGeometry args={[3.12, 1.82, 0.22]} />
          <meshPhysicalMaterial
            color={palette.surface}
            roughness={0.35}
            metalness={0.78}
            clearcoat={0.5}
            clearcoatRoughness={0.25}
          />
        </mesh>
        {/* 4 Rugged Armor Corner Bumpers (SmallHD / Atomos style) */}
        {(
          [
            [-1.56, 0.76, 0],
            [1.56, 0.76, 0],
            [-1.56, -1.06, 0],
            [1.56, -1.06, 0],
          ] as const
        ).map(([x, y, z], index) => (
          <mesh key={index} position={[x, y, z]}>
            <boxGeometry args={[0.12, 0.2, 0.25]} />
            <meshPhysicalMaterial color={palette.raised} roughness={0.22} metalness={0.88} />
          </mesh>
        ))}
        {/* Rear V-Mount Battery & Cooling Module on Back */}
        <mesh position={[0, -0.15, -0.13]}>
          <boxGeometry args={[1.1, 1.2, 0.04]} />
          <meshPhysicalMaterial color={palette.raised} roughness={0.4} metalness={0.65} />
        </mesh>
        <FrontFace
          palette={palette}
          ready={ready}
          projectCount={projectCount}
          recentProjectTitle={recentProjectTitle}
        />
        <BackFace
          palette={palette}
          ready={ready}
          projectCount={projectCount}
          recentProjectTitle={recentProjectTitle}
        />
        <MonitorTopArmor palette={palette} />
      </group>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the labelled canvas uses this stationary transparent Three.js mesh for pointer rotation; keyboard users have a separate reset button */}
      <mesh
        position={[0, 0, 1.2]}
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={(event) => {
          event.stopPropagation();
          resetView();
        }}
      >
        <planeGeometry args={[4.5, 3.25]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh position={[0, -1.58, -0.8]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.8, 64]} />
        <meshBasicMaterial color={palette.surface} transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.2, -1.1]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.15, 0.008, 6, 120]} />
        <meshBasicMaterial color={palette.line} transparent opacity={0.3} />
      </mesh>
      <pointLight
        position={[0.4, 0.5, 2.6]}
        color={ready ? palette.signal : palette.accent}
        intensity={ready ? 5.2 : 3.1}
        distance={6}
      />
    </group>
  );
}

function ArtifactScene({
  theme,
  workerReady,
  projectCount,
  recentProjectTitle,
}: {
  theme: ThemeName;
  workerReady: boolean;
  projectCount: number;
  recentProjectTitle: string | null;
}) {
  const palette = palettes[theme];
  const brightTheme = theme !== "noir";
  const { size } = useThree();
  const artifactScale = size.width < 500 ? 0.62 : size.width < 880 ? 0.82 : 1;
  return (
    <>
      <EnvironmentController theme={theme} />
      <ambientLight intensity={brightTheme ? 1.65 : 0.72} />
      <directionalLight
        position={[-3, 4, 5]}
        intensity={brightTheme ? 2.3 : 1.7}
        color={palette.accent}
      />
      <directionalLight position={[4, -1, 3]} intensity={1.1} color={palette.signal} />
      <group position={[0, 0, 0]} scale={artifactScale}>
        <BoardArtifact
          palette={palette}
          ready={workerReady}
          projectCount={projectCount}
          recentProjectTitle={recentProjectTitle}
        />
      </group>
      <Dust color={palette.dust} />
    </>
  );
}

function PixelDensityController({ density }: { density: number }) {
  const gl = useThree((state) => state.gl);
  const height = useThree((state) => state.size.height);
  const invalidate = useThree((state) => state.invalidate);
  const setDpr = useThree((state) => state.setDpr);
  const width = useThree((state) => state.size.width);

  useLayoutEffect(() => {
    if (width <= 0 || height <= 0) return;
    // Some software-WebGL hosts initialize Three with a 1x backing buffer even when the browser
    // advertises a high DPR. Synchronize both R3F state and the renderer after layout so the
    // director board does not become blurry on high-density or browser-zoomed displays.
    setDpr(density);
    gl.setPixelRatio(density);
    gl.setSize(width, height, false);
    invalidate();
  }, [density, gl, height, invalidate, setDpr, width]);

  return null;
}

class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    /* The CSS fallback keeps project access usable when WebGL is unavailable. */
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function SceneFallback() {
  return (
    <div className="universe-fallback artifact-fallback" aria-hidden="true">
      <i />
      <i />
      <i />
      <span />
    </div>
  );
}

export function StudioUniverse({
  quality,
  workerReady,
  projectCount,
  recentProjectTitle,
}: {
  quality: "balanced" | "full";
  workerReady: boolean;
  projectCount: number;
  recentProjectTitle: string | null;
}) {
  const theme = usePageTheme();
  const densityBounds = quality === "full" ? ([1.5, 2] as const) : ([1.25, 1.75] as const);
  const deviceDensity = typeof window === "undefined" ? 1 : (window.devicePixelRatio ?? 1);
  const renderDensity = Math.min(densityBounds[1], Math.max(densityBounds[0], deviceDensity));
  return (
    <div
      className="studio-universe artifact-universe"
      role="img"
      aria-label="可旋转的 YoYoTV 三维导演板，正面是产品主页，背面展示创作谱系"
    >
      <SceneBoundary fallback={<SceneFallback />}>
        <Canvas
          className="universe-webgl"
          dpr={renderDensity}
          frameloop="demand"
          camera={{ position: [0, 0.08, 6.5], fov: 32, near: 0.1, far: 40 }}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: "high-performance",
          }}
          onCreated={({ gl, scene }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            gl.setClearColor(0x000000, 0);
            gl.setClearAlpha(0);
            scene.background = null;
          }}
        >
          <PixelDensityController density={renderDensity} />
          <ArtifactScene
            theme={theme}
            workerReady={workerReady}
            projectCount={projectCount}
            recentProjectTitle={recentProjectTitle}
          />
        </Canvas>
      </SceneBoundary>
    </div>
  );
}
