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
      // stopRecording has already been called and completed
      // All chunks have been collected, safe to get blob
      const blob = await recorderRef.current.getBlob();
      
      const filename = recorderRef.current.getFilename();
      
      // FPS detection logic moved inside recorder.ts but we need it here to pass to preview page.
      // We can get it from recorder instance if we expose it or change getBlob/stopRecording flow.
      // Actually, getBlob just returns blob. 
      // But we modified startRecording to return FPS. Let's use a ref to store detected FPS.
      
      // We will use the fpsRef value which should have been set during startRecording
      const fps = detectedFpsRef.current || 30;
      
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
      // Set countdown to 0.1 to hide countdown and prevent the main panel from being shown
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
    } finally {
      setTimeout(() => {
        setCountdown(0);
      }, 100);
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

async function getScreenStream(sources: string[] = ['screen', 'window', 'tab']): Promise<MediaStream | null> {
  // If sources only contains 'currentTab', use getDisplayMedia API directly
  if (sources.length === 1 && sources[0] === 'currentTab') {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { action: 'getTabStreamId' },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response || !response.success) {
            reject(new Error(response?.error || 'Failed to get tab stream'));
            return;
          }

          // Use streamId to get MediaStream
          const constraints: any = {
            audio: {
              mandatory: {
                chromeMediaSource: 'tab',
                chromeMediaSourceId: response.streamId
              }
            },
            video: {
              mandatory: {
                chromeMediaSource: 'tab',
                chromeMediaSourceId: response.streamId,
                minWidth: window.innerWidth,
                minHeight: window.innerHeight,
                maxWidth: window.innerWidth * window.devicePixelRatio,
                maxHeight: window.innerHeight * window.devicePixelRatio
              }
            }
          };

          // Chrome extensions need to use legacy getUserMedia API for tabCapture streams
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
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onloadend = () => {
      try {
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


