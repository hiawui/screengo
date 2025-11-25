// ControlPanel.tsx - Control panel component

import React, { useState, useEffect } from 'react';
import { useRecorder } from '../hooks/useRecorder';
import { AreaSelector } from '../services/selector';
import { i18n, t } from '../services/i18n';
import type { SelectedArea, RecordingFormat, AudioOptions } from '../types';
// CSS is injected via manifest.json content_scripts.css

const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const ControlPanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [format, setFormat] = useState<RecordingFormat>('webm');
  const [audioOptions, setAudioOptions] = useState<AudioOptions>({
    systemAudio: true,
    microphone: false
  });
  const [currentLang, setCurrentLang] = useState<string>('en');
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const {
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
  } = useRecorder();

  const areaSelectorRef = React.useRef<AreaSelector | null>(null);
  const dragOffset = React.useRef({ x: 0, y: 0 });
  const panelRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isDragging) {
      const handleMouseMove = (e: MouseEvent) => {
        setPosition({
          left: e.clientX - dragOffset.current.x,
          top: e.clientY - dragOffset.current.y
        });
      };
      
      const handleMouseUp = () => {
        setIsDragging(false);
      };
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  // Cleanup effect when recording state changes to false
  useEffect(() => {
    if (!isRecording && areaSelectorRef.current) {
      // Delay slightly to ensure any final processing is done
      // But more importantly, to handle the case where recording stops externally (e.g. browser stop button)
      areaSelectorRef.current.cleanup();
      // Clear selected area state when recording stops
      setSelectedArea(null);
    }
  }, [isRecording]);

  useEffect(() => {
    // Initialize i18n
    i18n.init().then(() => {
      setCurrentLang(i18n.getLanguage());
    });

    // Initialize area selector
    if (!areaSelectorRef.current) {
      areaSelectorRef.current = new AreaSelector();
    }

    // Listen for messages from background script
    const messageListener = (request: any, _sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
      if (request.action === 'showPanel') {
        setIsVisible(true);
        // Send response to acknowledge message received
        sendResponse({ success: true });
      }
      // Return true to indicate we will send a response asynchronously
      return true;
    };

    chrome.runtime.onMessage.addListener(messageListener);

    // Listen for language changes
    const languageChangeListener = () => {
      setCurrentLang(i18n.getLanguage());
    };
    window.addEventListener('i18n:languageChanged', languageChangeListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      window.removeEventListener('i18n:languageChanged', languageChangeListener);
    };
  }, []);

  const handleSelectArea = () => {
    if (!areaSelectorRef.current) return;
    
    areaSelectorRef.current.startSelection((area: SelectedArea | null) => {
      console.log('Selected area:', area);
      if (area) {
        console.log('Area details:', {
          x: area.x,
          y: area.y,
          width: area.width,
          height: area.height
        });
      } else {
        console.log('Area selection cancelled');
      }
      setSelectedArea(area);
    });
  };

  const handleStartRecording = async () => {
    try {
      // Allow recording with or without selected area
      // If area is null, record the entire screen/window
      await startRecording(selectedArea, format, audioOptions);
      
      // Lock selector to prevent modification during recording
      if (areaSelectorRef.current) {
        areaSelectorRef.current.lock();
      }
    } catch (error: any) {
      alert(t('error') + ': ' + error.message);
    }
  };

  const handleStopRecording = async () => {
    try {
      await stopRecording();
      // Cleanup is now handled by the useEffect on isRecording
    } catch (error: any) {
      alert(t('error') + ': ' + error.message);
    }
  };

  const handleLanguageChange = (lang: string) => {
    i18n.setLanguage(lang as any);
    setCurrentLang(lang);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      
      // If we haven't set a manual position yet, set it now based on current rect
      // This prevents jumping when switching from CSS positioning to JS positioning
      if (!position) {
        setPosition({ left: rect.left, top: rect.top });
      }
      
      setIsDragging(true);
    }
  };

  const handleClose = async () => {
    // Stop recording if currently recording
    if (isRecording) {
      try {
        await stopRecording();
      } catch (error: any) {
        console.error('Failed to stop recording on close:', error);
        // Continue to close panel even if stop fails
      }
    }
    
    setIsVisible(false);
    // Cleanup selector when closing panel (cleanup overlay and selection box)
    if (areaSelectorRef.current) {
      areaSelectorRef.current.cleanup();
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div 
      id="screengo-control-panel" 
      className="visible"
      ref={panelRef}
      style={position ? { left: position.left, top: position.top, right: 'auto' } : undefined}
    >
      <div className="header" onMouseDown={handleMouseDown}>
        <div className="title">{t('extensionName')}</div>
        <button className="close-btn" onClick={handleClose}>×</button>
      </div>
      <div className="content">
        {countdown !== null && (
          <div className="countdown-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '100px',
            color: 'white',
            zIndex: 1000000
          }}>
            {countdown}
          </div>
        )}
        <div className={`status ${isRecording ? (isPaused ? 'paused' : 'recording') : 'idle'}`}>
          {isRecording ? (
            <>
              <span className={`recording-indicator ${isPaused ? 'paused' : ''}`}></span>
              {isPaused ? t('paused') : t('recording')} {formatDuration(recordingDuration)}
            </>
          ) : (
            t('recordingStopped')
          )}
        </div>
        
        <div className="section">
          <button 
            className="button button-secondary" 
            onClick={handleSelectArea}
          >
            {t('selectArea')}
          </button>
        </div>

        <div className="section">
          <div className="section-title">{t('audio')}</div>
          <div className="checkbox-group">
            <div className="checkbox-item">
              <input
                type="checkbox"
                id="screengo-system-audio"
                checked={audioOptions.systemAudio}
                onChange={(e) => setAudioOptions({
                  ...audioOptions,
                  systemAudio: e.target.checked
                })}
              />
              <label htmlFor="screengo-system-audio">{t('systemAudio')}</label>
            </div>
            <div className="checkbox-item">
              <input
                type="checkbox"
                id="screengo-microphone"
                checked={audioOptions.microphone}
                onChange={(e) => setAudioOptions({
                  ...audioOptions,
                  microphone: e.target.checked
                })}
              />
              <label htmlFor="screengo-microphone">{t('microphone')}</label>
            </div>
          </div>
        </div>

        <div className="section">
          <div className="section-title">{t('format')}</div>
          <div className="select-group">
            <select
              id="screengo-format"
              value={format}
              onChange={(e) => setFormat(e.target.value as RecordingFormat)}
            >
              <option value="webm">{t('webm')}</option>
              <option value="mp4">{t('mp4')}</option>
            </select>
          </div>
        </div>

        <div className="section">
          <button
            className="button button-primary"
            id="screengo-start-recording"
            disabled={isRecording}
            onClick={handleStartRecording}
            style={{ display: isRecording ? 'none' : 'flex' }}
          >
            {t('startRecording')}
          </button>
          {isRecording && (
            <>
              <button
                className="button button-secondary"
                onClick={isPaused ? resumeRecording : pauseRecording}
              >
                {isPaused ? t('resumeRecording') : t('pauseRecording')}
              </button>
              <button
                className="button button-danger"
                id="screengo-stop-recording"
                onClick={handleStopRecording}
              >
                {t('stopRecording')}
              </button>
            </>
          )}
        </div>

        <div className="section">
          <div className="section-title">{t('language')}</div>
          <div className="select-group">
            <select
              id="screengo-language"
              value={currentLang}
              onChange={(e) => handleLanguageChange(e.target.value)}
            >
              <option value="en">English</option>
              <option value="zh_CN">简体中文</option>
              <option value="zh_TW">繁體中文</option>
              <option value="es">Español</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

