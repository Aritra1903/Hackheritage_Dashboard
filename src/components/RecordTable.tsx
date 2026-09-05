/**
 * Compact Dataset Table View for the Audio & Noise Database
 */

import React from 'react';
import { 
  Play, 
  Pause, 
  Maximize2, 
  ArrowRightLeft, 
  Download, 
  FileAudio 
} from 'lucide-react';
import { AudioNoiseRecord, PlaybackChannel } from '../types';

interface RecordTableProps {
  records: AudioNoiseRecord[];
  activeRecordId: string | null;
  isPlaying: boolean;
  activeChannel: PlaybackChannel;
  onPlay: (record: AudioNoiseRecord) => void;
  onInspect: (record: AudioNoiseRecord) => void;
  onCompare: (record: AudioNoiseRecord) => void;
}

export const RecordTable: React.FC<RecordTableProps> = ({
  records,
  activeRecordId,
  isPlaying,
  activeChannel,
  onPlay,
  onInspect,
  onCompare,
}) => {
  const downloadWav = (record: AudioNoiseRecord) => {
    const url = URL.createObjectURL(record.noisyBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${record.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_noisy.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-emerald-500/30 bg-[#030806] shadow-[0_0_20px_rgba(16,185,129,0.06)]">
      <table className="w-full text-left text-xs text-emerald-300 font-mono">
        <thead className="bg-[#050f0a] text-emerald-400 font-display text-[10px] uppercase tracking-wider border-b border-emerald-500/30">
          <tr>
            <th className="py-2.5 px-3 w-12 text-center">LINK</th>
            <th className="py-2.5 px-3">SIG DOSSIER & SOURCE</th>
            <th className="py-2.5 px-3">CLASS</th>
            <th className="py-2.5 px-3">NOISE PROFILE</th>
            <th className="py-2.5 px-3">MEASURED SNR</th>
            <th className="py-2.5 px-3">CLEAN RMS</th>
            <th className="py-2.5 px-3">DEGRADED RMS</th>
            <th className="py-2.5 px-3">DURATION</th>
            <th className="py-2.5 px-3 text-right">TELEMETRY</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-emerald-500/15 font-mono text-[11px]">
          {records.map((record) => {
            const isRowActive = activeRecordId === record.id;
            const isRowPlaying = isRowActive && isPlaying;
            const snr = record.measuredSnrDb;

            const snrColor =
              snr < 0
                ? 'text-rose-400 font-bold'
                : snr < 8
                ? 'text-amber-400 font-bold'
                : 'text-emerald-400 font-bold';

            return (
              <tr
                key={record.id}
                className={`hover:bg-emerald-950/30 transition-colors ${
                  isRowActive ? 'bg-emerald-950/40 text-emerald-200' : ''
                }`}
              >
                {/* Play button */}
                <td className="py-2 px-3 text-center">
                  <button
                    onClick={() => onPlay(record)}
                    className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                      isRowPlaying
                        ? 'bg-emerald-500 text-slate-950 shadow-[0_0_8px_#00ff66]'
                        : 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {isRowPlaying ? (
                      <Pause className="w-3 h-3 fill-current" />
                    ) : (
                      <Play className="w-3 h-3 fill-current ml-0.5" />
                    )}
                  </button>
                </td>

                {/* Title & tags */}
                <td className="py-2 px-3">
                  <div className="font-bold text-emerald-100 font-display">{record.title}</div>
                  <div className="text-[10px] text-emerald-400/70 flex items-center gap-1.5 mt-0.5">
                    <span className="uppercase">{record.sourceType.replace('_', ' ')}</span>
                    <span>•</span>
                    <span>{record.tags.slice(0, 2).join(', ')}</span>
                  </div>
                </td>

                {/* Category */}
                <td className="py-2 px-3">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 text-[9px] uppercase font-bold">
                    {record.category}
                  </span>
                </td>

                {/* Noise Type */}
                <td className="py-2 px-3">
                  <span className="text-amber-300 font-bold uppercase text-[10px]">
                    {record.noiseType}
                  </span>
                </td>

                {/* Measured SNR */}
                <td className={`py-2 px-3 ${snrColor}`}>
                  {snr > 0 ? `+${snr}` : snr} dB
                </td>

                {/* Clean RMS */}
                <td className="py-2 px-3 text-emerald-400">
                  {record.cleanMetrics.rmsDb} dBFS
                </td>

                {/* Noisy RMS */}
                <td className="py-2 px-3 text-amber-400">
                  {record.noisyMetrics.rmsDb} dBFS
                </td>

                {/* Duration */}
                <td className="py-2 px-3 text-emerald-400/80">
                  {record.duration.toFixed(2)}s
                </td>

                {/* Actions */}
                <td className="py-2 px-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onCompare(record)}
                      className="p-1 rounded text-emerald-400/80 hover:text-emerald-200 hover:bg-emerald-950 transition-colors border border-emerald-500/20"
                      title="Compare with another record"
                    >
                      <ArrowRightLeft className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => downloadWav(record)}
                      className="p-1 rounded text-emerald-400/80 hover:text-emerald-200 hover:bg-emerald-950 transition-colors border border-emerald-500/20"
                      title="Download Noisy WAV"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onInspect(record)}
                      className="p-1 rounded text-emerald-400/80 hover:text-emerald-100 hover:bg-emerald-950 transition-colors border border-emerald-500/20"
                      title="Full Acoustic Inspection"
                    >
                      <Maximize2 className="w-3 h-3" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
