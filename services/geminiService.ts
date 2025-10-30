import { GoogleGenAI, Modality } from "@google/genai";
import { GEMINI_TTS_MODEL } from '../constants';
import { VoiceOption, Emotion, Language } from '../types';

interface GenerateSpeechParams {
  script: string;
  voiceOption: VoiceOption;
  emotion: Emotion;
  language: Language;
}

export async function generateSpeech(params: GenerateSpeechParams): Promise<string> {
  // CRITICAL: Create GoogleGenAI instance right before API call
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const { script, voiceOption, emotion, language } = params;

  // The gemini-2.5-flash-preview-tts model primarily relies on the input script
  // and the voiceName for language and emotional nuance.
  // Using `systemInstruction` for these parameters for a TTS model can lead to internal API errors.
  // We remove it to ensure the API call succeeds. The model will generate speech
  // for the provided script in the language it detects, using the characteristics
  // of the selected voice.
  // let systemInstruction = `You are generating speech. The user wants the audio in ${language}.`;
  // if (emotion && emotion !== 'neutral') {
  //   systemInstruction += ` Deliver the speech with a ${emotion} tone.`;
  // } else {
  //   systemInstruction += ` Deliver the speech in a natural tone.`;
  // }

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_TTS_MODEL,
      contents: [{ parts: [{ text: script }] }],
      config: {
        // systemInstruction: systemInstruction, // Removed as it causes INTERNAL errors for TTS model
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceOption.voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (!base64Audio) {
      throw new Error("No audio data received from the API.");
    }

    return base64Audio;
  } catch (error: any) {
    if (error instanceof Error && error.message.includes("Requested entity was not found.")) {
      console.error("API Key error: Requested entity was not found. Prompting user to select key.");
      // Assume window.aistudio.openSelectKey() is available in this environment for Veo models.
      // Although not strictly necessary for TTS, it's good practice to handle.
      if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
        await window.aistudio.openSelectKey();
        throw new Error("API key might be invalid or not selected. Please try again after selecting a key.");
      }
    }
    console.error("Error generating speech:", error);
    throw new Error(`Failed to generate speech: ${error.message || 'Unknown error'}`);
  }
}