
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { generateSpeech } from '../services/geminiService';
import { VOICE_OPTIONS, decode, decodeAudioData, encodeWAV, LANGUAGE_OPTIONS } from '../constants';
import { VoiceOption, Emotion, Language } from '../types';

const SpeechGenerator: React.FC = () => {
  const [script, setScript] = useState<string>('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(VOICE_OPTIONS[0]);
  const [selectedEmotion, setSelectedEmotion] = useState<Emotion>('neutral');
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('english');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [hasApiKeySelected, setHasApiKeySelected] = useState<boolean>(false); // New state for API key status

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new window.AudioContext({ sampleRate: 24000 });
    }
    return audioContextRef.current;
  }, []);

  // Effect to clean up the object URL when component unmounts or a new audio is generated
  useEffect(() => {
    return () => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  // Check for API key on component mount
  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKeySelected(hasKey);
      } else {
        // Assume key is available if aistudio API is not present (e.g., local dev without special runtime)
        setHasApiKeySelected(true);
      }
    };
    checkApiKey();
  }, []);

  const handleSelectApiKey = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      await window.aistudio.openSelectKey();
      // As per guidelines, assume selection was successful and update state
      setHasApiKeySelected(true);
      setError(null); // Clear any previous API key related error
    } else {
      setError("API key selection not available in this environment.");
    }
  };

  const handleGenerateSpeech = async () => {
    setError(null);
    if (!hasApiKeySelected) {
      setError("An API Key must be selected before generating speech. Please click 'Select API Key'.");
      return;
    }

    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl); // Clean up previous download URL
      setDownloadUrl(null);
    }
    setLoading(true);

    // Stop any currently playing audio
    if (sourceNodeRef.current) {
      sourceNodeRef.current.stop();
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }

    try {
      const base64Audio = await generateSpeech({
        script,
        voiceOption: selectedVoice,
        emotion: selectedEmotion,
        language: selectedLanguage,
      });

      const audioBytes = decode(base64Audio);
      const audioContext = getAudioContext();
      const audioBuffer = await decodeAudioData(audioBytes, audioContext, 24000, 1);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();

      sourceNodeRef.current = source; // Keep reference to the playing source

      // Generate WAV Blob and create download URL
      const wavBlob = encodeWAV(audioBuffer);
      const url = URL.createObjectURL(wavBlob);
      setDownloadUrl(url);

    } catch (err: any) {
      console.error(err);
      let errorMessage: string;
      if (err instanceof Error) {
        errorMessage = err.message;
        // If the error specifically indicates a key issue, update the state
        if (errorMessage.includes("API key might be invalid or not selected.")) {
          setHasApiKeySelected(false); // Prompt user to select key again
        }
      } else if (typeof err === 'string') {
        errorMessage = err;
      } else {
        errorMessage = 'An unexpected error occurred during speech generation.';
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const voice = VOICE_OPTIONS.find(v => v.id === e.target.value);
    if (voice) {
      setSelectedVoice(voice);
    }
  };

  const handleEmotionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedEmotion(e.target.value as Emotion);
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedLanguage(e.target.value as Language);
  };

  return (
    <div className="bg-white shadow-lg rounded-xl p-6 md:p-10 w-full max-w-2xl mx-auto flex flex-col space-y-6">
      <h1 className="text-4xl font-extrabold text-center text-gray-900 mb-6">Pujiverse Voice Studio</h1>

      {!hasApiKeySelected && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded-lg relative text-center flex flex-col items-center space-y-3" role="alert">
          <p className="font-bold text-lg">API Key Required</p>
          <p className="text-base">Please select your Gemini API key to use the voice generation service.</p>
          <button
            onClick={handleSelectApiKey}
            className="mt-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-5 rounded-lg shadow-md transition-all duration-300"
          >
            Select API Key
          </button>
          <p className="text-sm mt-2">
            Learn more about billing for Gemini API:{" "}
            <a
              href="https://ai.google.dev/gemini-api/docs/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-yellow-800 hover:text-yellow-900"
            >
              Billing Documentation
            </a>
          </p>
        </div>
      )}

      <div className="flex flex-col space-y-4">
        <label htmlFor="script" className="text-lg font-semibold text-gray-700">Script:</label>
        <textarea
          id="script"
          className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-y min-h-[150px] text-black bg-white placeholder-gray-600"
          placeholder="Enter your script here. The model will try to speak in the selected language and emotion."
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={8}
          disabled={!hasApiKeySelected} // Disable script input if no API key
        ></textarea>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="flex flex-col space-y-2">
          <label htmlFor="voice-select" className="text-lg font-semibold text-gray-700">Select Voice:</label>
          <select
            id="voice-select"
            className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-800"
            value={selectedVoice.id}
            onChange={handleVoiceChange}
            disabled={!hasApiKeySelected}
          >
            {VOICE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-600 mt-1">{selectedVoice.description}</p>
        </div>

        <div className="flex flex-col space-y-2">
          <label htmlFor="emotion-select" className="text-lg font-semibold text-gray-700">Desired Tone/Emotion:</label>
          <select
            id="emotion-select"
            className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-800"
            value={selectedEmotion}
            onChange={handleEmotionChange}
            disabled={!hasApiKeySelected}
          >
            <option value="neutral">Neutral</option>
            <option value="cheerful">Cheerful</option>
            <option value="happy">Happy</option>
            <option value="sad">Sad</option>
            <option value="angry">Angry</option>
            <option value="calm">Calm</option>
            <option value="excited">Excited</option>
          </select>
          <p className="text-sm text-gray-600 mt-1">
            Specify the overall emotional tone for the voice-over.
          </p>
        </div>

        <div className="flex flex-col space-y-2">
          <label htmlFor="language-select" className="text-lg font-semibold text-gray-700">Select Language:</label>
          <select
            id="language-select"
            className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-800"
            value={selectedLanguage}
            onChange={handleLanguageChange}
            disabled={!hasApiKeySelected}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-sm text-gray-600 mt-1">
            Select the target language for the voice-over (e.g., Telugu, Hindi).
          </p>
        </div>
      </div>

      <button
        onClick={handleGenerateSpeech}
        className={`w-full py-4 px-6 rounded-lg text-xl font-bold transition-all duration-300
          ${loading || !script.trim() || !hasApiKeySelected
            ? 'bg-blue-300 cursor-not-allowed animate-pulse'
            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg'
          }`}
        disabled={loading || !script.trim() || !hasApiKeySelected}
      >
        {loading ? 'Generating Speech...' : 'Generate Voice-over'}
      </button>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg relative text-center" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {downloadUrl && (
        <div className="flex justify-center mt-4">
          <a
            href={downloadUrl}
            download={`gemini-voiceover-${Date.now()}.wav`}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-md hover:shadow-lg transition-all duration-300 flex items-center space-x-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Download Voice-over (.wav)</span>
          </a>
        </div>
      )}
    </div>
  );
};

export default SpeechGenerator;
