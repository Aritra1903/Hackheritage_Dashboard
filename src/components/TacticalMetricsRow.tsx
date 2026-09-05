/**
 * Tactical Metrics Row & Intel Feed
 * Recreates the exact KPI metrics cards and Intel Feed from the TDIS command interface screenshot.
 */

import React from 'react';
import { 
  FileAudio, 
  Radio, 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  Terminal,
  Volume2
} from 'lucide-react';
import { DatabaseStats } from '../types';

interface TacticalMetricsRowProps {
  stats: DatabaseStats;
  criticalCount: number;
  recentLogs: string[];
  activeRecordTitle?: string;
  mlConfidence?: number;
  mlSnr?: number;
  mlNoiseType?: string;
  onOpenNoiseStudio: () => void;
}
export const TacticalMetricsRow: React.FC<TacticalMetricsRowProps> = ({
  stats,
  criticalCount,
  recentLogs,
  activeRecordTitle,
  mlConfidence,
  mlSnr,
  mlNoiseType,
  onOpenNoiseStudio,
}) => {
  const avgSnr = stats.avgSnrDb;
  const criticalPercent =
    stats.totalRecords > 0
      ? ((criticalCount / stats.totalRecords) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
      {/* 4 Tactical Metrics Cards - 8 cols on desktop */}
      <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        
        {/* Card 1: Audio Samples (Neon Green) */}
        <div className="relative bg-[#040c08] rounded-xl border border-emerald-500/35 p-3 flex flex-col justify-between shadow-[0_0_15px_rgba(16,185,129,0.05)] hover:border-emerald-400/60 transition-colors">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <FileAudio className="w-4 h-4" />
            </div>
            <span className="font-mono text-[10px] text-emerald-400/80 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-800/40">
              INPUTS
            </span>
          </div>
          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-bold font-display text-orange-200 tracking-tight">
              {mlSnr !== undefined
                ? (mlSnr < 0 ? 'CRITICAL' : 'NORMAL')
                : `${criticalPercent}%`}
            </div>

            <div className="text-[10px] sm:text-[11px] font-mono text-orange-400/70 uppercase tracking-wider mt-0.5">
              {mlSnr !== undefined ? 'Live SNR Status' : 'Sub-Zero SNR'}
            </div>
          </div>
        </div>

        {/* Card 2: Noise Types (Cyan) */}
        <div className="relative bg-[#030a0d] rounded-xl border border-cyan-500/35 p-3 flex flex-col justify-between shadow-[0_0_15px_rgba(6,182,212,0.05)] hover:border-cyan-400/60 transition-colors">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Radio className="w-4 h-4" />
            </div>
            <span className="font-mono text-[10px] text-cyan-400/80 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/40">
              JAMMERS
            </span>
          </div>
          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-bold font-display text-cyan-200 tracking-tight">
              {Object.keys(stats.noiseTypeDistribution).length}
            </div>
            <div className="text-[10px] sm:text-[11px] font-mono text-cyan-400/70 uppercase tracking-wider mt-0.5">
              Noise Profiles
            </div>
          </div>
        </div>

        {/* Card 3: Avg SNR Ratio (Yellow/Gold) */}
        <div className="relative bg-[#0a0a03] rounded-xl border border-yellow-500/35 p-3 flex flex-col justify-between shadow-[0_0_15px_rgba(234,179,8,0.05)] hover:border-yellow-400/60 transition-colors">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/15 border border-yellow-500/40 flex items-center justify-center text-yellow-400">
              <Activity className="w-4 h-4" />
            </div>
            <span className="font-mono text-[10px] text-yellow-400/80 bg-yellow-950/40 px-1.5 py-0.5 rounded border border-yellow-800/40">
              RATIO
            </span>
          </div>
          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-bold font-display text-yellow-200 tracking-tight">
              {mlSnr !== undefined
                ? `${mlSnr > 0 ? '+' : ''}${mlSnr}`
                : `${avgSnr > 0 ? '+' : ''}${avgSnr}`}
              <span className="text-xs text-yellow-400 font-mono">
                dB
              </span>
            </div>
            <div className="text-[10px] sm:text-[11px] font-mono text-yellow-400/70 uppercase tracking-wider mt-0.5">
              Avg SNR Index
            </div>
          </div>
        </div>

        {/* Card 4: Critical Noise (<0dB) (Orange/Red) */}
        <div className="relative bg-[#0d0704] rounded-xl border border-orange-500/35 p-3 flex flex-col justify-between shadow-[0_0_15px_rgba(249,115,22,0.05)] hover:border-orange-400/60 transition-colors">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <span className="font-mono text-[10px] text-orange-400/80 bg-orange-950/40 px-1.5 py-0.5 rounded border border-orange-800/40">
              ALERT
            </span>
          </div>
          <div className="mt-2.5">
            <div className="text-xl sm:text-2xl font-bold font-display text-orange-200 tracking-tight">
              {criticalPercent}%
            </div>
            <div className="text-[10px] sm:text-[11px] font-mono text-orange-400/70 uppercase tracking-wider mt-0.5">
              Sub-Zero SNR
            </div>
          </div>
        </div>

      </div>

      {/* Intel Feed Box - 4 cols on desktop (Exact to Screenshot!) */}
      <div className="lg:col-span-4 bg-[#030906] rounded-xl border border-emerald-500/35 p-3 flex flex-col justify-between shadow-[0_0_15px_rgba(16,185,129,0.06)] relative overflow-hidden">
        <div>
          {/* Header row */}
          <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-emerald-400" />
              <span className="font-display text-xs font-bold uppercase tracking-wider text-slate-100">
                Intel Feed
              </span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>

          {/* Feed Content */}
          <div className="mt-2 space-y-1.5 font-mono text-[11px]">
            <div className="flex items-start gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-emerald-400" />
              <div className="leading-snug">
                <span className="font-bold text-emerald-300">✓ STATUS: </span>
                <span className="text-emerald-400/90 text-[10.5px]">
                  Acoustic Defense Intelligence operational. All noise sensors & dual FFT streams online.
                </span>
              </div>
            </div>

            {mlNoiseType ? (
              <div className="flex items-center gap-1.5 text-cyan-400/90 text-[10.5px] pl-5 border-l border-emerald-900/60 ml-1.5">
                <span>ML DETECTED:</span>

                <span className="font-bold text-cyan-300 truncate">
                  {mlNoiseType.toUpperCase().replace('_', ' ')}
                </span>
              </div>
            ) : activeRecordTitle ? (
              <div className="flex items-center gap-1.5 text-cyan-400/90 text-[10.5px] pl-5 border-l border-emerald-900/60 ml-1.5">
                <span>INTERCEPTED:</span>

                <span className="font-bold text-cyan-300 truncate">
                  {activeRecordTitle}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Action footnote */}
        <div className="mt-2 pt-1.5 border-t border-emerald-500/20 flex items-center justify-between text-[10px] font-mono text-emerald-500/80">
          <span>SEC-INTEL: OK</span>
          <button
            onClick={onOpenNoiseStudio}
            className="hover:text-emerald-300 underline cursor-pointer"
          >
            + INJECT SIGNAL
          </button>
        </div>
      </div>
    </div>
  );
};
