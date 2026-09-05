/**
 * Tactical Radar Component
 * Recreates the "TACTICAL RADAR - REAL-TIME ASSET TRACKING" from the TDIS command interface.
 * Tracks the Clean Input Audio signal (friendly target), Noise Interference sources (hostile jammers),
 * and signal-to-noise vectors with radar sweeps, range rings, and interactive target coordinates.
 */

import React, { useEffect, useRef, useState } from 'react';
import { 
  AudioNoiseRecord, 
  PlaybackChannel 
} from '../types';
import { 
  Crosshair, 
  ZoomIn, 
  ZoomOut, 
  Grid, 
  RotateCw, 
  ShieldAlert, 
  Radio, 
  Target 
} from 'lucide-react';

interface TacticalRadarProps {
  record: AudioNoiseRecord | null;
  isPlaying: boolean;
  activeChannel: PlaybackChannel;
  analyserNode: AnalyserNode | null;
}

interface RadarBlip {
  id: string;
  name: string;
  x: number; // -100 to 100
  y: number; // -100 to 100
  type: 'friendly' | 'hostile' | 'objective';
  intensity: number;
  snrLabel?: string;
  threatLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export const TacticalRadar: React.FC<TacticalRadarProps> = ({
  record,
  isPlaying,
  activeChannel,
  analyserNode,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [showSweep, setShowSweep] = useState(true);
  const [selectedBlip, setSelectedBlip] = useState<RadarBlip | null>(null);

  // Derive threat rating from SNR
  const snr = record?.measuredSnrDb ?? 6.5;
  const threatLevel = snr < 0 ? 'HIGH' : snr < 7 ? 'MEDIUM' : 'LOW';
  const threatColor =
    threatLevel === 'HIGH'
      ? 'bg-rose-950/80 text-rose-400 border-rose-600'
      : threatLevel === 'MEDIUM'
      ? 'bg-amber-950/80 text-amber-300 border-amber-500'
      : 'bg-emerald-950/80 text-emerald-300 border-emerald-500';

  // Generate tactical radar blips based on record
  const blips: RadarBlip[] = [
    {
      id: 'target-alpha',
      name: `TARGET-ALPHA [${record?.title.slice(0, 10).toUpperCase() || 'INPUT_AUDIO'}]`,
      x: 0,
      y: 0,
      type: 'friendly',
      intensity: 1.0,
      snrLabel: `RMS: ${record?.cleanMetrics.rmsDb ?? -18}dBFS`,
    },
    {
      id: 'noise-node-1',
      name: `JAMMER-${record?.noiseType.toUpperCase() || 'WHITE_NOISE'}`,
      x: record?.noiseType === 'babble' ? 35 : record?.noiseType === 'traffic' ? -42 : 28,
      y: record?.noiseType === 'ground_hum' ? -30 : -25,
      type: 'hostile',
      intensity: 0.85,
      snrLabel: `NOISE: ${record?.noiseType.toUpperCase()}`,
      threatLevel,
    },
    {
      id: 'depot-1',
      name: 'DEPOT-1 [MIC_BUFFER]',
      x: -55,
      y: 40,
      type: 'objective',
      intensity: 0.6,
    },
    {
      id: 'alpha-1',
      name: 'ALPHA-1 [DSP_CORE]',
      x: -18,
      y: -22,
      type: 'friendly',
      intensity: 0.7,
    },
    {
      id: 'alpha-2',
      name: 'ALPHA-2 [FFT_FILTER]',
      x: -32,
      y: -35,
      type: 'friendly',
      intensity: 0.75,
    },
    {
      id: 'bravo-1',
      name: 'BRAVO-1 [NOISE_MIX]',
      x: -24,
      y: -42,
      type: 'friendly',
      intensity: 0.55,
    },
  ];

  // Radar Animation Loop with canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let angle = 0;
    const fftData = new Uint8Array(64);

    const render = () => {
      // Audio spectrum energy kick
      let audioEnergy = 0;
      if (analyserNode && isPlaying) {
        analyserNode.getByteFrequencyData(fftData);
        audioEnergy = (fftData[4] || 0) / 255;
      }

      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const maxRadius = Math.min(cx, cy) - 20;

      // Clear with dark tactical green tint
      ctx.fillStyle = '#030806';
      ctx.fillRect(0, 0, w, h);

      // Draw Grid Lines
      if (showGrid) {
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.12)';
        ctx.lineWidth = 1;

        const gridSize = 32 * zoom;
        ctx.beginPath();
        for (let x = cx % gridSize; x < w; x += gridSize) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
        }
        for (let y = cy % gridSize; y < h; y += gridSize) {
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
        }
        ctx.stroke();

        // Main Crosshair Axes
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.lineTo(cx, h);
        ctx.moveTo(0, cy);
        ctx.lineTo(w, cy);
        ctx.stroke();

        // Concentric Radar Rings
        const rings = [0.25, 0.5, 0.75, 1.0];
        rings.forEach((r) => {
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.18)';
          ctx.beginPath();
          ctx.arc(cx, cy, maxRadius * r * zoom, 0, Math.PI * 2);
          ctx.stroke();
        });

        // Range ring labels
        ctx.fillStyle = 'rgba(16, 185, 129, 0.4)';
        ctx.font = '9px monospace';
        ctx.fillText('100m', cx + maxRadius * 0.25 * zoom + 4, cy - 4);
        ctx.fillText('200m', cx + maxRadius * 0.5 * zoom + 4, cy - 4);
        ctx.fillText('300m', cx + maxRadius * 0.75 * zoom + 4, cy - 4);
        ctx.fillText('MAX RNG', cx + maxRadius * 1.0 * zoom + 4, cy - 4);
      }

      // Draw Noise Interference Hazard Zones (green/red transparent circles)
      blips.forEach((b) => {
        if (b.type === 'hostile') {
          const bx = cx + (b.x / 100) * maxRadius * zoom;
          const by = cy + (b.y / 100) * maxRadius * zoom;
          const pulse = isPlaying ? Math.sin(Date.now() / 250) * 8 : 0;
          const radius = (35 + pulse + audioEnergy * 20) * zoom;

          const grad = ctx.createRadialGradient(bx, by, 0, bx, by, radius);
          grad.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
          grad.addColorStop(0.7, 'rgba(239, 68, 68, 0.08)');
          grad.addColorStop(1, 'rgba(239, 68, 68, 0)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(bx, by, radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
          ctx.setLineDash([3, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (b.type === 'friendly' && b.id !== 'target-alpha') {
          const bx = cx + (b.x / 100) * maxRadius * zoom;
          const by = cy + (b.y / 100) * maxRadius * zoom;
          ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
          ctx.beginPath();
          ctx.arc(bx, by, 25 * zoom, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Rotating Radar Sweep
      if (showSweep) {
        angle += isPlaying ? 0.035 : 0.02;
        if (angle > Math.PI * 2) angle -= Math.PI * 2;

        const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius * zoom);
        sweepGrad.addColorStop(0, 'rgba(0, 255, 102, 0)');
        sweepGrad.addColorStop(1, 'rgba(0, 255, 102, 0.15)');

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxRadius * zoom, angle - 0.35, angle);
        ctx.closePath();
        ctx.fillStyle = sweepGrad;
        ctx.fill();

        // Leading sweep line
        ctx.strokeStyle = 'rgba(0, 255, 102, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(
          cx + Math.cos(angle) * maxRadius * zoom,
          cy + Math.sin(angle) * maxRadius * zoom
        );
        ctx.stroke();
        ctx.restore();
      }

      // Draw Blips & Tactical Asset Labels
      blips.forEach((b) => {
        const bx = cx + (b.x / 100) * maxRadius * zoom;
        const by = cy + (b.y / 100) * maxRadius * zoom;

        // Skip if outside canvas
        if (bx < 10 || bx > w - 10 || by < 10 || by > h - 10) return;

        if (b.type === 'friendly') {
          // Green glowing diamond / circle
          ctx.fillStyle = '#00ff66';
          ctx.shadowColor = '#00ff66';
          ctx.shadowBlur = 8;

          if (b.id === 'target-alpha') {
            // Target Alpha has crosshairs and pulse ring
            const pulse = isPlaying ? (Date.now() % 1000) / 1000 : 0;
            ctx.strokeStyle = `rgba(0, 255, 102, ${1 - pulse})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(bx, by, (8 + pulse * 14) * zoom, 0, Math.PI * 2);
            ctx.stroke();

            // Inner cyan/green reticle
            ctx.fillStyle = '#06b6d4';
            ctx.beginPath();
            ctx.arc(bx, by, 5 * zoom, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(bx, by, 4 * zoom, 0, Math.PI * 2);
            ctx.fill();
          }

          // Label
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#10b981';
          ctx.font = 'bold 9px monospace';
          ctx.fillText(b.name, bx - 15, by - 8);

        } else if (b.type === 'hostile') {
          // Red/Orange hostile noise jammer
          ctx.fillStyle = '#ef4444';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(bx, by, 5 * zoom, 0, Math.PI * 2);
          ctx.fill();

          // Double blip ring
          ctx.beginPath();
          ctx.arc(bx + 7 * zoom, by, 4 * zoom, 0, Math.PI * 2);
          ctx.fill();

          ctx.shadowBlur = 0;
          ctx.fillStyle = '#f87171';
          ctx.font = 'bold 9px monospace';
          ctx.fillText(b.name, bx - 20, by - 10);

        } else if (b.type === 'objective') {
          // Gold / Yellow square depot
          ctx.fillStyle = '#eab308';
          ctx.shadowColor = '#eab308';
          ctx.shadowBlur = 6;
          ctx.fillRect(bx - 3.5 * zoom, by - 3.5 * zoom, 7 * zoom, 7 * zoom);

          ctx.shadowBlur = 0;
          ctx.fillStyle = '#facc15';
          ctx.font = '9px monospace';
          ctx.fillText(b.name, bx - 15, by - 8);
        }
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [blips, isPlaying, zoom, showGrid, showSweep, analyserNode]);

  return (
    <div className="relative w-full rounded-2xl bg-[#030705] border border-emerald-500/30 overflow-hidden shadow-[0_0_25px_rgba(16,185,129,0.06)] flex flex-col">
      {/* Top Header bar with Threat Badge */}
      <div className="px-4 py-2.5 bg-[#050e09] border-b border-emerald-500/25 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#00ff66]" />
          <h3 className="font-display font-bold text-xs uppercase tracking-wider text-emerald-200">
            Tactical Radar — Real-Time Acoustic & Noise Tracking
          </h3>
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px]">
          <div className={`px-2.5 py-0.5 rounded border text-xs font-bold flex items-center gap-1.5 ${threatColor}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
            <span>THREAT: {threatLevel}</span>
            <span className="text-[10px] opacity-70">({snr > 0 ? `+${snr}` : snr} dB SNR)</span>
          </div>

          <div className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/60 text-[10px]">
            <Radio className="w-3 h-3 text-emerald-400" />
            <span>FREQ: 44.1 kHz</span>
          </div>
        </div>
      </div>

      {/* Main Radar Screen Container */}
      <div className="relative w-full h-[320px] sm:h-[380px] bg-[#020504]">
        <canvas
          ref={canvasRef}
          width={800}
          height={400}
          className="w-full h-full object-cover block cursor-crosshair"
        />

        {/* Tactical Control Bar (Right Strip - as seen in the screenshot!) */}
        <div className="absolute right-3 top-3 flex flex-col gap-1.5 z-10">
          <button
            onClick={() => setZoom((z) => Math.min(2.0, z + 0.25))}
            className="w-7 h-7 rounded bg-[#06120b]/90 border border-emerald-500/40 text-emerald-400 hover:text-emerald-200 hover:border-emerald-400 flex items-center justify-center transition-all text-xs font-mono active:scale-95 shadow-lg"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.25))}
            className="w-7 h-7 rounded bg-[#06120b]/90 border border-emerald-500/40 text-emerald-400 hover:text-emerald-200 hover:border-emerald-400 flex items-center justify-center transition-all text-xs font-mono active:scale-95 shadow-lg"
            title="Zoom Out"
          >
            -
          </button>
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`w-7 h-7 rounded border flex items-center justify-center transition-all text-xs shadow-lg ${
              showGrid
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400'
                : 'bg-[#06120b]/90 text-emerald-600 border-emerald-900/60'
            }`}
            title="Toggle Grid Coordinates"
          >
            <Grid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowSweep(!showSweep)}
            className={`w-7 h-7 rounded border flex items-center justify-center transition-all text-xs shadow-lg ${
              showSweep
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400'
                : 'bg-[#06120b]/90 text-emerald-600 border-emerald-900/60'
            }`}
            title="Toggle Radar Sweep"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoom(1.0)}
            className="w-7 h-7 rounded bg-[#06120b]/90 border border-emerald-500/40 text-emerald-400 hover:text-emerald-200 hover:border-emerald-400 flex items-center justify-center transition-all text-xs shadow-lg"
            title="Recenter Radar"
          >
            <Target className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Legend Box (Bottom Right - exact to screenshot!) */}
        <div className="absolute right-3 bottom-3 bg-[#040c08]/90 border border-emerald-500/30 rounded-lg p-2 font-mono text-[10px] text-emerald-300 flex flex-col gap-1 backdrop-blur-sm shadow-xl pointer-events-none">
          <div className="font-bold text-[9px] uppercase tracking-wider text-emerald-400 border-b border-emerald-500/20 pb-0.5">
            ASSET TYPES
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#00ff66]" />
            <span>Friendly Audio (Clean)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#ef4444]" />
            <span>Hostile Noise (Jammer)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-[#eab308]" />
            <span>Signal Buffer Node</span>
          </div>
        </div>

        {/* Status Telemetry Overlay (Bottom Left) */}
        <div className="absolute left-3 bottom-3 font-mono text-[10px] text-emerald-400/80 bg-[#040c08]/80 border border-emerald-500/20 rounded px-2.5 py-1 backdrop-blur-sm flex items-center gap-3">
          <span>LATENCY: 12ms</span>
          <span>•</span>
          <span>TRACKS: {blips.length}</span>
          <span>•</span>
          <span>ZOOM: {(zoom * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
};
