import React, { useRef, useState, useEffect } from 'react';

interface SignaturePadProps {
  onSave: (dataUrl: string) => void;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Handle high DPI displays
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.scale(ratio, ratio);
    }
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); // Prevent scrolling on touch
    setIsDrawing(true);
    setHasSignature(true);
    const pos = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#000';
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
    }
  };

  const handleSave = () => {
    if (canvasRef.current && hasSignature) {
      onSave(canvasRef.current.toDataURL());
    }
  };

  return (
    <div className="border border-slate-300 rounded-lg p-4 bg-white shadow-sm">
      <p className="text-sm text-slate-500 mb-2">Sign below:</p>
      <canvas
        ref={canvasRef}
        className="border border-slate-200 w-full h-40 bg-slate-50 rounded touch-none"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <div className="flex gap-2 mt-4">
        <button 
          onClick={clear}
          className="px-4 py-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 rounded"
        >
          Clear
        </button>
        <button 
          onClick={handleSave}
          disabled={!hasSignature}
          className="flex-1 px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50"
        >
          Confirm Signature
        </button>
      </div>
    </div>
  );
};
