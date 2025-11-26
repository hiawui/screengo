// useRecorder.ts - Recording functionality Hook

import { useState, useRef, useCallback, useEffect } from 'react';
import { ScreenRecorder } from '../services/recorder';
import type { SelectedArea, AudioOptions } from '../types';

export function useRecorder() {
  const [selectedArea, setSelectedArea] = useState<SelectedArea | null>(null);
  const recorderRef = useRef<ScreenRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pauseStartTimeRef = useRef<number | null>(null);
  const totalPausedTimeRef = useRef<number>(0);
  const detectedFpsRef = useRef<number>(30);
  
  // Read recording state from recorder instance (don't update it)
  // Use a state to trigger re-renders when recording state changes
  const [recordingState, setRecordingState] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  // Periodically read recording state from recorder instance
  useEffect(() => {
    const interval = setInterval(() => {
      const currentState = recorderRef.current?.getRecordingState() ?? false;
      const currentPaused = recorderRef.current?.getPausedState() ?? false;

      setRecordingState(prevState => {
        // Only update if state changed to avoid unnecessary re-renders
        if (prevState !== currentState) {
          return currentState;
        }
        return prevState;
      });

      setIsPaused(prevPaused => {
        if (prevPaused !== currentPaused) {
          return currentPaused;
        }
        return prevPaused;
      });

      if (currentState) {
        if (currentPaused) {
          if (!pauseStartTimeRef.current) {
            pauseStartTimeRef.current = Date.now();
          }
        } else {
          if (pauseStartTimeRef.current) {
            totalPausedTimeRef.current += (Date.now() - pauseStartTimeRef.current);
            pauseStartTimeRef.current = null;
          }

          if (startTimeRef.current) {
            const totalElapsed = Date.now() - startTimeRef.current;
            const duration = Math.floor((totalElapsed - totalPausedTimeRef.current) / 1000);
            setRecordingDuration(duration);
          }
        }
      } else {
        pauseStartTimeRef.current = null;
        totalPausedTimeRef.current = 0;
      }
    }, 100); // Check every 100ms
    
    return () => clearInterval(interval);
  }, []);
  
  const isRecording = recordingState;

  const handleRecordingStop = useCallback(async () => {
    if (!recorderRef.current) return;
    
    try {
      console.log('Handling recording stop (callback from recorder)...');
      
      // stopRecording has already been called and completed
      // All chunks have been collected, safe to get blob
      console.log('Getting blob...');
      const blob = await recorderRef.current.getBlob();
      console.log('Blob received:', { size: blob.size, type: blob.type });
      
      const filename = recorderRef.current.getFilename();
      
      // FPS detection logic moved inside recorder.ts but we need it here to pass to preview page.
      // We can get it from recorder instance if we expose it or change getBlob/stopRecording flow.
      // Actually, getBlob just returns blob. 
      // But we modified startRecording to return FPS. Let's use a ref to store detected FPS.
      
      // We will use the fpsRef value which should have been set during startRecording
      const fps = detectedFpsRef.current || 30;
      
      console.log('Using detected/default FPS:', fps);
      await openPreviewPage(blob, filename, fps);
      
      recorderRef.current.cleanup();
      recorderRef.current = null;
      
      // streamRef tracks are already stopped in getBlob(), no need to stop again
      if (streamRef.current) {
        streamRef.current = null;
      }
      
      startTimeRef.current = null;
      pauseStartTimeRef.current = null;
      totalPausedTimeRef.current = 0;
      setRecordingDuration(0);
      setCountdown(0);
    } catch (error) {
      console.error('Error handling recording stop:', error);
      // Cleanup even if save fails
      if (recorderRef.current) {
        recorderRef.current.cleanup();
        recorderRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current = null;
      }
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (recorderRef.current) {
      console.log('Manually stopping recording...');
      // Just call stopRecording, handleRecordingStop will be called by onStop callback
      recorderRef.current.stopRecording();
    }
  }, []);

  const pauseRecording = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.pauseRecording();
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (recorderRef.current) {
      recorderRef.current.resumeRecording();
    }
  }, []);

  const startRecording = useCallback(async (
    area: SelectedArea | null,
    audioOptions: AudioOptions
  ) => {
    try {
      // Get screen stream
      const stream = await getScreenStream(['currentTab']);
      if (!stream) {
        throw new Error('Failed to get screen stream');
      }

      // Start countdown
      for (let i = 3; i > 0; i--) {
        setCountdown(i);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      setCountdown(0.1);
      await new Promise(resolve => setTimeout(resolve, 100));

      streamRef.current = stream;
      
      if (!recorderRef.current) {
        recorderRef.current = new ScreenRecorder();
      }

      const fps = await recorderRef.current.startRecording(
        stream, 
        area, 
        audioOptions,
        // Unified onStop callback for both manual and system stop
        handleRecordingStop
      );
      
      if (typeof fps === 'number') {
        detectedFpsRef.current = fps;
        console.log('Set detected FPS:', fps);
      }

      startTimeRef.current = Date.now();
      pauseStartTimeRef.current = null;
      totalPausedTimeRef.current = 0;
      setRecordingDuration(0);
      
      // State will be automatically read by the interval in useEffect
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }, [handleRecordingStop]);

  return {
    isRecording,
    isPaused,
    countdown,
    selectedArea,
    setSelectedArea,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    recordingDuration
  };
}

// 1. 声明自定义接口，继承标准的 DisplayMediaStreamOptions
interface ChromeDisplayMediaOptions extends DisplayMediaStreamOptions {
  // 显式定义这两个非标准属性的类型
  selfBrowserSurface?: 'include' | 'exclude';
  preferCurrentTab?: boolean;
}

async function getScreenStream(sources: string[] = ['screen', 'window', 'tab']): Promise<MediaStream | null> {
  // If sources only contains 'currentTab', use getDisplayMedia API directly
  if (sources.length === 1 && sources[0] === 'currentTab') {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error('getDisplayMedia is not supported');
      }
      
      const options: ChromeDisplayMediaOptions = {
        video: {
          displaySurface: 'browser',
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
        selfBrowserSurface: 'include',
        preferCurrentTab: true,
      }
      const stream = await navigator.mediaDevices.getDisplayMedia(options);

      // Verify stream has active tracks
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      
      console.log('Stream obtained:', {
        videoTracks: videoTracks.length,
        audioTracks: audioTracks.length,
        videoState: videoTracks[0]?.readyState,
        videoSettings: videoTracks[0]?.getSettings()
      });

      // Ensure at least one video track is available
      if (videoTracks.length === 0) {
        throw new Error('No video track available in stream');
      }

      // Listen for track ended events
      videoTracks.forEach(track => {
        track.addEventListener('ended', () => {
          console.log('Video track ended by user or system');
        });
      });

      return stream;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to get display media');
    }
  }
  
  // Otherwise, use the Chrome extension API through background script
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { 
        action: 'getScreenStream',
        sources: sources
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (!response || !response.success) {
          reject(new Error(response?.error || 'Failed to get stream'));
          return;
        }

        // Use streamId to get MediaStream
        const constraints: any = {
          audio: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: response.streamId
            }
          },
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: response.streamId
            }
          }
        };

        // Chrome extensions need to use legacy getUserMedia API
        const nav = navigator as any;
        if (nav.getUserMedia) {
          nav.getUserMedia(constraints, resolve, reject);
        } else if (nav.webkitGetUserMedia) {
          nav.webkitGetUserMedia(constraints, resolve, reject);
        } else {
          reject(new Error('getUserMedia is not supported'));
        }
      }
    );
  });
}

async function openPreviewPage(blob: Blob, filename: string, fps?: number): Promise<void> {
  console.log(`Starting to open preview for: ${filename}, type: ${blob.type}, size: ${blob.size}, fps: ${fps}`);
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onloadend = () => {
      try {
        console.log('FileReader finished reading', {
          resultType: typeof reader.result,
          resultLength: reader.result ? (reader.result as string).length : 0
        });
        
        if (!reader.result) {
          reject(new Error('FileReader result is empty'));
          return;
        }
        
        const resultStr = reader.result as string;
        const base64Prefix = ';base64,';
        const base64Index = resultStr.indexOf(base64Prefix);
        
        if (base64Index === -1) {
          console.error('No base64 separator found in data URL');
          reject(new Error('Invalid data URL format'));
          return;
        }
        
        const base64data = resultStr.substring(base64Index + base64Prefix.length);
        
        chrome.runtime.sendMessage(
          {
            action: 'openPreview',
            blobData: base64data,
            blobType: blob.type,
            filename: filename,
            fps: fps || 30 // Pass FPS, default to 30
          },
          (response) => {
            if (chrome.runtime.lastError) {
              const errorMsg = chrome.runtime.lastError.message || 'Unknown error';
              if (errorMsg.includes('message port closed') && response?.success) {
                resolve();
                return;
              }
              reject(new Error(errorMsg));
              return;
            }

            if (!response?.success) {
              reject(new Error(response?.error || 'Failed to open preview'));
              return;
            }

            resolve();
          }
        );
      } catch (error: any) {
        console.error('Error in FileReader.onloadend:', error);
        reject(new Error(error.message || 'Failed to process file'));
      }
    };
    
    reader.onerror = (event) => {
      console.error('FileReader error event:', event);
      reject(new Error('Failed to read blob'));
    };
    
    reader.readAsDataURL(blob);
  });
}


