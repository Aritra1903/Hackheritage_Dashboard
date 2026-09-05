/**
 * Audio and Noise Database Types
 */

export type NoiseType = 
  | 'white' 
  | 'pink' 
  | 'brown' 
  | 'hum' 
  | 'babble' 
  | 'traffic' 
  | 'digital_click'
  | 'bomb_blast'
  | 'gunfire'
  | 'plane_crash';

export type ImpulsiveNoiseType = 'bomb_blast' | 'gunfire' | 'plane_crash';

export type SnrTrend = 'degradation' | 'improvement' | 'stable';

export interface NoiseConfig {
  type: NoiseType;
  label: string;
  description: string;
  color: string;
  defaultSnr: number;
  isImpulsive?: boolean;
}

export interface AudioMetrics {
  rmsDb: number;
  peakDb: number;
  dynamicRangeDb: number;
  crestFactor?: number;
}

export interface NoisyAudioMetrics extends AudioMetrics {
  calculatedSnrDb: number;
  noiseRmsDb: number;
}

export interface AiAcousticAnalysis {
  timestamp: number;
  noiseType: NoiseType;
  noiseLevelDb: number;
  noiseLevelPercent: number;
  currentSnrDb: number;
  previousSnrDb: number;
  snrDeltaDb: number;
  trend: SnrTrend;
  speechProbabilityPercent: number;
  ancReductionDb: number;
  residualNoiseDb: number;
  processingLatencyMs: number;
  isImpulsive: boolean;
  impulsiveType?: ImpulsiveNoiseType;
  impulsiveDurationSec?: number;
  intelligibilityScore: number;
  tacticalRecommendation: string;
  aiSummary: string;
  environmentClassifier: string;
}

export interface LiveSnrFrame {
  time: number;
  snrDb: number;
  previousSnrDb: number;
  cleanRmsDb: number;
  noisyRmsDb: number;
  noiseRmsDb: number;
  trend: SnrTrend;
  isImpulsive: boolean;
  impulsiveType?: ImpulsiveNoiseType;
  speechProbability: number;
}

export interface AudioNoiseRecord {
  id: string;
  title: string;
  category: 'speech' | 'music' | 'ambient' | 'tones' | 'custom';
  description?: string;
  tags: string[];
  createdAt: number;
  duration: number; // in seconds
  sampleRate: number;
  channels: number;
  
  // Noise Configuration
  noiseType: NoiseType;
  targetSnrDb: number; // desired SNR (dB)
  measuredSnrDb: number; // actual computed SNR
  noiseLevelPercent: number; // 0 - 100%
  
  // Audio Metrics
  cleanMetrics: AudioMetrics;
  noisyMetrics: NoisyAudioMetrics;
  
  // Waveform visualization cache (sampled peaks for immediate rendering)
  waveformPeaks: {
    clean: number[];
    noisy: number[];
    noiseOnly?: number[];
  };
  
  // Source
  sourceType: 'microphone' | 'file_upload' | 'preset_dataset';
  
  // Audio Blobs (stored in IndexedDB as binary Blobs)
  cleanBlob: Blob;
  noisyBlob: Blob;
  noiseBlob: Blob;
}

export interface DatabaseStats {
  totalRecords: number;
  totalDurationSec: number;
  avgSnrDb: number;
  noiseTypeDistribution: Record<NoiseType, number>;
  sourceDistribution: Record<string, number>;
}

export interface FilterState {
  searchQuery: string;
  noiseType: 'all' | NoiseType;
  category: 'all' | 'speech' | 'music' | 'ambient' | 'tones' | 'custom';
  snrBracket: 'all' | 'extreme_neg' | 'moderate' | 'clean_high'; // <0dB, 0-12dB, >12dB
  sortBy: 'newest' | 'oldest' | 'snr_asc' | 'snr_desc' | 'duration' | 'title';
}

export type PlaybackChannel = 'noisy' | 'clean' | 'noise_only';

export type ClearanceLevel = 'LVL-1' | 'LVL-2' | 'LVL-3' | 'LVL-4' | 'LVL-5';

export interface OperatorProfile {
  callsign: string;
  codename: string;
  email: string;
  clearance: ClearanceLevel;
  clearanceTitle: string;
  sectorId: string;
  unit: string;
  tokenHash: string;
  lastLogin?: number;
}
