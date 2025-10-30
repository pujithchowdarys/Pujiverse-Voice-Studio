
import { VoiceOption, Language } from './types';

export const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';

// Note: These voice descriptions are based on general perception and might not be officially tagged.
// The actual emotional nuance and language fidelity depend on the input text, selected language, and model's interpretation.
export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: 'kore-cheerful-adult-female',
    label: 'Kore (Cheerful Female, Adult)',
    voiceName: 'Kore',
    description: 'A friendly and cheerful female voice, adaptable for various languages and tones.',
  },
  {
    id: 'puck-calm-adult-male',
    label: 'Puck (Calm Male, Adult/Elderly)',
    voiceName: 'Puck',
    description: 'A calm and steady male voice, suitable for narration or serious tones across languages.',
  },
  {
    id: 'charon-authoritative-adult-male',
    label: 'Charon (Authoritative Male, Adult)',
    voiceName: 'Charon',
    description: 'An authoritative and clear male voice, suitable for instructional content in different languages.',
  },
  {
    id: 'zephyr-pleasant-adult-female',
    label: 'Zephyr (Pleasant Female, Adult)',
    voiceName: 'Zephyr',
    description: 'A clear and pleasant female voice, versatile for various applications and languages.',
  },
  {
    id: 'fenrir-strong-adult-male',
    label: 'Fenrir (Strong Male, Adult)',
    voiceName: 'Fenrir',
    description: 'A powerful and impactful male voice, good for dramatic readings across languages.',
  },
  // Voice models are primarily adult voices; "kid-like" is an interpretative tone based on prompt and emotion.
  {
    id: 'kore-friendly-young-female',
    label: 'Kore (Friendly Female, Young/Kid-like tone)',
    voiceName: 'Kore',
    description: 'A friendly female voice, can be guided to adopt a younger, more energetic tone.',
  },
];

export const LANGUAGE_OPTIONS: { id: Language, label: string }[] = [
  { id: 'english', label: 'English' },
  { id: 'telugu', label: 'Telugu' },
  { id: 'hindi', label: 'Hindi' },
  { id: 'tamil', label: 'Tamil' },
];

// Helper functions for audio decoding/encoding as provided in guidelines
export function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Converts an AudioBuffer to a WAV Blob.
 * @param audioBuffer The AudioBuffer containing the audio data.
 * @returns A Blob representing the WAV file.
 */
export function encodeWAV(audioBuffer: AudioBuffer): Blob {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bitsPerSample = 16; // The decodeAudioData function uses Int16Array, so 16 bits per sample.

  let interleaved: Float32Array;
  if (numChannels === 2) {
    const L = audioBuffer.getChannelData(0);
    const R = audioBuffer.getChannelData(1);
    interleaved = new Float32Array(L.length + R.length);
    for (let i = 0; i < L.length; i++) {
      interleaved[2 * i] = L[i];
      interleaved[2 * i + 1] = R[i];
    }
  } else {
    interleaved = audioBuffer.getChannelData(0);
  }

  const dataLength = interleaved.length * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  let offset = 0;

  // RIFF chunk descriptor
  writeString(view, offset, 'RIFF'); offset += 4;
  view.setUint32(offset, 36 + dataLength, true); offset += 4;
  writeString(view, offset, 'WAVE'); offset += 4;

  // FMT sub-chunk
  writeString(view, offset, 'fmt '); offset += 4;
  view.setUint32(offset, 16, true); offset += 4; // Subchunk1Size for PCM
  view.setUint16(offset, 1, true); offset += 2; // AudioFormat (PCM = 1)
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * numChannels * (bitsPerSample / 8), true); offset += 4; // ByteRate
  view.setUint16(offset, numChannels * (bitsPerSample / 8), true); offset += 2; // BlockAlign
  view.setUint16(offset, bitsPerSample, true); offset += 2;

  // Data sub-chunk
  writeString(view, offset, 'data'); offset += 4;
  view.setUint32(offset, dataLength, true); offset += 4;

  // Write the actual audio data
  floatTo16BitPCM(view, offset, interleaved);

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) {
    view.setUint8(offset + i, s.charCodeAt(i));
  }
}

function floatTo16BitPCM(view: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}
