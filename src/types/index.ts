// Type definitions

export interface SelectedArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AudioOptions {
  systemAudio: boolean;
  microphone: boolean;
}

export type RecordingFormat = 'webm' | 'mp4';

export interface RecordingState {
  isRecording: boolean;
  selectedArea: SelectedArea | null;
  format: RecordingFormat;
  audioOptions: AudioOptions;
}

export interface I18nMessage {
  message: string;
  description?: string;
}

export interface I18nMessages {
  [key: string]: I18nMessage;
}

