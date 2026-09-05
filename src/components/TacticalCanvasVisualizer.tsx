import React, { useEffect, useRef, useState } from 'react';

export type VisualizerMode = 'sonar' | 'waterfall' | 'constellation';

interface TacticalCanvasVisualizerProps {
  mode?: VisualizerMode;
  themeColor?: 'emerald' | 'amber' | 'cyan';
  className?: string;
  interactive?: boolean;
}

interface Blip {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  label: string;
  snr: string;
  time: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseX: number;
  baseY: number;
}

export const TacticalCanvasVisualizer: React.FC<TacticalCanvasVisualizerProps> = ({
  mode = 'sonar',
  themeColor = 'emerald',
  className = '',
  interactive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mousePos = useRef<{ x: number; y: number }>({ x: -1000, y: -1000 });

  const colorPalettes = {
    emerald: {
      primary: '#10b981',
      secondary: '#059669',
      glow: 'rgba(16, 185, 129, 0.4)',
      faint: 'rgba(16, 185, 129, 0.08)',
      mid: 'rgba(16, 185, 129, 0.25)',
      sweep: 'rgba(52, 211, 153, 0.15)',
      blip: '#34d399',
      line: 'rgba(16, 185, 129, 0.18)',
    },
    amber: {
      primary: '#f59e0b',
      secondary: '#d97706',
      glow: 'rgba(245, 158, 11, 0.4)',
      faint: 'rgba(245, 158, 11, 0.08)',
      mid: 'rgba(245, 158, 11, 0.25)',
      sweep: 'rgba(251, 191, 36, 0.15)',
      blip: '#fbbf24',
      line: 'rgba(245, 158, 11, 0.18)',
    },
    cyan: {
      primary: '#06b6d4',
      secondary: '#0891b2',
      glow: 'rgba(6, 182, 212, 0.4)',
      faint: 'rgba(6, 182, 212, 0.08)',
      mid: 'rgba(6, 182, 212, 0.25)',
      sweep: 'rgba(34, 211, 238, 0.15)',
      blip: '#22d3ee',
      line: 'rgba(6, 182, 212, 0.18)',
    },
  };

  const currentColors = colorPalettes[themeColor] || colorPalettes.emerald;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let angle = 0;
    let tick = 0;

    // Fixed acoustic blips for Sonar
    const blips: Blip[] = [
      { x: 0.32, y: 0.28, radius: 4, opacity: 0.9, label: 'CONTACT #01 [SUB-ACOUSTIC]', snr: '+14.2dB', time: 0 },
      { x: 0.72, y: 0.38, radius: 3.5, opacity: 0.7, label: 'BUOY-99 [HYDROPHONE]', snr: '-2.1dB', time: 0 },
      { x: 0.45, y: 0.76, radius: 5, opacity: 0.85, label: 'SIGNAL PEAK [IMPULSIVE]', snr: '+28.0dB', time: 0 },
      { x: 0.22, y: 0.65, radius: 3, opacity: 0.5, label: 'NOISE FLOOR [AMBIENT]', snr: '+3.5dB', time: 0 },
    ];

    // Constellation Particles
    const particles: Particle[] = [];
    const particleCount = 45;

    const resize = () => {
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      // Re-seed particles inside new bounds
      particles.length = 0;
      for (let i = 0; i < particleCount; i++) {
        const x = Math.random() * rect.width;
        const y = Math.random() * rect.height;
        particles.push({
          x,
          y,
          baseX: x,
          baseY: y,
          vx: (Math.random() - 0.5) * 0.7,
          vy: (Math.random() - 0.5) * 0.7,
          radius: 1.5 + Math.random() * 2,
        });
      }
    };

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(container);
    resize();

    // Render loop
    const render = () => {
      tick++;
      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      // MODE 1: SONAR RADAR SWEEP
      if (mode === 'sonar') {
        const cx = width / 2;
        const cy = height / 2;
        const maxRadius = Math.min(width, height) * 0.46;

        // Concentric Circles
        ctx.strokeStyle = currentColors.mid;
        ctx.lineWidth = 1;
        const rings = 4;
        for (let r = 1; r <= rings; r++) {
          ctx.beginPath();
          ctx.arc(cx, cy, (maxRadius / rings) * r, 0, Math.PI * 2);
          ctx.stroke();

          // Distance labels
          ctx.fillStyle = currentColors.primary;
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.fillText(`${r * 15}km`, cx + (maxRadius / rings) * r + 4, cy - 4);
        }

        // Crosshairs & axes
        ctx.strokeStyle = currentColors.faint;
        ctx.beginPath();
        ctx.moveTo(cx - maxRadius - 10, cy);
        ctx.lineTo(cx + maxRadius + 10, cy);
        ctx.moveTo(cx, cy - maxRadius - 10);
        ctx.lineTo(cx, cy + maxRadius + 10);
        ctx.stroke();

        // 45 degree diagonals
        const diag = maxRadius * 0.707;
        ctx.beginPath();
        ctx.moveTo(cx - diag, cy - diag);
        ctx.lineTo(cx + diag, cy + diag);
        ctx.moveTo(cx - diag, cy + diag);
        ctx.lineTo(cx + diag, cy - diag);
        ctx.stroke();

        // Angle tick marks on outer ring
        ctx.strokeStyle = currentColors.mid;
        for (let i = 0; i < 36; i++) {
          const a = (i * 10 * Math.PI) / 180;
          const r1 = maxRadius;
          const r2 = maxRadius - (i % 9 === 0 ? 8 : 4);
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
          ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
          ctx.stroke();
        }

        // Rotating radar beam
        angle = (angle + 0.015) % (Math.PI * 2);

        // Beam gradient trail (sector)
        const trailArc = Math.PI * 0.35;
        const sweepGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxRadius);
        sweepGrad.addColorStop(0, 'rgba(0,0,0,0)');
        sweepGrad.addColorStop(1, currentColors.sweep);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxRadius, angle - trailArc, angle);
        ctx.closePath();
        ctx.fillStyle = sweepGrad;
        ctx.fill();
        ctx.restore();

        // Leading bright laser beam
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * maxRadius, cy + Math.sin(angle) * maxRadius);
        ctx.strokeStyle = currentColors.blip;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = currentColors.primary;
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Render Blips
        blips.forEach((blip) => {
          const bx = cx + (blip.x - 0.5) * maxRadius * 1.8;
          const by = cy + (blip.y - 0.5) * maxRadius * 1.8;

          // Check distance to center to ensure inside radar
          const distFromCenter = Math.hypot(bx - cx, by - cy);
          if (distFromCenter > maxRadius) return;

          // Blip glow
          const pulse = Math.sin(tick * 0.08 + blip.x * 10) * 0.3 + 0.7;
          ctx.beginPath();
          ctx.arc(bx, by, blip.radius * pulse, 0, Math.PI * 2);
          ctx.fillStyle = currentColors.blip;
          ctx.shadowColor = currentColors.primary;
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;

          // Blip circle echo
          ctx.beginPath();
          ctx.arc(bx, by, blip.radius * (1.8 + pulse), 0, Math.PI * 2);
          ctx.strokeStyle = currentColors.mid;
          ctx.lineWidth = 1;
          ctx.stroke();

          // Blip tag label
          ctx.fillStyle = currentColors.primary;
          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.fillText(`${blip.label} [${blip.snr}]`, bx + 9, by + 3);
        });

      } else if (mode === 'waterfall') {
        // MODE 2: FFT EQUALIZER & AUDIO WAVEFORM
        const bars = 48;
        const barWidth = width / bars;
        const baseline = height * 0.75;

        // Equalizer Bars
        for (let i = 0; i < bars; i++) {
          const normalized = i / bars;
          // Harmonic wave simulation
          const freq1 = Math.sin(tick * 0.04 + i * 0.28);
          const freq2 = Math.cos(tick * 0.02 + i * 0.12);
          const heightFactor = Math.abs(freq1 * 0.6 + freq2 * 0.4) * (1 - Math.abs(normalized - 0.5) * 0.8);
          const barHeight = Math.max(8, heightFactor * height * 0.55);

          const bx = i * barWidth;
          const by = baseline - barHeight;

          // Bar gradient
          const barGrad = ctx.createLinearGradient(0, baseline, 0, by);
          barGrad.addColorStop(0, currentColors.faint);
          barGrad.addColorStop(1, currentColors.primary);

          ctx.fillStyle = barGrad;
          ctx.fillRect(bx + 1.5, by, barWidth - 3, barHeight);

          // Top peak point
          ctx.fillStyle = currentColors.blip;
          ctx.fillRect(bx + 1.5, by - 2, barWidth - 3, 2);
        }

        // Live undulating oscilloscope center line
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = currentColors.blip;
        ctx.shadowColor = currentColors.primary;
        ctx.shadowBlur = 6;

        for (let x = 0; x < width; x += 4) {
          const wave =
            Math.sin(x * 0.02 + tick * 0.06) * 22 +
            Math.sin(x * 0.05 - tick * 0.03) * 12 +
            Math.cos(x * 0.01 + tick * 0.02) * 8;
          const y = height * 0.35 + wave;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

      } else if (mode === 'constellation') {
        // MODE 3: NEURAL INTELLIGENCE CONSTELLATION
        // Update particles
        particles.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;

          // Bounce off boundaries
          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;

          // Mouse gravity
          if (interactive) {
            const dx = mousePos.current.x - p.x;
            const dy = mousePos.current.y - p.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 140 && dist > 10) {
              p.x += (dx / dist) * 0.6;
              p.y += (dy / dist) * 0.6;
            }
          }

          // Draw particle
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = currentColors.blip;
          ctx.fill();
        });

        // Connect nearby particles
        ctx.lineWidth = 0.8;
        for (let i = 0; i < particles.length; i++) {
          for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.hypot(dx, dy);

            if (dist < 90) {
              const alpha = (1 - dist / 90) * 0.45;
              ctx.strokeStyle = `rgba(16, 185, 129, ${alpha})`;
              ctx.beginPath();
              ctx.moveTo(particles[i].x, particles[i].y);
              ctx.lineTo(particles[j].x, particles[j].y);
              ctx.stroke();
            }
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive || !container) return;
      const rect = container.getBoundingClientRect();
      mousePos.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const handleMouseLeave = () => {
      mousePos.current = { x: -1000, y: -1000 };
    };

    window.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      window.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [mode, themeColor, interactive]);

  return (
    <div ref={containerRef} className={`w-full h-full relative overflow-hidden ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
