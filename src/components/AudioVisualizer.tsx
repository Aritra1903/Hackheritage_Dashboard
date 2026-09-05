/**
 * High-performance Dual Waveform & Spectrogram Visualizer Canvas
 */

import React, { useEffect, useRef, useState } from 'react';
import { PlaybackChannel } from '../types';

interface AudioVisualizerProps {
  cleanPeaks: number[];
  noisyPeaks: number[];
  noiseOnlyPeaks?: number[];
  duration: number;
  currentTime: number;
  activeChannel: PlaybackChannel;
  isPlaying: boolean;
  analyserNode?: AnalyserNode | null;
  onSeek?: (fraction: number) => void;
  showSpectrogram?: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  cleanPeaks,
  noisyPeaks,
  noiseOnlyPeaks,
  duration,
  currentTime,
  activeChannel,
  isPlaying,
  analyserNode,
  onSeek,
  showSpectrogram = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);
  const fftCanvasRef = useRef<HTMLCanvasElement>(null);
  const [viewMode, setViewMode] = useState<'overlay' | 'split' | 'active_only'>('overlay');
  const [isHovering, setIsHovering] = useState(false);
  const [hoverFraction, setHoverFraction] = useState(0);

  // Render Waveform Canvas
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    // Background grid lines (time & amplitude markers)
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);

    // Horizontal center line
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // Time division lines (every 1 second or 0.5 sec)
    if (duration > 0) {
      const stepSec = duration > 5 ? 1 : 0.5;
      const totalSteps = Math.floor(duration / stepSec);
      for (let s = 1; s <= totalSteps; s++) {
        const x = (s * stepSec / duration) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);

    const numPoints = Math.max(cleanPeaks.length, noisyPeaks.length);
    if (numPoints === 0) return;

    const barWidth = Math.max(1.5, width / numPoints - 1);

    if (viewMode === 'split') {
      // Split view: Clean on Top half, Noisy on Bottom half
      const halfH = height / 2;

      // Draw Top: Clean (Emerald)
      for (let i = 0; i < cleanPeaks.length; i++) {
        const x = (i / cleanPeaks.length) * width;
        const val = cleanPeaks[i];
        const barH = Math.max(2, val * (halfH - 8));
        ctx.fillStyle = activeChannel === 'clean' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(16, 185, 129, 0.5)';
        ctx.fillRect(x, halfH - barH, barWidth, barH);
      }

      // Draw Bottom: Noisy (Amber / Orange)
      for (let i = 0; i < noisyPeaks.length; i++) {
        const x = (i / noisyPeaks.length) * width;
        const val = noisyPeaks[i];
        const barH = Math.max(2, val * (halfH - 8));
        ctx.fillStyle = activeChannel === 'noisy' ? 'rgba(245, 158, 11, 0.95)' : 'rgba(245, 158, 11, 0.5)';
        ctx.fillRect(x, halfH, barWidth, barH);
      }

      // Divider line
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.beginPath();
      ctx.moveTo(0, halfH);
      ctx.lineTo(width, halfH);
      ctx.stroke();

    } else if (viewMode === 'active_only') {
      // Active channel only
      const midY = height / 2;
      let peaksToDraw = noisyPeaks;
      let fillColor = 'rgba(245, 158, 11, 0.9)';

      if (activeChannel === 'clean') {
        peaksToDraw = cleanPeaks;
        fillColor = 'rgba(16, 185, 129, 0.9)';
      } else if (activeChannel === 'noise_only' && noiseOnlyPeaks) {
        peaksToDraw = noiseOnlyPeaks;
        fillColor = 'rgba(168, 85, 247, 0.9)';
      }

      for (let i = 0; i < peaksToDraw.length; i++) {
        const x = (i / peaksToDraw.length) * width;
        const val = peaksToDraw[i];
        const barH = Math.max(2, val * (midY - 8));
        ctx.fillStyle = fillColor;
        ctx.fillRect(x, midY - barH, barWidth, barH * 2);
      }

    } else {
      // Overlay view: Clean in emerald background, Noisy in amber foreground
      const midY = height / 2;

      // 1. Draw Noisy Waveform envelope (amber translucent)
      for (let i = 0; i < noisyPeaks.length; i++) {
        const x = (i / noisyPeaks.length) * width;
        const val = noisyPeaks[i];
        const barH = Math.max(2, val * (midY - 6));
        ctx.fillStyle = activeChannel === 'noisy' 
          ? 'rgba(245, 158, 11, 0.45)' 
          : 'rgba(245, 158, 11, 0.25)';
        ctx.fillRect(x, midY - barH, barWidth, barH * 2);
      }

      // 2. Draw Clean Waveform inside (emerald high contrast)
      for (let i = 0; i < cleanPeaks.length; i++) {
        const x = (i / cleanPeaks.length) * width;
        const val = cleanPeaks[i];
        const barH = Math.max(2, val * (midY - 10));
        ctx.fillStyle = activeChannel === 'clean' 
          ? 'rgba(16, 185, 129, 0.95)' 
          : 'rgba(16, 185, 129, 0.7)';
        ctx.fillRect(x, midY - barH, barWidth * 0.8, barH * 2);
      }

      // If noise only is selected, draw purple noise spikes
      if (activeChannel === 'noise_only' && noiseOnlyPeaks) {
        for (let i = 0; i < noiseOnlyPeaks.length; i++) {
          const x = (i / noiseOnlyPeaks.length) * width;
          const val = noiseOnlyPeaks[i];
          const barH = Math.max(2, val * (midY - 6));
          ctx.fillStyle = 'rgba(192, 132, 252, 0.9)';
          ctx.fillRect(x, midY - barH, barWidth, barH * 2);
        }
      }
    }

    // Playhead progress indicator
    if (duration > 0) {
      const progressFraction = Math.min(1, Math.max(0, currentTime / duration));
      const playheadX = progressFraction * width;

      // Completed played region tint
      ctx.fillStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.fillRect(0, 0, playheadX, height);

      // Playhead vertical bar
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Playhead handle
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(playheadX, 6, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hover cursor indicator
    if (isHovering) {
      const hoverX = hoverFraction * width;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [cleanPeaks, noisyPeaks, noiseOnlyPeaks, duration, currentTime, activeChannel, viewMode, isHovering, hoverFraction]);

  // Real-time FFT / Spectrogram live animation loop
  useEffect(() => {
    if (!showSpectrogram || !analyserNode || !isPlaying) return;
    const canvas = fftCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const renderFFT = () => {
      analyserNode.getByteFrequencyData(dataArray);
      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
      ctx.fillRect(0, 0, width, height);

      const barWidth = (width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * height;

        // Color mapped by frequency and intensity
        const hue = 180 + (i / bufferLength) * 120; // cyan to orange
        ctx.fillStyle = `hsl(${hue}, 85%, ${40 + (dataArray[i] / 255) * 35}%)`;
        ctx.fillRect(x, height - barHeight, barWidth, barHeight);

        x += barWidth + 1;
      }

      animationId = requestAnimationFrame(renderFFT);
    };

    renderFFT();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [showSpectrogram, analyserNode, isPlaying]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, x / rect.width));
    setHoverFraction(fraction);
    setIsHovering(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, x / rect.width));
    onSeek(fraction);
  };

  return (
    <div ref={containerRef} className="w-full flex flex-col gap-2 select-none" id="audio-visualizer-container">
      {/* Controls & Legend Header */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 px-1">
        <div className="flex items-center gap-3">
          <span className="font-mono text-slate-300">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          {isHovering && (
            <span className="font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/50">
              Seek: {formatTime(hoverFraction * duration)}
            </span>
          )}
        </div>

        {/* Legend / View mode buttons */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
            <span className="text-slate-300">Clean Signal</span>
          </div>
          <div className="flex items-center gap-1.5 mr-3">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500"></span>
            <span className="text-slate-300">Input + Noise</span>
          </div>

          <div className="inline-flex rounded-md bg-[#020504] p-0.5 border border-emerald-500/30 font-mono text-[10px]">
            <button
              id="btn-view-overlay"
              onClick={() => setViewMode('overlay')}
              className={`px-2 py-0.5 rounded transition-colors ${
                viewMode === 'overlay' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-emerald-400 hover:text-emerald-200'
              }`}
            >
              OVERLAY
            </button>
            <button
              id="btn-view-split"
              onClick={() => setViewMode('split')}
              className={`px-2 py-0.5 rounded transition-colors ${
                viewMode === 'split' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-emerald-400 hover:text-emerald-200'
              }`}
            >
              SPLIT
            </button>
            <button
              id="btn-view-active"
              onClick={() => setViewMode('active_only')}
              className={`px-2 py-0.5 rounded transition-colors ${
                viewMode === 'active_only' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-emerald-400 hover:text-emerald-200'
              }`}
            >
              ACTIVE
            </button>
          </div>
        </div>
      </div>

      {/* Main Waveform Canvas */}
      <div className="relative w-full h-28 bg-[#020504] rounded-lg border border-emerald-500/30 overflow-hidden cursor-crosshair group">
        <canvas
          ref={waveformCanvasRef}
          className="w-full h-full block"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleClick}
        />

        {/* Channel Watermark Tag */}
        <div className="absolute bottom-2 right-2 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity">
          <span className="font-mono text-[9px] tracking-wider uppercase px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
            {activeChannel === 'clean' ? 'CHANNEL: CLEAN' : activeChannel === 'noisy' ? 'CHANNEL: DEGRADED MIX' : 'CHANNEL: JAMMING ONLY'}
          </span>
        </div>
      </div>

      {/* Optional Real-time Frequency Spectrum Analyzer */}
      {showSpectrogram && (
        <div className="relative w-full h-16 bg-[#020504] rounded-lg border border-emerald-500/30 overflow-hidden">
          <div className="absolute top-1 left-2 z-10 flex items-center gap-2">
            <span className="font-mono text-[9px] text-emerald-400/80">LIVE SPECTRUM FFT (0 - 12kHz)</span>
          </div>
          <canvas
            ref={fftCanvasRef}
            width={600}
            height={64}
            className="w-full h-full block"
          />
        </div>
      )}
    </div>
  );
};

function formatTime(sec: number): string {
  if (!sec || isNaN(sec)) return '00:00.0';
  const mins = Math.floor(sec / 60);
  const remSec = (sec % 60).toFixed(1);
  return `${mins.toString().padStart(2, '0')}:${remSec.padStart(4, '0')}`;
}
