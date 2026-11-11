import { useCallback, useEffect, useRef, useState } from "react";

type MaskEditorProps = {
  imageUrl: string;
  imageName: string;
  maskUrl?: string | null | undefined;
  onClose: () => void;
  onSave: (maskBlob: Blob) => Promise<void> | void;
};

type Tool = "brush" | "eraser" | "marquee";
type OutputMode = "original" | "color";

const QUICK_COLORS: Record<string, string> = {
  green: "#34d399",
  white: "#ffffff",
  black: "#000000",
};

const OVERLAY_COLORS: Record<string, { label: string; hex: string }> = {
  white: { label: "白", hex: "#ffffff" },
  red: { label: "红", hex: "#ff3030" },
  orange: { label: "橙", hex: "#ff8c20" },
  yellow: { label: "黄", hex: "#ffe52e" },
  green: { label: "绿", hex: "#28d66f" },
  cyan: { label: "青", hex: "#24d9d1" },
  blue: { label: "蓝", hex: "#347cff" },
  purple: { label: "紫", hex: "#b04cff" },
  gray: { label: "灰", hex: "#808080" },
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// Flood-fill hole closing algorithm matching Goohai's native implementation
function fillMaskHoles(sourceCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const sctx = sourceCanvas.getContext("2d");
  const octx = out.getContext("2d");
  if (!sctx || !octx) return sourceCanvas;

  const source = sctx.getImageData(0, 0, w, h);
  const result = octx.createImageData(w, h);
  const wall = new Uint8Array(w * h);
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let i = 0; i < wall.length; i++) {
    if (source.data[i * 4 + 3]! > 5) {
      wall[i] = 1;
      const x = i % w;
      const y = (i / w) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) {
    return out;
  }

  minX = Math.max(0, minX - 1);
  minY = Math.max(0, minY - 1);
  maxX = Math.min(w - 1, maxX + 1);
  maxY = Math.min(h - 1, maxY + 1);

  const outside = new Uint8Array(w * h);
  const queue = new Int32Array((maxX - minX + 1) * (maxY - minY + 1));
  let head = 0;
  let tail = 0;

  const visit = (x: number, y: number) => {
    if (x < minX || y < minY || x > maxX || y > maxY) return;
    const idx = y * w + x;
    if (wall[idx] || outside[idx]) return;
    outside[idx] = 1;
    queue[tail++] = idx;
  };

  for (let x = minX; x <= maxX; x++) {
    visit(x, minY);
    visit(x, maxY);
  }
  for (let y = minY; y <= maxY; y++) {
    visit(minX, y);
    visit(maxX, y);
  }

  while (head < tail) {
    const idx = queue[head++]!;
    const x = idx % w;
    const y = (idx / w) | 0;
    visit(x - 1, y);
    visit(x + 1, y);
    visit(x, y - 1);
    visit(x, y + 1);
  }

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const idx = y * w + x;
      if (!wall[idx] && outside[idx]) continue;
      const off = idx * 4;
      result.data[off] = source.data[off] || 52;
      result.data[off + 1] = source.data[off + 1] || 211;
      result.data[off + 2] = source.data[off + 2] || 153;
      result.data[off + 3] = 255;
    }
  }

  octx.putImageData(result, 0, 0);
  return out;
}

export function MaskEditor({ imageUrl, imageName, maskUrl, onClose, onSave }: MaskEditorProps) {
  const [tool, setTool] = useState<Tool>("brush");
  const [quickColor, setQuickColor] = useState<string>("green");
  const [outputMode, setOutputMode] = useState<OutputMode>("color");
  const [overlayColorKey, setOverlayColorKey] = useState<string>("green");
  const [overlayOpacity, setOverlayOpacity] = useState<number>(50);
  const [autoFillHoles, setAutoFillHoles] = useState<boolean>(false);
  const [brushSize, setBrushSize] = useState<number>(38);
  const [busy, setBusy] = useState(false);
  const [imageDims, setImageDims] = useState<{ width: number; height: number; naturalW: number; naturalH: number } | null>(null);

  // Undo / Redo history
  const [historyLength, setHistoryLength] = useState(0);
  const [redoLength, setRedoLength] = useState(0);

  // Transform (pan & zoom)
  const [transform, setTransform] = useState<{ scale: number; x: number; y: number }>({ scale: 1, x: 0, y: 0 });

  // Mouse & interaction states
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const paintCanvasRef = useRef<HTMLCanvasElement>(null);
  const marqueeCanvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  // Working mask canvases
  const rawMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const historyRef = useRef<ImageData[]>([]);
  const redoRef = useRef<ImageData[]>([]);

  // Interaction refs
  const isDrawing = useRef(false);
  const isPanning = useRef(false);
  const isRightResizing = useRef(false);
  const rightResizeStart = useRef<{ x: number; size: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const lastDrawPos = useRef<{ x: number; y: number } | null>(null);
  const isSpaceDown = useRef(false);
  const isAltDown = useRef(false);

  // Marquee state
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);
  const marqueeDraft = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const dashOffsetRef = useRef(0);
  const rafMarquee = useRef<number>(0);

  const activeColorHex = outputMode === "color"
    ? OVERLAY_COLORS[overlayColorKey]?.hex || "#28d66f"
    : QUICK_COLORS[quickColor] || "#34d399";

  // Repaint visible canvas from rawMaskCanvas (with hole filling / opacity / color if needed)
  const refreshDisplay = useCallback(() => {
    const visible = paintCanvasRef.current;
    const raw = rawMaskCanvasRef.current;
    if (!visible || !raw) return;
    const vctx = visible.getContext("2d");
    if (!vctx) return;

    vctx.clearRect(0, 0, visible.width, visible.height);

    const sourceCanvas = autoFillHoles ? fillMaskHoles(raw) : raw;

    // Apply color and opacity
    vctx.save();
    vctx.globalAlpha = outputMode === "color" ? overlayOpacity / 100 : 0.65;
    vctx.drawImage(sourceCanvas, 0, 0);
    vctx.restore();
  }, [autoFillHoles, outputMode, overlayOpacity]);

  // Recolor raw mask when color changes
  const recolorRawMask = useCallback((hexColor: string) => {
    const raw = rawMaskCanvasRef.current;
    if (!raw) return;
    const ctx = raw.getContext("2d");
    if (!ctx) return;
    const imgData = ctx.getImageData(0, 0, raw.width, raw.height);
    const data = imgData.data;

    // Parse hex
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! > 5) {
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, []);

  const pushHistory = useCallback(() => {
    const raw = rawMaskCanvasRef.current;
    if (!raw) return;
    const ctx = raw.getContext("2d");
    if (!ctx) return;
    const snap = ctx.getImageData(0, 0, raw.width, raw.height);
    historyRef.current.push(snap);
    if (historyRef.current.length > 25) historyRef.current.shift();
    redoRef.current = [];
    setHistoryLength(historyRef.current.length);
    setRedoLength(0);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyRef.current.length <= 1) return;
    const current = historyRef.current.pop()!;
    redoRef.current.push(current);
    const prev = historyRef.current[historyRef.current.length - 1];
    if (prev && rawMaskCanvasRef.current) {
      const ctx = rawMaskCanvasRef.current.getContext("2d");
      ctx?.putImageData(prev, 0, 0);
      refreshDisplay();
    }
    setHistoryLength(historyRef.current.length);
    setRedoLength(redoRef.current.length);
  }, [refreshDisplay]);

  const handleRedo = useCallback(() => {
    if (redoRef.current.length === 0) return;
    const next = redoRef.current.pop()!;
    historyRef.current.push(next);
    if (rawMaskCanvasRef.current) {
      const ctx = rawMaskCanvasRef.current.getContext("2d");
      ctx?.putImageData(next, 0, 0);
      refreshDisplay();
    }
    setHistoryLength(historyRef.current.length);
    setRedoLength(redoRef.current.length);
  }, [refreshDisplay]);

  const handleClear = useCallback(() => {
    const raw = rawMaskCanvasRef.current;
    if (!raw) return;
    const ctx = raw.getContext("2d");
    ctx?.clearRect(0, 0, raw.width, raw.height);
    pushHistory();
    refreshDisplay();
  }, [pushHistory, refreshDisplay]);

  const handleInvert = useCallback(() => {
    const raw = rawMaskCanvasRef.current;
    if (!raw) return;
    const ctx = raw.getContext("2d");
    if (!ctx) return;
    const imgData = ctx.getImageData(0, 0, raw.width, raw.height);
    const data = imgData.data;

    const hexColor = activeColorHex;
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3]! > 10) {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
        data[i + 3] = 0;
      } else {
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = b;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
    pushHistory();
    refreshDisplay();
  }, [activeColorHex, pushHistory, refreshDisplay]);

  // Load image and initialize canvas
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const nw = img.naturalWidth || 800;
    const nh = img.naturalHeight || 600;
    const maxSide = 1536;
    const sf = Math.max(nw, nh) > maxSide ? maxSide / Math.max(nw, nh) : 1;
    const editW = Math.max(1, Math.round(nw * sf));
    const editH = Math.max(1, Math.round(nh * sf));

    setImageDims({ width: editW, height: editH, naturalW: nw, naturalH: nh });

    const raw = document.createElement("canvas");
    raw.width = editW;
    raw.height = editH;
    rawMaskCanvasRef.current = raw;

    const visible = paintCanvasRef.current;
    if (visible) {
      visible.width = editW;
      visible.height = editH;
    }

    if (maskUrl) {
      const maskImg = new Image();
      maskImg.crossOrigin = "anonymous";
      maskImg.onload = () => {
        const ctx = raw.getContext("2d");
        if (ctx) {
          ctx.drawImage(maskImg, 0, 0, editW, editH);
        }
        pushHistory();
        refreshDisplay();
      };
      maskImg.onerror = () => {
        pushHistory();
        refreshDisplay();
      };
      maskImg.src = maskUrl;
    } else {
      pushHistory();
      refreshDisplay();
    }
  }, [maskUrl, pushHistory, refreshDisplay]);

  // Convert client mouse coordinates to mask canvas coordinates
  const getCanvasPos = useCallback((clientX: number, clientY: number) => {
    const canvas = paintCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  }, []);

  // Update cursor position and size
  const updateCursor = useCallback((clientX: number, clientY: number) => {
    const cursor = cursorRef.current;
    const stage = stageRef.current;
    const canvas = paintCanvasRef.current;
    if (!cursor || !stage || !canvas) return;

    if (isSpaceDown.current) {
      cursor.style.display = "none";
      stage.style.cursor = "grab";
      return;
    }
    if (tool === "marquee") {
      cursor.style.display = "none";
      stage.style.cursor = "crosshair";
      return;
    }

    stage.style.cursor = "none";
    const stageRect = stage.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const displayScale = canvasRect.width / Math.max(1, canvas.width);
    const size = Math.max(4, brushSize * displayScale);

    cursor.style.display = "block";
    cursor.style.width = `${size}px`;
    cursor.style.height = `${size}px`;
    cursor.style.left = `${clientX - stageRect.left - size / 2}px`;
    cursor.style.top = `${clientY - stageRect.top - size / 2}px`;
  }, [brushSize, tool]);

  // Draw stroke
  const drawStroke = useCallback((from: { x: number; y: number }, to: { x: number; y: number }) => {
    const raw = rawMaskCanvasRef.current;
    if (!raw) return;
    const ctx = raw.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const isEraser = tool === "eraser" || isAltDown.current;
    if (isEraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "#fff";
      ctx.fillStyle = "#fff";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = activeColorHex;
      ctx.fillStyle = activeColorHex;
    }

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(to.x, to.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    refreshDisplay();
  }, [activeColorHex, brushSize, refreshDisplay, tool]);

  // Fill marquee selection into mask
  const commitMarquee = useCallback(() => {
    const draft = marqueeDraft.current;
    const raw = rawMaskCanvasRef.current;
    if (!draft || !raw || draft.w <= 1 || draft.h <= 1) return;
    const ctx = raw.getContext("2d");
    if (!ctx) return;

    ctx.save();
    const isEraser = tool === "eraser" || isAltDown.current;
    if (isEraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "#fff";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = activeColorHex;
    }
    ctx.fillRect(draft.x, draft.y, draft.w, draft.h);
    ctx.restore();

    marqueeDraft.current = null;
    pushHistory();
    refreshDisplay();
  }, [activeColorHex, pushHistory, refreshDisplay, tool]);

  // Draw marching ants marquee animation
  const redrawMarquee = useCallback(() => {
    const canvas = marqueeCanvasRef.current;
    const stage = stageRef.current;
    const paint = paintCanvasRef.current;
    if (!canvas || !stage || !paint) return;

    const srect = stage.getBoundingClientRect();
    if (canvas.width !== srect.width || canvas.height !== srect.height) {
      canvas.width = srect.width;
      canvas.height = srect.height;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const draft = marqueeDraft.current;
    if (!draft) return;

    const prect = paint.getBoundingClientRect();
    const sx = prect.width / paint.width;
    const sy = prect.height / paint.height;
    const screenX = prect.left - srect.left + draft.x * sx;
    const screenY = prect.top - srect.top + draft.y * sy;
    const screenW = draft.w * sx;
    const screenH = draft.h * sy;

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -dashOffsetRef.current;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(screenX, screenY, screenW, screenH);
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -dashOffsetRef.current + 4;
    ctx.strokeStyle = "#000";
    ctx.strokeRect(screenX, screenY, screenW, screenH);
    ctx.restore();
  }, []);

  // Animation loop for marquee dashOffset
  useEffect(() => {
    let last = performance.now();
    const loop = (now: number) => {
      dashOffsetRef.current = (dashOffsetRef.current + (now - last) * 0.03) % 8;
      last = now;
      redrawMarquee();
      rafMarquee.current = requestAnimationFrame(loop);
    };
    rafMarquee.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafMarquee.current);
  }, [redrawMarquee]);

  // Mouse wheel: zoom centered on mouse
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    setTransform((prev) => {
      const nextScale = clamp(prev.scale * factor, 0.2, 10);
      const stage = stageRef.current;
      if (!stage) return { ...prev, scale: nextScale };
      const rect = stage.getBoundingClientRect();
      const mx = e.clientX - rect.left - rect.width / 2;
      const my = e.clientY - rect.top - rect.height / 2;
      const ratio = nextScale / prev.scale;
      return {
        scale: nextScale,
        x: mx + (prev.x - mx) * ratio,
        y: my + (prev.y - my) * ratio,
      };
    });
  }, []);

  // Pointer down handler
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".guhai-mask-panel")) return;

    // Pan with Space + Left Click OR Middle Click
    if (isSpaceDown.current || e.button === 1) {
      e.preventDefault();
      isPanning.current = true;
      panStart.current = { x: e.clientX, y: e.clientY, ox: transform.x, oy: transform.y };
      return;
    }

    // Right-click drag to resize brush
    if (e.button === 2) {
      e.preventDefault();
      isRightResizing.current = true;
      rightResizeStart.current = { x: e.clientX, size: brushSize };
      return;
    }

    if (e.button !== 0) return;

    if (tool === "marquee") {
      const pos = getCanvasPos(e.clientX, e.clientY);
      marqueeStart.current = pos;
      marqueeDraft.current = { x: pos.x, y: pos.y, w: 0, h: 0 };
      return;
    }

    // Drawing brush/eraser
    isDrawing.current = true;
    const pos = getCanvasPos(e.clientX, e.clientY);
    lastDrawPos.current = pos;
    drawStroke(pos, pos);
  }, [brushSize, drawStroke, getCanvasPos, tool, transform.x, transform.y]);

  // Pointer move handler
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    updateCursor(e.clientX, e.clientY);

    // Right click resize
    if (isRightResizing.current && rightResizeStart.current) {
      const dx = e.clientX - rightResizeStart.current.x;
      const newSize = clamp(rightResizeStart.current.size + Math.round(dx / 2), 2, 300);
      setBrushSize(newSize);
      return;
    }

    // Panning
    if (isPanning.current && panStart.current) {
      setTransform((prev) => ({
        ...prev,
        x: panStart.current!.ox + (e.clientX - panStart.current!.x),
        y: panStart.current!.oy + (e.clientY - panStart.current!.y),
      }));
      return;
    }

    // Marquee dragging
    if (tool === "marquee" && marqueeStart.current) {
      const pos = getCanvasPos(e.clientX, e.clientY);
      const x0 = Math.min(marqueeStart.current.x, pos.x);
      const y0 = Math.min(marqueeStart.current.y, pos.y);
      const w = Math.abs(pos.x - marqueeStart.current.x);
      const h = Math.abs(pos.y - marqueeStart.current.y);
      marqueeDraft.current = { x: x0, y: y0, w, h };
      redrawMarquee();
      return;
    }

    // Drawing
    if (isDrawing.current && lastDrawPos.current) {
      const pos = getCanvasPos(e.clientX, e.clientY);
      drawStroke(lastDrawPos.current, pos);
      lastDrawPos.current = pos;
    }
  }, [drawStroke, getCanvasPos, redrawMarquee, tool, updateCursor]);

  // Pointer up handler
  const onPointerUp = useCallback(() => {
    if (isRightResizing.current) {
      isRightResizing.current = false;
      rightResizeStart.current = null;
    }
    if (isPanning.current) {
      isPanning.current = false;
      panStart.current = null;
    }
    if (tool === "marquee" && marqueeStart.current) {
      marqueeStart.current = null;
      commitMarquee();
    }
    if (isDrawing.current) {
      isDrawing.current = false;
      lastDrawPos.current = null;
      pushHistory();
    }
  }, [commitMarquee, pushHistory, tool]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === "Space") {
        isSpaceDown.current = true;
        if (stageRef.current) stageRef.current.style.cursor = "grab";
        if (cursorRef.current) cursorRef.current.style.display = "none";
      }
      if (e.key === "Alt") {
        isAltDown.current = true;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        handleInvert();
      }
      if (e.key.toLowerCase() === "b") setTool("brush");
      if (e.key.toLowerCase() === "e") setTool("eraser");
      if (e.key.toLowerCase() === "m") setTool("marquee");
      if (e.key.toLowerCase() === "x") handleClear();
      if (e.key === "Escape") onClose();
      if (e.key === "[") setBrushSize((s) => clamp(s - 5, 2, 300));
      if (e.key === "]") setBrushSize((s) => clamp(s + 5, 2, 300));
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        isSpaceDown.current = false;
        if (stageRef.current) stageRef.current.style.cursor = "none";
      }
      if (e.key === "Alt") {
        isAltDown.current = false;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [handleClear, handleInvert, handleRedo, handleUndo, onClose]);

  // Handle color change recoloring
  useEffect(() => {
    recolorRawMask(activeColorHex);
    refreshDisplay();
  }, [activeColorHex, recolorRawMask, refreshDisplay]);

  // Export green mask RGBA PNG blob (transparent for unmasked, #28d66f for masked)
  const handleSave = useCallback(async () => {
    const raw = rawMaskCanvasRef.current;
    if (!raw || !imageDims) return;
    setBusy(true);

    try {
      const sourceCanvas = autoFillHoles ? fillMaskHoles(raw) : raw;
      const sctx = sourceCanvas.getContext("2d");
      if (!sctx) throw new Error("无法读取遮罩画布");

      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = imageDims.naturalW;
      exportCanvas.height = imageDims.naturalH;
      const ectx = exportCanvas.getContext("2d");
      if (!ectx) throw new Error("无法创建导出画布");

      // Intermediate canvas for scaling to natural resolution
      const scaledCanvas = document.createElement("canvas");
      scaledCanvas.width = imageDims.naturalW;
      scaledCanvas.height = imageDims.naturalH;
      const scaledCtx = scaledCanvas.getContext("2d");
      if (scaledCtx) {
        scaledCtx.imageSmoothingEnabled = false;
        scaledCtx.drawImage(sourceCanvas, 0, 0, exportCanvas.width, exportCanvas.height);
        const sdata = scaledCtx.getImageData(0, 0, exportCanvas.width, exportCanvas.height);
        const edata = ectx.createImageData(exportCanvas.width, exportCanvas.height);

        // Green (#28d66f: r=40, g=214, b=111, a=255) for painted mask pixels, alpha 0 for unpainted
        for (let i = 0; i < sdata.data.length; i += 4) {
          if (sdata.data[i + 3]! > 10) {
            edata.data[i] = 40;
            edata.data[i + 1] = 214;
            edata.data[i + 2] = 111;
            edata.data[i + 3] = 255;
          } else {
            edata.data[i + 3] = 0;
          }
        }
        ectx.putImageData(edata, 0, 0);
      }

      const blob = await new Promise<Blob | null>((resolve) =>
        exportCanvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("生成遮罩图片失败");
      await onSave(blob);
    } finally {
      setBusy(false);
    }
  }, [autoFillHoles, imageDims, onSave]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        background: "#15171b",
        color: "#f0f2f5",
        fontFamily: '"PingFang SC", "Microsoft YaHei", Arial, sans-serif',
        display: "flex",
        flexDirection: "column",
        userSelect: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Top Toolbar matching Goohai .guhai-mask-toolbar */}
      <header
        style={{
          minHeight: "48px",
          display: "flex",
          alignItems: "center",
          gap: "14px",
          padding: "8px 16px",
          background: "#202329",
          borderBottom: "1px solid #353a43",
          boxShadow: "0 8px 24px rgba(0,0,0,0.26)",
          position: "relative",
          zIndex: 15,
        }}
      >
        {/* Left Tools */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
          <div
            style={{
              display: "flex",
              overflow: "hidden",
              border: "1px solid #454b56",
              borderRadius: "999px",
              background: "#181a1f",
            }}
          >
            <button
              type="button"
              onClick={() => setTool("brush")}
              title="画笔 (B)"
              style={{
                border: 0,
                background: tool === "brush" ? "#45c7bf" : "transparent",
                color: tool === "brush" ? "#fff" : "#c6cbd3",
                fontSize: "14px",
                fontWeight: 700,
                padding: "7px 14px",
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              画笔
            </button>
            <button
              type="button"
              onClick={() => setTool("eraser")}
              title="橡皮擦 (E)"
              style={{
                border: 0,
                background: tool === "eraser" ? "#45c7bf" : "transparent",
                color: tool === "eraser" ? "#fff" : "#c6cbd3",
                fontSize: "14px",
                fontWeight: 700,
                padding: "7px 14px",
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              橡皮擦
            </button>
            <button
              type="button"
              onClick={() => setTool("marquee")}
              title="选框 (M)"
              style={{
                border: 0,
                background: tool === "marquee" ? "#45c7bf" : "transparent",
                color: tool === "marquee" ? "#fff" : "#c6cbd3",
                fontSize: "14px",
                fontWeight: 700,
                padding: "7px 14px",
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              选框
            </button>
          </div>

          {/* Quick Swatches */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {Object.entries(QUICK_COLORS).map(([key, hex]) => (
              <button
                key={key}
                type="button"
                onClick={() => setQuickColor(key)}
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  border: "1px solid #626a78",
                  background: hex,
                  cursor: "pointer",
                  outline: quickColor === key ? "2px solid #45c7bf" : "none",
                  outlineOffset: "2px",
                  transform: quickColor === key ? "scale(1.08)" : "none",
                }}
              />
            ))}
          </div>

          <span
            style={{
              fontSize: "12px",
              color: "#aeb5c0",
              fontFamily: '"JetBrains Mono", Consolas, monospace',
              minWidth: "48px",
            }}
          >
            {brushSize}px
          </span>
        </div>

        {/* Center Hint */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: "12px",
            fontWeight: 700,
            color: "#487d7d",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          鼠标右键左右拖动调节画笔大小
        </div>

        {/* Right Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "flex-end", flex: 1 }}>
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyLength <= 1}
            title="撤销 (Ctrl+Z)"
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "50%",
              border: "1px solid transparent",
              background: "transparent",
              color: historyLength <= 1 ? "#555" : "#c6cbd3",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: historyLength <= 1 ? "default" : "pointer",
              fontWeight: 800,
              fontSize: "16px",
            }}
          >
            ↺
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={redoLength === 0}
            title="重做 (Ctrl+Shift+Z / Ctrl+Y)"
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "50%",
              border: "1px solid transparent",
              background: "transparent",
              color: redoLength === 0 ? "#555" : "#c6cbd3",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: redoLength === 0 ? "default" : "pointer",
              fontWeight: 800,
              fontSize: "16px",
            }}
          >
            ↻
          </button>
          <button
            type="button"
            onClick={handleInvert}
            title="反转 (Ctrl+I)"
            style={{
              height: "30px",
              borderRadius: "999px",
              border: "1px solid #4a5260",
              background: "transparent",
              color: "#d7dbe2",
              fontSize: "13px",
              fontWeight: 700,
              padding: "0 14px",
              cursor: "pointer",
            }}
          >
            反转
          </button>
          <button
            type="button"
            onClick={handleClear}
            title="清空 (X)"
            style={{
              height: "30px",
              borderRadius: "999px",
              border: "1px solid #4a5260",
              background: "transparent",
              color: "#d7dbe2",
              fontSize: "13px",
              fontWeight: 700,
              padding: "0 14px",
              cursor: "pointer",
            }}
          >
            清空
          </button>
          <button
            type="button"
            onClick={onClose}
            title="取消 (Esc)"
            style={{
              height: "30px",
              borderRadius: "999px",
              border: "1px solid #4a5260",
              background: "transparent",
              color: "#d7dbe2",
              fontSize: "13px",
              fontWeight: 700,
              padding: "0 14px",
              cursor: "pointer",
            }}
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy}
            title="保存遮罩 (Enter)"
            style={{
              height: "30px",
              borderRadius: "999px",
              border: 0,
              background: "#45c7bf",
              color: "#111318",
              fontSize: "13px",
              fontWeight: 800,
              padding: "0 18px",
              cursor: busy ? "wait" : "pointer",
              boxShadow: "0 3px 12px rgba(69,199,191,0.35)",
            }}
          >
            {busy ? "保存中…" : "保存遮罩"}
          </button>
        </div>
      </header>

      {/* Main Viewport Stage */}
      <div
        ref={stageRef}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          if (cursorRef.current) cursorRef.current.style.display = "none";
        }}
        style={{
          position: "relative",
          flex: 1,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111318",
          touchAction: "none",
        }}
      >
        {/* Left Floating Output Panel matching Goohai .guhai-mask-output-panel */}
        <div
          className="guhai-mask-panel"
          style={{
            position: "absolute",
            left: "14px",
            top: "14px",
            zIndex: 12,
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            width: "222px",
            padding: "12px",
            color: "#dce2ea",
            fontSize: "14px",
            userSelect: "none",
            background: "rgba(8, 58, 62, 0.4)",
            border: "1px solid rgba(77, 174, 177, 0.2)",
            borderRadius: "10px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.18)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {/* Output Mode Toggle */}
          <div style={{ display: "flex", width: "100%" }}>
            <div
              style={{
                display: "flex",
                width: "100%",
                overflow: "hidden",
                border: "1px solid rgba(130,145,160,0.65)",
                borderRadius: "999px",
                background: "rgba(18,22,28,0.28)",
              }}
            >
              <button
                type="button"
                onClick={() => setOutputMode("original")}
                style={{
                  flex: 1,
                  border: 0,
                  background: outputMode === "original" ? "rgba(69,199,191,0.78)" : "transparent",
                  color: "#fff",
                  fontSize: "13px",
                  padding: "6px 8px",
                  cursor: "pointer",
                }}
              >
                仅遮罩
              </button>
              <button
                type="button"
                onClick={() => setOutputMode("color")}
                style={{
                  flex: 1,
                  border: 0,
                  background: outputMode === "color" ? "rgba(69,199,191,0.78)" : "transparent",
                  color: "#fff",
                  fontSize: "13px",
                  padding: "6px 8px",
                  cursor: "pointer",
                }}
              >
                颜色叠加
              </button>
            </div>
          </div>

          {/* Color swatches in color overlay mode */}
          {outputMode === "color" && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              {Object.entries(OVERLAY_COLORS).map(([key, item]) => (
                <button
                  key={key}
                  type="button"
                  title={item.label}
                  onClick={() => setOverlayColorKey(key)}
                  style={{
                    width: "17px",
                    height: "17px",
                    borderRadius: "50%",
                    border: "1px solid rgba(255,255,255,0.7)",
                    background: item.hex,
                    cursor: "pointer",
                    outline: overlayColorKey === key ? "2px solid #45c7bf" : "none",
                    outlineOffset: "2px",
                  }}
                />
              ))}
            </div>
          )}

          {/* Opacity slider */}
          {outputMode === "color" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#b9c2ce" }}>透明度</span>
                <span style={{ fontSize: "12px", color: "#c8d1dc", fontFamily: "Consolas, monospace" }}>
                  {overlayOpacity}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#45c7bf", cursor: "pointer" }}
              />
            </div>
          )}

          {/* Auto fill holes toggle switch */}
          <label
            style={{
              display: "grid",
              gridTemplateColumns: "1fr max-content",
              alignItems: "center",
              cursor: "pointer",
              fontSize: "13px",
              color: "#c7d0da",
            }}
          >
            <span>自动填充漏洞</span>
            <input
              type="checkbox"
              checked={autoFillHoles}
              onChange={(e) => setAutoFillHoles(e.target.checked)}
              style={{ display: "none" }}
            />
            <span
              style={{
                position: "relative",
                width: "42px",
                height: "18px",
                borderRadius: "999px",
                background: autoFillHoles ? "#45c7bf" : "rgba(91,101,114,0.72)",
                transition: "background 0.16s ease",
                display: "inline-block",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: "2px",
                  top: "2px",
                  width: "14px",
                  height: "14px",
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.45)",
                  transform: autoFillHoles ? "translateX(24px)" : "translateX(0)",
                  transition: "transform 0.16s ease",
                }}
              />
            </span>
          </label>
        </div>

        {/* Central Transformable Canvas Frame */}
        <div
          style={{
            position: "relative",
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: "center center",
            boxShadow: "0 10px 32px rgba(0,0,0,0.45)",
          }}
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt="底图"
            draggable={false}
            onLoad={onImageLoad}
            style={{
              display: "block",
              maxWidth: "85vw",
              maxHeight: "calc(100vh - 120px)",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
          <canvas
            ref={paintCanvasRef}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
            }}
          />
          {imageDims && (
            <div
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: "100%",
                marginTop: "6px",
                textAlign: "center",
                fontSize: "12px",
                color: "#c8ccd3",
                fontFamily: '"JetBrains Mono", Consolas, monospace',
                pointerEvents: "none",
              }}
            >
              {imageDims.width} × {imageDims.height}
              {imageDims.width !== imageDims.naturalW && (
                <span> (原图 {imageDims.naturalW} × {imageDims.naturalH})</span>
              )}
            </div>
          )}
        </div>

        {/* Marquee marching ants overlay canvas */}
        <canvas
          ref={marqueeCanvasRef}
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 5,
          }}
        />

        {/* Circular Brush Cursor */}
        <div
          ref={cursorRef}
          style={{
            position: "absolute",
            pointerEvents: "none",
            zIndex: 20,
            border: "2px solid #f5f7fb",
            boxShadow: "0 0 0 1px #111318",
            borderRadius: "50%",
            display: "none",
          }}
        />
      </div>
    </div>
  );
}
