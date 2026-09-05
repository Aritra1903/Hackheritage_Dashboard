/**
 * Tactical Top Navigation Bar
 * Recreates the exact top status bar from the TDIS interface screenshot:
 * Shield logo, Tactical Title, Live Zulu Clock, Sector ID, Online status pill, and quick counters.
 */

import React, { useEffect, useState } from 'react';
import { Shield, Menu, Volume2, VolumeX, Plus, RefreshCw, Lock, LogOut, User } from 'lucide-react';
import { OperatorProfile } from '../types';

interface TacticalTopNavProps {
  totalRecords: number;
  noiseCount: number;
  currentOperator?: OperatorProfile | null;
  onLockTerminal?: () => void;
  onLogout?: () => void;
  onToggleSound?: () => void;
  soundActive?: boolean;
  onOpenNoiseStudio: () => void;
  onResetDataset: () => void;
  onToggleMobileSidebar?: () => void;
}

export const TacticalTopNav: React.FC<TacticalTopNavProps> = ({
  totalRecords,
  noiseCount,
  currentOperator,
  onLockTerminal,
  onLogout,
  onToggleSound,
  soundActive = true,
  onOpenNoiseStudio,
  onResetDataset,
  onToggleMobileSidebar,
}) => {
  // Live Zulu time clock
  const [zuluTime, setZuluTime] = useState<string>('00:00:00 ZULU');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const h = String(now.getUTCHours()).padStart(2, '0');
      const m = String(now.getUTCMinutes()).padStart(2, '0');
      const s = String(now.getUTCSeconds()).padStart(2, '0');
      setZuluTime(`${h}:${m}:${s} ZULU`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="w-full bg-[#030705] border-b border-emerald-500/30 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 font-mono sticky top-0 z-40 backdrop-blur-md">
      {/* Left: Brand & Tactical Emblem */}
      <div className="flex items-center gap-3">
        <button 
          onClick={onToggleMobileSidebar}
          className="p-1 rounded-md text-emerald-400 hover:text-emerald-200 hover:bg-emerald-950/40 lg:hidden"
          title="Tactical Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Shield Icon Box */}
        <div className="w-9 h-9 rounded-lg bg-[#06140c] border border-emerald-500/60 flex items-center justify-center text-emerald-400 shadow-[0_0_12px_rgba(0,255,102,0.25)]">
          <Shield className="w-5 h-5" />
        </div>

        {/* Titles */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display font-bold text-base sm:text-lg text-emerald-300 tracking-wider">
              TDIS-AUDIO
            </h1>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 font-bold hidden sm:inline">
              v7.4
            </span>
          </div>
          <div className="text-[10px] text-emerald-400/70 font-mono tracking-tight flex items-center gap-1.5">
            <span>TACTICAL DEFENSE INTELLIGENCE SYSTEM</span>
            <span className="hidden md:inline">•</span>
            <span className="hidden md:inline text-emerald-500/90">AUDIO NOISE SURVEILLANCE & DATABASE</span>
          </div>
        </div>
      </div>

      {/* Right: Metrics, Sector ID, Online Pill & Zulu Clock */}
      <div className="flex items-center gap-3 sm:gap-4 text-xs">
        {/* Sample counters (Exact to screenshot: IMAGES 0, DETECTIONS 0, SECTOR ID 12321) */}
        <div className="hidden sm:flex items-center gap-3 bg-[#050f09] px-2.5 py-1 rounded-lg border border-emerald-500/25 text-[11px]">
          <div className="flex flex-col text-center">
            <span className="text-[9px] text-emerald-500/80">SAMPLES</span>
            <span className="font-bold text-emerald-200">{totalRecords}</span>
          </div>
          <span className="text-emerald-800">|</span>
          <div className="flex flex-col text-center">
            <span className="text-[9px] text-emerald-500/80">DETECTIONS</span>
            <span className="font-bold text-emerald-200">{noiseCount}</span>
          </div>
          <span className="text-emerald-800">|</span>
          <div className="flex flex-col text-center">
            <span className="text-[9px] text-emerald-500/80">SECTOR ID</span>
            <span className="font-bold text-emerald-300">12321</span>
          </div>
        </div>

        {/* Online Status Pill (Exact to screenshot!) */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold shadow-[0_0_8px_rgba(0,255,102,0.2)]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>ONLINE</span>
        </div>

        {/* Zulu Time (Exact to screenshot!) */}
        <div className="flex items-center gap-1.5 text-cyan-300 font-bold text-xs bg-[#040e11] px-2.5 py-1 rounded-md border border-cyan-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span>{zuluTime}</span>
        </div>

        {/* Tactical Sound FX Toggle */}
        {onToggleSound && (
          <button
            onClick={onToggleSound}
            className="p-1.5 rounded-md bg-[#040e08] border border-emerald-500/30 text-emerald-400 hover:text-emerald-200 hover:border-emerald-400/60 transition-colors"
            title={soundActive ? 'Sound FX Enabled' : 'Sound FX Muted'}
          >
            {soundActive ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-emerald-700" />}
          </button>
        )}

        {/* Current Operator Badge */}
        {currentOperator && (
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#05110a] border border-cyan-500/40 text-cyan-300 text-[11px] font-bold">
            <User className="w-3 h-3 text-cyan-400" />
            <span className="text-emerald-400 font-mono">[{currentOperator.clearance}]</span>
            <span className="text-cyan-200">OFFICER: {currentOperator.codename || currentOperator.callsign}</span>
          </div>
        )}

        {/* Dedicated Logout Button (Requirement 8) */}
        {(onLogout || onLockTerminal) && (
          <button
            onClick={onLogout || onLockTerminal}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-500/50 text-rose-300 text-xs font-bold transition-all shadow-[0_0_12px_rgba(244,63,94,0.25)] active:scale-95 cursor-pointer"
            title="Logout and return to VĀKSETU gateway"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>LOGOUT</span>
          </button>
        )}

        {/* Action Button: Inject Audio + Noise */}
        <button
          onClick={onOpenNoiseStudio}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-[0_0_15px_rgba(0,255,102,0.3)] transition-all active:scale-95"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span className="hidden sm:inline">INJECT SIGNAL</span>
        </button>
      </div>
    </header>
  );
};
