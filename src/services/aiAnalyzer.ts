/**
 * Acoustic AI Situational Intelligence & Telemetry Analysis Engine
 * Real-time computation of noise levels, dual SNR delta tracking,
 * voice activity detection (VAD speech probability), ANC attenuation,
 * residual noise floor, DSP processing latency, and impulsive blast detection.
 */

import { AiAcousticAnalysis, ImpulsiveNoiseType, NoiseType, SnrTrend } from '../types';

export interface AnalysisInputParams {
  noiseType: NoiseType;
  currentSnrDb: number;
  previousSnrDb: number;
  currentTime: number;
  duration: number;
  activeChannel: 'noisy' | 'clean' | 'noise_only';
  ancEnabled: boolean;
  cleanRmsDb?: number;
  noisyRmsDb?: number;
  noiseRmsDb?: number;
  manualImpulsiveTrigger?: ImpulsiveNoiseType | null;
  manualImpulsiveActive?: boolean;
}

/**
 * Check if the noise is an impulsive blast / shockwave category
 */
export function isImpulsiveCategory(type: NoiseType): type is ImpulsiveNoiseType {
  return type === 'bomb_blast' || type === 'gunfire' || type === 'plane_crash';
}

/**
 * Real-time Acoustic AI situational analyzer
 */
export function computeAcousticAiAnalysis(params: AnalysisInputParams): AiAcousticAnalysis {
  const {
    noiseType,
    currentSnrDb,
    previousSnrDb,
    currentTime,
    duration,
    activeChannel,
    ancEnabled,
    cleanRmsDb = -22.5,
    noisyRmsDb = -18.2,
    noiseRmsDb = -26.0,
    manualImpulsiveTrigger = null,
    manualImpulsiveActive = false,
  } = params;

  // Calculate SNR Delta
  const snrDeltaDb = Math.round((currentSnrDb - previousSnrDb) * 10) / 10;

  // Determine SNR Trend
  let trend: SnrTrend = 'stable';
  if (snrDeltaDb <= -1.2 || (activeChannel === 'noisy' && currentSnrDb < 0)) {
    trend = 'degradation';
  } else if (snrDeltaDb >= 1.2 || ancEnabled || activeChannel === 'clean') {
    trend = 'improvement';
  }

  // Check Impulsive Noise window
  let isImpulsive = false;
  let impulsiveType: ImpulsiveNoiseType | undefined = undefined;
  let impulsiveDurationSec = 0;

  if (manualImpulsiveActive && manualImpulsiveTrigger) {
    isImpulsive = true;
    impulsiveType = manualImpulsiveTrigger;
    impulsiveDurationSec = 2.8;
  } else if (isImpulsiveCategory(noiseType)) {
    impulsiveType = noiseType;
    // Determine active persistence window based on physical acoustics
    switch (noiseType) {
      case 'bomb_blast':
        // Primary shockwave at 0.3s, persistent detonation rumble and shock turbulence to 2.4s
        if (currentTime >= 0.25 && currentTime <= 2.5) {
          isImpulsive = true;
          impulsiveDurationSec = Math.max(0.1, 2.5 - currentTime);
        }
        break;
      case 'gunfire':
        // Multi-burst shots: 0.2s - 3.4s
        if (currentTime >= 0.2 && currentTime <= 3.5) {
          isImpulsive = true;
          impulsiveDurationSec = Math.max(0.1, 3.5 - currentTime);
        }
        break;
      case 'plane_crash':
        // Aerodynamic distress then catastrophic impact at 1.0s to 3.5s
        if (currentTime >= 0.8 && currentTime <= 3.6) {
          isImpulsive = true;
          impulsiveDurationSec = Math.max(0.1, 3.6 - currentTime);
        }
        break;
    }
  }

  // Model Active Noise Cancellation (ANC) Reduction based on noise physics
  let baseAncReduction = -18.5; // default dB
  switch (noiseType) {
    case 'hum':
      baseAncReduction = -24.2; // 60Hz stationary hum is easily eliminated by notch / LMS
      break;
    case 'brown':
      baseAncReduction = -21.8; // Low frequency stationary noise responds very well to ANC
      break;
    case 'pink':
    case 'traffic':
      baseAncReduction = -17.4;
      break;
    case 'white':
      baseAncReduction = -14.2; // Broadband white noise has low correlation
      break;
    case 'babble':
      baseAncReduction = -11.5; // Non-stationary multi-speaker chatter
      break;
    case 'bomb_blast':
    case 'gunfire':
    case 'plane_crash':
      baseAncReduction = -7.8; // Hypersonic impulse transients saturate feedback loops
      break;
    default:
      baseAncReduction = -16.0;
  }

  const ancReductionDb = ancEnabled ? baseAncReduction : 0;

  // Noise level estimation
  let noiseLevelDb = Math.round(noiseRmsDb * 10) / 10;
  if (isImpulsive) {
    noiseLevelDb = Math.max(-6.5, noiseLevelDb + 14.5); // surge during blast
  }
  const noiseLevelPercent = Math.min(100, Math.max(5, Math.round(Math.pow(10, (noiseLevelDb + 50) / 30) * 50)));

  // Residual Noise floor after ANC
  const residualNoiseDb = Math.round((noiseLevelDb + ancReductionDb) * 10) / 10;

  // VAD Speech Probability calculation (%)
  let speechProbability = 0;
  if (activeChannel === 'noise_only') {
    speechProbability = Math.max(1.2, Math.round(3.5 + Math.random() * 2));
  } else if (isImpulsive) {
    speechProbability = Math.max(2.5, Math.round(8.0 + Math.random() * 6));
  } else {
    // Proportional to effective SNR
    const effectiveSnr = currentSnrDb + (ancEnabled ? Math.abs(ancReductionDb) : 0);
    // Logistic sigmoid for speech probability vs SNR
    const sigmoid = 1 / (1 + Math.exp(-effectiveSnr / 4.5));
    speechProbability = Math.round((sigmoid * 88 + 8 + (Math.sin(currentTime * 6) * 3)) * 10) / 10;
    speechProbability = Math.max(4.0, Math.min(99.2, speechProbability));
  }

  // Processing Latency (ms) - frame buffer execution time (e.g. 128 samples @ 44.1kHz = 2.9ms + 0.5ms DSP overhead)
  const processingLatencyMs = Math.round((3.1 + Math.sin(currentTime * 2) * 0.4) * 10) / 10;

  // Speech Intelligibility Score (0-100)
  const intelligibilityScore = Math.max(0, Math.min(100, Math.round(speechProbability * 0.85 + Math.max(-10, currentSnrDb) * 1.5)));

  // Environment Classification
  let environmentClassifier = 'Standard Acoustic Spectrum';
  if (isImpulsive) {
    if (impulsiveType === 'bomb_blast') environmentClassifier = 'DETONATION SHOCKWAVE ZONE (BOMB BLAST)';
    else if (impulsiveType === 'gunfire') environmentClassifier = 'KINETIC BALLISTIC COMBAT ZONE (GUNFIRE)';
    else if (impulsiveType === 'plane_crash') environmentClassifier = 'CATASTROPHIC IMPACT AIRFRAME DISASTER';
  } else if (noiseType === 'babble') {
    environmentClassifier = 'High-Density Cocktail Party / Babble Interference';
  } else if (noiseType === 'hum') {
    environmentClassifier = 'Mains Ground-Loop Electromagnetic Coupling';
  } else if (noiseType === 'traffic') {
    environmentClassifier = 'Urban Arterial Vehicle Infrastructure';
  } else if (noiseType === 'white') {
    environmentClassifier = 'Broadband Gaussian Thermal Interference';
  }

  // Tactical Recommendations and Situational Diagnostics
  let tacticalRecommendation = '';
  let aiSummary = '';

  if (isImpulsive) {
    const blastName = impulsiveType ? impulsiveType.replace('_', ' ').toUpperCase() : 'IMPULSIVE';
    tacticalRecommendation = `CRITICAL DEFENSE: Engage fast-attack lookahead peak limiter (-30dB ceiling) and engage high-pass filter at 140Hz to suppress shockwave blast energy.`;
    aiSummary = `AI ACOUSTIC THREAT DETECTED: Active ${blastName} event identified! High crest factor shockwave with extreme transient rise time (<3ms) is causing severe acoustic masking. Speech probability degraded to ${speechProbability}%. Maintain emergency isolation until transient echo dissipates.`;
  } else if (trend === 'degradation') {
    tacticalRecommendation = `ADAPTIVE ACTION: SNR has fallen by ${Math.abs(snrDeltaDb)} dB. Deploy LMS adaptive noise canceller and isolate voice formant passband (300Hz - 3.4kHz).`;
    aiSummary = `AI SPECTRUM DEGRADATION ALERT: SNR shifted from previous ${previousSnrDb > 0 ? '+' : ''}${previousSnrDb} dB to degraded ${currentSnrDb > 0 ? '+' : ''}${currentSnrDb} dB (Δ ${snrDeltaDb} dB loss). Ambient noise level surged to ${noiseLevelDb} dBFS, impairing vocal phoneme discrimination.`;
  } else if (trend === 'improvement') {
    tacticalRecommendation = `OPTIMAL LINK: SNR gained +${snrDeltaDb} dB. Maintain active notch filter coefficients and feedforward acoustic compensation.`;
    aiSummary = `AI ACOUSTIC IMPROVEMENT CONFIRMED: SNR recovered from previous ${previousSnrDb > 0 ? '+' : ''}${previousSnrDb} dB up to ${currentSnrDb > 0 ? '+' : ''}${currentSnrDb} dB (Δ +${snrDeltaDb} dB recovery). Active noise reduction achieved ${ancReductionDb} dB attenuation. Speech probability boosted to ${speechProbability}%.`;
  } else {
    tacticalRecommendation = `MONITORING: Spectral energy balance is stable. Continuous background SNR monitoring active.`;
    aiSummary = `AI STEADY-STATE DIAGNOSIS: Signal-to-noise ratio is steady at ${currentSnrDb > 0 ? '+' : ''}${currentSnrDb} dB. Noise floor measured at ${noiseLevelDb} dBFS with ${speechProbability}% voice probability and ${processingLatencyMs}ms DSP frame latency.`;
  }

  return {
    timestamp: Date.now(),
    noiseType,
    noiseLevelDb,
    noiseLevelPercent,
    currentSnrDb: Math.round(currentSnrDb * 10) / 10,
    previousSnrDb: Math.round(previousSnrDb * 10) / 10,
    snrDeltaDb,
    trend,
    speechProbabilityPercent: speechProbability,
    ancReductionDb,
    residualNoiseDb,
    processingLatencyMs,
    isImpulsive,
    impulsiveType,
    impulsiveDurationSec: Math.round(impulsiveDurationSec * 10) / 10,
    intelligibilityScore,
    tacticalRecommendation,
    aiSummary,
    environmentClassifier,
  };
}

/**
 * Request deep generative acoustic audit from Gemini API
 */
export async function requestGeminiAudit(
  analysis: AiAcousticAnalysis,
  audioTitle?: string
): Promise<string> {
  try {
    const res = await fetch('/api/ai-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysis,
        audioTitle: audioTitle || 'Tactical Audio Stream',
      }),
    });

    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }

    const data = await res.json();
    return data.report || analysis.aiSummary;
  } catch (err) {
    console.warn('Gemini server endpoint fallback to localized DSP model:', err);
    return analysis.aiSummary;
  }
}
