

export interface VoiceOption {
  id: string;
  label: string;
  voiceName: string;
  description: string;
}

export type Emotion = 'neutral' | 'happy' | 'sad' | 'angry' | 'cheerful' | 'calm' | 'excited';
export type Language = 'english' | 'telugu' | 'hindi' | 'tamil';