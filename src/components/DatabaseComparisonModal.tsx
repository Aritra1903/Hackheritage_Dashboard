/**
 * Dual Database Record Comparison Modal (Side-by-Side Noise & SNR Analysis)
 */

import React from 'react';
import { X, ArrowRightLeft, Activity, Radio, Sparkles } from 'lucide-react';
import { AudioNoiseRecord } from '../types';
import { AudioVisualizer } from './AudioVisualizer';

interface DatabaseComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  recordA: AudioNoiseRecord | null;
  recordB: AudioNoiseRecord | null;
  onSelectRecordA: (record: AudioNoiseRecord) => void;
  onSelectRecordB: (record: AudioNoiseRecord) => void;
  allRecords: AudioNoiseRecord[];
}

export const DatabaseComparisonModal: React.FC<DatabaseComparisonModalProps> = ({
  isOpen,
  onClose,
  recordA,
  recordB,
  onSelectRecordA,
  onSelectRecordB,
  allRecords,
}) => {
  if (!isOpen || !recordA) return null;

  const compareRecordB = recordB || (allRecords.find(r => r.id !== recordA.id) || recordA);

  const snrDiff = Math.round((recordA.measuredSnrDb - compareRecordB.measuredSnrDb) * 10) / 10;

  return (
    <div 
      id="comparison-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto"
    >
      <div 
        id="comparison-modal-card"
        className="w-full max-w-5xl bg-[#0e1422] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#131b2e]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">Side-by-Side Noise Impact Comparison</h2>
              <p className="text-xs text-slate-400">Compare waveform degradation, noise profiles, and SNR differences between database entries</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-6 max-h-[75vh] overflow-y-auto">
          
          {/* Comparison Delta Bar */}
          <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-300">SNR Delta:</span>
              <span className={`font-mono px-2 py-0.5 rounded font-bold ${
                snrDiff > 0 
                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800' 
                  : snrDiff < 0 
                  ? 'bg-rose-950/60 text-rose-300 border border-rose-800' 
                  : 'bg-slate-800 text-slate-300'
              }`}>
                {snrDiff > 0 ? `+${snrDiff}` : snrDiff} dB
              </span>
              <span className="text-slate-400">
                ({recordA.title} is {snrDiff >= 0 ? 'cleaner' : 'noisier'} than {compareRecordB.title})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Switch Right Track:</span>
              <select
                value={compareRecordB.id}
                onChange={(e) => {
                  const target = allRecords.find((r) => r.id === e.target.value);
                  if (target) onSelectRecordB(target);
                }}
                className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-slate-200 focus:outline-none"
              >
                {allRecords.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title} ({r.noiseType.toUpperCase()} - {r.measuredSnrDb}dB)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Two-Column Side by Side Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* RECORD A */}
            <div className="flex flex-col gap-3 p-4 bg-slate-900/50 rounded-xl border border-cyan-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">Sample A</span>
                  <h3 className="text-sm font-bold text-slate-100">{recordA.title}</h3>
                </div>
                <span className="font-mono text-xs px-2 py-1 rounded font-bold bg-slate-800 border border-slate-700 text-slate-200">
                  SNR: {recordA.measuredSnrDb > 0 ? `+${recordA.measuredSnrDb}` : recordA.measuredSnrDb} dB
                </span>
              </div>

              {/* Waveform */}
              <div className="h-28">
                <AudioVisualizer
                  cleanPeaks={recordA.waveformPeaks.clean}
                  noisyPeaks={recordA.waveformPeaks.noisy}
                  duration={recordA.duration}
                  currentTime={0}
                  activeChannel="noisy"
                  isPlaying={false}
                />
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                <div className="p-2 bg-slate-800/60 rounded-lg">
                  <div className="text-[10px] text-slate-400">Noise</div>
                  <div className="text-amber-300 font-bold uppercase">{recordA.noiseType}</div>
                </div>
                <div className="p-2 bg-slate-800/60 rounded-lg">
                  <div className="text-[10px] text-slate-400">Clean RMS</div>
                  <div className="text-emerald-400 font-semibold">{recordA.cleanMetrics.rmsDb} dB</div>
                </div>
                <div className="p-2 bg-slate-800/60 rounded-lg">
                  <div className="text-[10px] text-slate-400">Noisy RMS</div>
                  <div className="text-amber-400 font-semibold">{recordA.noisyMetrics.rmsDb} dB</div>
                </div>
              </div>
            </div>

            {/* RECORD B */}
            <div className="flex flex-col gap-3 p-4 bg-slate-900/50 rounded-xl border border-amber-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">Sample B</span>
                  <h3 className="text-sm font-bold text-slate-100">{compareRecordB.title}</h3>
                </div>
                <span className="font-mono text-xs px-2 py-1 rounded font-bold bg-slate-800 border border-slate-700 text-slate-200">
                  SNR: {compareRecordB.measuredSnrDb > 0 ? `+${compareRecordB.measuredSnrDb}` : compareRecordB.measuredSnrDb} dB
                </span>
              </div>

              {/* Waveform */}
              <div className="h-28">
                <AudioVisualizer
                  cleanPeaks={compareRecordB.waveformPeaks.clean}
                  noisyPeaks={compareRecordB.waveformPeaks.noisy}
                  duration={compareRecordB.duration}
                  currentTime={0}
                  activeChannel="noisy"
                  isPlaying={false}
                />
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                <div className="p-2 bg-slate-800/60 rounded-lg">
                  <div className="text-[10px] text-slate-400">Noise</div>
                  <div className="text-amber-300 font-bold uppercase">{compareRecordB.noiseType}</div>
                </div>
                <div className="p-2 bg-slate-800/60 rounded-lg">
                  <div className="text-[10px] text-slate-400">Clean RMS</div>
                  <div className="text-emerald-400 font-semibold">{compareRecordB.cleanMetrics.rmsDb} dB</div>
                </div>
                <div className="p-2 bg-slate-800/60 rounded-lg">
                  <div className="text-[10px] text-slate-400">Noisy RMS</div>
                  <div className="text-amber-400 font-semibold">{compareRecordB.noisyMetrics.rmsDb} dB</div>
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3 border-t border-slate-800 bg-[#131b2e]">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Close Comparison
          </button>
        </div>

      </div>
    </div>
  );
};
