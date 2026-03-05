'use client';

import { useRef, useEffect, useCallback } from 'react';

interface TimelinePoint {
  value: number;
  date: string;
}

interface StateTimelineProps {
  points: TimelinePoint[];
  color: string;
  label: string;
}

function toRgba(color: string, alpha: number): string {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${alpha})`;
  }
  // Fallback: hex color with alpha appended
  const hex = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return color + hex;
}

export function StateTimeline({ points, color, label }: StateTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || points.length < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const paddingTop = 16;
    const paddingBottom = 28;
    const paddingLeft = 28;
    const paddingRight = 2;

    ctx.clearRect(0, 0, w, h);

    // Auto-scale to data range with buffer
    const values = points.map((p) => p.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const range = rawMax - rawMin || 0.1;
    const buffer = Math.max(range * 0.1, 0.05);
    const dataMin = Math.max(0, rawMin - buffer);
    const dataMax = Math.min(1, rawMax + buffer);

    // Draw Y-axis labels and grid lines
    const topPct = Math.round(dataMax * 100);
    const midPct = Math.round(((dataMax + dataMin) / 2) * 100);
    const botPct = Math.round(dataMin * 100);
    const yLabels = [
      { value: dataMax, text: `${topPct}%` },
      { value: (dataMax + dataMin) / 2, text: `${midPct}%` },
      { value: dataMin, text: `${botPct}%` },
    ];
    const usableH = h - paddingTop - paddingBottom;

    ctx.font = '9px sans-serif';
    ctx.textBaseline = 'middle';

    for (const { value, text } of yLabels) {
      const normalized = (value - dataMin) / (dataMax - dataMin);
      const y = h - paddingBottom - normalized * usableH;

      // Label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.textAlign = 'right';
      ctx.fillText(text, paddingLeft - 4, y);

      // Grid line
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 0.5;
      ctx.setLineDash([3, 3]);
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(w - paddingRight, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw X-axis date labels
    const chartW = w - paddingLeft - paddingRight;
    const xStep = chartW / (points.length - 1);
    const maxXLabels = Math.max(2, Math.floor(chartW / 48));
    const xLabelInterval = Math.max(1, Math.ceil(points.length / maxXLabels));

    ctx.font = '9px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const xLabelY = h - paddingBottom + 6;

    for (let i = 0; i < points.length; i += xLabelInterval) {
      const x = paddingLeft + i * xStep;
      const point = points[i];
      if (!point) continue;
      const d = new Date(point.date);
      const dayMonth = `${d.getDate()}/${d.getMonth() + 1}`;
      ctx.fillText(dayMonth, x, xLabelY);
    }
    // Always draw last label
    if ((points.length - 1) % xLabelInterval !== 0) {
      const x = paddingLeft + (points.length - 1) * xStep;
      const lastPt = points[points.length - 1];
      if (!lastPt) return;
      const d = new Date(lastPt.date);
      const dayMonth = `${d.getDate()}/${d.getMonth() + 1}`;
      ctx.fillText(dayMonth, x, xLabelY);
    }

    // Draw sparkline
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const coords: { x: number; y: number }[] = [];

    points.forEach((p, i) => {
      const x = paddingLeft + i * xStep;
      const clamped = Math.max(0, Math.min(1, p.value));
      const normalized = (clamped - dataMin) / (dataMax - dataMin);
      const y = h - paddingBottom - normalized * usableH;
      coords.push({ x, y });
      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Fill area under curve
    if (coords.length === 0) return;
    const lastCoord = coords[coords.length - 1];
    const firstCoord = coords[0];
    if (!lastCoord || !firstCoord) return;
    ctx.lineTo(lastCoord.x, h - paddingBottom);
    ctx.lineTo(firstCoord.x, h - paddingBottom);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(
      0,
      paddingTop,
      0,
      h - paddingBottom
    );
    gradient.addColorStop(0, toRgba(color, 0.12));
    gradient.addColorStop(1, toRgba(color, 0));
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw last value dot + label
    const lastPoint = points[points.length - 1];
    if (!lastPoint) return;
    const pct = Math.round(Math.max(0, Math.min(1, lastPoint.value)) * 100);

    ctx.beginPath();
    ctx.arc(lastCoord.x, lastCoord.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.font = 'bold 10px sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${pct}%`, lastCoord.x - 6, lastCoord.y - 4);
  }, [points, color]);

  useEffect(() => {
    draw();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new ResizeObserver(() => draw());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [draw]);

  if (points.length < 2) return null;

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] tracking-widest text-white/25 uppercase">
        {label}
      </span>
      <canvas
        ref={canvasRef}
        className="h-28 w-full"
        style={{ background: 'transparent' }}
      />
    </div>
  );
}
