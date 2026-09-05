/**
 * Tactical Audio Noise Command Console & Database
 * Displays input audio with controllable acoustic noise, dual waveforms,
 * real-time tactical radar tracking, live FFT spectrograms, and persistent IndexedDB dataset repository.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { 
  DatabaseStats, 
  FilterState, 
  AudioNoiseRecord, 
  PlaybackChannel,
  OperatorProfile
} from './types';
import { 
  clearAllRecords, 
  deleteRecord, 
  getAllRecords, 
  saveRecord, 
  seedInitialDatabase 
} from './services/database';
import { TacticalTopNav } from './components/TacticalTopNav';
import { TacticalSidebar, TacticalView } from './components/TacticalSidebar';
import { TacticalMetricsRow } from './components/TacticalMetricsRow';
import { TacticalRadar } from './components/TacticalRadar';
import { DatabaseHeader } from './components/DatabaseHeader';
import { RecordCard } from './components/RecordCard';
import { RecordTable } from './components/RecordTable';
import { AudioVisualizer } from './components/AudioVisualizer';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { LiveSnrGraph } from './components/LiveSnrGraph';
import { NoiseStudioModal } from './components/NoiseStudioModal';
import { RecordDetailModal } from './components/RecordDetailModal';
import { DatabaseComparisonModal } from './components/DatabaseComparisonModal';
import { TacticalLoginPage } from './components/TacticalLoginPage';
import { soundFx } from './services/soundFx';
import { listenToMLPrediction, MLPredictionData } from './firebaseService';
import { 
  Activity, 
  Radio, 
  ShieldAlert, 
  Plus, 
  Maximize2,
  Volume2,
  Sliders,
  Sparkles,
  Zap,
  RotateCcw
} from 'lucide-react';

export default function App() {
  const [mlPrediction, setMlPrediction] = useState<MLPredictionData | null>(null);
  // Operator clearance authentication state
  const [currentOperator, setCurrentOperator] = useState<OperatorProfile | null>(null);
  const [soundActive, setSoundActive] = useState<boolean>(true);
  const [lastLoggedOutCodename, setLastLoggedOutCodename] = useState<string>(() => {
    return localStorage.getItem('vaksetu_last_logged_out_officer') || 'T-315';
  });

  // Database records
  const [records, setRecords] = useState<AudioNoiseRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active playing audio state
  const [activeRecord, setActiveRecord] = useState<AudioNoiseRecord | null>(null);
  const [activeChannel, setActiveChannel] = useState<PlaybackChannel>('noisy');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [seekFraction, setSeekFraction] = useState<number | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [showLiveSpectrogram, setShowLiveSpectrogram] = useState(true);

  // Tactical navigation & view states
  const [currentView, setCurrentView] = useState<TacticalView>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // View & Filter states for the Database
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    noiseType: 'all',
    category: 'all',
    snrBracket: 'all',
    sortBy: 'newest',
  });

  // Modals state
  const [isNoiseStudioOpen, setIsNoiseStudioOpen] = useState(false);
  const [inspectingRecord, setInspectingRecord] = useState<AudioNoiseRecord | null>(null);
  const [comparingRecordA, setComparingRecordA] = useState<AudioNoiseRecord | null>(null);
  const [comparingRecordB, setComparingRecordB] = useState<AudioNoiseRecord | null>(null);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);

  // Tactical telemetry logs
  const [recentLogs, setRecentLogs] = useState<string[]>([
    'TDIS CORE ONLINE: Defense acoustic network initialized',
    'INDEXED_DB: Stored signal stems mounted with zero latency',
    'JAMMER RADAR: Spectrum frequency scans running across 12kHz'
  ]);

  const addLog = (entry: string) => {
    const timeStr = new Date().toTimeString().slice(0, 8);
    setRecentLogs((prev) => [`[${timeStr}] ${entry}`, ...prev.slice(0, 6)]);
  };

  // Initialize and seed database
  // Listen for live ML predictions from Firebase
  useEffect(() => {
    const unsubscribe = listenToMLPrediction(
      (prediction) => {
        console.log('Live ML Prediction:', prediction);
        setMlPrediction(prediction);

        if (prediction) {
          addLog(
            `LIVE ML UPDATE: ${(prediction.noise_type || 'unknown').toUpperCase()} | ${prediction.confidence ?? 0}% confidence`
          );
        }
      },
      (error) => {
        console.error('Firebase ML listener error:', error);
      }
    );

    return () => unsubscribe();
  }, []);
  useEffect(() => {
    const initDb = async () => {
      try {
        setIsLoading(true);
        const data = await seedInitialDatabase();
        setRecords(data);
        if (data.length > 0) {
          setActiveRecord(data[0]);
          addLog(`AUDIO BENCHMARK: Loaded ${data.length} signal dossiers`);
        }
      } catch (err) {
        console.error('Failed to initialize database:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initDb();
  }, []);

  // Filter and sort records
  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => {
        // Search filter
        if (filters.searchQuery) {
          const q = filters.searchQuery.toLowerCase();
          const matchTitle = r.title.toLowerCase().includes(q);
          const matchNoise = r.noiseType.toLowerCase().includes(q);
          const matchDesc = (r.description || '').toLowerCase().includes(q);
          const matchTags = r.tags.some((t) => t.toLowerCase().includes(q));
          if (!matchTitle && !matchNoise && !matchDesc && !matchTags) return false;
        }

        // Noise type filter
        if (filters.noiseType !== 'all' && r.noiseType !== filters.noiseType) {
          return false;
        }

        // Category filter
        if (filters.category !== 'all' && r.category !== filters.category) {
          return false;
        }

        // SNR bracket filter
        if (filters.snrBracket === 'extreme_neg' && r.measuredSnrDb >= 0) return false;
        if (filters.snrBracket === 'moderate' && (r.measuredSnrDb < 0 || r.measuredSnrDb > 10)) return false;
        if (filters.snrBracket === 'clean_high' && r.measuredSnrDb <= 10) return false;

        return true;
      })
      .sort((a, b) => {
        switch (filters.sortBy) {
          case 'newest':
            return b.createdAt - a.createdAt;
          case 'oldest':
            return a.createdAt - b.createdAt;
          case 'snr_asc':
            return a.measuredSnrDb - b.measuredSnrDb;
          case 'snr_desc':
            return b.measuredSnrDb - a.measuredSnrDb;
          case 'duration':
            return b.duration - a.duration;
          case 'title':
            return a.title.localeCompare(b.title);
          default:
            return 0;
        }
      });
  }, [records, filters]);

  // Database Statistics summary
  const stats: DatabaseStats = useMemo(() => {
    let totalSec = 0;
    let sumSnr = 0;
    const noiseDist: Record<string, number> = {};
    const sourceDist: Record<string, number> = {};

    records.forEach((r) => {
      totalSec += r.duration;
      sumSnr += r.measuredSnrDb;
      noiseDist[r.noiseType] = (noiseDist[r.noiseType] || 0) + 1;
      sourceDist[r.sourceType] = (sourceDist[r.sourceType] || 0) + 1;
    });

    return {
      totalRecords: records.length,
      totalDurationSec: Math.round(totalSec * 10) / 10,
      avgSnrDb: records.length > 0 ? Math.round((sumSnr / records.length) * 10) / 10 : 0,
      noiseTypeDistribution: noiseDist as any,
      sourceDistribution: sourceDist,
    };
  }, [records]);

  // Critical threats (SNR < 0 dB or heavily degraded)
  const criticalCount = useMemo(() => {
    return records.filter((r) => r.measuredSnrDb < 0).length;
  }, [records]);

  // Handle Save New Record
  const handleSaveRecord = async (newRecord: AudioNoiseRecord) => {
    await saveRecord(newRecord);
    setRecords((prev) => [newRecord, ...prev]);
    setActiveRecord(newRecord);
    setCurrentTime(0);
    addLog(`DOSSIER_COMMITTED: ${newRecord.title} with ${newRecord.noiseType.toUpperCase()} noise`);
  };

  // Handle Delete Record
  const handleDeleteRecord = async (id: string) => {
    await deleteRecord(id);
    setRecords((prev) => prev.filter((r) => r.id !== id));
    if (activeRecord?.id === id) {
      const remaining = records.filter((r) => r.id !== id);
      setActiveRecord(remaining[0] || null);
      setCurrentTime(0);
    }
    addLog(`SIGNAL_PURGED: ID ${id.slice(0, 8)} removed from archive`);
  };

  // Handle Reset Dataset
  const handleResetDataset = async () => {
    if (confirm('Reset database to default benchmark audio samples?')) {
      await clearAllRecords();
      const freshData = await seedInitialDatabase();
      setRecords(freshData);
      setActiveRecord(freshData[0] || null);
      setCurrentTime(0);
      addLog('DATABASE_RESET: Restored default acoustic benchmarks');
    }
  };

  // Handle Card Play Toggle
  const handleCardPlayToggle = (targetRecord: AudioNoiseRecord) => {
    if (activeRecord?.id === targetRecord.id) {
      setIsPlaying(!isPlaying);
      addLog(isPlaying ? `AUDIO_HALTED: ${targetRecord.title}` : `STREAM_RESUMED: ${targetRecord.title}`);
    } else {
      setActiveRecord(targetRecord);
      setCurrentTime(0);
      setIsPlaying(true);
      addLog(`LINK_ESTABLISHED: ${targetRecord.title} (${targetRecord.noiseType.toUpperCase()} noise)`);
    }
  };

  // Handle Side-by-Side Compare
  const handleOpenComparison = (rec?: AudioNoiseRecord) => {
    const target = rec || activeRecord || records[0];
    if (!target) return;
    setComparingRecordA(target);
    const other = records.find((r) => r.id !== target.id) || target;
    setComparingRecordB(other);
    setIsComparisonOpen(true);
    addLog(`DUAL_ANALYTICS: Comparing ${target.title} vs ${other.title}`);
  };

  // Handle channel change with logging
  const handleChannelSwitch = (channel: PlaybackChannel) => {
    setActiveChannel(channel);
    addLog(`CHANNEL_SWITCH: Active link set to ${channel.toUpperCase()}`);
  };

  const handleLogout = () => {
    soundFx.playLock();
    if (currentOperator) {
      const codename = currentOperator.codename || currentOperator.callsign || 'T-315';
      setLastLoggedOutCodename(codename);
      try {
        localStorage.setItem('vaksetu_last_logged_out_officer', codename);
      } catch (e) {
        // ignore localstorage error
      }
      addLog(`TERMINAL_LOCKED: Officer ${codename} logged out to gateway`);
    }
    setCurrentOperator(null);
  };

  // If operator not authenticated, render Tactical Login Page
  if (!currentOperator) {
    return (
      <TacticalLoginPage
        onLoginSuccess={(operator) => {
          setCurrentOperator(operator);
          addLog(`CLEARANCE_GRANTED: Officer ${operator.codename || operator.callsign} [${operator.clearance}]`);
        }}
        lastLoggedOutCodename={lastLoggedOutCodename}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#020504] text-emerald-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      
      {/* Top Tactical Nav Bar */}
      <TacticalTopNav
        totalRecords={records.length}
        noiseCount={Object.keys(stats.noiseTypeDistribution).length}
        currentOperator={currentOperator}
        onLockTerminal={handleLogout}
        onLogout={handleLogout}
        onToggleSound={() => {
          const s = soundFx.toggleSound();
          setSoundActive(s);
        }}
        soundActive={soundActive}
        onOpenNoiseStudio={() => {
          setIsNoiseStudioOpen(true);
          addLog('NOISE_STUDIO: Input Audio + Noise generator deployed');
        }}
        onResetDataset={handleResetDataset}
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      />

      {/* Main Workspace with Tactical Sidebar + Command Center */}
      <div className="flex-1 flex w-full relative">
        
        {/* Tactical Navigation Sidebar (Desktop + Collapsible Drawer on Mobile) */}
        <div className={`
          ${isMobileSidebarOpen ? 'fixed inset-0 z-50 bg-[#020504]/90 backdrop-blur-sm flex' : 'hidden'}
          lg:flex lg:static lg:z-auto
        `}>
          <div className="w-64 flex-shrink-0 bg-[#030806] border-r border-emerald-500/30 h-full overflow-y-auto">
            {isMobileSidebarOpen && (
              <div className="p-3 border-b border-emerald-500/30 flex justify-end lg:hidden">
                <button
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="px-2 py-1 rounded bg-emerald-950 text-emerald-300 font-mono text-xs border border-emerald-500/30"
                >
                  [CLOSE X]
                </button>
              </div>
            )}
            <TacticalSidebar
              currentView={currentView}
              onSelectView={(view) => {
                setCurrentView(view);
                setIsMobileSidebarOpen(false);
                addLog(`VIEW_CHANGE: Switched to ${view.toUpperCase()}`);
              }}
              onOpenNoiseStudio={() => {
                setIsNoiseStudioOpen(true);
                setIsMobileSidebarOpen(false);
              }}
              onOpenComparison={() => {
                handleOpenComparison();
                setIsMobileSidebarOpen(false);
              }}
              totalRecords={records.length}
              noiseProfileCount={Object.keys(stats.noiseTypeDistribution).length}
              currentOperator={currentOperator}
              onLockTerminal={handleLogout}
            />
          </div>
          {isMobileSidebarOpen && (
            <div 
              className="flex-1 lg:hidden"
              onClick={() => setIsMobileSidebarOpen(false)}
            />
          )}
        </div>

        {/* Central Operations Dashboard */}
        <main className="flex-1 w-full min-w-0 p-3 sm:p-5 flex flex-col gap-4 max-w-[1600px] mx-auto">
          
          {/* Tactical KPI Metrics Row & Live Intel Feed */}
          <TacticalMetricsRow
            stats={stats}
            criticalCount={criticalCount}
            recentLogs={recentLogs}
            activeRecordTitle={activeRecord?.title}
            mlConfidence={mlPrediction?.confidence}
            mlSnr={mlPrediction?.snr_db}
            mlNoiseType={mlPrediction?.noise_type}
            onOpenNoiseStudio={() => setIsNoiseStudioOpen(true)}
          />

          {/* MAIN COMMAND STAGE: Radar + Audio Waveform Telemetry */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
            
            {/* Tactical Radar (Left column on wide screens, 5 cols) */}
            <div className="xl:col-span-5 h-[420px] sm:h-[460px] xl:h-auto min-h-[420px] flex flex-col">
              <TacticalRadar
                record={activeRecord}
                isPlaying={isPlaying}
                activeChannel={activeChannel}
                analyserNode={analyserNode}
              />
            </div>

            {/* Active Audio Inspection, Dual Waveforms & Player Bar (Right column, 7 cols) */}
            <div className="xl:col-span-7 flex flex-col gap-3">
              {activeRecord ? (
                <section 
                  id="active-audio-stage"
                  className="w-full bg-[#030806] rounded-xl border border-emerald-500/30 p-3 sm:p-4 shadow-[0_0_20px_rgba(16,185,129,0.06)] flex flex-col gap-3"
                >
                  {/* Stage Title and SNR Readout */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-sm sm:text-base font-display font-bold text-emerald-100 tracking-wider">
                            {activeRecord.title}
                          </h2>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded font-bold bg-amber-950/60 text-amber-300 border border-amber-500/40">
                            NOISE: {(mlPrediction?.noise_type || activeRecord.noiseType).toUpperCase()}
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-500/70 font-mono mt-0.5">
                          {activeRecord.description || 'Dual waveform degradation and live spectral energy analysis'}
                        </p>
                      </div>
                    </div>

                    {/* Acoustic Specs Badges */}
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <div className="px-2 py-1 rounded bg-[#020504] border border-emerald-500/30">
                        <span className="text-emerald-600 text-[10px]">TARGET SNR: </span>
                        <span className="text-emerald-200 font-bold">{activeRecord.targetSnrDb} dB</span>
                      </div>
                      <div className="px-2 py-1 rounded bg-[#020504] border border-emerald-500/30">
                        <span className="text-emerald-600 text-[10px]">MEASURED: </span>
                        <span className={`font-bold ${
                          activeRecord.measuredSnrDb < 0 
                            ? 'text-rose-400' 
                            : activeRecord.measuredSnrDb < 8 
                            ? 'text-amber-400' 
                            : 'text-emerald-400'
                        }`}>
                          {mlPrediction?.snr_db !== undefined
                            ? `${mlPrediction.snr_db > 0 ? '+' : ''}${mlPrediction.snr_db}`
                            : `${activeRecord.measuredSnrDb > 0 ? '+' : ''}${activeRecord.measuredSnrDb}`} dB
                        </span>
                      </div>
                      <button
                        onClick={() => setInspectingRecord(activeRecord)}
                        className="p-1.5 rounded bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 transition-colors"
                        title="Full Spectrum Inspection"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Dual Waveform Visualizer & FFT Heatmap */}
                  <AudioVisualizer
                    cleanPeaks={activeRecord.waveformPeaks.clean}
                    noisyPeaks={activeRecord.waveformPeaks.noisy}
                    noiseOnlyPeaks={activeRecord.waveformPeaks.noiseOnly}
                    duration={activeRecord.duration}
                    currentTime={currentTime}
                    activeChannel={activeChannel}
                    isPlaying={isPlaying}
                    analyserNode={analyserNode}
                    onSeek={(fraction) => setSeekFraction(fraction)}
                    showSpectrogram={showLiveSpectrogram}
                  />

                  {/* Synchronized Player Bar */}
                  <AudioPlayerBar
                    record={activeRecord}
                    activeChannel={activeChannel}
                    onChangeChannel={handleChannelSwitch}
                    onTimeUpdate={(t) => setCurrentTime(t)}
                    onSetPlaying={(p) => setIsPlaying(p)}
                    onRegisterAnalyser={(analyser) => setAnalyserNode(analyser)}
                    seekFraction={seekFraction}
                  />
                </section>
              ) : (
                <div className="w-full bg-[#030806] rounded-xl border border-emerald-500/30 p-8 flex flex-col items-center justify-center text-center gap-3">
                  <Radio className="w-8 h-8 text-emerald-500 animate-pulse" />
                  <p className="font-display text-emerald-200">NO ACTIVE SIGNAL SELECTED</p>
                  <p className="text-xs font-mono text-emerald-500/70">Select a record from the database below to initialize telemetry link.</p>
                </div>
              )}
            </div>
          </div>

          {/* REAL-TIME SNR LIVE GRAPH & ACOUSTIC AI ANALYSIS SUITE (DASHBOARD REQUIREMENT) */}
          <section id="live-snr-telemetry-dashboard" className="w-full">
            <LiveSnrGraph
              record={activeRecord}
              currentTime={currentTime}
              duration={activeRecord?.duration || 4.0}
              isPlaying={isPlaying}
              activeChannel={activeChannel}
              analyserNode={analyserNode}
              onSelectChannel={handleChannelSwitch}
            />
          </section>

          {/* DATABASE PREVIEW SECTION */}
          <section id="database-repository-section" className="flex flex-col gap-3 mt-1">
            <DatabaseHeader
              totalRecords={stats.totalRecords}
              totalDurationSec={stats.totalDurationSec}
              avgSnrDb={stats.avgSnrDb}
              noiseTypeCounts={stats.noiseTypeDistribution}
              filters={filters}
              onFilterChange={(newFilters) => setFilters((prev) => ({ ...prev, ...newFilters }))}
              onOpenNoiseStudio={() => setIsNoiseStudioOpen(true)}
              onResetDataset={handleResetDataset}
              viewMode={viewMode}
              onToggleViewMode={(mode) => setViewMode(mode)}
            />

            {/* Database Content Grid or Table */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-emerald-500 gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
                <p className="text-xs font-mono">Loading audio database and acoustic profiles...</p>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 bg-[#030806] rounded-xl border border-emerald-500/30 text-center gap-3 font-mono">
                <div className="w-12 h-12 rounded-full bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <Radio className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-emerald-200 font-display">NO MATCHING DOSSIERS FOUND</p>
                <p className="text-xs text-emerald-500/80 max-w-sm">
                  Adjust your search parameters or SNR and noise filter options.
                </p>
                <button
                  onClick={() => setFilters({
                    searchQuery: '',
                    noiseType: 'all',
                    category: 'all',
                    snrBracket: 'all',
                    sortBy: 'newest',
                  })}
                  className="mt-1 px-3 py-1.5 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-xs border border-emerald-500/30 font-mono font-bold"
                >
                  CLEAR FILTERS
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {filteredRecords.map((record) => (
                  <RecordCard
                    key={record.id}
                    record={record}
                    isActive={activeRecord?.id === record.id}
                    isPlaying={isPlaying && activeRecord?.id === record.id}
                    activeChannel={activeChannel}
                    currentTime={currentTime}
                    onPlay={handleCardPlayToggle}
                    onToggleChannel={handleChannelSwitch}
                    onInspect={(rec) => setInspectingRecord(rec)}
                    onCompare={handleOpenComparison}
                    onSeek={(fraction) => {
                      setActiveRecord(record);
                      setSeekFraction(fraction);
                    }}
                  />
                ))}
              </div>
            ) : (
              <RecordTable
                records={filteredRecords}
                activeRecordId={activeRecord?.id || null}
                isPlaying={isPlaying}
                activeChannel={activeChannel}
                onPlay={handleCardPlayToggle}
                onInspect={(rec) => setInspectingRecord(rec)}
                onCompare={handleOpenComparison}
              />
            )}
          </section>

        </main>
      </div>

      {/* Noise Studio Modal */}
      <NoiseStudioModal
        isOpen={isNoiseStudioOpen}
        onClose={() => setIsNoiseStudioOpen(false)}
        onSaveRecord={handleSaveRecord}
      />

      {/* Detail Inspection Modal */}
      <RecordDetailModal
        record={inspectingRecord}
        isOpen={!!inspectingRecord}
        onClose={() => setInspectingRecord(null)}
        onDeleteRecord={handleDeleteRecord}
        onSelectForPlayback={(rec) => {
          setActiveRecord(rec);
          setCurrentTime(0);
          setIsPlaying(true);
          addLog(`DOSSIER_ENGAGED: ${rec.title}`);
        }}
      />

      {/* Side-by-side comparison modal */}
      <DatabaseComparisonModal
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
        recordA={comparingRecordA}
        recordB={comparingRecordB}
        onSelectRecordA={(rec) => setComparingRecordA(rec)}
        onSelectRecordB={(rec) => setComparingRecordB(rec)}
        allRecords={records}
      />

      {/* Tactical Status Footer */}
      <footer className="border-t border-emerald-500/20 bg-[#020504] py-3 px-4 sm:px-6 flex flex-wrap items-center justify-between text-[11px] text-emerald-500/70 font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_#00ff66]"></span>
          <span>TDIS ACOUSTIC DATABASE ENGINE // SECURE LOCAL INDEXED_DB STORAGE</span>
        </div>
        <div className="flex items-center gap-4 mt-1 sm:mt-0">
          <span>SAMPLING: 44.1 kHz 16-BIT PCM</span>
          <span>DUAL-STEM SYNCHRONIZER: NOMINAL</span>
        </div>
      </footer>
    </div>
  );
}
