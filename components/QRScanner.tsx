'use client';

import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Upload, Camera, SwitchCamera } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string, isUpload?: boolean) => void;
  isActive: boolean;
}

export function QRScanner({ onScan, isActive }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>('');
  const [hasCamera, setHasCamera] = useState<boolean>(true);

  // Camera selection states
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');

  // Enumerate cameras once on mount
  useEffect(() => {
    const getCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setCameras(videoDevices);
        if (videoDevices.length > 0) {
          // Find back camera by default if possible
          const backCamera = videoDevices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear'));
          setSelectedCameraId(backCamera ? backCamera.deviceId : videoDevices[0].deviceId);
        }
      } catch (err) {
        console.warn('Cannot enumerate devices', err);
      }
    };
    
    // Only enumerate if the API is available
    if (navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function') {
      // Browsers often require getUserMedia to be called at least once before returning device labels,
      // but enumerateDevices will still return deviceIds.
      getCameras();
    }
  }, []);

  useEffect(() => {
    let animationFrameId: number;
    let stream: MediaStream | null = null;

    const startScanner = async () => {
      try {
        const constraints: MediaStreamConstraints = {
          video: selectedCameraId 
            ? { deviceId: { exact: selectedCameraId } }
            : { facingMode: 'environment' }
        };
        
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Add event listener for when video is ready to play
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            requestAnimationFrame(tick);
          };
        }
        setHasCamera(true);
        setError('');
      } catch (err) {
        setHasCamera(false);
      }
    };

    const tick = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        
        if (canvas && video) {
          canvas.height = video.videoHeight;
          canvas.width = video.videoWidth;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          
          if (context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });
            
            if (code) {
              onScan(code.data, false);
            }
          }
        }
      }
      
      if (isActive) {
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    if (isActive) {
      startScanner();
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [isActive, onScan, selectedCameraId]);

  const handleCycleCamera = () => {
    if (cameras.length < 2) return;
    const currentIndex = cameras.findIndex(c => c.deviceId === selectedCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    setSelectedCameraId(cameras[nextIndex].deviceId);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // Scale down if image is too large to improve performance and success rate
        const MAX_WIDTH = 1200;
        let width = img.width;
        let height = img.height;
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const imageData = ctx.getImageData(0, 0, width, height);
          
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "attemptBoth",
          });
          
          if (code) {
            onScan(code.data, true);
          } else {
            setError('無法從圖片中讀取 QR Code，請確認圖片清晰並包含發票左側的 QR Code。');
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    
    // Reset input so the same file can be selected again
    e.target.value = '';
  };

  return (
    <div className="space-y-4">
      {hasCamera ? (
        <div className="relative overflow-hidden rounded-2xl bg-black aspect-[3/4] w-full max-w-md mx-auto">
          <video 
            ref={videoRef}
            className="absolute inset-0 h-full w-full object-cover"
            playsInline
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* Scanner overlay */}
          <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
            <div className="absolute inset-0 border-2 border-white/50 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
              <div className="absolute inset-x-0 h-0.5 bg-blue-500 animate-[scan_2s_ease-in-out_infinite]" />
            </div>
          </div>
          
          {/* Camera Switch Button */}
          {cameras.length > 1 && (
            <button
              onClick={handleCycleCamera}
              className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
              title="切換相機"
            >
              <SwitchCamera className="h-5 w-5" />
            </button>
          )}
        </div>
      ) : (
        <div className="flex aspect-[3/4] w-full max-w-md mx-auto flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50 p-6 text-center">
          <Camera className="mb-4 h-12 w-12 text-zinc-400" />
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">相機無法使用</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">請允許相機權限，或直接上傳圖片</p>
        </div>
      )}

      {error && (
        <div className="p-3 text-sm text-center text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-xl max-w-md mx-auto">
          {error}
        </div>
      )}

      <div className="flex justify-center">
        <input 
          type="file" 
          accept="image/*" 
          capture="environment"
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
        />
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-6 py-3 font-medium shadow-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors"
        >
          <Upload className="h-5 w-5" />
          上傳發票圖片或拍照
        </button>
      </div>
    </div>
  );
}
