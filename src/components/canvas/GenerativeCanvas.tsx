'use client';

import { useCallback, useEffect, useRef } from 'react';
import type { DriftInfo, SpaceKey, UserState } from '@/lib/domain/types';

interface GenerativeCanvasProps {
  state: UserState;
  drift?: DriftInfo;
  onOrbClick?: (space: SpaceKey) => void;
}

interface Orb {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  radius: number;
  targetRadius: number;
  color: [number, number, number];
  targetAlpha: number;
  alpha: number;
  phase: number;
  speed: number;
  label: string;
  spaceKey: SpaceKey;
  pulseBoost: number;
  hoverScale: number;
  hoverGlow: number;
}

const HEALTH_COLOR: [number, number, number] = [64, 224, 208]; // teal
const CONNECTION_COLOR: [number, number, number] = [255, 130, 150]; // rose
const PURPOSE_COLOR: [number, number, number] = [255, 191, 64]; // amber

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function GenerativeCanvas({ state, drift, onOrbClick }: GenerativeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const orbsRef = useRef<Orb[]>([]);
  const animRef = useRef<number>(0);
  const stateRef = useRef(state);
  const driftRef = useRef(drift);
  const hoveredOrbRef = useRef<SpaceKey | null>(null);

  useEffect(() => {
    driftRef.current = drift;
  }, [drift]);

  useEffect(() => {
    stateRef.current = state;

    const [healthOrb, connectionOrb, purposeOrb] = orbsRef.current;
    if (healthOrb && connectionOrb && purposeOrb) {
      healthOrb.targetAlpha = 0.5 + state.health.attention * 0.45;
      healthOrb.targetRadius = 35 + state.health.attention * 90;
      if (Math.abs(healthOrb.targetAlpha - healthOrb.alpha) > 0.05) {
        healthOrb.pulseBoost = 1.0;
      }

      connectionOrb.targetAlpha = 0.5 + state.connection.attention * 0.45;
      connectionOrb.targetRadius = 35 + state.connection.attention * 90;
      if (Math.abs(connectionOrb.targetAlpha - connectionOrb.alpha) > 0.05) {
        connectionOrb.pulseBoost = 1.0;
      }

      purposeOrb.targetAlpha = 0.5 + state.purpose.attention * 0.45;
      purposeOrb.targetRadius = 35 + state.purpose.attention * 90;
      if (Math.abs(purposeOrb.targetAlpha - purposeOrb.alpha) > 0.05) {
        purposeOrb.pulseBoost = 1.0;
      }

      const speedMultiplier = 0.3 + state.energy * 0.7;
      orbsRef.current.forEach((orb) => {
        const spaceDrift = driftRef.current?.[orb.spaceKey];
        const driftSlowdown = spaceDrift?.isDrifting ? 0.6 : 1;
        orb.speed = 0.005 * speedMultiplier * driftSlowdown;

        // Reduce alpha for drifting orbs
        if (spaceDrift?.isDrifting) {
          orb.targetAlpha = Math.max(orb.targetAlpha - 0.12, 0.08);
        }
      });
    }
  }, [state]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onOrbClick) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      for (const orb of orbsRef.current) {
        const dx = x - orb.x;
        const dy = y - orb.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < orb.radius * 1.8) {
          onOrbClick(orb.spaceKey);
          return;
        }
      }
    },
    [onOrbClick],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onOrbClick) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      let found: SpaceKey | null = null;
      for (const orb of orbsRef.current) {
        const dx = x - orb.x;
        const dy = y - orb.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < orb.radius * 1.8) {
          found = orb.spaceKey;
          break;
        }
      }

      hoveredOrbRef.current = found;
      canvas.style.cursor = found ? 'pointer' : 'default';
    },
    [onOrbClick],
  );

  const handleMouseLeave = useCallback(() => {
    hoveredOrbRef.current = null;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ORB_POSITIONS: [number, number][] = [
      [0.2, 0.25],
      [0.8, 0.22],
      [0.5, 0.78],
    ];

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();

      // Skip resize when parent is hidden (e.g. during SpaceExplorer view)
      if (rect.width === 0 || rect.height === 0) return;

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      // Recalculate orb target positions for new dimensions
      const w = rect.width;
      const h = rect.height;
      orbsRef.current.forEach((orb, i) => {
        const pos = ORB_POSITIONS[i];
        if (!pos) return;
        orb.targetX = w * pos[0];
        orb.targetY = h * pos[1];
      });
    };

    resize();
    window.addEventListener('resize', resize);

    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;
    const s = stateRef.current;

    orbsRef.current = [
      {
        x: w * 0.2,
        y: h * 0.25,
        targetX: w * 0.2,
        targetY: h * 0.25,
        radius: 35 + s.health.attention * 90,
        targetRadius: 35 + s.health.attention * 90,
        color: HEALTH_COLOR,
        alpha: 0.5 + s.health.attention * 0.45,
        targetAlpha: 0.5 + s.health.attention * 0.45,
        phase: 0,
        speed: 0.005 * (0.3 + s.energy * 0.7),
        label: 'health',
        spaceKey: 'health',
        pulseBoost: 0,
        hoverScale: 1,
        hoverGlow: 0,
      },
      {
        x: w * 0.8,
        y: h * 0.22,
        targetX: w * 0.8,
        targetY: h * 0.22,
        radius: 35 + s.connection.attention * 90,
        targetRadius: 35 + s.connection.attention * 90,
        color: CONNECTION_COLOR,
        alpha: 0.5 + s.connection.attention * 0.45,
        targetAlpha: 0.5 + s.connection.attention * 0.45,
        phase: Math.PI * 0.66,
        speed: 0.005 * (0.3 + s.energy * 0.7),
        label: 'connection',
        spaceKey: 'connection',
        pulseBoost: 0,
        hoverScale: 1,
        hoverGlow: 0,
      },
      {
        x: w * 0.5,
        y: h * 0.78,
        targetX: w * 0.5,
        targetY: h * 0.78,
        radius: 35 + s.purpose.attention * 90,
        targetRadius: 35 + s.purpose.attention * 90,
        color: PURPOSE_COLOR,
        alpha: 0.5 + s.purpose.attention * 0.45,
        targetAlpha: 0.5 + s.purpose.attention * 0.45,
        phase: Math.PI * 1.33,
        speed: 0.005 * (0.3 + s.energy * 0.7),
        label: 'purpose',
        spaceKey: 'purpose',
        pulseBoost: 0,
        hoverScale: 1,
        hoverGlow: 0,
      },
    ];

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const cw = rect.width;
      const ch = rect.height;

      // Recover from 0-dimension state (HMR while hidden)
      if (canvas.width === 0 && cw > 0) {
        resize();
      }

      // Clear and skip drawing when not visible
      if (cw === 0 || ch === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        animRef.current = requestAnimationFrame(draw);
        return;
      }

      const energy = stateRef.current.energy;

      ctx.clearRect(0, 0, cw, ch);

      const bgWarmth = energy * 0.08;
      if (bgWarmth > 0.01) {
        ctx.fillStyle = `rgba(${Math.round(10 + energy * 15)}, ${Math.round(10 + energy * 8)}, ${Math.round(18 + energy * 5)}, ${bgWarmth})`;
        ctx.fillRect(0, 0, cw, ch);
      }

      const clarity = stateRef.current.clarity;
      const blurAmount = (1 - clarity) * 4 + 0.5;

      const hovered = hoveredOrbRef.current;

      for (const orb of orbsRef.current) {
        orb.phase += orb.speed;

        const isHovered = onOrbClick && orb.spaceKey === hovered;
        const targetScale = isHovered ? 1.12 : 1;
        const targetGlow = isHovered ? 1 : 0;
        orb.hoverScale = lerp(orb.hoverScale, targetScale, 0.08);
        orb.hoverGlow = lerp(orb.hoverGlow, targetGlow, 0.08);

        const drift = 25;
        orb.x = lerp(orb.x, orb.targetX + Math.sin(orb.phase) * drift, 0.02);
        orb.y = lerp(orb.y, orb.targetY + Math.cos(orb.phase * 0.7) * drift, 0.02);

        orb.radius = lerp(orb.radius, orb.targetRadius, 0.04);
        orb.alpha = lerp(orb.alpha, orb.targetAlpha, 0.04);

        orb.pulseBoost = lerp(orb.pulseBoost, 0, 0.02);
        const pulse = 1 + Math.sin(orb.phase * 2) * (0.12 + orb.pulseBoost * 0.15);
        const r = orb.radius * pulse * orb.hoverScale;

        // Attention + alignment control color saturation (grey when neglected/misaligned)
        const spaceState = stateRef.current[orb.spaceKey];
        const rawSat = (spaceState.attention + spaceState.alignment) / 2;
        const saturation = rawSat * rawSat; // quadratic curve: 0.5 → 0.25, 0.8 → 0.64

        // Tensions add visual turbulence
        const turbulence =
          spaceState.tensions.length > 0
            ? Math.sin(orb.phase * 5) * spaceState.tensions.length * 2
            : 0;

        const layers = 2;
        const hoverBrightness = 1 + orb.hoverGlow * 0.4;
        for (let i = layers; i >= 0; i--) {
          const layerRadius = r * (1 + i * 0.3);
          const layerAlpha = Math.min(orb.alpha * hoverBrightness, 0.95) * (1 - i * 0.2);

          const gradient = ctx.createRadialGradient(
            orb.x + turbulence,
            orb.y + turbulence * 0.7,
            0,
            orb.x + turbulence,
            orb.y + turbulence * 0.7,
            layerRadius,
          );
          const [cr, cg, cb] = orb.color;
          const grey = 140;
          const sr = Math.round(grey + (cr - grey) * saturation);
          const sg = Math.round(grey + (cg - grey) * saturation);
          const sb = Math.round(grey + (cb - grey) * saturation);
          gradient.addColorStop(0, `rgba(${sr}, ${sg}, ${sb}, ${layerAlpha})`);
          gradient.addColorStop(0.5, `rgba(${sr}, ${sg}, ${sb}, ${layerAlpha * 0.75})`);
          gradient.addColorStop(0.8, `rgba(${sr}, ${sg}, ${sb}, ${layerAlpha * 0.25})`);
          gradient.addColorStop(1, `rgba(${sr}, ${sg}, ${sb}, 0)`);

          ctx.filter = `blur(${blurAmount + i * 2.5}px)`;
          ctx.beginPath();
          ctx.arc(orb.x + turbulence, orb.y + turbulence * 0.7, layerRadius, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();
        }

        ctx.filter = 'none';
        ctx.font = '13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.letterSpacing = '2px';
        const labelAlpha = 0.6 + orb.hoverGlow * 0.3;
        ctx.fillStyle = `rgba(255, 255, 255, ${labelAlpha})`;
        ctx.fillText(orb.label.toUpperCase(), orb.x, orb.y + r * 0.6 + 20);
        ctx.letterSpacing = '0px';
      }

      ctx.filter = 'none';
      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [onOrbClick]);

  return (
    <canvas
      ref={canvasRef}
      onClick={handleCanvasClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="h-full w-full"
      style={{ background: 'transparent' }}
    />
  );
}
