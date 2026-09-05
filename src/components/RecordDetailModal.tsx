/**
 * Record Detail & Acoustic Inspection Modal
 */

import React, { useState } from 'react';
import { 
  X, 
  Download, 
  Trash2, 
  Calendar, 
  Activity, 
  FileAudio, 
  Layers, 
  Tag, 
  ExternalLink,
  ShieldAlert,
  Sliders
} from 'lucide-react';
import { AudioNoiseRecord, PlaybackChannel } from '../types';
import { AudioVisualizer } from './AudioVisualizer';

interface RecordDetailModalProps {
  record: AudioNoiseRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleteRecord: (id: string) => Promise<void>;
  onSelectForPlayback: (record: AudioNoiseRecord) => void;
}

export const RecordDetailModal: React.FC<RecordDetailModalProps> = ({
  record,
  isOpen,
  onClose,
  onDeleteRecord,
  onSelectForPlayback,
}) => {
  const [activeChannel, setActiveChannel] = useState<PlaybackChannel>('noisy');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!isOpen || !record) return null;

  const downloadWav = (blob: Blob, suffix: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${record.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${suffix}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    await onDeleteRecord(record.id);
    onClose();
  };

  const snrColor = 
    record.measuredSnrDb < 0 
      ? 'text-rose-400 bg-rose-950/40 border-rose-800' 
      : record.measuredSnrDb < 8 
      ? 'text-amber-400 bg-amber-950/40 border-amber-800' 
      : 'text-emerald-400 bg-emerald-950/40 border-emerald-800';

  return (
    <div 
      id="record-detail-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto"
    >
      <div 
        id="record-detail-modal-card"
        className="w-full max-w-3xl bg-[#0e1422] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#131b2e]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <FileAudio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">{record.title}</h2>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="flex items-center gap-1 font-mono">
                  <Calendar className="w-3.5 h-3.5" />
                  {new Date(record.createdAt).toLocaleDateString()} {new Date(record.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span>•</span>
                <span className="capitalize">{record.sourceType.replace('_', ' ')}</span>
              </div>
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
          
          {/* Dual Waveform Visualizer */}
          <div className="flex flex-col gap-2 p-4 bg-slate-900/80 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                Waveform Profile (Clean vs Injected Noise)
              </span>
              <button
                onClick={() => {
                  onSelectForPlayback(record);
                  onClose();
                }}
                className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                Load into Player <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            <AudioVisualizer
              cleanPeaks={record.waveformPeaks.clean}
              noisyPeaks={record.waveformPeaks.noisy}
              noiseOnlyPeaks={record.waveformPeaks.noiseOnly}
              duration={record.duration}
              currentTime={0}
              activeChannel={activeChannel}
              isPlaying={false}
              showSpectrogram={false}
            />
          </div>

          {/* Acoustic & SNR Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-center font-mono">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider">Measured SNR</div>
              <div className={`text-lg font-bold mt-0.5 ${snrColor.split(' ')[0]}`}>
                {record.measuredSnrDb > 0 ? `+${record.measuredSnrDb}` : record.measuredSnrDb} dB
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Target: {record.targetSnrDb} dB</div>
            </div>

            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-center font-mono">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider">Noise Type</div>
              <div className="text-sm font-bold text-amber-300 mt-1 uppercase">
                {record.noiseType}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Intensity: ~{record.noiseLevelPercent}%</div>
            </div>

            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-center font-mono">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider">Clean RMS</div>
              <div className="text-sm font-semibold text-emerald-400 mt-1">
                {record.cleanMetrics.rmsDb} dBFS
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Peak: {record.cleanMetrics.peakDb} dBFS</div>
            </div>

            <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-center font-mono">
              <div className="text-[11px] text-slate-400 uppercase tracking-wider">Noisy RMS</div>
              <div className="text-sm font-semibold text-amber-400 mt-1">
                {record.noisyMetrics.rmsDb} dBFS
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Peak: {record.noisyMetrics.peakDb} dBFS</div>
            </div>
          </div>

          {/* Audio Specs Table */}
          <div className="p-4 bg-slate-900/40 rounded-xl border border-slate-800/80">
            <h4 className="text-xs font-semibold text-slate-300 mb-3 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" /> Technical Audio Properties
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
              <div>
                <span className="text-slate-500 block">Duration</span>
                <span className="text-slate-200 font-medium">{record.duration.toFixed(2)} seconds</span>
              </div>
              <div>
                <span className="text-slate-500 block">Sample Rate</span>
                <span className="text-slate-200 font-medium">{record.sampleRate} Hz</span>
              </div>
              <div>
                <span className="text-slate-500 block">Channels</span>
                <span className="text-slate-200 font-medium">{record.channels === 1 ? 'Mono (1 ch)' : 'Stereo (2 ch)'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Format</span>
                <span className="text-slate-200 font-medium">16-bit PCM WAV</span>
              </div>
            </div>
          </div>

          {/* Tags & Description */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-400">Tags & Notes:</span>
            <div className="flex flex-wrap gap-1.5">
              {record.tags.map((tag, i) => (
                <span 
                  key={i} 
                  className="px-2 py-0.5 rounded-md text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700/80"
                >
                  #{tag}
                </span>
              ))}
            </div>
            {record.description && (
              <p className="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800/60 mt-1">
                {record.description}
              </p>
            )}
          </div>

          {/* Download Audio Files */}
          <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col gap-3">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5 text-cyan-400" /> Export / Download WAV Stems:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={() => downloadWav(record.noisyBlob, 'mixed_noisy')}
                className="flex items-center justify-center gap-2 p-2 rounded-lg bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 text-amber-300 text-xs font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Input + Noise (WAV)
              </button>

              <button
                onClick={() => downloadWav(record.cleanBlob, 'clean_input')}
                className="flex items-center justify-center gap-2 p-2 rounded-lg bg-emerald-500/15 border border-emerald-500/40 hover:bg-emerald-500/25 text-emerald-300 text-xs font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Clean Input (WAV)
              </button>

              <button
                onClick={() => downloadWav(record.noiseBlob, 'noise_only')}
                className="flex items-center justify-center gap-2 p-2 rounded-lg bg-purple-500/15 border border-purple-500/40 hover:bg-purple-500/25 text-purple-300 text-xs font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Noise Component (WAV)
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-[#131b2e]">
          <div>
            {showDeleteConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-rose-300">Are you sure?</span>
                <button
                  onClick={handleDelete}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-md"
                >
                  Yes, Delete
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2 py-1 text-slate-400 hover:text-slate-200 text-xs"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete from Database
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
