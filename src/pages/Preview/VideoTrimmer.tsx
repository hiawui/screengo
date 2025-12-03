import React, { useRef, useEffect, useState, useCallback } from 'react';
import { t } from '../../services/i18n';

interface VideoTrimmerProps {
  duration: number;
  currentTime: number;
  startTime: number;
  endTime: number;
  isPlaying: boolean;
  fps?: number;
  onStartTimeChange: (time: number) => void;
  onEndTimeChange: (time: number) => void;
  onSeek: (time: number) => void;
  onPlayPause: () => void;
}

const formatTime = (seconds: number) => {
  if (!isFinite(seconds) || seconds < 0) return '00:00.00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
};

export const VideoTrimmer: React.FC<VideoTrimmerProps> = ({
  duration,
  currentTime,
  startTime,
  endTime,
  isPlaying,
  fps = 30,
  onStartTimeChange,
  onEndTimeChange,
  onSeek,
  onPlayPause,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<'start' | 'end' | null>(null);
  const lastDragEndTime = useRef(0);

  const getPercentage = (time: number) => {
    if (!isFinite(time) || !isFinite(duration) || duration <= 0) return 0;
    return Math.min(100, Math.max(0, (time / duration) * 100));
  };

  const handleMouseDown = (type: 'start' | 'end') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(type);
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    console.log(`VideoTrimmer: handleTrackClick. isDragging: ${isDragging}`);
    // Ignore clicks during dragging or immediately after dragging ends
    if (!containerRef.current || isDragging || Date.now() - lastDragEndTime.current < 200) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const newTime = percentage * duration;
    
    if (isFinite(newTime)) {
      console.log(`VideoTrimmer: handleTrackClick. newTime: ${newTime}`);
      onSeek(Math.max(startTime, Math.min(endTime, newTime)));
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const time = percentage * duration;

    if (!isFinite(time)) return;

    if (isDragging === 'start') {
      // Ensure start doesn't exceed end (minus some buffer)
      const newStart = Math.max(0, Math.min(time, endTime - 0.5));
      onStartTimeChange(newStart);
    } else {
      // Ensure end doesn't go below start
      const newEnd = Math.min(duration, Math.max(time, startTime + 0.5));
      onEndTimeChange(newEnd);
    }
  }, [isDragging, duration, endTime, startTime, onStartTimeChange, onEndTimeChange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
    lastDragEndTime.current = Date.now();
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className="video-trimmer">
      <div className="trimmer-controls">
        <button 
          className="play-pause-btn"
          onClick={onPlayPause}
          title={isPlaying ? t('pause') : t('play')}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>
        
        <button 
          className="play-pause-btn"
          onClick={() => onSeek(startTime)}
          title={t('replayFromStart')}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
          </svg>
        </button>

        <button 
          className="play-pause-btn"
          onClick={() => onSeek(Math.max(startTime, Math.min(endTime, currentTime - (1/fps))))}
          title={t('previousFrame', (1/fps).toFixed(3))}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
          </svg>
        </button>

        <button 
          className="play-pause-btn"
          onClick={() => onSeek(Math.max(startTime, Math.min(endTime, currentTime + (1/fps))))}
          title={t('nextFrame', (1/fps).toFixed(3))}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>

        <div className="trimmer-times">
          <span>{formatTime(startTime)}</span>
          <span className="current-time">{formatTime(currentTime)}</span>
          <span>{formatTime(endTime)}</span>
        </div>
      </div>
      
      <div  
        className="trimmer-track-container" 
        ref={containerRef}
        onClick={handleTrackClick}
      >
        <div className="trimmer-track-bg" />
        
        {/* Selected Range (Unplayed) */}
        <div 
          className="trimmer-selection"
          style={{
            left: `${getPercentage(startTime)}%`,
            width: `${getPercentage(endTime) - getPercentage(startTime)}%`
          }}
        />

        {/* Selected Range (Played) */}
        <div 
          className="trimmer-selection-played"
          style={{
            left: `${getPercentage(startTime)}%`,
            width: `${Math.max(0, getPercentage(Math.min(currentTime, endTime)) - getPercentage(startTime))}%`
          }}
        />

        {/* Start Handle */}
        <div 
          className="trimmer-handle start-handle"
          style={{ left: `${getPercentage(startTime)}%` }}
          onMouseDown={handleMouseDown('start')}
          onClick={(e) => e.stopPropagation()}
        />

        {/* End Handle */}
        <div 
          className="trimmer-handle end-handle"
          style={{ left: `${getPercentage(endTime)}%` }}
          onMouseDown={handleMouseDown('end')}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
};

