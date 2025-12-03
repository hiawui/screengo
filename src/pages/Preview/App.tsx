import { useEffect, useState, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { i18n, t } from '../../services/i18n';
import { VideoTrimmer } from './VideoTrimmer';

export default function App() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [currentLang, setCurrentLang] = useState(i18n.getLanguage());
  
  const [fps, setFps] = useState<number>(30);
  
  // Video state
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const ffmpegRef = useRef(new FFmpeg());

  useEffect(() => {
    // Initialize i18n
    i18n.init().then(() => {
      setCurrentLang(i18n.getLanguage());
    });

    const handleLanguageChange = () => {
      setCurrentLang(i18n.getLanguage());
    };

    window.addEventListener('i18n:languageChanged', handleLanguageChange);

    return () => {
      window.removeEventListener('i18n:languageChanged', handleLanguageChange);
    };
  }, []);

  useEffect(() => {
    // Request video data from background
    chrome.runtime.sendMessage({ action: 'getPreviewData' }, (response) => {
      if (chrome.runtime.lastError) {
        setError(chrome.runtime.lastError.message || 'Failed to connect to background');
        setLoading(false);
        return;
      }

      if (response && response.success && response.data) {
        try {
          // Set FPS if provided
          if (response.fps) {
            console.log(`App: FPS: ${response.fps}`);
            setFps(response.fps);
          } else {
            setFps(30);
            console.log(`App: FPS not provided, using default 30`);
          }

          // Convert base64 back to Blob
          const byteCharacters = atob(response.data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: response.type || 'video/webm' });
          
          const url = URL.createObjectURL(blob);
          setVideoUrl(url);
          setVideoBlob(blob);
        } catch (err) {
          console.error('Error processing video data:', err);
          setError('Failed to process video data');
        }
      } else {
        setError('No recording data found');
      }
      setLoading(false);
    });

    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, []);

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;

    const dur = videoRef.current.duration;
    console.log(`App: handleLoadedMetadata: ${dur}`);

    if (dur === Infinity) {
      // Fix for Chrome bug where WebM duration is Infinity
      videoRef.current.currentTime = 1e101;

      const onDurationChange = () => {
        if (videoRef.current && Number.isFinite(videoRef.current.duration)) {
          const fixedDur = videoRef.current.duration;
          console.log(`App: fixed duration: ${fixedDur}`);
          setDuration(fixedDur);
          setEndTime(fixedDur);
          videoRef.current.currentTime = 0;
          videoRef.current.removeEventListener('durationchange', onDurationChange);
        }
      };

      videoRef.current.addEventListener('durationchange', onDurationChange);
    } else {
      setDuration(dur);
      setEndTime(dur);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;

    // Ignore time updates during the duration fix hack
    if (videoRef.current.currentTime > 1e100) return;

    const curr = videoRef.current.currentTime;
    setCurrentTime(curr);

    // Check if we need to loop or stop
    // Use a small tolerance for floating point comparisons
    const tolerance = 0.01;
    
    if (curr >= endTime) {
      videoRef.current.pause();
      if (curr > endTime + tolerance) {
        videoRef.current.currentTime = endTime;
      }
    } else if (curr < startTime - tolerance) {
      videoRef.current.currentTime = startTime;
    }
  };

  const handleStartTimeChange = (time: number) => {
    setStartTime(Math.min(videoRef.current?.currentTime || 0, time));
  };

  const handleEndTimeChange = (time: number) => {
    setEndTime(Math.max(videoRef.current?.currentTime || 0, time));
  };

  const handleSeek = (time: number) => {
    console.log(`App: handleSeek: ${time}`);
    if (videoRef.current && Number.isFinite(time)) {
      // Ensure time is within valid range [0, duration]
      const validTime = Math.max(0, Math.min(time, videoRef.current.duration));
      videoRef.current.currentTime = validTime;
      setCurrentTime(validTime);
    }
  };

  const processVideo = async (outputType: 'video/webm' | 'video/mp4') => {
    if (!videoBlob) return;

    setIsExporting(true);
    setError(null);

    try {
      const ffmpeg = ffmpegRef.current;
      
      if (!ffmpeg.loaded) {
        const baseURL = chrome.runtime.getURL('assets');
        await ffmpeg.load({
          coreURL: `${baseURL}/ffmpeg-core.js`,
          wasmURL: `${baseURL}/ffmpeg-core.wasm`,
        });
      }

      const inputName = 'input.webm';
      const outputName = outputType === 'video/mp4' ? 'output.mp4' : 'output.webm';
      
      await ffmpeg.writeFile(inputName, await fetchFile(videoBlob));
      
      const trimDuration = endTime - startTime;
      const shouldTrim = startTime > 0 || endTime < duration;

      const args = [];
      
      if (shouldTrim) {
        args.push('-ss', startTime.toString());
        args.push('-t', trimDuration.toString());
      }

      args.push('-i', inputName);

      if (outputType === 'video/mp4') {
        args.push(
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '28',
          '-r', fps.toString(),
          outputName
        );
      } else {
        args.push(
          '-c', 'copy',
          outputName
        );
      }

      await ffmpeg.exec(args);
      
      const data = await ffmpeg.readFile(outputName);
      const processedBlob = new Blob([data as any], { type: outputType });
      const processedUrl = URL.createObjectURL(processedBlob);
      
      const extension = outputType === 'video/mp4' ? 'mp4' : 'webm';
      const a = document.createElement('a');
      a.href = processedUrl;
      a.download = `screengo-${new Date().toISOString()}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Cleanup
      URL.revokeObjectURL(processedUrl);
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);

    } catch (err: any) {
      console.error('Processing failed:', err);
      setError(`Processing failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleDownload = async () => {
    if (!videoUrl) return;

    // Check if we need to trim
    const shouldTrim = startTime > 0 || endTime < duration;

    if (!shouldTrim) {
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = `screengo-${new Date().toISOString()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    await processVideo('video/webm');
  };

  const handleExportMp4 = async () => {
    await processVideo('video/mp4');
  };

  if (loading) {
    return <div className="container loading">{t('loadingPreview')}</div>;
  }

  return (
    <div className="container" data-lang={currentLang}>
      <header>
        <h1>{t('previewTitle')}</h1>
      </header>
      
      <main className="main-content">
        {error && <div className="error-message">{error}</div>}
        
        <div className="content-split">
          <div className="preview-area">
            <div className="video-container">
              {videoUrl && (
                <video 
                  ref={videoRef} 
                  src={videoUrl} 
                  controls 
                  autoPlay 
                  className="preview-video"
                  controlsList="nodownload"
                  onLoadedMetadata={handleLoadedMetadata}
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                />
              )}
            </div>
            
            {Number.isFinite(duration) && duration > 0 && (
              <VideoTrimmer
                duration={duration}
                currentTime={currentTime}
                startTime={startTime}
                endTime={endTime}
                isPlaying={isPlaying}
                fps={fps}
                onStartTimeChange={handleStartTimeChange}
                onEndTimeChange={handleEndTimeChange}
                onSeek={handleSeek}
                onPlayPause={handlePlayPause}
              />
            )}
          </div>

          <div className="controls-area">
            <div className="control-group">
              <div className="action-buttons">
                <button className="btn primary full-width" onClick={handleDownload} disabled={isExporting}>
                  {t('downloadWebM')}
                </button>
                <button className="btn primary full-width" onClick={handleExportMp4} disabled={isExporting}>
                  {isExporting ? t('exporting') : t('exportToMp4')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
