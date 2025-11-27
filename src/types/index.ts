// Type definitions

export interface Position {
  left: number;
  top: number;
}

export interface SelectedArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AudioOptions {
  tabAudio: boolean;
  microphone: boolean;
}

export interface I18nMessage {
  message: string;
  description?: string;
}

export interface I18nMessages {
  [key: string]: I18nMessage;
}
