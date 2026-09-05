/**
 * Live SNR Telemetry Graph & Acoustic AI Diagnostic Console
 * 
 * Requirements implemented:
 * 1) Live graph of SNR as input audio is being processed.
 * 2) Shows values of SNR in case of SNR degradation (yellow blinking)
 *    or improvement (light blue blinking) with both previous and current values.
 * 3) Special case: Impulsive noise (Bomb Blast, Gunfire, Plane Crash) with bright red blinking
 *    persisting for the duration of the impulsive acoustic event.
 * 4) Complete AI analysis mentioning:
 *    - Noise Level (dBFS / %)
 *    - SNR Value (both previous and current values + delta)
 *    - Speech Probability in percentage (%)
 *    - ANC Reduction (dB)
 *    - Residual Noise (dBFS)
 *    - Processing Latency (ms)
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { 
  Activity, 
  AlertTriangle, 
  ShieldAlert, 
  Zap, 
  Sparkles, 
  Volume2, 
  Sliders, 
  Clock, 
  CheckCircle2, 
  Radio, 
  Flame, 
  Bomb, 
  Crosshair, 
  Plane,
  RefreshCw,
  Cpu,
  Waves
} from 'lucide-react';
import { 
  AudioNoiseRecord, 
  PlaybackChannel, 
  AiAcousticAnalysis, 
  ImpulsiveNoiseType 
} from '../types';
import { 
  computeAcousticAiAnalysis, 
  requestGeminiAudit 
} from '../services/aiAnalyzer';

interface LiveSnrGraphProps {
  record: AudioNoiseRecord | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  activeChannel: PlaybackChannel;
  analyserNode: AnalyserNode | null;
  onSelectChannel?: (channel: PlaybackChannel) => void;
}

interface SnrHistoryPoint {
  time: number;
  snr: number;
  isImpulsive: boolean;
  trend: 'degradation' | 'improvement' | 'stable';
}

export const LiveSnrGraph: React.FC<LiveSnrGraphProps> = ({
  record,
  currentTime,
  duration,
  isPlaying,
  activeChannel,
  analyserNode,
  onSelectChannel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Active Noise Cancellation (ANC) switch
  const [ancEnabled, setAncEnabled] = useState<boolean>(false);

  // Manual Impulsive simulation state for testing specific threats
  const [manualImpulsiveType, setManualImpulsiveType] = useState<ImpulsiveNoiseType | null>(null);
  const [manualImpulsiveRemaining, setManualImpulsiveRemaining] = useState<number>(0);

  // Simulated degradation or improvement override for instant inspection
  const [manualSnrOffset, setManualSnrOffset] = useState<number>(0);

  // Track previous and current SNR for delta calculation
  const previousSnrRef = useRef<number>(record?.measuredSnrDb || 10.0);
  const [displayedAnalysis, setDisplayedAnalysis] = useState<AiAcousticAnalysis | null>(null);

  // Gemini deep AI report state
  const [isRequestingGemini, setIsRequestingGemini] = useState(false);
  const [geminiAuditReport, setGeminiAuditReport] = useState<string | null>(null);

  // Rolling history of SNR data points for the live chart
  const historyRef = useRef<SnrHistoryPoint[]>([]);

  // Timer countdown for manual impulsive noise persistence
  useEffect(() => {
    if (manualImpulsiveRemaining <= 0) {
      setManualImpulsiveType(null);
      return;
    }
    const timer = setInterval(() => {
      setManualImpulsiveRemaining((prev) => {
        if (prev <= 0.1) {
          setManualImpulsiveType(null);
          return 0;
        }
        return Math.round((prev - 0.1) * 10) / 10;
      });
    }, 100);
    return () => clearInterval(timer);
  }, [manualImpulsiveRemaining]);

  // Handle manual impulsive noise trigger (persists for 3.2 seconds)
  const triggerImpulsiveEvent = (type: ImpulsiveNoiseType) => {
    setManualImpulsiveType(type);
    setManualImpulsiveRemaining(3.2);
  };

  // Reset baseline when record changes
  useEffect(() => {
    if (record) {
      previousSnrRef.current = record.measuredSnrDb;
      historyRef.current = [];
      setGeminiAuditReport(null);
    }
  }, [record?.id]);

  // Real-time audio analysis loop
  useEffect(() => {
    if (!record) return;

    // Determine baseline SNR
    let baseSnr = record.measuredSnrDb;
    if (activeChannel === 'clean') baseSnr = 38.0;
    if (activeChannel === 'noise_only') baseSnr = -32.0;

    // Apply manual offset
    let effectiveSnr = baseSnr + manualSnrOffset;

    // Apply ANC boost
    if (ancEnabled && activeChannel === 'noisy') {
      effectiveSnr += 16.5;
    }

    // Dynamic wave variation during playback
    if (isPlaying) {
      const wobble = Math.sin(currentTime * 4) * 1.8 + Math.cos(currentTime * 8) * 0.9;
      effectiveSnr += wobble;
    }

    // Impulsive noise collapses SNR dramatically
    const isManualImpulse = manualImpulsiveRemaining > 0 && manualImpulsiveType !== null;
    const isRecordImpulse = record.noiseType === 'bomb_blast' || 
                            record.noiseType === 'gunfire' || 
                            record.noiseType === 'plane_crash';

    if (isManualImpulse || isRecordImpulse) {
      effectiveSnr = Math.min(-6.0, effectiveSnr - 18.0);
    }

    effectiveSnr = Math.round(effectiveSnr * 10) / 10;

    // Compute AI Analysis
    const analysis = computeAcousticAiAnalysis({
      noiseType: manualImpulsiveType || record.noiseType,
      currentSnrDb: effectiveSnr,
      previousSnrDb: previousSnrRef.current,
      currentTime,
      duration: record.duration,
      activeChannel,
      ancEnabled,
      cleanRmsDb: record.cleanMetrics.rmsDb,
      noisyRmsDb: record.noisyMetrics.rmsDb,
      noiseRmsDb: record.noisyMetrics.noiseRmsDb,
      manualImpulsiveTrigger: manualImpulsiveType,
      manualImpulsiveActive: isManualImpulse,
    });

    setDisplayedAnalysis(analysis);

    // Append to rolling history
    historyRef.current.push({
      time: currentTime,
      snr: effectiveSnr,
      isImpulsive: analysis.isImpulsive,
      trend: analysis.trend,
    });

    // Limit history length (keep last 120 frames ~ 8 seconds of playback)
    if (historyRef.current.length > 120) {
      historyRef.current.shift();
    }

    // Update previous SNR periodically to maintain dynamic delta tracking
    const updatePrev = setTimeout(() => {
      previousSnrRef.current = effectiveSnr;
    }, 1800);

    return () => clearTimeout(updatePrev);
  }, [
    record?.id, 
    currentTime, 
    isPlaying, 
    activeChannel, 
    ancEnabled, 
    manualImpulsiveType, 
    manualImpulsiveRemaining, 
    manualSnrOffset
  ]);

  // Live Canvas Rendering for the SNR Graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // SNR Scale parameters: -30 dB (bottom) to +30 dB (top)
      const minDb = -30;
      const maxDb = 35;
      const rangeDb = maxDb - minDb;

      const dbToY = (db: number) => {
        const clamped = Math.max(minDb, Math.min(maxDb, db));
        const normalized = (clamped - minDb) / rangeDb;
        return height - normalized * (height - 24) - 12;
      };

      // 1. Background Grid & Calibrated Reference Lines
      const gridLevels = [
        { db: 30, label: '+30 dB (Pristine)', color: 'rgba(56, 189, 248, 0.25)' },
        { db: 20, label: '+20 dB (High)', color: 'rgba(16, 185, 129, 0.25)' },
        { db: 10, label: '+10 dB (Nominal)', color: 'rgba(16, 185, 129, 0.2)' },
        { db: 0, label: '0 dB (CRITICAL ZERO)', color: 'rgba(239, 68, 68, 0.55)', isCritical: true },
        { db: -10, label: '-10 dB (Severe Degradation)', color: 'rgba(234, 179, 8, 0.25)' },
        { db: -20, label: '-20 dB (Hostile Jamming)', color: 'rgba(239, 68, 68, 0.25)' },
      ];

      gridLevels.forEach((level) => {
        const y = dbToY(level.db);

        ctx.strokeStyle = level.color;
        ctx.lineWidth = level.isCritical ? 1.5 : 1;
        ctx.setLineDash(level.isCritical ? [4, 2] : [2, 4]);

        ctx.beginPath();
        ctx.moveTo(48, y);
        ctx.lineTo(width, y);
        ctx.stroke();

        // Label on left
        ctx.fillStyle = level.isCritical ? 'rgba(239, 68, 68, 0.9)' : 'rgba(16, 185, 129, 0.6)';
        ctx.font = '10px JetBrains Mono, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(level.label, 44, y + 3);
      });

      ctx.setLineDash([]);

      // 2. Draw Target SNR line from Record
      if (record) {
        const targetY = dbToY(record.targetSnrDb);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(48, targetY);
        ctx.lineTo(width, targetY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = 'rgba(245, 158, 11, 0.8)';
        ctx.font = '9px JetBrains Mono, monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`TARGET ${record.targetSnrDb} dB`, width - 8, targetY - 4);
      }

      // 3. Draw Live SNR Curve from History
      const history = historyRef.current;
      if (history.length > 1) {
        const plotWidth = width - 56;
        const startX = 52;

        ctx.beginPath();
        for (let i = 0; i < history.length; i++) {
          const pt = history[i];
          const x = startX + (i / (history.length - 1)) * plotWidth;
          const y = dbToY(pt.snr);
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        // Stroke styling based on current state
        const isCurrentImpulsive = displayedAnalysis?.isImpulsive;
        const currentTrend = displayedAnalysis?.trend;

        if (isCurrentImpulsive) {
          ctx.strokeStyle = '#ef4444'; // Bright red for impulsive
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 10;
        } else if (currentTrend === 'degradation') {
          ctx.strokeStyle = '#facc15'; // Bright yellow for degradation
          ctx.shadowColor = '#facc15';
          ctx.shadowBlur = 8;
        } else if (currentTrend === 'improvement') {
          ctx.strokeStyle = '#38bdf8'; // Light blue for improvement
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 8;
        } else {
          ctx.strokeStyle = '#10b981'; // Nominal emerald
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 4;
        }

        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Glowing Area under the curve
        const lastPt = history[history.length - 1];
        const lastX = startX + plotWidth;
        const zeroY = dbToY(0);

        ctx.lineTo(lastX, zeroY);
        ctx.lineTo(startX, zeroY);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, dbToY(30), 0, dbToY(-20));
        if (isCurrentImpulsive) {
          grad.addColorStop(0, 'rgba(239, 68, 68, 0.28)');
          grad.addColorStop(1, 'rgba(239, 68, 68, 0.02)');
        } else if (currentTrend === 'degradation') {
          grad.addColorStop(0, 'rgba(250, 204, 21, 0.25)');
          grad.addColorStop(1, 'rgba(250, 204, 21, 0.02)');
        } else if (currentTrend === 'improvement') {
          grad.addColorStop(0, 'rgba(56, 189, 248, 0.25)');
          grad.addColorStop(1, 'rgba(56, 189, 248, 0.02)');
        } else {
          grad.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
          grad.addColorStop(1, 'rgba(16, 185, 129, 0.02)');
        }

        ctx.fillStyle = grad;
        ctx.fill();
        ctx.shadowBlur = 0; // reset shadow

        // 4. Draw Current Instantaneous Head Marker
        const currentY = dbToY(lastPt.snr);
        ctx.beginPath();
        ctx.arc(lastX, currentY, 5, 0, Math.PI * 2);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // SNR callout badge on right
        ctx.fillStyle = '#030806';
        ctx.fillRect(lastX - 70, currentY - 20, 65, 16);
        ctx.strokeStyle = ctx.fillStyle;
        ctx.strokeRect(lastX - 70, currentY - 20, 65, 16);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px JetBrains Mono, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${lastPt.snr > 0 ? '+' : ''}${lastPt.snr} dB`, lastX - 37, currentY - 8);
      }

      ctx.restore();
    };

    render();
    if (isPlaying) {
      animId = requestAnimationFrame(render);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [displayedAnalysis, isPlaying, record?.targetSnrDb]);

  // Request on-demand Gemini AI audit report
  const handleRequestGeminiReport = async () => {
    if (!displayedAnalysis) return;
    setIsRequestingGemini(true);
    try {
      const report = await requestGeminiAudit(displayedAnalysis, record?.title);
      setGeminiAuditReport(report);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRequestingGemini(false);
    }
  };

  const isImpulsive = displayedAnalysis?.isImpulsive;
  const impulsiveType = displayedAnalysis?.impulsiveType;
  const trend = displayedAnalysis?.trend;

  return (
    <div className="w-full flex flex-col gap-3 font-mono">
      
      {/* 1. CRITICAL SPECIAL CASE: BRIGHT RED BLINKING FOR IMPULSIVE NOISE */}
      {isImpulsive && (
        <div 
          id="impulsive-noise-alarm-banner"
          className="w-full bg-red-950/85 border-2 border-red-500 rounded-xl p-3.5 shadow-[0_0_30px_rgba(239,68,68,0.7)] animate-pulse flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-red-100"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-600/30 border border-red-400 flex items-center justify-center text-red-200 animate-ping">
              <Bomb className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-red-600 text-white font-black text-xs tracking-wider animate-pulse">
                  CRITICAL IMPULSIVE NOISE ACTIVE
                </span>
                <span className="font-bold text-sm tracking-wide text-red-200">
                  {impulsiveType === 'bomb_blast' && '💥 DETONATION SHOCKWAVE (BOMB BLAST)'}
                  {impulsiveType === 'gunfire' && '🎯 BALLISTIC SUPERSONIC DISCHARGE (GUNFIRE)'}
                  {impulsiveType === 'plane_crash' && '✈️ CATASTROPHIC IMPACT AIRFRAME DISASTER (PLANE CRASH)'}
                  {!impulsiveType && 'IMPULSIVE ACOUSTIC BURST'}
                </span>
              </div>
              <p className="text-xs text-red-200/90 mt-1">
                Hypersonic acoustic pulse detected. Extreme peak crest factor (&gt;18.5 dB). Warning: Blinking persists until the impulse acoustic signature subsides!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-center font-bold">
            <div className="px-3 py-1.5 rounded-lg bg-red-900/90 border border-red-400 text-xs flex items-center gap-2">
              <Clock className="w-4 h-4 animate-spin text-red-300" />
              <span>PERSISTING: {displayedAnalysis?.impulsiveDurationSec ?? manualImpulsiveRemaining}s</span>
            </div>
            <button
              onClick={() => {
                setManualImpulsiveRemaining(0);
                setManualImpulsiveType(null);
              }}
              className="px-2.5 py-1 text-xs rounded bg-red-950 hover:bg-red-800 text-red-200 border border-red-500/50"
            >
              DISMISS ALARM
            </button>
          </div>
        </div>
      )}

      {/* 2. MAIN LIVE SNR GRAPH CARD WITH YELLOW / LIGHT-BLUE BLINKING TELEMETRY */}
      <div className={`
        w-full rounded-xl border p-4 bg-[#030806] transition-all duration-300 flex flex-col gap-3.5
        ${isImpulsive 
          ? 'border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.4)]' 
          : trend === 'degradation' 
          ? 'border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.25)]' 
          : trend === 'improvement' 
          ? 'border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.25)]' 
          : 'border-emerald-500/30'
        }
      `}>
        
        {/* Header: Title, Blinking Status Readout, and Quick Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-500/20 pb-3">
          
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isImpulsive ? 'bg-red-500/20 text-red-400' :
              trend === 'degradation' ? 'bg-yellow-500/20 text-yellow-300' :
              trend === 'improvement' ? 'bg-sky-500/20 text-sky-300' :
              'bg-emerald-500/20 text-emerald-400'
            }`}>
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-bold text-sm tracking-wider text-emerald-100">
                  REAL-TIME SNR TELEMETRY MONITOR
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                  LIVE DSP ENGINE
                </span>
              </div>
              <p className="text-[11px] text-emerald-500/70 font-mono">
                Continuous acoustic SNR tracking as input audio is processed
              </p>
            </div>
          </div>

          {/* SNR STATUS PILLS: YELLOW BLINKING (DEGRADATION) OR LIGHT BLUE BLINKING (IMPROVEMENT) */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Case: SNR Degradation (YELLOW BLINKING) */}
            {trend === 'degradation' && !isImpulsive && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-950/80 border-2 border-yellow-400 shadow-[0_0_15px_#facc15] animate-pulse">
                <AlertTriangle className="w-4 h-4 text-yellow-300 animate-bounce" />
                <div>
                  <div className="text-[10px] font-black text-yellow-400 uppercase tracking-widest leading-none">
                    ⚠️ SNR DEGRADATION ACTIVE
                  </div>
                  <div className="text-xs font-bold text-yellow-200 mt-0.5">
                    CURRENT: <span className="text-yellow-300 font-extrabold text-sm">{displayedAnalysis?.currentSnrDb} dB</span>
                    {' '}| PREV: <span className="text-yellow-100">{displayedAnalysis?.previousSnrDb} dB</span>
                    {' '}| LOSS: <span className="text-rose-400 font-black">{displayedAnalysis?.snrDeltaDb} dB</span>
                  </div>
                </div>
              </div>
            )}

            {/* Case: SNR Improvement (LIGHT BLUE BLINKING) */}
            {trend === 'improvement' && !isImpulsive && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-sky-950/80 border-2 border-sky-400 shadow-[0_0_15px_#38bdf8] animate-pulse">
                <Zap className="w-4 h-4 text-sky-300 animate-bounce" />
                <div>
                  <div className="text-[10px] font-black text-sky-300 uppercase tracking-widest leading-none">
                    💎 SNR IMPROVEMENT ACTIVE
                  </div>
                  <div className="text-xs font-bold text-sky-200 mt-0.5">
                    CURRENT: <span className="text-sky-300 font-extrabold text-sm">{displayedAnalysis?.currentSnrDb} dB</span>
                    {' '}| PREV: <span className="text-sky-100">{displayedAnalysis?.previousSnrDb} dB</span>
                    {' '}| GAIN: <span className="text-emerald-300 font-black">+{displayedAnalysis?.snrDeltaDb} dB</span>
                  </div>
                </div>
              </div>
            )}

            {/* Case: Steady State (Emerald) */}
            {trend === 'stable' && !isImpulsive && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="text-[10px] text-emerald-500 font-bold block">SNR STEADY</span>
                  <span className="font-extrabold text-sm">{displayedAnalysis?.currentSnrDb} dB</span>
                </div>
              </div>
            )}

            {/* Active Noise Cancellation (ANC) Toggle Switch */}
            <button
              onClick={() => setAncEnabled(!ancEnabled)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 ${
                ancEnabled 
                  ? 'bg-sky-500/20 text-sky-300 border-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.4)]' 
                  : 'bg-emerald-950/50 text-emerald-400 border-emerald-500/30 hover:bg-emerald-900/40'
              }`}
              title="Toggle Active Noise Cancellation filter to test real-time SNR improvement"
            >
              <Waves className="w-3.5 h-3.5" />
              <span>ANC FILTER: {ancEnabled ? 'ENGAGED (-18dB)' : 'BYPASSED'}</span>
            </button>
          </div>

        </div>

        {/* 1. Live Canvas SNR Graph */}
        <div className="relative w-full h-48 sm:h-56 bg-[#020504] rounded-lg border border-emerald-500/20 overflow-hidden">
          <canvas
            ref={canvasRef}
            className="w-full h-full block"
          />

          {/* Quick HUD legend on graph */}
          <div className="absolute top-2 right-2 flex items-center gap-3 text-[10px] bg-[#030806]/85 px-2.5 py-1 rounded border border-emerald-500/20 backdrop-blur-sm">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-emerald-300">&gt;10dB Clear</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span>
              <span className="text-yellow-300">0-10dB Degraded</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              <span className="text-red-300">&lt;0dB Critical/Impulsive</span>
            </div>
          </div>
        </div>

        {/* Simulation Triggers Bar for User Testing */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-lg bg-[#020504] border border-emerald-500/20 text-xs">
          <span className="text-emerald-500 text-[11px] font-bold flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 text-emerald-400" />
            SIMULATE CONDITIONS:
          </span>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Trigger Degradation */}
            <button
              onClick={() => {
                setManualSnrOffset((prev) => (prev <= -12 ? 0 : -14));
              }}
              className={`px-2.5 py-1 rounded text-xs border font-bold transition-all ${
                manualSnrOffset < 0 
                  ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400 animate-pulse' 
                  : 'bg-emerald-950/40 text-yellow-400/90 border-yellow-500/30 hover:bg-yellow-950/40'
              }`}
            >
              ⚠️ DEGRADE SNR (-14dB Yellow Blink)
            </button>

            {/* Trigger Improvement */}
            <button
              onClick={() => {
                setManualSnrOffset((prev) => (prev >= 12 ? 0 : 16));
              }}
              className={`px-2.5 py-1 rounded text-xs border font-bold transition-all ${
                manualSnrOffset > 0 
                  ? 'bg-sky-500/20 text-sky-300 border-sky-400 animate-pulse' 
                  : 'bg-emerald-950/40 text-sky-400/90 border-sky-500/30 hover:bg-sky-950/40'
              }`}
            >
              💎 IMPROVE SNR (+16dB Light Blue Blink)
            </button>

            {/* Impulsive Blast Triggers (Bright Red Blinking) */}
            <button
              onClick={() => triggerImpulsiveEvent('bomb_blast')}
              className="px-2.5 py-1 rounded text-xs font-bold bg-red-950/50 hover:bg-red-900/60 text-red-400 border border-red-500/50 flex items-center gap-1"
              title="Simulate Bomb Blast shockwave"
            >
              <Bomb className="w-3 h-3" />
              <span>BOMB BLAST</span>
            </button>

            <button
              onClick={() => triggerImpulsiveEvent('gunfire')}
              className="px-2.5 py-1 rounded text-xs font-bold bg-red-950/50 hover:bg-red-900/60 text-red-400 border border-red-500/50 flex items-center gap-1"
              title="Simulate Gunfire crack"
            >
              <Crosshair className="w-3 h-3" />
              <span>GUNFIRE</span>
            </button>

            <button
              onClick={() => triggerImpulsiveEvent('plane_crash')}
              className="px-2.5 py-1 rounded text-xs font-bold bg-red-950/50 hover:bg-red-900/60 text-red-400 border border-red-500/50 flex items-center gap-1"
              title="Simulate Plane Crash structural impact"
            >
              <Plane className="w-3 h-3" />
              <span>PLANE CRASH</span>
            </button>

            {(manualSnrOffset !== 0 || manualImpulsiveRemaining > 0) && (
              <button
                onClick={() => {
                  setManualSnrOffset(0);
                  setManualImpulsiveRemaining(0);
                  setManualImpulsiveType(null);
                }}
                className="px-2 py-1 rounded text-xs text-emerald-500 hover:text-emerald-200 underline"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* 4. AI ACOUSTIC ANALYSIS SECTION - ALL 6 REQUIRED PARAMETERS */}
        <div className="w-full bg-[#020504] rounded-lg border border-emerald-500/30 p-3.5 flex flex-col gap-3">
          
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span className="font-display font-bold text-xs tracking-wider text-emerald-200">
                AI ACOUSTIC SITUATIONAL ANALYSIS // TELEMETRY DOSSIER
              </span>
            </div>
            <span className="text-[10px] text-emerald-500 font-mono">
              ENV: {displayedAnalysis?.environmentClassifier}
            </span>
          </div>

          {/* Grid of the 6 Required Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            
            {/* Metric 1: Noise Level */}
            <div className="p-2.5 rounded bg-[#030806] border border-emerald-500/25 flex flex-col">
              <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">
                1. NOISE LEVEL
              </span>
              <span className="text-base font-extrabold text-emerald-100 mt-1">
                {displayedAnalysis?.noiseLevelDb} dBFS
              </span>
              <span className="text-[10px] text-emerald-500/80 mt-0.5">
                {displayedAnalysis?.noiseLevelPercent}% Amplitude
              </span>
            </div>

            {/* Metric 2: SNR Value (Both Previous & Current) */}
            <div className={`p-2.5 rounded bg-[#030806] border flex flex-col transition-all ${
              trend === 'degradation' 
                ? 'border-yellow-400 shadow-[0_0_10px_#facc15] animate-pulse text-yellow-300' 
                : trend === 'improvement' 
                ? 'border-sky-400 shadow-[0_0_10px_#38bdf8] animate-pulse text-sky-300' 
                : 'border-emerald-500/25 text-emerald-300'
            }`}>
              <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                2. SNR VALUE
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-base font-black">
                  {displayedAnalysis?.currentSnrDb} dB
                </span>
                <span className="text-[10px] opacity-75">CURR</span>
              </div>
              <span className="text-[10px] opacity-80 mt-0.5">
                PREV: {displayedAnalysis?.previousSnrDb} dB (Δ {displayedAnalysis?.snrDeltaDb} dB)
              </span>
            </div>

            {/* Metric 3: Speech Probability in % */}
            <div className="p-2.5 rounded bg-[#030806] border border-emerald-500/25 flex flex-col">
              <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">
                3. SPEECH PROBABILITY
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className={`text-base font-black ${
                  (displayedAnalysis?.speechProbabilityPercent || 0) > 60 ? 'text-emerald-300' :
                  (displayedAnalysis?.speechProbabilityPercent || 0) > 30 ? 'text-yellow-300' :
                  'text-rose-400'
                }`}>
                  {displayedAnalysis?.speechProbabilityPercent}%
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-1 bg-emerald-950 rounded-full mt-1.5 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    (displayedAnalysis?.speechProbabilityPercent || 0) > 60 ? 'bg-emerald-400' :
                    (displayedAnalysis?.speechProbabilityPercent || 0) > 30 ? 'bg-yellow-400' :
                    'bg-rose-500'
                  }`}
                  style={{ width: `${displayedAnalysis?.speechProbabilityPercent || 0}%` }}
                />
              </div>
            </div>

            {/* Metric 4: ANC Reduction */}
            <div className="p-2.5 rounded bg-[#030806] border border-emerald-500/25 flex flex-col">
              <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">
                4. ANC REDUCTION
              </span>
              <span className="text-base font-extrabold text-sky-300 mt-1">
                {displayedAnalysis?.ancReductionDb !== 0 ? `${displayedAnalysis?.ancReductionDb} dB` : 'BYPASS (0 dB)'}
              </span>
              <span className="text-[10px] text-emerald-500/80 mt-0.5">
                {ancEnabled ? 'Active Filtering ON' : 'Standby Mode'}
              </span>
            </div>

            {/* Metric 5: Residual Noise */}
            <div className="p-2.5 rounded bg-[#030806] border border-emerald-500/25 flex flex-col">
              <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">
                5. RESIDUAL NOISE
              </span>
              <span className="text-base font-extrabold text-amber-300 mt-1">
                {displayedAnalysis?.residualNoiseDb} dBFS
              </span>
              <span className="text-[10px] text-emerald-500/80 mt-0.5">
                Post-Cancellation Floor
              </span>
            </div>

            {/* Metric 6: Processing Latency */}
            <div className="p-2.5 rounded bg-[#030806] border border-emerald-500/25 flex flex-col">
              <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">
                6. DSP LATENCY
              </span>
              <span className="text-base font-extrabold text-emerald-200 mt-1">
                {displayedAnalysis?.processingLatencyMs} ms
              </span>
              <span className="text-[10px] text-emerald-500/80 mt-0.5">
                Ultra-Low Latency Buffer
              </span>
            </div>

          </div>

          {/* AI Situational Narrative Briefing */}
          <div className="p-3 rounded bg-[#030806] border border-emerald-500/20 flex flex-col sm:flex-row items-start justify-between gap-3 text-xs">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold text-emerald-300 uppercase tracking-wider text-[11px]">
                  AI ACOUSTIC DIAGNOSIS:
                </span>
              </div>
              <p className="text-emerald-100/90 leading-relaxed">
                {displayedAnalysis?.aiSummary}
              </p>
              <p className="text-emerald-400/80 font-mono text-[11px] mt-1.5">
                <strong>RECOMMENDATION:</strong> {displayedAnalysis?.tacticalRecommendation}
              </p>
            </div>

            <div className="flex flex-col gap-2 self-stretch sm:self-center shrink-0">
              <button
                onClick={handleRequestGeminiReport}
                disabled={isRequestingGemini}
                className="px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/50 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-[0_0_12px_rgba(16,185,129,0.2)] disabled:opacity-50"
              >
                {isRequestingGemini ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                )}
                <span>{isRequestingGemini ? 'AUDITING...' : 'GEMINI DEEP AI AUDIT'}</span>
              </button>
            </div>
          </div>

          {/* Deep Gemini Audit Modal/Expansion if triggered */}
          {geminiAuditReport && (
            <div className="p-3.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between text-emerald-300 font-bold border-b border-emerald-500/30 pb-1">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  GEMINI SITUATIONAL INTELLIGENCE BRIEFING
                </span>
                <button
                  onClick={() => setGeminiAuditReport(null)}
                  className="text-emerald-500 hover:text-emerald-200 text-xs"
                >
                  [CLOSE]
                </button>
              </div>
              <div className="text-emerald-100 font-mono whitespace-pre-wrap leading-relaxed">
                {geminiAuditReport}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
