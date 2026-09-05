/**
 * Database Header, Statistics Bar & Filter Toolbar
 */

import React from 'react';
import { 
  Search, 
  Plus, 
  SlidersHorizontal, 
  RotateCcw, 
  Volume2, 
  Activity, 
  LayoutGrid, 
  Table as TableIcon,
  Filter,
  Radio,
  Clock
} from 'lucide-react';
import { FilterState, NoiseType } from '../types';

interface DatabaseHeaderProps {
  totalRecords: number;
  totalDurationSec: number;
  avgSnrDb: number;
  noiseTypeCounts: Record<string, number>;
  filters: FilterState;
  onFilterChange: (newFilters: Partial<FilterState>) => void;
  onOpenNoiseStudio: () => void;
  onResetDataset: () => void;
  viewMode: 'grid' | 'table';
  onToggleViewMode: (mode: 'grid' | 'table') => void;
}

export const DatabaseHeader: React.FC<DatabaseHeaderProps> = ({
  totalRecords,
  totalDurationSec,
  avgSnrDb,
  noiseTypeCounts,
  filters,
  onFilterChange,
  onOpenNoiseStudio,
  onResetDataset,
  viewMode,
  onToggleViewMode,
}) => {
  const noiseTypes: Array<{ key: 'all' | NoiseType; label: string }> = [
    { key: 'all', label: 'All Noises' },
    { key: 'white', label: 'White' },
    { key: 'pink', label: 'Pink' },
    { key: 'brown', label: 'Brownian' },
    { key: 'hum', label: '60Hz Hum' },
    { key: 'babble', label: 'Babble' },
    { key: 'traffic', label: 'Traffic' },
    { key: 'digital_click', label: 'Glitches' },
  ];

  return (
    <div id="database-header-section" className="flex flex-col gap-4">
      {/* Top Banner & Stats Overview */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#030806] p-3.5 sm:p-4 rounded-xl border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.06)] font-mono">
        
        {/* Title and Purpose */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-display font-bold text-emerald-100 tracking-wider">
              ACOUSTIC SIGNAL DOSSIERS & NOISE PREVIEW
            </h2>
            <p className="text-[11px] text-emerald-400/70 mt-0.5">
              Input signals with calibrated noise profiles • 16-bit PCM stems & dual spectrum telemetry
            </p>
          </div>
        </div>

        {/* Telemetry Statistics Counters */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="px-2.5 py-1 rounded bg-[#05120b] border border-emerald-500/25 text-center">
            <div className="text-[9px] text-emerald-400/70 uppercase">ENTRIES</div>
            <div className="text-sm font-bold text-emerald-300">{totalRecords}</div>
          </div>

          <div className="px-2.5 py-1 rounded bg-[#05120b] border border-emerald-500/25 text-center">
            <div className="text-[9px] text-emerald-400/70 uppercase">AVG SNR</div>
            <div className="text-sm font-bold text-yellow-300">
              {avgSnrDb > 0 ? `+${avgSnrDb}` : avgSnrDb} dB
            </div>
          </div>

          <div className="px-2.5 py-1 rounded bg-[#05120b] border border-emerald-500/25 text-center">
            <div className="text-[9px] text-emerald-400/70 uppercase">DURATION</div>
            <div className="text-sm font-bold text-cyan-300">{totalDurationSec.toFixed(1)}s</div>
          </div>
        </div>

      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-[#040c08] p-2.5 rounded-xl border border-emerald-500/25 font-mono text-xs">
        
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-emerald-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="search-database-input"
            type="text"
            value={filters.searchQuery}
            onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
            placeholder="Search signals by code, noise type, or tag..."
            className="w-full pl-8 pr-3 py-1.5 bg-[#020504] border border-emerald-500/30 rounded-lg text-xs text-emerald-200 placeholder-emerald-700 focus:outline-none focus:border-emerald-400"
          />
        </div>

        {/* SNR Bracket Filter */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-emerald-400/70 text-[10px] hidden sm:inline">SNR:</span>
          <select
            id="filter-snr-bracket"
            value={filters.snrBracket}
            onChange={(e) => onFilterChange({ snrBracket: e.target.value as any })}
            className="px-2 py-1.5 rounded-lg bg-[#020504] border border-emerald-500/30 text-xs text-emerald-200 focus:outline-none focus:border-emerald-400 font-mono"
          >
            <option value="all">All SNR Ranges</option>
            <option value="extreme_neg">Critical (&lt; 0 dB)</option>
            <option value="moderate">Moderate (0 - 10 dB)</option>
            <option value="clean_high">Clean (&gt; 10 dB)</option>
          </select>
        </div>

        {/* Category Filter */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-emerald-400/70 text-[10px] hidden sm:inline">CLASS:</span>
          <select
            id="filter-category"
            value={filters.category}
            onChange={(e) => onFilterChange({ category: e.target.value as any })}
            className="px-2 py-1.5 rounded-lg bg-[#020504] border border-emerald-500/30 text-xs text-emerald-200 focus:outline-none focus:border-emerald-400 font-mono"
          >
            <option value="all">All Classes</option>
            <option value="speech">Speech</option>
            <option value="music">Music</option>
            <option value="tones">Tones</option>
            <option value="ambient">Ambient</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-emerald-400/70 text-[10px] hidden sm:inline">SORT:</span>
          <select
            id="sort-records-select"
            value={filters.sortBy}
            onChange={(e) => onFilterChange({ sortBy: e.target.value as any })}
            className="px-2 py-1.5 rounded-lg bg-[#020504] border border-emerald-500/30 text-xs text-emerald-200 focus:outline-none focus:border-emerald-400 font-mono"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="snr_asc">SNR: Low to High (Noisiest)</option>
            <option value="snr_desc">SNR: High to Low (Cleanest)</option>
            <option value="duration">Duration</option>
            <option value="title">Title (A-Z)</option>
          </select>
        </div>

        {/* View Mode & Reset Buttons */}
        <div className="flex items-center gap-1.5">
          <div className="flex rounded-lg bg-[#020504] p-0.5 border border-emerald-500/30">
            <button
              onClick={() => onToggleViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-emerald-500 hover:text-emerald-200'}`}
              title="Grid Dossiers view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onToggleViewMode('table')}
              className={`p-1.5 rounded ${viewMode === 'table' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-emerald-500 hover:text-emerald-200'}`}
              title="Table Telemetry view"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            id="btn-reset-dataset"
            onClick={onResetDataset}
            className="p-1.5 rounded-lg bg-[#020504] hover:bg-emerald-950 text-emerald-400 hover:text-emerald-200 border border-emerald-500/30 transition-colors"
            title="Reset to default benchmark dataset"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* Noise Type Quick-Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-[10px] font-mono text-emerald-500/80 mr-1 flex items-center gap-1">
          <Filter className="w-3 h-3" /> NOISE FILTER:
        </span>
        {noiseTypes.map((n) => {
          const count = n.key === 'all' ? totalRecords : (noiseTypeCounts[n.key] || 0);
          const isSelected = filters.noiseType === n.key;

          return (
            <button
              key={n.key}
              onClick={() => onFilterChange({ noiseType: n.key })}
              className={`px-2.5 py-0.5 rounded-md text-[11px] font-mono transition-all whitespace-nowrap flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-[0_0_8px_#00ff66]'
                  : 'bg-[#030906] hover:bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              <span>{n.label}</span>
              <span className={`text-[9px] px-1 rounded ${isSelected ? 'bg-slate-950 text-emerald-300' : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
