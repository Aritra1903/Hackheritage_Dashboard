/**
 * Record Card Component for the Audio & Noise Database
 */

import React from 'react';
import { 
  Play, 
  Pause, 
  Maximize2, 
  Download, 
  ArrowRightLeft, 
  Activity, 
  Sparkles, 
  Zap, 
  Radio
} from 'lucide-react';
import { AudioNoiseRecord, PlaybackChannel } from '../types';

interface RecordCardProps {
  record: AudioNoiseRecord;
  isActive: boolean;
  isPlaying: boolean;
  activeChannel: PlaybackChannel;
  currentTime: number;
  onPlay: (record: AudioNoiseRecord) => void;
  onToggleChannel: (channel: PlaybackChannel) => void;
  onInspect: (record: AudioNoiseRecord) => void;
  onCompare: (record: AudioNoiseRecord) => void;
  onSeek?: (fraction: number) => void;
}

export const RecordCard: React.FC<RecordCardProps> = ({
  record,
  isActive,
  isPlaying,
  activeChannel,
  currentTime,
  onPlay,
  onToggleChannel,
  onInspect,
  onCompare,
}) => {
  const snr = record.measuredSnrDb;
  const isCurrentlyPlaying = isActive && isPlaying;

  const snrStyle =
    snr < 0
      ? 'bg-rose-950/60 text-rose-300 border-rose-800/80'
      : snr < 8
      ? 'bg-amber-950/60 text-amber-300 border-amber-800/80'
      : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80';

  const noiseBadgeStyle: Record<string, string> = {
    white: 'border-slate-600 bg-slate-800/80 text-slate-300',
    pink: 'border-pink-800/60 bg-pink-950/40 text-pink-300',
    brown: 'border-amber-900/60 bg-amber-950/40 text-amber-400',
    hum: 'border-yellow-800/60 bg-yellow-950/40 text-yellow-300',
    babble: 'border-cyan-800/60 bg-cyan-950/40 text-cyan-300',
    traffic: 'border-blue-800/60 bg-blue-950/40 text-blue-300',
    digital_click: 'border-rose-800/60 bg-rose-950/40 text-rose-300',
  };

  const progressFraction = isActive && record.duration > 0
    ? Math.min(1, Math.max(0, currentTime / record.duration))
    : 0;

  return (
    <div
      id={`record-card-${record.id}`}
      className={`relative rounded-xl border transition-all duration-200 overflow-hidden flex flex-col justify-between font-mono ${
        isActive
          ? 'bg-[#06140c] border-emerald-400 shadow-[0_0_20px_rgba(0,255,102,0.2)] ring-1 ring-emerald-500/50'
          : 'bg-[#030806] border-emerald-500/25 hover:border-emerald-400/50 hover:bg-[#050f09]'
      }`}
    >
      {/* Card Header */}
      <div className="p-3 pb-2 flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
              {record.category}
            </span>
            <span
              className={`font-mono text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                noiseBadgeStyle[record.noiseType] || 'border-emerald-800 text-emerald-300'
              }`}
            >
              JAM: {record.noiseType}
            </span>
          </div>

          <h3 className="text-xs font-display font-bold text-emerald-100 truncate" title={record.title}>
            {record.title}
          </h3>
        </div>

        {/* SNR Badge */}
        <div className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold border shrink-0 ${snrStyle}`}>
          {snr > 0 ? `+${snr}` : snr} dB SNR
        </div>
      </div>

      {/* Dual Mini Waveform Box */}
      <div className="px-3 py-1.5">
        <div 
          onClick={() => onPlay(record)}
          className="relative h-12 w-full bg-[#020504] rounded-lg border border-emerald-500/25 p-1 flex items-center gap-0.5 overflow-hidden cursor-pointer group shadow-inner"
          title="Click to intercept / play signal"
        >
          {/* Waveform bars */}
          {record.waveformPeaks.noisy.slice(0, 70).map((noisyPeak, idx) => {
            const cleanPeak = record.waveformPeaks.clean[idx] || 0;
            return (
              <div key={idx} className="flex-1 h-full flex flex-col justify-center items-center gap-0.5">
                {/* Noisy Envelope (translucent amber) */}
                <div
                  className="w-full bg-amber-500/30 rounded-xs transition-all"
                  style={{ height: `${Math.max(12, noisyPeak * 100)}%` }}
                />
                {/* Clean Core (emerald) */}
                <div
                  className="w-full bg-emerald-400/90 rounded-xs -mt-2"
                  style={{ height: `${Math.max(6, cleanPeak * 60)}%` }}
                />
              </div>
            );
          })}

          {/* Active progress overlay */}
          {isActive && (
            <div
              className="absolute top-0 bottom-0 left-0 bg-emerald-500/20 border-r-2 border-emerald-400 pointer-events-none transition-all duration-75"
              style={{ width: `${progressFraction * 100}%` }}
            />
          )}

          {/* Hover play icon watermark */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/60 backdrop-blur-[1px] transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-bold shadow-[0_0_12px_#00ff66]">
              {isCurrentlyPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </div>
          </div>
        </div>

        {/* Time and Specs bar below waveform */}
        <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-emerald-400/70">
          <span>{record.duration.toFixed(1)}s</span>
          <span>RMS: {record.cleanMetrics.rmsDb} dBFS</span>
        </div>
      </div>

      {/* Card Footer: Quick Channel Toggle & Action Buttons */}
      <div className="px-3 py-2 bg-[#040e0a] border-t border-emerald-500/20 flex items-center justify-between gap-2">
        {/* Play/Pause Button */}
        <button
          onClick={() => onPlay(record)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-bold tracking-wider transition-all ${
            isCurrentlyPlaying
              ? 'bg-emerald-500 text-slate-950 shadow-[0_0_10px_#00ff66]'
              : 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30'
          }`}
        >
          {isCurrentlyPlaying ? (
            <>
              <Pause className="w-3 h-3 fill-current" /> PAUSE
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-current" /> PLAY
            </>
          )}
        </button>

        {/* Actions: Compare & Inspect */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onCompare(record)}
            className="p-1.5 rounded text-emerald-400/80 hover:text-emerald-200 hover:bg-emerald-950/60 transition-colors border border-emerald-500/20"
            title="A/B Compare with another recording"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onInspect(record)}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold text-emerald-300 hover:text-emerald-100 hover:bg-emerald-950/60 transition-colors border border-emerald-500/30"
            title="Inspect full acoustic specs & WAV stems"
          >
            <Maximize2 className="w-3 h-3" /> DOSSIER
          </button>
        </div>
      </div>
    </div>
  );
};
