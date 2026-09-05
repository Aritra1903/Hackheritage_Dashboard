/**
 * Interactive Audio Player Bar with seamless A/B Clean vs Noisy toggle
 */

import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Repeat, 
  Radio, 
  Sparkles, 
  Zap, 
  Layers
} from 'lucide-react';
import { AudioNoiseRecord, PlaybackChannel } from '../types';
import { getAudioContext } from '../services/audioEngine';

interface AudioPlayerBarProps {
  record: AudioNoiseRecord;
  activeChannel: PlaybackChannel;
  onChangeChannel: (channel: PlaybackChannel) => void;
  onTimeUpdate: (currentTime: number) => void;
  onSetPlaying: (isPlaying: boolean) => void;
  onRegisterAnalyser: (analyser: AnalyserNode | null) => void;
  seekFraction?: number | null;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  record,
  activeChannel,
  onChangeChannel,
  onTimeUpdate,
  onSetPlaying,
  onRegisterAnalyser,
  seekFraction,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [currentTime, setCurrentTime] = useState(0);

  // Audio nodes refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);

  // Decoded buffers cache
  const buffersRef = useRef<{
    clean: AudioBuffer | null;
    noisy: AudioBuffer | null;
    noise_only: AudioBuffer | null;
  }>({ clean: null, noisy: null, noise_only: null });

  // Playback timing tracking
  const startTimeRef = useRef<number>(0);
  const pauseOffsetRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  // Load and decode AudioBuffers when active record changes
  useEffect(() => {
    let isCancelled = false;

    const loadBuffers = async () => {
      // Stop current playback
      stopAudio();
      pauseOffsetRef.current = 0;
      setCurrentTime(0);
      onTimeUpdate(0);

      try {
        const ctx = getAudioContext();
        audioContextRef.current = ctx;

        // Create analyser node once
        if (!analyserNodeRef.current) {
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.8;
          analyserNodeRef.current = analyser;
          onRegisterAnalyser(analyser);
        }

        // Create gain node once
        if (!gainNodeRef.current) {
          const gain = ctx.createGain();
          gain.gain.value = volume;
          gain.connect(analyserNodeRef.current);
          analyserNodeRef.current.connect(ctx.destination);
          gainNodeRef.current = gain;
        }

        const [cleanArray, noisyArray, noiseArray] = await Promise.all([
          record.cleanBlob.arrayBuffer(),
          record.noisyBlob.arrayBuffer(),
          record.noiseBlob.arrayBuffer(),
        ]);

        if (isCancelled) return;

        const [cleanBuf, noisyBuf, noiseBuf] = await Promise.all([
          ctx.decodeAudioData(cleanArray),
          ctx.decodeAudioData(noisyArray),
          ctx.decodeAudioData(noiseArray),
        ]);

        if (isCancelled) return;

        buffersRef.current = {
          clean: cleanBuf,
          noisy: noisyBuf,
          noise_only: noiseBuf,
        };
      } catch (err) {
        console.error('Failed to decode audio buffers for player:', err);
      }
    };

    loadBuffers();

    return () => {
      isCancelled = true;
      stopAudio();
    };
  }, [record.id]);

  // Handle external seek
  useEffect(() => {
    if (seekFraction !== undefined && seekFraction !== null && record.duration > 0) {
      const targetSec = Math.max(0, Math.min(record.duration, seekFraction * record.duration));
      seekToTime(targetSec);
    }
  }, [seekFraction]);

  // Volume updates
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Stop audio node
  const stopAudio = () => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.onended = null;
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {
        // ignore if already stopped
      }
      sourceNodeRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsPlaying(false);
    onSetPlaying(false);
  };

  // Play audio from given offset
  const playAudio = (offset: number) => {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const currentBuffer = buffersRef.current[activeChannel];
    if (!currentBuffer || !gainNodeRef.current) return;

    // Clean up old source
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.onended = null;
        sourceNodeRef.current.stop();
        sourceNodeRef.current.disconnect();
      } catch {
        // ignore
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = currentBuffer;
    source.loop = isLooping;
    source.playbackRate.value = playbackSpeed;
    source.connect(gainNodeRef.current);

    const safeOffset = Math.max(0, Math.min(record.duration - 0.05, offset));
    startTimeRef.current = ctx.currentTime - (safeOffset / playbackSpeed);
    pauseOffsetRef.current = safeOffset;

    source.onended = () => {
      if (!isLooping) {
        setIsPlaying(false);
        onSetPlaying(false);
        pauseOffsetRef.current = 0;
        setCurrentTime(0);
        onTimeUpdate(0);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
      }
    };

    source.start(0, safeOffset);
    sourceNodeRef.current = source;
    setIsPlaying(true);
    onSetPlaying(true);

    // Continuous time ticker
    const tick = () => {
      if (!audioContextRef.current) return;
      const elapsed = (audioContextRef.current.currentTime - startTimeRef.current) * playbackSpeed;
      let pos = elapsed;
      if (isLooping && record.duration > 0) {
        pos = pos % record.duration;
      } else if (pos >= record.duration) {
        pos = record.duration;
      }
      pauseOffsetRef.current = pos;
      setCurrentTime(pos);
      onTimeUpdate(pos);

      if (pos < record.duration || isLooping) {
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(tick);
  };

  const togglePlay = () => {
    if (isPlaying) {
      // Pause
      stopAudio();
    } else {
      // Play
      playAudio(pauseOffsetRef.current >= record.duration - 0.05 ? 0 : pauseOffsetRef.current);
    }
  };

  const seekToTime = (newTimeSec: number) => {
    pauseOffsetRef.current = newTimeSec;
    setCurrentTime(newTimeSec);
    onTimeUpdate(newTimeSec);

    if (isPlaying) {
      stopAudio();
      playAudio(newTimeSec);
    }
  };

  // Seamless channel change (A/B testing while playing)
  const handleChannelSwitch = (channel: PlaybackChannel) => {
    onChangeChannel(channel);
    if (isPlaying) {
      // Instant hot-swap
      stopAudio();
      // Resume immediately with new channel buffer at exact position
      setTimeout(() => {
        playAudio(pauseOffsetRef.current);
      }, 10);
    }
  };

  const resetToStart = () => {
    seekToTime(0);
  };

  return (
    <div 
      id="audio-player-toolbar"
      className="w-full bg-[#030806] border border-emerald-500/30 rounded-xl p-3 sm:p-3.5 shadow-[0_0_20px_rgba(16,185,129,0.06)] flex flex-col gap-2.5 font-mono"
    >
      {/* Top: Active Record Name & A/B Channel Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Radio className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-emerald-100 text-xs sm:text-sm">{record.title}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 font-bold">
                SNR: {record.measuredSnrDb > 0 ? `+${record.measuredSnrDb}` : record.measuredSnrDb} dB
              </span>
            </div>
            <p className="text-[10px] text-emerald-500/70">
              JAMMER: {record.noiseType.toUpperCase()} | {record.sampleRate} Hz | {record.channels === 1 ? 'MONO' : 'STEREO'}
            </p>
          </div>
        </div>

        {/* A/B Channel Selector Buttons */}
        <div className="flex items-center gap-1 bg-[#020504] p-1 rounded-lg border border-emerald-500/30">
          <span className="text-[10px] text-emerald-500 px-1.5 flex items-center gap-1 font-bold">
            <Layers className="w-3 h-3 text-emerald-400" /> LINK:
          </span>
          
          <button
            id="channel-btn-noisy"
            onClick={() => handleChannelSwitch('noisy')}
            title="Listen to input audio with mixed noise"
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold tracking-wider transition-all ${
              activeChannel === 'noisy'
                ? 'bg-amber-500 text-slate-950 shadow-[0_0_8px_#f59e0b]'
                : 'text-emerald-400/80 hover:text-emerald-200 hover:bg-emerald-950/40'
            }`}
          >
            <Zap className="w-3 h-3" />
            MIX [AUDIO+NOISE]
          </button>

          <button
            id="channel-btn-clean"
            onClick={() => handleChannelSwitch('clean')}
            title="Listen to pristine clean input audio"
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold tracking-wider transition-all ${
              activeChannel === 'clean'
                ? 'bg-emerald-500 text-slate-950 shadow-[0_0_8px_#00ff66]'
                : 'text-emerald-400/80 hover:text-emerald-200 hover:bg-emerald-950/40'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            CLEAN AUDIO
          </button>

          <button
            id="channel-btn-noise-only"
            onClick={() => handleChannelSwitch('noise_only')}
            title="Listen to isolated noise component alone"
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold tracking-wider transition-all ${
              activeChannel === 'noise_only'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_8px_#06b6d4]'
                : 'text-emerald-400/80 hover:text-emerald-200 hover:bg-emerald-950/40'
            }`}
          >
            <Radio className="w-3 h-3" />
            NOISE ONLY
          </button>
        </div>
      </div>

      {/* Bottom: Playback Controls, Scrub Slider, Volume, Loop */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* Play/Pause */}
          <button
            id="btn-play-pause"
            onClick={togglePlay}
            className="w-9 h-9 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center font-bold transition-all shadow-[0_0_12px_#00ff66] active:scale-95"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          {/* Reset */}
          <button
            id="btn-player-restart"
            onClick={resetToStart}
            className="p-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 transition-colors"
            title="Restart playback"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Loop toggle */}
          <button
            id="btn-player-loop"
            onClick={() => setIsLooping(!isLooping)}
            className={`p-1.5 rounded-lg transition-colors border ${
              isLooping 
                ? 'bg-emerald-500/30 text-emerald-300 border-emerald-400' 
                : 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-500 border-emerald-500/20'
            }`}
            title={isLooping ? 'Looping enabled' : 'Enable loop'}
          >
            <Repeat className="w-3.5 h-3.5" />
          </button>

          {/* Playback speed */}
          <div className="inline-flex rounded-lg bg-[#020504] border border-emerald-500/30 p-0.5 text-[10px] font-mono">
            {[0.5, 1.0, 1.5].map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackSpeed(speed)}
                className={`px-1.5 py-0.5 rounded ${
                  playbackSpeed === speed ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-emerald-400 hover:text-emerald-200'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        {/* Time Progress Scrub Bar */}
        <div className="flex-1 min-w-[180px] flex items-center gap-2">
          <span className="font-mono text-[11px] text-emerald-400 w-11 text-right">
            {formatTime(currentTime)}
          </span>
          
          <input
            id="player-scrub-input"
            type="range"
            min="0"
            max={record.duration || 1}
            step="0.01"
            value={currentTime}
            onChange={(e) => seekToTime(parseFloat(e.target.value))}
            className="flex-1 h-1.5 bg-[#020504] rounded-lg appearance-none cursor-pointer accent-emerald-400 border border-emerald-500/30"
          />

          <span className="font-mono text-[11px] text-emerald-400/70 w-11">
            {formatTime(record.duration)}
          </span>
        </div>

        {/* Volume & Mute */}
        <div className="flex items-center gap-2">
          <button
            id="btn-player-mute"
            onClick={() => setIsMuted(!isMuted)}
            className="p-1.5 rounded text-emerald-400 hover:text-emerald-200 transition-colors"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            id="player-volume-input"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              setVolume(parseFloat(e.target.value));
              if (isMuted) setIsMuted(false);
            }}
            className="w-16 h-1.5 bg-[#020504] rounded-lg appearance-none cursor-pointer accent-emerald-400 border border-emerald-500/30"
          />
        </div>
      </div>
    </div>
  );
};

function formatTime(sec: number): string {
  if (!sec || isNaN(sec)) return '00:00.0';
  const mins = Math.floor(sec / 60);
  const remSec = (sec % 60).toFixed(1);
  return `${mins.toString().padStart(2, '0')}:${remSec.padStart(4, '0')}`;
}
