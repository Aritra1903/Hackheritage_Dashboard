/**
 * IndexedDB Audio & Noise Records Database Service
 */

import { AudioNoiseRecord, NoiseType } from '../types';
import { 
  audioBufferToWav, 
  extractWaveformPeaks, 
  generateSyntheticAudio, 
  mixAudioWithNoise 
} from './audioEngine';

const DB_NAME = 'AudioNoiseDB';
const DB_VERSION = 1;
const STORE_NAME = 'records';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('noiseType', 'noiseType', { unique: false });
        store.createIndex('category', 'category', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Fetch all records from IndexedDB ordered by creation time (descending)
 */
export async function getAllRecords(): Promise<AudioNoiseRecord[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const results = (request.result as AudioNoiseRecord[]) || [];
      // Sort newest first by default
      results.sort((a, b) => b.createdAt - a.createdAt);
      resolve(results);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Save or update a record in IndexedDB
 */
export async function saveRecord(record: AudioNoiseRecord): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a record from IndexedDB by ID
 */
export async function deleteRecord(id: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all records
 */
export async function clearAllRecords(): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generate default seed dataset for the database on initial boot
 */
export async function seedInitialDatabase(): Promise<AudioNoiseRecord[]> {
  const records = await getAllRecords();
  const existingIds = new Set(records.map((r) => r.id));

  const seedConfigs: Array<{
    id: string;
    title: string;
    category: 'speech' | 'music' | 'tones' | 'ambient';
    description: string;
    tags: string[];
    synthType: 'speech_vowels' | 'acoustic_chords' | 'sine_sweep' | 'synth_lead';
    noiseType: NoiseType;
    snrDb: number;
    duration: number;
  }> = [
    {
      id: 'sample-speech-babble',
      title: 'Voice Phonemes in Crowd Babble',
      category: 'speech',
      description: 'Formant speech vowel articulation degraded by cocktail party chatter and acoustic interference.',
      tags: ['Voice', 'Formants', 'Babble Noise', 'Low SNR'],
      synthType: 'speech_vowels',
      noiseType: 'babble',
      snrDb: 3.5,
      duration: 3.5,
    },
    {
      id: 'sample-guitar-hum',
      title: 'Acoustic Harmonics with 60Hz Hum',
      category: 'music',
      description: 'Natural plucked string chord sequence with ground loop mains hum and harmonic overtone buzz.',
      tags: ['Acoustic', 'Guitar', 'Ground Hum', 'Mains 60Hz'],
      synthType: 'acoustic_chords',
      noiseType: 'hum',
      snrDb: 12.0,
      duration: 4.0,
    },
    {
      id: 'sample-speech-white',
      title: 'Speech Vowels in Heavy White Noise',
      category: 'speech',
      description: 'Human speech signals immersed in severe Gaussian white noise with negative signal-to-noise ratio.',
      tags: ['Speech', 'Gaussian', 'White Noise', 'Negative SNR'],
      synthType: 'speech_vowels',
      noiseType: 'white',
      snrDb: -2.5,
      duration: 3.2,
    },
    {
      id: 'sample-sweep-pink',
      title: '100Hz - 7kHz Sweep in Pink Noise',
      category: 'tones',
      description: 'Logarithmic frequency chirp calibration signal tested against 1/f spectral pink noise distribution.',
      tags: ['Chirp', 'Calibration', 'Pink Noise', '1/f Noise'],
      synthType: 'sine_sweep',
      noiseType: 'pink',
      snrDb: 7.5,
      duration: 3.8,
    },
    {
      id: 'sample-synth-traffic',
      title: 'Lead Arpeggio in City Traffic',
      category: 'music',
      description: 'Synthesizer harmonic melody combined with low-frequency urban traffic rumble and road wash.',
      tags: ['Synth', 'Urban', 'Traffic Noise', 'Low Frequency'],
      synthType: 'synth_lead',
      noiseType: 'traffic',
      snrDb: 5.0,
      duration: 3.6,
    },
    {
      id: 'sample-impulsive-bomb',
      title: 'Voice Distress in Bomb Blast Detonation',
      category: 'speech',
      description: 'Emergency vocal dispatch interrupted by a high-order explosive shockwave, sub-bass pressure pulse, and fireball acoustic roar.',
      tags: ['Impulsive Noise', 'Bomb Blast', 'Detonation', 'Critical Threat', 'Negative SNR'],
      synthType: 'speech_vowels',
      noiseType: 'bomb_blast',
      snrDb: -6.5,
      duration: 3.4,
    },
    {
      id: 'sample-impulsive-gunfire',
      title: 'Tactical Radio Comm in Ballistic Gunfire',
      category: 'speech',
      description: 'Operator transmission degraded by repetitive supersonic bullet cracks, high-caliber muzzle detonations, and acoustic barrel reverberation.',
      tags: ['Impulsive Noise', 'Gunfire', 'Ballistic Crack', 'Combat Audio', 'Transient Pulse'],
      synthType: 'speech_vowels',
      noiseType: 'gunfire',
      snrDb: -4.0,
      duration: 3.5,
    },
    {
      id: 'sample-impulsive-plane',
      title: 'Cockpit Audio in Plane Crash Impact',
      category: 'speech',
      description: 'Air traffic control flight telemetry experiencing screaming turbine distress, catastrophic ground impact shockwave, and secondary explosion.',
      tags: ['Impulsive Noise', 'Plane Crash', 'Structural Impact', 'Turbine Distress', 'Severe Masking'],
      synthType: 'speech_vowels',
      noiseType: 'plane_crash',
      snrDb: -8.0,
      duration: 3.8,
    },
  ];

  const missingConfigs = seedConfigs.filter((c) => !existingIds.has(c.id));
  if (missingConfigs.length === 0) {
    return records;
  }

  for (const item of missingConfigs) {
    const cleanBuffer = generateSyntheticAudio(item.synthType, item.duration);
    const mixResult = mixAudioWithNoise(cleanBuffer, item.noiseType, item.snrDb);

    const cleanBlob = audioBufferToWav(mixResult.cleanBuffer);
    const noisyBlob = audioBufferToWav(mixResult.noisyBuffer);
    const noiseBlob = audioBufferToWav(mixResult.noiseBuffer);

    const cleanPeaks = extractWaveformPeaks(mixResult.cleanBuffer, 220);
    const noisyPeaks = extractWaveformPeaks(mixResult.noisyBuffer, 220);
    const noiseOnlyPeaks = extractWaveformPeaks(mixResult.noiseBuffer, 220);

    const record: AudioNoiseRecord = {
      id: item.id,
      title: item.title,
      category: item.category,
      description: item.description,
      tags: item.tags,
      createdAt: Date.now() - (seedConfigs.indexOf(item) * 1000 * 60 * 15),
      duration: Math.round(mixResult.cleanBuffer.duration * 100) / 100,
      sampleRate: mixResult.cleanBuffer.sampleRate,
      channels: mixResult.cleanBuffer.numberOfChannels,
      noiseType: item.noiseType,
      targetSnrDb: item.snrDb,
      measuredSnrDb: mixResult.measuredSnrDb,
      noiseLevelPercent: Math.round(Math.max(5, Math.min(100, 50 - item.snrDb * 2.5))),
      cleanMetrics: mixResult.cleanMetrics,
      noisyMetrics: mixResult.noisyMetrics,
      waveformPeaks: {
        clean: cleanPeaks,
        noisy: noisyPeaks,
        noiseOnly: noiseOnlyPeaks,
      },
      sourceType: 'preset_dataset',
      cleanBlob,
      noisyBlob,
      noiseBlob,
    };

    await saveRecord(record);
  }

  return await getAllRecords();
}
