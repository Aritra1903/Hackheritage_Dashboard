/**
 * Firebase Realtime Database Service
 * VĀKSETU: AI-powered Active Acoustic Noise Cancellation and Analysis System
 *
 * Listens to real-time ML acoustic prediction feed at path:
 * 'anc_system/current_prediction'
 *
 * Uses Firebase Modular SDK v9/v10/v11 onValue() listener.
 * No firebase-key.json is used in the frontend.
 */

import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getDatabase, 
  ref, 
  onValue, 
  Database, 
  DatabaseReference,
  Unsubscribe 
} from 'firebase/database';

/**
 * Expected schema for the real-time ML prediction broadcast
 */
export interface MLPredictionData {
  noise_type?: string;
  confidence?: number;
  decibels?: number;
  snr_db?: number;
  anc_attenuation_db?: number;
  phase_inversion_active?: boolean;
  phase_angle_deg?: number;
  anti_noise_frequency_hz?: number;
  residual_noise_db?: number;
  spectral_bands?: number[];
  timestamp?: number | string;
  status?: string;
  [key: string]: any;
}

export type MLPredictionCallback = (prediction: MLPredictionData | null) => void;

/**
 * Firebase client configuration from Vite environment variables
 * with safe fallbacks when variables are yet to be configured.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAgUo7lxhG9bC4T4NcDJ1_3FDie5ACUajE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "newproject-98ee4.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://newproject-98ee4-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "newproject-98ee4",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "newproject-98ee4.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "299779096755",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:299779096755:web:f8ce5ba7764fa4908a30c6"
};

/** Target path for live ML prediction payload */
export const RTDB_PREDICTION_PATH = 'anc_system/current_prediction';

let firebaseAppInstance: FirebaseApp | null = null;
let firebaseDbInstance: Database | null = null;

/**
 * Lazily initialize and retrieve the Firebase App instance.
 */
export function getFirebaseApp(): FirebaseApp {
  if (!firebaseAppInstance) {
    if (getApps().length > 0) {
      firebaseAppInstance = getApp();
    } else {
      firebaseAppInstance = initializeApp(firebaseConfig);
    }
  }
  return firebaseAppInstance;
}

/**
 * Lazily initialize and retrieve the Firebase Realtime Database instance.
 */
export function getFirebaseDatabase(): Database {
  if (!firebaseDbInstance) {
    const app = getFirebaseApp();
    firebaseDbInstance = firebaseConfig.databaseURL 
      ? getDatabase(app, firebaseConfig.databaseURL) 
      : getDatabase(app);
  }
  return firebaseDbInstance;
}

/**
 * Returns the database reference to 'anc_system/current_prediction'
 */
export function getMLPredictionRef(): DatabaseReference {
  const db = getFirebaseDatabase();
  return ref(db, RTDB_PREDICTION_PATH);
}

/**
 * Listen to real-time ML prediction updates from Firebase Realtime Database.
 * Path: anc_system/current_prediction
 *
 * Uses Firebase onValue() to stream live prediction data to the callback.
 * Returns an unsubscribe cleanup function.
 *
 * @param callback - Function invoked whenever new prediction data arrives
 * @param onError - Optional callback invoked if database read error occurs
 * @returns Unsubscribe function to terminate listener
 *
 * Example usage:
 * ```ts
 * useEffect(() => {
 *   const unsubscribe = listenToMLPrediction((prediction) => {
 *     console.log('Live ML Prediction:', prediction);
 *   });
 *   return () => unsubscribe();
 * }, []);
 * ```
 */
export function listenToMLPrediction(
  callback: MLPredictionCallback,
  onError?: (error: Error) => void
): Unsubscribe {
  try {
    const predictionRef = getMLPredictionRef();
    
    // onValue subscribes to data changes at the specified database reference
    const unsubscribe = onValue(
      predictionRef,
      (snapshot) => {
        const data = snapshot.exists() ? (snapshot.val() as MLPredictionData) : null;
        callback(data);
      },
      (error) => {
        console.error(`[VĀKSETU Firebase] Error reading from ${RTDB_PREDICTION_PATH}:`, error);
        if (onError) {
          onError(error);
        }
      }
    );

    return unsubscribe;
  } catch (err) {
    console.error(`[VĀKSETU Firebase] Failed to attach listener to ${RTDB_PREDICTION_PATH}:`, err);
    if (onError && err instanceof Error) {
      onError(err);
    }
    return () => {
      // No-op fallback unsubscribe
    };
  }
}
