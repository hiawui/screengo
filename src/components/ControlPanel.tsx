// ControlPanel.tsx - Control panel component

import React, { useState, useEffect } from 'react';
import { useRecorder } from '../hooks/useRecorder';
import { AreaSelector } from '../services/selector';
import { i18n, t } from '../services/i18n';
import { storage, STORAGE_KEYS } from '../services/storage';
import type { SelectedArea, AudioOptions, Position } from '../types';
// CSS is injected via manifest.json content_scripts.css

const formatDuration = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const ControlPanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [audioOptions, setAudioOptions] = useState<AudioOptions>({
    tabAudio: true,
    microphone: false
  });
  const [currentLang, setCurrentLang] = useState<string>(i18n.getLanguage());
  const [isI18nReady, setIsI18nReady] = useState(false);
  const [mainPanelPosition, setMainPanelPosition] = useState<Position | null>(null);
  const [miniPanelPosition, setMiniPanelPosition] = useState<Position | null>(null);
  const [draggingTarget, setDraggingTarget] = useState<'main' | 'mini' | null>(null);
  const [showMiniPanel, setShowMiniPanel] = useState(true);
  const currentDragPosRef = React.useRef<Position | null>(null);
  
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
  const mainPanelRef = React.useRef<HTMLDivElement>(null);
  const miniPanelRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (draggingTarget) {
      const handleMouseMove = (e: MouseEvent) => {
        const newPos = {
          left: e.clientX - dragOffset.current.x,
          top: e.clientY - dragOffset.current.y
        };
        currentDragPosRef.current = newPos;

        if (draggingTarget === 'main') {
          setMainPanelPosition(newPos);
        } else {
          setMiniPanelPosition(newPos);
        }
      };
      
      const handleMouseUp = () => {
        if (currentDragPosRef.current) {
          const key = draggingTarget === 'main' ? STORAGE_KEYS.PANEL_POS_MAIN : STORAGE_KEYS.PANEL_POS_MINI;
          storage.set({ [key]: currentDragPosRef.current });
        }
        setDraggingTarget(null);
        currentDragPosRef.current = null;
      };
      
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingTarget]);

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
      setIsI18nReady(true);
    });

    // Load saved positions and settings
    storage.get([
      STORAGE_KEYS.PANEL_POS_MAIN, 
      STORAGE_KEYS.PANEL_POS_MINI,
      STORAGE_KEYS.AUDIO_OPTS,
      STORAGE_KEYS.SHOW_MINI_PANEL
    ]).then((result) => {
      if (result[STORAGE_KEYS.PANEL_POS_MAIN]) {
        setMainPanelPosition(result[STORAGE_KEYS.PANEL_POS_MAIN]!);
      }
      if (result[STORAGE_KEYS.PANEL_POS_MINI]) {
        setMiniPanelPosition(result[STORAGE_KEYS.PANEL_POS_MINI]!);
      }
      if (result[STORAGE_KEYS.AUDIO_OPTS]) {
        setAudioOptions(result[STORAGE_KEYS.AUDIO_OPTS]!);
      }
      if (result[STORAGE_KEYS.SHOW_MINI_PANEL] !== undefined) {
        setShowMiniPanel(result[STORAGE_KEYS.SHOW_MINI_PANEL]!);
      }
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

  useEffect(() => {
    if (countdown > 0 && areaSelectorRef.current) {
      areaSelectorRef.current.lock();
    }
  }, [countdown]);

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
      await startRecording(selectedArea, audioOptions);
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

  const handleLanguageChange = async (lang: string) => {
    await i18n.setLanguage(lang as any);
    // State update will be handled by the event listener
  };

  const handleMouseDown = (e: React.MouseEvent, target: 'main' | 'mini') => {
    const currentRef = target === 'main' ? mainPanelRef : miniPanelRef;
    if (currentRef.current) {
      const rect = currentRef.current.getBoundingClientRect();
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      
      // If we haven't set a manual position yet, set it now based on current rect
      // This prevents jumping when switching from CSS positioning to JS positioning
      if (target === 'main' && !mainPanelPosition) {
        setMainPanelPosition({ left: rect.left, top: rect.top });
      } else if (target === 'mini' && !miniPanelPosition) {
        setMiniPanelPosition({ left: rect.left, top: rect.top });
      }
      
      setDraggingTarget(target);
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
    <>
      {countdown >= 1 && (
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
          pointerEvents: 'none',
          zIndex: 1000000
        }}>
          <div style={{
            fontSize: '100px',
            color: 'white',
            textShadow: '0 0 20px rgba(0,0,0,0.5)',
            fontWeight: 'bold'
          }}>
            {countdown}
          </div>
        </div>
      )}

      {/* Mini Panel - Visible when enabled */}
      {showMiniPanel && (
        <div
          id="screengo-mini-panel"
          className="visible"
        ref={miniPanelRef}
        style={{
          position: 'fixed',
          left: miniPanelPosition ? miniPanelPosition.left : 'auto',
          top: miniPanelPosition ? miniPanelPosition.top : '20px',
          right: miniPanelPosition ? 'auto' : '20px',
          transform: 'none',
          background: '#fff',
          padding: '8px 12px',
          borderRadius: '20px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 999999,
          cursor: 'move',
          border: '1px solid rgba(0,0,0,0.1)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          userSelect: 'none'
        }}
        onMouseDown={(e) => handleMouseDown(e, 'mini')}
      >
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px',
          color: '#333',
          fontSize: '14px',
          fontWeight: 500,
          minWidth: '80px'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isPaused ? '#fbbf24' : '#ef4444',
            animation: isPaused ? 'none' : 'pulse 2s infinite',
            opacity: isRecording ? 1 : 0.3
          }} />
          {formatDuration(recordingDuration)}
        </div>

        <div style={{ width: '1px', height: '16px', background: '#e5e7eb' }} />

        <button
          className="button"
          disabled={countdown > 0}
          onClick={(e) => {
            e.stopPropagation();
            if (!isRecording) {
              handleStartRecording();
            } else {
              isPaused ? resumeRecording() : pauseRecording();
            }
          }}
          style={{
            padding: '4px 12px',
            fontSize: '13px',
            borderRadius: '15px',
            background: !isRecording ? '#ef4444' : (isPaused ? '#3b82f6' : '#f3f4f6'),
            color: !isRecording ? 'white' : (isPaused ? 'white' : (isRecording ? '#374151' : '#9ca3af')),
            border: 'none',
            cursor: (isRecording || countdown === 0) ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '32px'
          }}
          title={!isRecording ? t('startRecording') : (isPaused ? t('resumeRecording') : t('pauseRecording'))}
        >
          {!isRecording ? '●' : (isPaused ? '▶' : '⏸')}
        </button>

        <button
          className="button"
          disabled={!isRecording}
          onClick={(e) => {
            e.stopPropagation();
            handleStopRecording();
          }}
          style={{
            padding: '4px 12px',
            fontSize: '13px',
            borderRadius: '15px',
            background: '#fee2e2',
            color: '#ef4444',
            border: 'none',
            cursor: isRecording ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
            opacity: isRecording ? 1 : 0.5
          }}
          title={t('stopRecording')}
        >
          ⏹
        </button>
      </div>
      )}

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>

      {/* Main Panel - Visible when not recording and not counting down */}
      {(!isRecording && countdown === 0) && (
        <div 
          id="screengo-control-panel" 
          className="visible"
          ref={mainPanelRef}
          style={mainPanelPosition ? { left: mainPanelPosition.left, top: mainPanelPosition.top, right: 'auto' } : undefined}
        >
          <div className="header" onMouseDown={(e) => handleMouseDown(e, 'main')} data-i18n-ready={isI18nReady}>
            <div className="title">{t('extensionName')}</div>
            <button className="close-btn" onClick={handleClose}>×</button>
          </div>
          <div className="content">
            <div className={`status ${isRecording ? (isPaused ? 'paused' : 'recording') : 'idle'}`}>
              {t('recordingStopped')}
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
              <div className="section-title">{t('settings')}</div>
              <div className="checkbox-group">
                <div className="checkbox-item">
                  <input
                    type="checkbox"
                    id="screengo-tab-audio"
                    checked={audioOptions.tabAudio}
                    onChange={(e) => {
                      const newOptions = { ...audioOptions, tabAudio: e.target.checked };
                      setAudioOptions(newOptions);
                      storage.set({ [STORAGE_KEYS.AUDIO_OPTS]: newOptions });
                    }}
                  />
                  <label htmlFor="screengo-tab-audio">{t('tabAudio')}</label>
                </div>
                <div className="checkbox-item">
                  <input
                    type="checkbox"
                    id="screengo-microphone"
                    checked={audioOptions.microphone}
                    onChange={(e) => {
                      const newOptions = { ...audioOptions, microphone: e.target.checked };
                      setAudioOptions(newOptions);
                      storage.set({ [STORAGE_KEYS.AUDIO_OPTS]: newOptions });
                    }}
                  />
                  <label htmlFor="screengo-microphone">{t('microphone')}</label>
                </div>
                <div className="checkbox-item">
                  <input
                    type="checkbox"
                    id="screengo-mini-panel-toggle"
                    checked={showMiniPanel}
                    onChange={(e) => {
                      setShowMiniPanel(e.target.checked);
                      storage.set({ [STORAGE_KEYS.SHOW_MINI_PANEL]: e.target.checked });
                    }}
                  />
                  <label htmlFor="screengo-mini-panel-toggle">{t('showMiniPanel')}</label>
                </div>
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
      )}
    </>
  );
};

