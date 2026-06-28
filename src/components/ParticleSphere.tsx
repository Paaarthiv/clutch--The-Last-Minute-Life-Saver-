import React, { useRef, useEffect } from "react";

export interface RepelNode { ox: number; oy: number; rx: number; ry: number; }

/**
 * Interactive 3D particle sphere (Fibonacci-distributed dots, perspective projection).
 * - Slowly rotates, repels dots near the cursor.
 * - Each node in `nodes` repels the dots around it (ellipse sized to the pill) and clears
 *   a hole so a label can sit cleanly over the sphere.
 * - `onGeo` reports the sphere's pixel geometry so overlays can be positioned exactly.
 */
export function ParticleSphere({
  nodes = [],
  onGeo,
  count = 2600,
  pillForce = 2.2,
  pillFieldA = 26,
  pillFieldB = 22,
  pillClear = 6,
  radiusScale = 1,
  cyRatio = 0.5,
}: {
  nodes?: RepelNode[];
  onGeo?: (g: { cx: number; cy: number; r: number }) => void;
  count?: number;
  pillForce?: number;   // how hard each pill pushes the dots
  pillFieldA?: number;  // extra px on the repel ellipse (x)
  pillFieldB?: number;  // extra px on the repel ellipse (y)
  pillClear?: number;   // px of dots cleared behind a pill
  radiusScale?: number; // multiply the computed radius (make the ball bigger/smaller)
  cyRatio?: number;     // vertical centre as a fraction of height (0.5 = middle, lower = higher up)
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -9999, y: -9999, inside: false });
  const nodesRef = useRef(nodes); nodesRef.current = nodes;
  const onGeoRef = useRef(onGeo); onGeoRef.current = onGeo;
  const cfgRef = useRef({ pillForce, pillFieldA, pillFieldB, pillClear, radiusScale, cyRatio });
  cfgRef.current = { pillForce, pillFieldA, pillFieldB, pillClear, radiusScale, cyRatio };

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    const N = count;
    const base: { x: number; y: number; z: number }[] = [];
    for (let i = 0; i < N; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / N);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      base.push({ x: Math.sin(phi) * Math.cos(theta), y: Math.sin(phi) * Math.sin(theta), z: Math.cos(phi) });
    }
    const off = base.map(() => ({ dx: 0, dy: 0, vx: 0, vy: 0 }));

    let W = 0, H = 0, cx = 0, cy = 0, R = 0;
    const resize = () => {
      W = wrap.clientWidth; H = wrap.clientHeight;
      canvas.width = W * DPR; canvas.height = H * DPR;
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const cfg = cfgRef.current;
      cx = W / 2; cy = H * cfg.cyRatio; R = Math.min(W * 0.46, H * 0.62) * cfg.radiusScale;
      if (onGeoRef.current) onGeoRef.current({ cx, cy, r: R });
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    let angY = 0;
    const angX = 0.42;
    const cosX = Math.cos(angX), sinX = Math.sin(angX);
    let raf = 0;

    const render = () => {
      ctx.clearRect(0, 0, W, H);
      angY += 0.0015;
      const cosY = Math.cos(angY), sinY = Math.sin(angY);
      const m = mouse.current;
      const pts: { sx: number; sy: number; z: number }[] = [];
      for (let i = 0; i < N; i++) {
        const b = base[i];
        let x = b.x * cosY + b.z * sinY;
        let z = -b.x * sinY + b.z * cosY;
        let y = b.y;
        const y2 = y * cosX - z * sinX;
        const z2 = y * sinX + z * cosX;
        y = y2; z = z2;
        const persp = 1 / (1.9 - z * 0.6);
        let sx = cx + x * R * persp;
        let sy = cy + y * R * persp;

        const o = off[i];
        if (m.inside) {
          const ddx = sx - m.x, ddy = sy - m.y;
          const dist = Math.hypot(ddx, ddy);
          const infl = R * 0.5;
          if (dist < infl && dist > 0.01) {
            const f = (1 - dist / infl) * 1.4;
            o.vx += (ddx / dist) * f;
            o.vy += (ddy / dist) * f;
          }
        }
        // Each pill repels the dots around a rounded-rectangle-like field sized to the pill.
        const nds = nodesRef.current;
        const cfg = cfgRef.current;
        for (let k = 0; k < nds.length; k++) {
          const nd = nds[k];
          const nxp = cx + nd.ox * R, nyp = cy + nd.oy * R;
          const ndx = sx - nxp, ndy = sy - nyp;
          const PA = nd.rx + cfg.pillFieldA, PB = nd.ry + cfg.pillFieldB;
          const qx = Math.abs(ndx) / PA, qy = Math.abs(ndy) / PB;
          const ned = Math.pow(qx * qx * qx * qx + qy * qy * qy * qy, 0.25);
          if (ned < 1) {
            const dlen = Math.hypot(ndx, ndy) || 1;
            const bf = (1 - ned) * cfg.pillForce;
            o.vx += (ndx / dlen) * bf;
            o.vy += (ndy / dlen) * bf;
          }
        }
        o.vx += -o.dx * 0.06; o.vy += -o.dy * 0.06;
        o.vx *= 0.86; o.vy *= 0.86;
        o.dx += o.vx; o.dy += o.vy;
        sx += o.dx; sy += o.dy;
        // Never render a dot on top of any pill. Use the same superellipse shape
        // as the repel field so the cleared area follows the rounded pill silhouette.
        let hidden = false;
        for (let k = 0; k < nds.length; k++) {
          const nd = nds[k];
          const nxp = cx + nd.ox * R, nyp = cy + nd.oy * R;
          const PA = nd.rx + cfg.pillClear, PB = nd.ry + cfg.pillClear;
          const qx = Math.abs(sx - nxp) / PA, qy = Math.abs(sy - nyp) / PB;
          if (qx * qx * qx * qx + qy * qy * qy * qy < 1) { hidden = true; break; }
        }
        if (hidden) continue;
        pts.push({ sx, sy, z });
      }
      pts.sort((a, b) => a.z - b.z);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const depth = (p.z + 1) / 2;
        const size = 0.6 + depth * 1.7;
        const alpha = 0.18 + depth * 0.62;
        const g = Math.round(96 + depth * 40);
        const bl = Math.round(105 + depth * 50);
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(20, ${g}, ${bl}, ${alpha.toFixed(3)})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  const onMove = (e: React.MouseEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    mouse.current = { x: e.clientX - r.left, y: e.clientY - r.top, inside: true };
  };
  const onLeave = () => { mouse.current.inside = false; };

  return (
    <div ref={wrapRef} onMouseMove={onMove} onMouseLeave={onLeave} className="relative w-full h-full">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
