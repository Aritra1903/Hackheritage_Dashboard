/**
 * Tactical Sidebar Component
 * Recreates the left tactical menu and telemetry status stack from the TDIS command interface screenshot.
 */

import React from 'react';
import { 
  LayoutDashboard, 
  Database, 
  Activity, 
  Radio, 
  Sliders, 
  ArrowRightLeft, 
  Shield, 
  Layers, 
  FileText,
  Lock,
  LogOut,
  UserCheck
} from 'lucide-react';
import { OperatorProfile } from '../types';

export type TacticalView = 
  | 'dashboard' 
  | 'database' 
  | 'snr_telemetry'
  | 'radar' 
  | 'spectrogram' 
  | 'studio' 
  | 'compare';

interface TacticalSidebarProps {
  currentView: TacticalView;
  onSelectView: (view: TacticalView) => void;
  onOpenNoiseStudio: () => void;
  onOpenComparison: () => void;
  totalRecords: number;
  noiseProfileCount: number;
  currentOperator?: OperatorProfile | null;
  onLockTerminal?: () => void;
}

export const TacticalSidebar: React.FC<TacticalSidebarProps> = ({
  currentView,
  onSelectView,
  onOpenNoiseStudio,
  onOpenComparison,
  totalRecords,
  noiseProfileCount,
  currentOperator,
  onLockTerminal,
}) => {
  const navItems: { id: TacticalView; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: 'dashboard',
      label: 'DASHBOARD',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'snr_telemetry',
      label: 'LIVE SNR & AI AUDIT',
      icon: <Activity className="w-4 h-4 text-sky-400" />,
      badge: 'LIVE',
    },
    {
      id: 'database',
      label: 'AUDIO DATABASE',
      icon: <Database className="w-4 h-4" />,
      badge: `${totalRecords}`,
    },
    {
      id: 'radar',
      label: 'ACOUSTIC RADAR',
      icon: <Radio className="w-4 h-4" />,
    },
    {
      id: 'spectrogram',
      label: 'SPECTRAL FFT',
      icon: <Activity className="w-4 h-4" />,
    },
    {
      id: 'studio',
      label: 'NOISE INJECTION',
      icon: <Sliders className="w-4 h-4" />,
      badge: `${noiseProfileCount} FX`,
    },
    {
      id: 'compare',
      label: 'A/B INTEL COMPARE',
      icon: <ArrowRightLeft className="w-4 h-4" />,
    },
  ];

  return (
    <aside className="w-full lg:w-56 flex-shrink-0 flex flex-col justify-between bg-[#040907] border border-emerald-500/30 rounded-2xl p-3 shadow-[0_0_25px_rgba(16,185,129,0.06)] font-mono text-xs">
      {/* Top Section */}
      <div className="space-y-4">
        
        {/* Mission Status Badge (Exact to screenshot!) */}
        <div className="relative rounded-xl bg-[#06120b] border border-emerald-500/60 p-2.5 flex items-center gap-2.5 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          </div>
          <div>
            <div className="text-[9px] uppercase tracking-wider text-emerald-400/80 font-bold">
              MISSION STATUS
            </div>
            <div className="text-xs font-bold text-emerald-300 font-display tracking-wide flex items-center gap-1.5">
              <span>ACTIVE</span>
              <span className="text-[10px] text-emerald-500 font-mono">[ARMED]</span>
            </div>
          </div>
        </div>

        {/* Tactical Nav Menu */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'studio') {
                    onOpenNoiseStudio();
                  } else if (item.id === 'compare') {
                    onOpenComparison();
                  } else {
                    onSelectView(item.id);
                  }
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-bold text-[11px] transition-all tracking-wider text-left ${
                  isActive
                    ? 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                    : 'text-emerald-400/80 hover:text-emerald-200 hover:bg-emerald-950/40 border border-transparent hover:border-emerald-500/30'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={isActive ? 'text-slate-950' : 'text-emerald-400'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                      isActive
                        ? 'bg-slate-950 text-emerald-300'
                        : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Telemetry Status Stack (Exact representation from the screenshot!) */}
      <div className="mt-6 pt-3 border-t border-emerald-500/20 space-y-1.5 text-[10px]">
        <div className="text-[9px] text-emerald-500/70 font-bold uppercase tracking-wider pb-0.5">
          SYSTEM TELEMETRY
        </div>

        <div className="flex items-center justify-between text-emerald-400/90">
          <span>AI Models:</span>
          <span className="text-emerald-300 font-bold">LOADED</span>
        </div>

        <div className="flex items-center justify-between text-emerald-400/90">
          <span>DSP Kernel:</span>
          <span className="text-emerald-300 font-bold">READY</span>
        </div>

        <div className="flex items-center justify-between text-emerald-400/90">
          <span>SNR Engine:</span>
          <span className="text-emerald-300 font-bold">READY</span>
        </div>

        <div className="flex items-center justify-between text-emerald-400/90">
          <span>FFT Analyser:</span>
          <span className="text-emerald-300 font-bold">READY</span>
        </div>

        <div className="flex items-center justify-between text-emerald-400/90">
          <span>FAISS / IndexedDB:</span>
          <span className="text-emerald-300 font-bold">ONLINE</span>
        </div>
      </div>

      {/* Operator Clearance Card */}
      {currentOperator && (
        <div className="mt-3 pt-3 border-t border-emerald-500/20 bg-[#06120a] rounded-xl p-2.5 border border-cyan-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-cyan-300">
                <UserCheck className="w-3.5 h-3.5" />
              </div>
              <div className="leading-tight">
                <div className="text-[10px] font-bold text-cyan-200 truncate max-w-[100px]">
                  OFFICER {currentOperator.codename || currentOperator.callsign}
                </div>
                <div className="text-[9px] text-emerald-400 font-mono">
                  {currentOperator.clearance}
                </div>
              </div>
            </div>
            {onLockTerminal && (
              <button
                onClick={onLockTerminal}
                className="px-2 py-1 rounded bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-300 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                title="Logout Officer"
              >
                <LogOut className="w-3 h-3 text-rose-400" />
                <span>LOGOUT</span>
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
