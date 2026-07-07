'use client';

import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

interface QRScannerProps {
  onScan: (data: string) => void;
  isActive: boolean;
}

export function QRScanner({ onScan, isActive }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let animationFrameId: number;
    let stream: MediaStream | null = null;

    const startScanner = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Add event listener for when video is ready to play
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            requestAnimationFrame(tick);
          };
        }
      } catch (err) {
        setError('Unable to access camera. Please check permissions.');
      }
    };

    const tick = () => {
      if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        
        if (canvas && video) {
          canvas.height = video.videoHeight;
          canvas.width = video.videoWidth;
          const context = canvas.getContext('2d');
          
          if (context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });
            
            if (code) {
              onScan(code.data);
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
  }, [isActive, onScan]);

  if (error) {
    return <div className="p-4 text-center text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl">{error}</div>;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-black aspect-[3/4] w-full max-w-md mx-auto">
      <video 
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
      />
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Scanner overlay */}
      <div className="absolute inset-0 border-[40px] border-black/40">
        <div className="absolute inset-0 border-2 border-white/50 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]">
          <div className="absolute inset-x-0 h-0.5 bg-blue-500 animate-[scan_2s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
}
