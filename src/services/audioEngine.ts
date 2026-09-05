/**
 * Audio Engine: Web Audio API synthesis, noise generation, SNR calculation,
 * WAV encoding, and peak extraction.
 */

import { AudioMetrics, NoiseType, NoisyAudioMetrics } from '../types';

let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Compute Root Mean Square (RMS) of an audio channel
 */
export function calculateRMS(channelData: Float32Array): number {
  let sumSquares = 0;
  for (let i = 0; i < channelData.length; i++) {
    sumSquares += channelData[i] * channelData[i];
  }
  return Math.sqrt(sumSquares / Math.max(1, channelData.length));
}

/**
 * Convert linear amplitude (0 to 1) to Decibels Full Scale (dBFS)
 */
export function amplitudeToDb(amp: number): number {
  if (amp <= 1e-7) return -140;
  return 20 * Math.log10(amp);
}

/**
 * Compute peak absolute value of audio channel
 */
export function calculatePeak(channelData: Float32Array): number {
  let peak = 0;
  for (let i = 0; i < channelData.length; i++) {
    const abs = Math.abs(channelData[i]);
    if (abs > peak) peak = abs;
  }
  return peak;
}

/**
 * Generate synthetic noise vector of given type
 */
export function generateNoiseSamples(
  noiseType: NoiseType,
  length: number,
  sampleRate: number
): Float32Array {
  const noise = new Float32Array(length);

  switch (noiseType) {
    case 'white': {
      // Gaussian / Normal distribution approximation (Box-Muller)
      for (let i = 0; i < length; i += 2) {
        let u1 = Math.random();
        let u2 = Math.random();
        while (u1 <= 1e-6) u1 = Math.random();
        const r = Math.sqrt(-2.0 * Math.log(u1));
        const theta = 2.0 * Math.PI * u2;
        noise[i] = (r * Math.cos(theta)) * 0.5;
        if (i + 1 < length) {
          noise[i + 1] = (r * Math.sin(theta)) * 0.5;
        }
      }
      break;
    }

    case 'pink': {
      // Paul Kellet's filtered pink noise algorithm (-3dB/octave)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        b6 = white * 0.115926;
        noise[i] = pink * 0.15;
      }
      break;
    }

    case 'brown': {
      // Brownian / Red noise (-6dB/octave integration)
      let lastOut = 0.0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + (0.02 * white)) / 1.02;
        noise[i] = lastOut * 3.5;
      }
      break;
    }

    case 'hum': {
      // 60Hz / 50Hz Ground Loop Hum with 120Hz, 180Hz, 240Hz, 300Hz harmonics & jitter
      const fundamental = 60; // 60Hz AC mains hum
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const jitter = Math.sin(t * 1.5) * 0.4;
        const f = fundamental + jitter;
        const h1 = Math.sin(2 * Math.PI * f * t) * 0.55;
        const h2 = Math.sin(2 * Math.PI * (f * 2) * t) * 0.30;
        const h3 = Math.sin(2 * Math.PI * (f * 3) * t) * 0.18;
        const h4 = Math.sin(2 * Math.PI * (f * 4) * t) * 0.08;
        const buzz = (Math.random() - 0.5) * 0.05;
        noise[i] = (h1 + h2 + h3 + h4 + buzz) * 0.6;
      }
      break;
    }

    case 'babble': {
      // Simulated crowded room / cocktail party chatter formant noise
      const formantFreqs = [300, 750, 1500, 2400, 3100];
      const phases = [0, 1.2, 2.5, 3.8, 0.7];
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        let sample = 0;
        // Low-frequency cadences (speech cadence ~ 3-5 Hz modulations)
        const envelope = 0.5 + 0.4 * Math.sin(2 * Math.PI * 3.8 * t) * Math.cos(2 * Math.PI * 1.2 * t);
        for (let j = 0; j < formantFreqs.length; j++) {
          const modF = formantFreqs[j] * (1 + 0.1 * Math.sin(t * (j + 1) * 2));
          phases[j] += (2 * Math.PI * modF) / sampleRate;
          sample += Math.sin(phases[j]) / (j + 1.2);
        }
        const whiteFuzz = (Math.random() - 0.5) * 0.3;
        noise[i] = (sample * 0.25 + whiteFuzz) * envelope * 0.8;
      }
      break;
    }

    case 'traffic': {
      // Urban traffic / street rumble with vehicle pass-bys
      let rumble = 0;
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const white = Math.random() * 2 - 1;
        rumble = (rumble + 0.008 * white) / 1.008; // very low pass
        const vehicleSwell = 0.4 + 0.5 * Math.pow(Math.sin(t * 0.8), 4);
        const tireHiss = (Math.random() * 2 - 1) * 0.03 * vehicleSwell;
        noise[i] = (rumble * 5.0 * vehicleSwell + tireHiss) * 0.7;
      }
      break;
    }

    case 'digital_click': {
      // Digital transmission glitches, jitter dropouts, and burst clicks
      for (let i = 0; i < length; i++) {
        let val = 0;
        // Random clicks every ~2000-5000 samples
        if (Math.random() < 0.0015) {
          val = (Math.random() > 0.5 ? 0.9 : -0.9) * (0.5 + Math.random() * 0.5);
        } else if (Math.random() < 0.0003) {
          // Burst of high frequency hiss
          val = (Math.random() * 2 - 1) * 0.7;
        } else {
          // Low quantization floor
          val = (Math.random() - 0.5) * 0.02;
        }
        noise[i] = val;
      }
      break;
    }

    case 'bomb_blast': {
      // Violent explosive detonation:
      // Primary shockwave at t=0.3s (massive exponential blast pulse with soft-clipping)
      // Followed by subsonic ground shock (35-70Hz decaying sine) and turbulent expanding fireball roar (1.5s decay)
      const blastTime = 0.3; // seconds
      const blastSample = Math.floor(blastTime * sampleRate);
      for (let i = 0; i < length; i++) {
        if (i < blastSample) {
          // Low pre-blast ambient tension
          noise[i] = (Math.random() - 0.5) * 0.03;
        } else {
          const dt = (i - blastSample) / sampleRate;
          // Initial hypersonic shockwave spike (duration ~30ms)
          const shockwave = dt < 0.03 ? (1.0 - dt / 0.03) * (Math.random() > 0.5 ? 1.0 : -0.9) : 0;
          // Sub-bass detonation thump (45Hz with frequency sweep down to 25Hz)
          const subFreq = Math.max(25, 65 - dt * 25);
          const subBass = Math.sin(2 * Math.PI * subFreq * dt) * Math.exp(-dt * 2.2);
          // Wideband blast turbulence & debris roar
          const blastWhite = (Math.random() * 2 - 1);
          const roarEnvelope = Math.exp(-dt * 1.8);
          // Non-linear blast wave compression / distortion
          const raw = shockwave * 2.2 + subBass * 1.8 + blastWhite * roarEnvelope * 1.2;
          noise[i] = Math.tanh(raw * 1.3) * 0.96;
        }
      }
      break;
    }

    case 'gunfire': {
      // Rapid semi-automatic / sniper gunfire bursts at fixed intervals
      // E.g., shots fired at 0.25s, 0.85s, 1.65s, 2.35s
      const totalDur = length / sampleRate;
      const shotTimes = [0.25, 0.85, 1.65, 2.35, 3.10].filter((t) => t < totalDur);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        let sampleVal = (Math.random() - 0.5) * 0.03; // background floor
        for (const st of shotTimes) {
          if (t >= st && t < st + 0.45) {
            const dt = t - st;
            // Supersonic crack (sharp Dirac transient pulse < 3ms)
            const crack = dt < 0.004 ? Math.sin(2 * Math.PI * 4800 * dt) * Math.exp(-dt * 800) * 2.5 : 0;
            // Muzzle flash / barrel detonation pulse (~190Hz ringing)
            const barrel = Math.sin(2 * Math.PI * 190 * dt) * Math.exp(-dt * 22) * 1.8;
            // Acoustic environmental echo & reverberation tail
            const reverb = (Math.random() * 2 - 1) * Math.exp(-dt * 9.0) * 0.8;
            sampleVal += (crack + barrel + reverb);
          }
        }
        noise[i] = Math.tanh(sampleVal * 1.2) * 0.95;
      }
      break;
    }

    case 'plane_crash': {
      // Catastrophic aerospace crash:
      // High-frequency screaming turbine failure & airframe aerodynamic flutter (0s to 1.0s)
      // Terminal impact at t=1.0s: massive structural collision shockwave + shattering metal shearing
      // Followed by secondary fuel-air explosion & roaring wreckage fire
      const impactTime = 1.0;
      const impactSample = Math.floor(impactTime * sampleRate);
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        if (i < impactSample) {
          // Screaming turbine whine & aerodynamic buffeting
          const whineFreq = 1800 + Math.sin(2 * Math.PI * 8 * t) * 400 + (t / impactTime) * 1200;
          const turbineWhine = Math.sin(2 * Math.PI * whineFreq * t) * (0.3 + 0.6 * (t / impactTime));
          const windRush = (Math.random() * 2 - 1) * (0.2 + 0.5 * (t / impactTime));
          noise[i] = (turbineWhine + windRush) * 0.7;
        } else {
          const dt = (i - impactSample) / sampleRate;
          // Massive impact shockwave spike (< 50ms)
          const impactSpike = dt < 0.05 ? (1.0 - dt / 0.05) * (Math.random() * 2 - 1) * 2.8 : 0;
          // Metal screeching & airframe disintegration
          const metalScreech = Math.sin(2 * Math.PI * 2600 * dt * (1 + 0.5 * Math.sin(dt * 30))) * Math.exp(-dt * 3.5) * 1.2;
          // Fuel explosion deep rumble (30-60Hz)
          const explosionRumble = Math.sin(2 * Math.PI * 40 * dt) * Math.exp(-dt * 1.5) * 1.8;
          // Sustained roaring wreckage fire
          const fireRoar = (Math.random() * 2 - 1) * Math.exp(-dt * 1.2) * 1.1;
          const raw = impactSpike + metalScreech + explosionRumble + fireRoar;
          noise[i] = Math.tanh(raw * 1.3) * 0.98;
        }
      }
      break;
    }
  }

  return noise;
}

/**
 * Mix clean audio buffer with specified noise type at a target SNR (dB).
 * Produces clean, noisy, and noise-only AudioBuffers + computed metrics.
 */
export function mixAudioWithNoise(
  cleanBuffer: AudioBuffer,
  noiseType: NoiseType,
  targetSnrDb: number
): {
  cleanBuffer: AudioBuffer;
  noisyBuffer: AudioBuffer;
  noiseBuffer: AudioBuffer;
  measuredSnrDb: number;
  cleanMetrics: AudioMetrics;
  noisyMetrics: NoisyAudioMetrics;
} {
  const ctx = getAudioContext();
  const numChannels = cleanBuffer.numberOfChannels;
  const length = cleanBuffer.length;
  const sampleRate = cleanBuffer.sampleRate;

  const noisyBuffer = ctx.createBuffer(numChannels, length, sampleRate);
  const noiseBuffer = ctx.createBuffer(numChannels, length, sampleRate);

  let totalSignalPower = 0;
  let totalNoisePower = 0;
  let cleanPeak = 0;
  let noisyPeak = 0;

  for (let ch = 0; ch < numChannels; ch++) {
    const cleanData = cleanBuffer.getChannelData(ch);
    const noisyData = noisyBuffer.getChannelData(ch);
    const noiseData = noiseBuffer.getChannelData(ch);

    const signalRms = calculateRMS(cleanData);
    const rawNoise = generateNoiseSamples(noiseType, length, sampleRate);
    const rawNoiseRms = calculateRMS(rawNoise);

    // Target SNR formula:
    // SNR_dB = 20 * log10(RMS_signal / RMS_noise)
    // => RMS_target_noise = RMS_signal / (10 ^ (SNR_dB / 20))
    const targetNoiseRms = signalRms / Math.pow(10, targetSnrDb / 20);
    const noiseGain = rawNoiseRms > 1e-6 ? targetNoiseRms / rawNoiseRms : 0;

    let chSignalSq = 0;
    let chNoiseSq = 0;

    for (let i = 0; i < length; i++) {
      const n = rawNoise[i] * noiseGain;
      const s = cleanData[i];
      const mixed = s + n;

      noiseData[i] = n;
      noisyData[i] = mixed;

      chSignalSq += s * s;
      chNoiseSq += n * n;

      const absClean = Math.abs(s);
      if (absClean > cleanPeak) cleanPeak = absClean;

      const absNoisy = Math.abs(mixed);
      if (absNoisy > noisyPeak) noisyPeak = absNoisy;
    }

    totalSignalPower += chSignalSq / length;
    totalNoisePower += chNoiseSq / length;
  }

  // Prevent digital hard clipping if noisy peak exceeds 0.999
  if (noisyPeak > 0.98) {
    const headroomScale = 0.95 / noisyPeak;
    for (let ch = 0; ch < numChannels; ch++) {
      const noisyData = noisyBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        noisyData[i] *= headroomScale;
      }
    }
  }

  const avgSignalRms = Math.sqrt(totalSignalPower / numChannels);
  const avgNoiseRms = Math.sqrt(totalNoisePower / numChannels);
  const measuredSnr = avgNoiseRms > 1e-7 ? 20 * Math.log10(avgSignalRms / avgNoiseRms) : 99;

  const cleanRmsDb = amplitudeToDb(avgSignalRms);
  const cleanPeakDb = amplitudeToDb(cleanPeak);
  const noisyRmsDb = amplitudeToDb(calculateRMS(noisyBuffer.getChannelData(0)));
  const noisyPeakDb = amplitudeToDb(noisyPeak);
  const noiseRmsDb = amplitudeToDb(avgNoiseRms);

  return {
    cleanBuffer,
    noisyBuffer,
    noiseBuffer,
    measuredSnrDb: Math.round(measuredSnr * 10) / 10,
    cleanMetrics: {
      rmsDb: Math.round(cleanRmsDb * 10) / 10,
      peakDb: Math.round(cleanPeakDb * 10) / 10,
      dynamicRangeDb: Math.round(Math.abs(cleanPeakDb - cleanRmsDb) * 10) / 10,
    },
    noisyMetrics: {
      rmsDb: Math.round(noisyRmsDb * 10) / 10,
      peakDb: Math.round(noisyPeakDb * 10) / 10,
      dynamicRangeDb: Math.round(Math.abs(noisyPeakDb - noisyRmsDb) * 10) / 10,
      calculatedSnrDb: Math.round(measuredSnr * 10) / 10,
      noiseRmsDb: Math.round(noiseRmsDb * 10) / 10,
    },
  };
}

/**
 * Downsample audio channel into peak buckets for instant canvas rendering
 */
export function extractWaveformPeaks(buffer: AudioBuffer, numBuckets: number = 240): number[] {
  const channelData = buffer.getChannelData(0);
  const blockSize = Math.floor(channelData.length / numBuckets);
  const peaks: number[] = [];

  for (let i = 0; i < numBuckets; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, channelData.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      const val = Math.abs(channelData[j]);
      if (val > max) max = val;
    }
    peaks.push(Math.min(1, Math.round(max * 1000) / 1000));
  }

  return peaks;
}

/**
 * Encode an AudioBuffer to standard 16-bit PCM WAV Blob
 */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const length = buffer.length;
  const dataSize = length * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /* RIFF chunk descriptor */
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  /* FMT sub-chunk */
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  /* DATA sub-chunk */
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write 16-bit interleaved PCM samples
  let offset = 44;
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(buffer.getChannelData(ch));
  }

  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channelData[ch][i]));
      // 16-bit integer conversion
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Decode audio file or blob into AudioBuffer
 */
export async function decodeAudioBlob(blob: Blob): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  return await ctx.decodeAudioData(arrayBuffer);
}

/**
 * Synthesize rich clean test audio signals directly in client
 */
export function generateSyntheticAudio(
  type: 'speech_vowels' | 'acoustic_chords' | 'sine_sweep' | 'synth_lead',
  durationSec: number = 3.5,
  sampleRate: number = 44100
): AudioBuffer {
  const ctx = getAudioContext();
  const length = Math.floor(durationSec * sampleRate);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  switch (type) {
    case 'speech_vowels': {
      // Formant synthesis for spoken vowels sequence: /a/ (father), /i/ (see), /o/ (go), /u/ (who)
      const vowelFormants = [
        { f1: 730, f2: 1090, f3: 2440 }, // /a/
        { f1: 270, f2: 2290, f3: 3010 }, // /i/
        { f1: 570, f2: 840, f3: 2410 },  // /o/
        { f1: 300, f2: 870, f3: 2240 },  // /u/
      ];
      const pitch = 135; // base speaking pitch (Hz)

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const vowelIdx = Math.min(3, Math.floor((t / durationSec) * 4));
        const vf = vowelFormants[vowelIdx];
        // glottal pulse train
        const glottal = (Math.sin(2 * Math.PI * pitch * t) + 
                         0.6 * Math.sin(2 * Math.PI * pitch * 2 * t) + 
                         0.3 * Math.sin(2 * Math.PI * pitch * 3 * t));
        // resonant formants
        const formants = 0.5 * Math.sin(2 * Math.PI * vf.f1 * t) +
                         0.35 * Math.sin(2 * Math.PI * vf.f2 * t) +
                         0.15 * Math.sin(2 * Math.PI * vf.f3 * t);
        // natural word cadence envelope
        const cadence = Math.sin(Math.PI * ((t % (durationSec / 4)) / (durationSec / 4)));
        data[i] = glottal * formants * Math.pow(Math.max(0, cadence), 0.7) * 0.75;
      }
      break;
    }

    case 'acoustic_chords': {
      // Rich acoustic chord progression with natural string decay
      const chords = [
        [220, 277.18, 329.63, 440], // A Major
        [164.81, 246.94, 329.63, 392], // E Minor
        [174.61, 220, 261.63, 349.23], // F Major
        [196, 246.94, 293.66, 392], // G Major
      ];

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const chordIdx = Math.min(3, Math.floor((t / durationSec) * 4));
        const chord = chords[chordIdx];
        const chordT = t % (durationSec / 4);
        const decay = Math.exp(-chordT * 2.5); // exponential pluck decay

        let chordSample = 0;
        for (let k = 0; k < chord.length; k++) {
          const freq = chord[k];
          // Harmonic overtone series
          const h1 = Math.sin(2 * Math.PI * freq * t);
          const h2 = 0.5 * Math.sin(2 * Math.PI * freq * 2 * t);
          const h3 = 0.25 * Math.sin(2 * Math.PI * freq * 3 * t);
          chordSample += (h1 + h2 + h3) * decay;
        }
        data[i] = (chordSample / chord.length) * 0.7;
      }
      break;
    }

    case 'sine_sweep': {
      // 100 Hz to 7000 Hz logarithmic frequency sweep (ideal for acoustic analysis)
      const fStart = 100;
      const fEnd = 7000;
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const phase = (2 * Math.PI * fStart * durationSec / Math.log(fEnd / fStart)) * 
                      (Math.pow(fEnd / fStart, t / durationSec) - 1);
        const env = Math.sin(Math.PI * (t / durationSec));
        data[i] = Math.sin(phase) * Math.min(1, env * 2) * 0.65;
      }
      break;
    }

    case 'synth_lead': {
      // Arpeggiated synthesizer lead melody
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 523.25, 392.00, 329.63]; // C-E-G-C'-E'-C'-G-E
      const noteDuration = durationSec / notes.length;
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const noteIdx = Math.min(notes.length - 1, Math.floor(t / noteDuration));
        const freq = notes[noteIdx];
        const noteT = t % noteDuration;
        const env = Math.exp(-noteT * 3.5);
        // Sawtooth-like rich harmonics
        let saw = 0;
        for (let h = 1; h <= 6; h++) {
          saw += (1 / h) * Math.sin(2 * Math.PI * freq * h * t);
        }
        data[i] = saw * env * 0.45;
      }
      break;
    }
  }

  return buffer;
}
