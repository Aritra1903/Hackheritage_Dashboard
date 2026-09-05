/**
 * Noise Studio Modal: Input audio (Mic, File Upload, or Synth) and mix with Noise
 */

import React, { useEffect, useRef, useState } from 'react';
import { 
  X, 
  Mic, 
  Upload, 
  Sliders, 
  Sparkles, 
  Square, 
  Play, 
  Pause, 
  Check, 
  Zap, 
  Info,
  Radio
} from 'lucide-react';
import { AudioNoiseRecord, NoiseType } from '../types';
import { 
  audioBufferToWav, 
  calculateRMS, 
  decodeAudioBlob, 
  extractWaveformPeaks, 
  generateSyntheticAudio, 
  getAudioContext, 
  mixAudioWithNoise 
} from '../services/audioEngine';

interface NoiseStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveRecord: (record: AudioNoiseRecord) => Promise<void>;
}

const NOISE_PROFILES: Array<{
  type: NoiseType;
  label: string;
  desc: string;
  badgeColor: string;
  defaultSnr: number;
}> = [
  { type: 'white', label: 'Gaussian White Noise', desc: 'Flat power density across all frequencies', badgeColor: 'border-slate-500 text-slate-300', defaultSnr: 0 },
  { type: 'pink', label: '1/f Pink Noise', desc: 'Equal energy per octave, acoustic & ambient', badgeColor: 'border-pink-500 text-pink-300', defaultSnr: 6 },
  { type: 'brown', label: 'Brownian Rumble', desc: 'Deep low-frequency roll-off (-6dB/oct)', badgeColor: 'border-amber-600 text-amber-300', defaultSnr: 8 },
  { type: 'hum', label: '60Hz Mains Hum', desc: 'Ground loop hum + 120Hz/180Hz/240Hz harmonics', badgeColor: 'border-yellow-500 text-yellow-300', defaultSnr: 12 },
  { type: 'babble', label: 'Crowd Babble', desc: 'Multi-speaker cocktail party chatter interference', badgeColor: 'border-cyan-500 text-cyan-300', defaultSnr: 4 },
  { type: 'traffic', label: 'Urban Traffic', desc: 'Street road rumble and vehicle tire pass-bys', badgeColor: 'border-blue-500 text-blue-300', defaultSnr: 6 },
  { type: 'digital_click', label: 'Digital Glitches', desc: 'Impulse clicks, packet dropouts, and bursts', badgeColor: 'border-rose-500 text-rose-300', defaultSnr: 10 },
  { type: 'bomb_blast', label: 'Bomb Blast Detonation', desc: 'Explosive supersonic shockwave, sub-bass 45Hz blast pulse & turbulent roar', badgeColor: 'border-red-500 text-red-400', defaultSnr: -6 },
  { type: 'gunfire', label: 'Ballistic Gunfire', desc: 'Supersonic bullet crack, high-caliber muzzle blast & cavity reverberation', badgeColor: 'border-red-600 text-red-300', defaultSnr: -4 },
  { type: 'plane_crash', label: 'Plane Crash Disaster', desc: 'Turbine failure, structural impact shockwave & secondary fuel explosion', badgeColor: 'border-rose-600 text-rose-400', defaultSnr: -8 },
];

export const NoiseStudioModal: React.FC<NoiseStudioModalProps> = ({
  isOpen,
  onClose,
  onSaveRecord,
}) => {
  // Input source tab: 'mic' | 'upload' | 'synth'
  const [inputTab, setInputTab] = useState<'mic' | 'upload' | 'synth'>('synth');

  // Audio state
  const [cleanBuffer, setCleanBuffer] = useState<AudioBuffer | null>(null);
  const [cleanWaveformPeaks, setCleanWaveformPeaks] = useState<number[]>([]);
  const [audioTitle, setAudioTitle] = useState('My Audio Input with Noise');
  const [category, setCategory] = useState<'speech' | 'music' | 'ambient' | 'tones' | 'custom'>('speech');
  const [tagInput, setTagInput] = useState('Voice, Experiment');
  const [notes, setNotes] = useState('');

  // Noise injection parameters
  const [selectedNoiseType, setSelectedNoiseType] = useState<NoiseType>('babble');
  const [targetSnrDb, setTargetSnrDb] = useState<number>(6.0);

  // Mixed results state
  const [mixedResult, setMixedResult] = useState<ReturnType<typeof mixAudioWithNoise> | null>(null);

  // Preview playback state
  const [previewChannel, setPreviewChannel] = useState<'noisy' | 'clean'>('noisy');
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Microphone recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const [micVolumeLevel, setMicVolumeLevel] = useState(0);

  // Upload file state
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Synth preset state
  const [synthPreset, setSynthPreset] = useState<'speech_vowels' | 'acoustic_chords' | 'sine_sweep' | 'synth_lead'>('speech_vowels');

  // Load initial synthetic buffer when opened
  useEffect(() => {
    if (isOpen && !cleanBuffer) {
      loadSyntheticAudio(synthPreset);
    }
  }, [isOpen]);

  // Re-mix audio whenever clean buffer, noise type, or target SNR changes
  useEffect(() => {
    if (!cleanBuffer) {
      setMixedResult(null);
      return;
    }
    try {
      const result = mixAudioWithNoise(cleanBuffer, selectedNoiseType, targetSnrDb);
      setMixedResult(result);
    } catch (err) {
      console.error('Failed to mix audio with noise:', err);
    }
  }, [cleanBuffer, selectedNoiseType, targetSnrDb]);

  // Clean up preview audio on unmount or close
  useEffect(() => {
    return () => {
      stopPreviewAudio();
    };
  }, []);

  const loadSyntheticAudio = (type: 'speech_vowels' | 'acoustic_chords' | 'sine_sweep' | 'synth_lead') => {
    stopPreviewAudio();
    setSynthPreset(type);
    const buf = generateSyntheticAudio(type, 3.5);
    setCleanBuffer(buf);
    setCleanWaveformPeaks(extractWaveformPeaks(buf, 160));
    setFileName(null);
    if (type === 'speech_vowels') {
      setAudioTitle('Speech Phonemes Input');
      setCategory('speech');
      setTagInput('Speech, Vowels, Formants');
    } else if (type === 'acoustic_chords') {
      setAudioTitle('Acoustic Pluck Melody');
      setCategory('music');
      setTagInput('Acoustic, Harmonics, Strings');
    } else if (type === 'sine_sweep') {
      setAudioTitle('Log Chirp Sweep (100Hz - 7kHz)');
      setCategory('tones');
      setTagInput('Calibration, Chirp, Spectrum');
    } else {
      setAudioTitle('Synthesizer Lead Arpeggio');
      setCategory('music');
      setTagInput('Synth, Electronic, Lead');
    }
  };

  // Start microphone recording
  const startMicRecording = async () => {
    stopPreviewAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = getAudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const meterInterval = window.setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        setMicVolumeLevel(Math.min(100, Math.round((sum / dataArray.length / 128) * 100)));
      }, 80);

      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        clearInterval(meterInterval);
        setMicVolumeLevel(0);
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        try {
          setIsProcessing(true);
          const decoded = await decodeAudioBlob(audioBlob);
          setCleanBuffer(decoded);
          setCleanWaveformPeaks(extractWaveformPeaks(decoded, 160));
          setAudioTitle('Live Microphone Input');
          setCategory('speech');
          setTagInput('Microphone, Voice, Live');
        } catch (err) {
          console.error('Error decoding recorded audio:', err);
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorder.start(100);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordSeconds(0);

      recordTimerRef.current = window.setInterval(() => {
        setRecordSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Microphone access denied or error:', err);
      alert('Microphone access was denied or unavailable in this environment.');
    }
  };

  // Stop microphone recording
  const stopMicRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
    }
  };

  // Handle file drop / upload
  const handleFileUpload = async (file: File) => {
    stopPreviewAudio();
    try {
      setIsProcessing(true);
      setFileName(file.name);
      const decoded = await decodeAudioBlob(file);
      setCleanBuffer(decoded);
      setCleanWaveformPeaks(extractWaveformPeaks(decoded, 160));
      setAudioTitle(file.name.replace(/\.[^/.]+$/, ''));
      setCategory('custom');
      setTagInput('Upload, Audio File');
    } catch (err) {
      console.error('Failed to parse uploaded audio file:', err);
      alert('Unable to decode this audio file. Please ensure it is a valid WAV, MP3, or OGG audio file.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Preview Playback logic
  const stopPreviewAudio = () => {
    if (previewSourceRef.current) {
      try {
        previewSourceRef.current.stop();
        previewSourceRef.current.disconnect();
      } catch {
        // ignore
      }
      previewSourceRef.current = null;
    }
    setIsPreviewPlaying(false);
  };

  const playPreviewAudio = (channel: 'noisy' | 'clean') => {
    stopPreviewAudio();
    if (!mixedResult) return;

    const ctx = getAudioContext();
    const source = ctx.createBufferSource();
    source.buffer = channel === 'noisy' ? mixedResult.noisyBuffer : mixedResult.cleanBuffer;
    source.connect(ctx.destination);

    source.onended = () => {
      setIsPreviewPlaying(false);
      previewSourceRef.current = null;
    };

    source.start(0);
    previewSourceRef.current = source;
    setIsPreviewPlaying(true);
    setPreviewChannel(channel);
  };

  // Save to Database
  const handleSave = async () => {
    if (!cleanBuffer || !mixedResult) return;

    const cleanBlob = audioBufferToWav(mixedResult.cleanBuffer);
    const noisyBlob = audioBufferToWav(mixedResult.noisyBuffer);
    const noiseBlob = audioBufferToWav(mixedResult.noiseBuffer);

    const noisyPeaks = extractWaveformPeaks(mixedResult.noisyBuffer, 220);
    const cleanPeaks = extractWaveformPeaks(mixedResult.cleanBuffer, 220);
    const noiseOnlyPeaks = extractWaveformPeaks(mixedResult.noiseBuffer, 220);

    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const newRecord: AudioNoiseRecord = {
      id: `audio-rec-${Date.now()}`,
      title: audioTitle.trim() || 'Untitled Audio Input',
      category,
      description: notes.trim() || `${selectedNoiseType.toUpperCase()} noise at SNR ${mixedResult.measuredSnrDb} dB.`,
      tags: tags.length > 0 ? tags : ['Audio', selectedNoiseType],
      createdAt: Date.now(),
      duration: Math.round(cleanBuffer.duration * 100) / 100,
      sampleRate: cleanBuffer.sampleRate,
      channels: cleanBuffer.numberOfChannels,
      noiseType: selectedNoiseType,
      targetSnrDb,
      measuredSnrDb: mixedResult.measuredSnrDb,
      noiseLevelPercent: Math.round(Math.max(5, Math.min(100, 50 - targetSnrDb * 2.5))),
      cleanMetrics: mixedResult.cleanMetrics,
      noisyMetrics: mixedResult.noisyMetrics,
      waveformPeaks: {
        clean: cleanPeaks,
        noisy: noisyPeaks,
        noiseOnly: noiseOnlyPeaks,
      },
      sourceType: inputTab === 'mic' ? 'microphone' : inputTab === 'upload' ? 'file_upload' : 'preset_dataset',
      cleanBlob,
      noisyBlob,
      noiseBlob,
    };

    stopPreviewAudio();
    await onSaveRecord(newRecord);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      id="noise-studio-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto"
    >
      <div 
        id="noise-studio-modal-card"
        className="w-full max-w-4xl bg-[#0e1422] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-[#131b2e]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">Input Audio & Inject Noise Studio</h2>
              <p className="text-xs text-slate-400">Record, upload, or synthesize audio, then apply controllable acoustic noise profiles</p>
            </div>
          </div>
          <button
            id="btn-close-modal"
            onClick={() => {
              stopPreviewAudio();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Two-column layout */}
        <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 max-h-[75vh] overflow-y-auto">
          
          {/* Left Column: Input Source (Mic, Upload, Synth) */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            
            {/* Input Method Selector Tabs */}
            <div className="flex rounded-xl bg-slate-900/90 p-1 border border-slate-800">
              <button
                id="tab-synth"
                onClick={() => setInputTab('synth')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                  inputTab === 'synth' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Audio Signals
              </button>
              <button
                id="tab-mic"
                onClick={() => setInputTab('mic')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                  inputTab === 'mic' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                Microphone
              </button>
              <button
                id="tab-upload"
                onClick={() => setInputTab('upload')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                  inputTab === 'upload' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                Upload File
              </button>
            </div>

            {/* TAB CONTENT: 1. Synthetic Presets */}
            {inputTab === 'synth' && (
              <div className="flex flex-col gap-2 p-3 bg-slate-900/60 rounded-xl border border-slate-800/80">
                <span className="text-xs font-medium text-slate-300">Choose Clean Input Signal:</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => loadSyntheticAudio('speech_vowels')}
                    className={`p-2.5 rounded-lg text-left border transition-all ${
                      synthPreset === 'speech_vowels'
                        ? 'bg-cyan-950/50 border-cyan-500 text-cyan-200 shadow-sm'
                        : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-xs font-semibold">Speech Vowels</div>
                    <div className="text-[11px] text-slate-400">Human formant articulation</div>
                  </button>

                  <button
                    onClick={() => loadSyntheticAudio('acoustic_chords')}
                    className={`p-2.5 rounded-lg text-left border transition-all ${
                      synthPreset === 'acoustic_chords'
                        ? 'bg-cyan-950/50 border-cyan-500 text-cyan-200 shadow-sm'
                        : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-xs font-semibold">Acoustic Harmonics</div>
                    <div className="text-[11px] text-slate-400">Plucked string chord decay</div>
                  </button>

                  <button
                    onClick={() => loadSyntheticAudio('sine_sweep')}
                    className={`p-2.5 rounded-lg text-left border transition-all ${
                      synthPreset === 'sine_sweep'
                        ? 'bg-cyan-950/50 border-cyan-500 text-cyan-200 shadow-sm'
                        : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-xs font-semibold">Chirp Sweep</div>
                    <div className="text-[11px] text-slate-400">100Hz - 7kHz log chirp</div>
                  </button>

                  <button
                    onClick={() => loadSyntheticAudio('synth_lead')}
                    className={`p-2.5 rounded-lg text-left border transition-all ${
                      synthPreset === 'synth_lead'
                        ? 'bg-cyan-950/50 border-cyan-500 text-cyan-200 shadow-sm'
                        : 'bg-slate-800/50 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="text-xs font-semibold">Synth Lead</div>
                    <div className="text-[11px] text-slate-400">Electronic melodic arpeggio</div>
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 2. Live Microphone */}
            {inputTab === 'mic' && (
              <div className="flex flex-col items-center justify-center p-5 bg-slate-900/60 rounded-xl border border-slate-800/80 gap-3 text-center">
                {isRecording ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center animate-pulse">
                        <Mic className="w-7 h-7 text-rose-400" />
                      </div>
                    </div>
                    <div>
                      <span className="font-mono text-lg font-bold text-rose-400">
                        00:{recordSeconds.toString().padStart(2, '0')}
                      </span>
                      <p className="text-xs text-slate-400">Recording live microphone input...</p>
                    </div>

                    {/* Live Mic Level Bar */}
                    <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-rose-500 transition-all duration-75"
                        style={{ width: `${micVolumeLevel}%` }}
                      />
                    </div>

                    <button
                      id="btn-stop-mic"
                      onClick={stopMicRecording}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md transition-all"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" /> Stop Recording
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                      <Mic className="w-6 h-6" />
                    </div>
                    <p className="text-xs text-slate-300 font-medium">Capture Speech or Audio via Microphone</p>
                    <p className="text-[11px] text-slate-400 max-w-xs">Speak into your mic to test speech intelligibility with various background noise types.</p>
                    <button
                      id="btn-start-mic"
                      onClick={startMicRecording}
                      className="mt-1 flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold shadow-md transition-all"
                    >
                      <Mic className="w-3.5 h-3.5" /> Start Recording
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: 3. File Upload */}
            {inputTab === 'upload' && (
              <div 
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed transition-all text-center gap-2 ${
                  isDragging ? 'border-cyan-400 bg-cyan-950/20' : 'border-slate-700/80 bg-slate-900/40 hover:bg-slate-900/60'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-300">
                  <Upload className="w-5 h-5 text-cyan-400" />
                </div>
                <div className="text-xs font-medium text-slate-200">
                  {fileName ? `Loaded: ${fileName}` : 'Drop an audio file here, or browse'}
                </div>
                <p className="text-[11px] text-slate-400">Supports WAV, MP3, OGG, M4A</p>

                <label className="mt-1 cursor-pointer px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors">
                  Choose File
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                  />
                </label>
              </div>
            )}

            {/* Waveform preview of clean input */}
            {cleanBuffer && (
              <div className="flex flex-col gap-1 p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                    <Check className="w-3.5 h-3.5" /> Clean Input Loaded
                  </span>
                  <span className="font-mono text-[11px]">
                    {cleanBuffer.duration.toFixed(2)}s | {cleanBuffer.sampleRate} Hz
                  </span>
                </div>
                {/* Mini peaks */}
                <div className="h-10 w-full flex items-center gap-0.5 bg-[#080c14] px-1 py-0.5 rounded border border-slate-800/80">
                  {cleanWaveformPeaks.slice(0, 100).map((peak, idx) => (
                    <div
                      key={idx}
                      className="flex-1 bg-emerald-500/80 rounded-xs"
                      style={{ height: `${Math.max(10, peak * 100)}%` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Metadata Fields */}
            <div className="flex flex-col gap-2.5">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Record Title</label>
                <input
                  id="input-record-title"
                  type="text"
                  value={audioTitle}
                  onChange={(e) => setAudioTitle(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. Speech in Heavy White Noise"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
                  <select
                    id="select-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
                  >
                    <option value="speech">Speech</option>
                    <option value="music">Music</option>
                    <option value="ambient">Ambient</option>
                    <option value="tones">Tones</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Tags (comma separated)</label>
                  <input
                    id="input-record-tags"
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-500"
                    placeholder="e.g. Voice, -6dB SNR"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Noise Profile Selector & SNR Control */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            
            {/* Noise Type Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-amber-400" />
                Select Noise Type to Inject:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {NOISE_PROFILES.map((profile) => (
                  <button
                    key={profile.type}
                    onClick={() => {
                      setSelectedNoiseType(profile.type);
                    }}
                    className={`p-2.5 rounded-xl text-left border transition-all ${
                      selectedNoiseType === profile.type
                        ? 'bg-amber-950/40 border-amber-500 text-amber-200 shadow-md'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{profile.label}</span>
                      {selectedNoiseType === profile.type && (
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{profile.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* SNR Slider */}
            <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-slate-200">Desired Signal-to-Noise Ratio (SNR)</span>
                  <p className="text-[11px] text-slate-400">Lower = More severe noise | Higher = Cleaner input</p>
                </div>
                <span className={`font-mono text-sm px-2 py-0.5 rounded font-bold border ${
                  targetSnrDb < 0 
                    ? 'bg-rose-950/60 border-rose-800 text-rose-300' 
                    : targetSnrDb < 8 
                    ? 'bg-amber-950/60 border-amber-800 text-amber-300' 
                    : 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                }`}>
                  {targetSnrDb > 0 ? `+${targetSnrDb}` : targetSnrDb} dB
                </span>
              </div>

              <input
                id="slider-target-snr"
                type="range"
                min="-12"
                max="24"
                step="0.5"
                value={targetSnrDb}
                onChange={(e) => setTargetSnrDb(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />

              {/* SNR Range presets */}
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                <button 
                  onClick={() => setTargetSnrDb(-6)} 
                  className="hover:text-rose-400 transition-colors"
                >
                  -6dB (Heavy Noise)
                </button>
                <button 
                  onClick={() => setTargetSnrDb(0)} 
                  className="hover:text-amber-400 transition-colors"
                >
                  0dB (Equal Power)
                </button>
                <button 
                  onClick={() => setTargetSnrDb(6)} 
                  className="hover:text-amber-300 transition-colors"
                >
                  +6dB (Standard)
                </button>
                <button 
                  onClick={() => setTargetSnrDb(15)} 
                  className="hover:text-emerald-400 transition-colors"
                >
                  +15dB (Light Noise)
                </button>
              </div>
            </div>

            {/* Calculated Metrics Readout */}
            {mixedResult && (
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-900/60 rounded-xl border border-slate-800/80 text-center font-mono">
                <div className="p-1.5 bg-slate-800/60 rounded-lg">
                  <div className="text-[10px] text-slate-400">Clean RMS</div>
                  <div className="text-xs font-semibold text-emerald-400">{mixedResult.cleanMetrics.rmsDb} dBFS</div>
                </div>
                <div className="p-1.5 bg-slate-800/60 rounded-lg">
                  <div className="text-[10px] text-slate-400">Noise RMS</div>
                  <div className="text-xs font-semibold text-purple-400">{mixedResult.noisyMetrics.noiseRmsDb} dBFS</div>
                </div>
                <div className="p-1.5 bg-slate-800/60 rounded-lg">
                  <div className="text-[10px] text-slate-400">Measured SNR</div>
                  <div className="text-xs font-bold text-amber-300">{mixedResult.measuredSnrDb} dB</div>
                </div>
              </div>
            )}

            {/* Pre-Listen Audio Test Controls */}
            <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  id="btn-preview-noisy"
                  onClick={() => {
                    if (isPreviewPlaying && previewChannel === 'noisy') {
                      stopPreviewAudio();
                    } else {
                      playPreviewAudio('noisy');
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    isPreviewPlaying && previewChannel === 'noisy'
                      ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                      : 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                  }`}
                >
                  {isPreviewPlaying && previewChannel === 'noisy' ? (
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  Listen with Noise
                </button>

                <button
                  id="btn-preview-clean"
                  onClick={() => {
                    if (isPreviewPlaying && previewChannel === 'clean') {
                      stopPreviewAudio();
                    } else {
                      playPreviewAudio('clean');
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    isPreviewPlaying && previewChannel === 'clean'
                      ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-400'
                      : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                  }`}
                >
                  {isPreviewPlaying && previewChannel === 'clean' ? (
                    <Pause className="w-3.5 h-3.5 fill-current" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  Clean Input Only
                </button>
              </div>

              {isPreviewPlaying && (
                <span className="text-[11px] font-mono text-cyan-400 animate-pulse">Playing...</span>
              )}
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-800 bg-[#131b2e]">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Info className="w-3.5 h-3.5 text-slate-500" />
            <span>Encodes 16-bit PCM WAV to persistent IndexedDB</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                stopPreviewAudio();
                onClose();
              }}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>

            <button
              id="btn-save-to-database"
              onClick={handleSave}
              disabled={!cleanBuffer || !mixedResult || isProcessing}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 text-xs font-bold shadow-md transition-all active:scale-95"
            >
              <Zap className="w-3.5 h-3.5" />
              Save Record to Database
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
