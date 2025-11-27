import { useEffect, useState, useRef } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { i18n, t } from '../../services/i18n';

export default function App() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [currentLang, setCurrentLang] = useState(i18n.getLanguage());
  
  const [fps, setFps] = useState<number>(30);
  
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
            setFps(response.fps);
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

  const handleDownload = () => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `screengo-${new Date().toISOString()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleExportMp4 = async () => {
    if (!videoBlob) return;
    
    setIsExporting(true);
    setError(null);
    
    try {
      const ffmpeg = ffmpegRef.current;
      
      if (!ffmpeg.loaded) {
        const baseURL = chrome.runtime.getURL('assets');
        
        // Log messages from ffmpeg

        await ffmpeg.load({
          coreURL: `${baseURL}/ffmpeg-core.js`,
          wasmURL: `${baseURL}/ffmpeg-core.wasm`,
        });
      }

      const inputName = 'input.webm';
      const outputName = 'output.mp4';
      
      await ffmpeg.writeFile(inputName, await fetchFile(videoBlob));
      
      // Add fast preset and lower resolution/crf for better performance in WASM
      await ffmpeg.exec([
        '-i', inputName, 
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '28',
        '-r', fps.toString(), // Use configured FPS
        outputName
      ]);
      
      const data = await ffmpeg.readFile(outputName);
      const mp4Blob = new Blob([data as any], { type: 'video/mp4' });
      const mp4Url = URL.createObjectURL(mp4Blob);
      
      const a = document.createElement('a');
      a.href = mp4Url;
      a.download = `screengo-${new Date().toISOString()}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Cleanup
      URL.revokeObjectURL(mp4Url);
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
      
    } catch (err: any) {
      console.error('Export failed:', err);
      setError(`Export failed: ${err.message || 'Unknown error'}. If you see SharedArrayBuffer error, it means browser restrictions prevent MP4 conversion here.`);
    } finally {
      setIsExporting(false);
    }
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
                />
              )}
            </div>
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
