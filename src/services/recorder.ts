// recorder.ts - Recording logic encapsulation

import type { SelectedArea, AudioOptions } from '../types';

// Recording configuration constants
const RECORDER_CONFIG = {
  TIMESLICE: 100,                    // Collect data every 100ms
  VIDEO_BITRATE: 2500000,            // 2.5 Mbps
  CANVAS_FPS: 30,                    // Canvas capture frame rate
} as const;

// Supported MIME types in order of preference
const MIME_TYPES = {
  WEBM_VP9_OPUS: 'video/webm;codecs=vp9,opus',
  WEBM_VP8_OPUS: 'video/webm;codecs=vp8,opus',
  WEBM_VP9: 'video/webm;codecs=vp9',
  WEBM: 'video/webm',
} as const;

export class ScreenRecorder {
  // State
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isRecording: boolean = false;
  private isPaused: boolean = false;
  
  // Resources
  private stream: MediaStream | null = null;
  private micStream: MediaStream | null = null;
  private recordingStream: MediaStream | null = null;
  private transformStreamController: AbortController | null = null;
  
  // Configuration
  
  // Callbacks
  private onStopCallback?: () => void;

  // ============================================================================
  // Public API
  // ============================================================================

  async startRecording(
    stream: MediaStream,
    area: SelectedArea | null = null,
    audioOptions: AudioOptions = { tabAudio: true, microphone: false},
    onStop?: () => void
  ): Promise<number> { // Return detected FPS instead of boolean
    // Initialize recording state
    this.stream = stream;
    this.recordedChunks = [];
    this.isRecording = true;
    this.isPaused = false;
    this.onStopCallback = onStop;

    try {
      this.recordingStream = await this.prepareRecordingStream(stream, area, audioOptions);
      const mimeType = this.selectMimeType();
      this.createMediaRecorder(this.recordingStream, mimeType);
      
      this.mediaRecorder!.start(RECORDER_CONFIG.TIMESLICE);
      
      // Try to get actual framerate from video track settings
      const videoTrack = this.recordingStream.getVideoTracks()[0];
      const settings = videoTrack?.getSettings();
      // Chrome often reports 'frameRate' in settings
      const streamFps = settings?.frameRate;
      
      return streamFps || 30; // Return detected FPS or default 30
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.isRecording = false;
      throw error;
    }
  }

  stopRecording(): void {
    if (!this.mediaRecorder || !this.isRecording) {
      return;
    }
    
    // Request final data before stopping
    if (this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.requestData();
    }
    
    // Trigger stop - onStopCallback will be called in handleMediaRecorderStop
    this.mediaRecorder.stop();
    this.isRecording = false;
    this.isPaused = false;
  }

  pauseRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
      this.isPaused = true;
    }
  }

  resumeRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
      this.isPaused = false;
    }
  }

  getPausedState(): boolean {
    return this.isPaused;
  }

  async getBlob(): Promise<Blob> {
    // Validate recorded data
    if (this.recordedChunks.length === 0) {
      throw new Error('No recorded data');
    }

    const totalSize = this.recordedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
    if (totalSize === 0) {
      throw new Error('Recorded data is empty');
    }
    
    // Create blob
    const mimeType = this.mediaRecorder?.mimeType || MIME_TYPES.WEBM;
    const blob = new Blob(this.recordedChunks, { type: mimeType });
    
    // Stop stream tracks
    this.stopStreamTracks();
    
    return blob;
  }

  cleanup(): void {
    // Cleanup streams
    this.cleanupStreams();
    
    // Cleanup WebCodecs controller
    if (this.transformStreamController) {
      this.transformStreamController.abort();
      this.transformStreamController = null;
    }
    
    // Reset state
    this.recordedChunks = [];
    this.mediaRecorder = null;
    this.isRecording = false;
    this.isPaused = false;
  }

  getRecordingState(): boolean {
    return this.isRecording;
  }

  getFilename(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `screengo-${timestamp}.webm`;
  }

  // ============================================================================
  // Stream Preparation
  // ============================================================================

  private async prepareRecordingStream(
    stream: MediaStream,
    area: SelectedArea | null,
    audioOptions: AudioOptions
  ): Promise<MediaStream> {
    let recordingStream = await this.processAudioTracks(stream, audioOptions);
    
    if (area) {
      recordingStream = this.cropStream(recordingStream, area);
    }
    
    // Verify video tracks
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) {
      throw new Error('No video tracks available in recording stream');
    }
    
    // Setup track listeners for system stop (browser's stop button)
    videoTracks.forEach(track => {
      track.addEventListener('ended', () => {
        // If still recording, it means browser stopped (not manual stop)
        // Manual stop sets isRecording to false before tracks end
        if (this.isRecording && this.mediaRecorder?.state === 'recording') {
          
          // Trigger stop process - callback will be called in handleMediaRecorderStop
          this.stopRecording();
        }
      });
    });
    
    return recordingStream;
  }

  // ============================================================================
  // MIME Type Selection
  // ============================================================================

  private selectMimeType(): string {
    return this.selectWebmMimeType();
  }

  private selectWebmMimeType(): string {
    const types = [
      MIME_TYPES.WEBM_VP9_OPUS,
      MIME_TYPES.WEBM_VP8_OPUS,
      MIME_TYPES.WEBM_VP9,
      MIME_TYPES.WEBM,
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    console.warn('No supported WebM codec found, using default');
    return '';
  }

  // ============================================================================
  // MediaRecorder Setup
  // ============================================================================

  private createMediaRecorder(stream: MediaStream, mimeType: string): void {
    const options: MediaRecorderOptions = {
      mimeType: mimeType || undefined,
      videoBitsPerSecond: RECORDER_CONFIG.VIDEO_BITRATE
    };

    this.mediaRecorder = new MediaRecorder(stream, options);

    // Attach event handlers
    this.mediaRecorder.ondataavailable = (event) => this.handleMediaRecorderDataAvailable(event);
    this.mediaRecorder.onstop = () => this.handleMediaRecorderStop();
    this.mediaRecorder.onerror = (event) => this.handleMediaRecorderError(event);
    this.mediaRecorder.onstart = () => this.handleMediaRecorderStart();
  }

  // ============================================================================
  // MediaRecorder Event Handlers
  // ============================================================================

  private handleMediaRecorderDataAvailable(event: BlobEvent): void {
    if (event.data && event.data.size > 0) {
      this.recordedChunks.push(event.data);
    }
  }

  private handleMediaRecorderStop(): void {
    // Call onStop callback for both manual and system stop
    // No delay needed - all chunks are already collected when onstop fires
    if (this.onStopCallback) {
      this.onStopCallback();
    }
  }

  private handleMediaRecorderError(event: Event): void {
    console.error('MediaRecorder error:', event);
    this.isRecording = false;
  }

  private handleMediaRecorderStart(): void {
    // Recording started
  }

  // ============================================================================
  // Blob Management
  // ============================================================================

  private stopStreamTracks(): void {
    if (!this.stream) return;
    
    this.stream.getTracks().forEach(track => {
      if (track.readyState === 'live') {
        track.stop();
      }
    });
  }

  // ============================================================================
  // Audio Processing
  // ============================================================================

  private async processAudioTracks(
    stream: MediaStream,
    audioOptions: AudioOptions
  ): Promise<MediaStream> {
    const newStream = new MediaStream();
    
    // Add video tracks
    stream.getVideoTracks().forEach(track => newStream.addTrack(track));
    
    // Handle tab audio
    if (audioOptions.tabAudio) {
      stream.getAudioTracks().forEach(track => newStream.addTrack(track));
    } else {
      stream.getAudioTracks().forEach(track => track.stop());
    }
    
    // Handle microphone
    if (audioOptions.microphone) {
      await this.addMicrophoneTrack(newStream);
    }
    
    return newStream;
  }

  private async addMicrophoneTrack(stream: MediaStream): Promise<void> {
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      this.micStream.getAudioTracks().forEach(track => stream.addTrack(track));
    } catch (error) {
      console.warn('Failed to get microphone access:', error);
    }
  }

  // ============================================================================
  // Area Cropping
  // ============================================================================

  private cropStream(stream: MediaStream, area: SelectedArea): MediaStream {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      throw new Error('No video track found for cropping');
    }

    // @ts-ignore - WebCodecs types might be missing
    const processor = new MediaStreamTrackProcessor({ track: videoTrack });
    // @ts-ignore - WebCodecs types might be missing
    const generator = new MediaStreamTrackGenerator({ kind: 'video' });

    const { width, height, x, y } = area;
    // Ensure dimensions are even for codec compatibility
    const targetWidth = Math.floor(width / 2) * 2;
    const targetHeight = Math.floor(height / 2) * 2;

    // Create OffscreenCanvas for cropping
    const offscreen = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = offscreen.getContext('2d', { 
      alpha: false,
      desynchronized: true 
    }) as OffscreenCanvasRenderingContext2D;

    if (!ctx) {
      throw new Error('Failed to create OffscreenCanvas context');
    }

    this.transformStreamController = new AbortController();
    const signal = this.transformStreamController.signal;

    const transformer = new TransformStream({
      transform: async (frame: VideoFrame, controller) => {
        if (signal.aborted) {
          frame.close();
          return;
        }

        try {
          // Calculate scaling factors based on current frame size vs viewport
          // Assuming area coordinates are based on the initial viewport size
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          
          const scaleX = frame.displayWidth / viewportWidth;
          const scaleY = frame.displayHeight / viewportHeight;

          const sx = x * scaleX;
          const sy = y * scaleY;
          const sw = width * scaleX;
          const sh = height * scaleY;

          // Draw cropped area to offscreen canvas
          ctx.drawImage(frame, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

          // Create new VideoFrame from canvas
          // @ts-ignore - VideoFrame constructor types
          const newFrame = new VideoFrame(offscreen, {
            timestamp: frame.timestamp,
            duration: frame.duration ?? undefined
          });

          controller.enqueue(newFrame);
        } catch (err) {
          console.error('Error transforming frame:', err);
        } finally {
          frame.close();
        }
      }
    });

    // Pipe the stream
    processor.readable
      .pipeThrough(transformer, { signal })
      .pipeTo(generator.writable, { signal })
      .catch((e: any) => {
        if (!signal.aborted) {
          console.error('Stream pipeline error:', e);
        }
      });

    // Create new stream with the generated video track and original audio tracks
    const newStream = new MediaStream([generator]);
    stream.getAudioTracks().forEach(track => newStream.addTrack(track));

    return newStream;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  private cleanupStreams(): void {
    const streams = [
      { stream: this.stream, name: 'main' },
      { stream: this.micStream, name: 'mic' },
      { stream: this.recordingStream, name: 'recording' }
    ];
    
    streams.forEach(({ stream }) => {
      if (stream) {
        stream.getTracks().forEach(track => {
          if (track.readyState === 'live') {
            track.stop();
          }
        });
      }
    });
    
    this.stream = null;
    this.micStream = null;
    this.recordingStream = null;
  }
}
