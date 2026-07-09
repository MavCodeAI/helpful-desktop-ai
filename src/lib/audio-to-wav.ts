/**
 * Decode any browser-produced audio Blob (WebM/Opus, MP4/AAC, OGG, …) and
 * re-encode it as a 16 kHz mono 16-bit PCM WAV. Used as a fallback when the
 * upstream STT rejects the original container (HTTP 415 "Unsupported audio
 * format") — WAV is universally decodable and sidesteps codec mismatches.
 */
export async function transcodeToWav(blob: Blob): Promise<Blob> {
  const arrayBuf = await blob.arrayBuffer();
  // Some browsers (Safari) require webkitAudioContext; fall back if needed.
  const Ctx: typeof AudioContext =
    (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuf.slice(0));
    // Downmix to mono + downsample to 16 kHz — plenty for speech recognition
    // and keeps the upload small.
    const targetRate = 16000;
    const mono = downmixToMono(decoded);
    const resampled = await resample(mono, decoded.sampleRate, targetRate);
    return encodeWav(resampled, targetRate);
  } finally {
    void ctx.close();
  }
}

function downmixToMono(buf: AudioBuffer): Float32Array {
  if (buf.numberOfChannels === 1) return buf.getChannelData(0);
  const len = buf.length;
  const out = new Float32Array(len);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) out[i] += data[i];
  }
  const inv = 1 / buf.numberOfChannels;
  for (let i = 0; i < len; i++) out[i] *= inv;
  return out;
}

async function resample(samples: Float32Array, fromRate: number, toRate: number): Promise<Float32Array> {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const outLen = Math.floor(samples.length / ratio);
  const out = new Float32Array(outLen);
  // Linear interpolation is fine for speech at 16 kHz.
  for (let i = 0; i < outLen; i++) {
    const idx = i * ratio;
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, samples.length - 1);
    const frac = idx - i0;
    out[i] = samples[i0] * (1 - frac) + samples[i1] * frac;
  }
  return out;
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample; // mono
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let p = 0;
  const writeStr = (s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(p++, s.charCodeAt(i)); };
  const writeU32 = (v: number) => { view.setUint32(p, v, true); p += 4; };
  const writeU16 = (v: number) => { view.setUint16(p, v, true); p += 2; };

  writeStr("RIFF");
  writeU32(36 + dataSize);
  writeStr("WAVE");
  writeStr("fmt ");
  writeU32(16);           // PCM chunk size
  writeU16(1);            // PCM format
  writeU16(1);            // mono
  writeU32(sampleRate);
  writeU32(byteRate);
  writeU16(blockAlign);
  writeU16(16);           // bits per sample
  writeStr("data");
  writeU32(dataSize);

  // Clamp + convert Float32 [-1,1] → Int16 PCM.
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    p += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
}
