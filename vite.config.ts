import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

function aiAnalysisPlugin() {
  return {
    name: 'ai-analysis-api',
    configureServer(server: any) {
      server.middlewares.use('/api/ai-analysis', async (req: any, res: any) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }

        let body = '';
        req.on('data', (chunk: any) => {
          body += chunk;
        });
        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const { analysis, audioTitle } = data;

            const apiKey = process.env.GEMINI_API_KEY;
            if (apiKey) {
              const { GoogleGenAI } = await import('@google/genai');
              const ai = new GoogleGenAI({ apiKey });
              const prompt = `You are a military-grade acoustic signal processing AI. Analyze this real-time audio telemetry report:
Audio Title: "${audioTitle || 'Input Stream'}"
Noise Category: ${analysis?.noiseType}
Current SNR: ${analysis?.currentSnrDb} dB (Previous SNR: ${analysis?.previousSnrDb} dB, Delta: ${analysis?.snrDeltaDb} dB)
Trend: ${analysis?.trend}
Noise Level: ${analysis?.noiseLevelDb} dBFS (${analysis?.noiseLevelPercent}%)
Speech Probability: ${analysis?.speechProbabilityPercent}%
Active Noise Cancellation (ANC): ${analysis?.ancReductionDb} dB
Residual Noise: ${analysis?.residualNoiseDb} dBFS
DSP Latency: ${analysis?.processingLatencyMs} ms
Impulsive Event: ${analysis?.isImpulsive ? `YES (${analysis?.impulsiveType})` : 'NO'}

Generate a concise 3-paragraph tactical acoustic intelligence dossier covering:
1. Spectral degradation assessment & threat classification
2. Speech intelligibility impact and voice formant preservation
3. Recommended DSP mitigation (e.g. adaptive notch filtering, lookahead limiter, spectral subtraction, or AGC).`;

              const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
              });

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ report: response.text }));
              return;
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                report:
                  analysis?.aiSummary ||
                  'Acoustic intelligence report processed via real-time DSP mathematical modeling.',
              })
            );
          } catch (e: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: e?.message || 'AI processing error' }));
          }
        });
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), aiAnalysisPlugin()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'lucide-react', 'firebase/app', 'firebase/database'],
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
