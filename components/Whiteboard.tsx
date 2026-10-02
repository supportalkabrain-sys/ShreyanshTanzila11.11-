'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db, WhiteboardElement } from '@/lib/firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import {
  Pen,
  Eraser,
  Minus,
  MoveRight,
  Square,
  Circle,
  Type,
  StickyNote,
  RotateCcw,
  RotateCw,
  Trash2,
  Download,
  Palette,
  Cloud,
} from 'lucide-react';
import { sound } from '@/lib/sound';

interface WhiteboardProps {
  roomId: string;
  readOnly?: boolean;
}

const COLORS = [
  '#ffffff', // White
  '#6366f1', // Indigo
  '#a855f7', // Purple
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
];

export const Whiteboard: React.FC<WhiteboardProps> = ({ roomId, readOnly = false }) => {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [tool, setTool] = useState<'pen' | 'eraser' | 'line' | 'arrow' | 'rect' | 'circle' | 'text' | 'sticky'>('pen');
  const [color, setColor] = useState('#6366f1');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);

  // History & Elements
  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const [undoStack, setUndoStack] = useState<WhiteboardElement[][]>([]);
  const [redoStack, setRedoStack] = useState<WhiteboardElement[][]>([]);
  const [currentElement, setCurrentElement] = useState<WhiteboardElement | null>(null);

  // Sync state
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'offline'>('synced');
  const lastSyncTimeRef = useRef<number>(0);
  const isRemoteUpdateRef = useRef<boolean>(false);

  const drawElement = (ctx: CanvasRenderingContext2D, el: WhiteboardElement) => {
    ctx.save();
    ctx.strokeStyle = el.color;
    ctx.fillStyle = el.color;
    ctx.lineWidth = el.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (el.type === 'pen' && el.points && el.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(el.points[0].x, el.points[0].y);
      for (let i = 1; i < el.points.length; i++) {
        ctx.lineTo(el.points[i].x, el.points[i].y);
      }
      ctx.stroke();
    } else if (el.type === 'line' && el.points && el.points.length === 2) {
      ctx.beginPath();
      ctx.moveTo(el.points[0].x, el.points[0].y);
      ctx.lineTo(el.points[1].x, el.points[1].y);
      ctx.stroke();
    } else if (el.type === 'arrow' && el.points && el.points.length === 2) {
      const fromX = el.points[0].x;
      const fromY = el.points[0].y;
      const toX = el.points[1].x;
      const toY = el.points[1].y;
      const headlen = 12;
      const angle = Math.atan2(toY - fromY, toX - fromX);

      ctx.beginPath();
      ctx.moveTo(fromX, fromY);
      ctx.lineTo(toX, toY);
      ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
      ctx.moveTo(toX, toY);
      ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
      ctx.stroke();
    } else if (el.type === 'rect' && el.x !== undefined && el.y !== undefined && el.width !== undefined && el.height !== undefined) {
      ctx.strokeRect(el.x, el.y, el.width, el.height);
    } else if (el.type === 'circle' && el.x !== undefined && el.y !== undefined && el.width !== undefined) {
      ctx.beginPath();
      const radius = Math.abs(el.width) / 2;
      const centerX = el.x + el.width / 2;
      const centerY = el.y + (el.height || el.width) / 2;
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (el.type === 'sticky' && el.x !== undefined && el.y !== undefined) {
      ctx.fillStyle = '#fef08a'; // Pastel yellow
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 8;
      ctx.fillRect(el.x, el.y, el.width || 120, el.height || 80);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#1e293b';
      ctx.font = '12px sans-serif';
      ctx.fillText(el.text || 'Study note...', el.x + 8, el.y + 24);
    } else if (el.type === 'text' && el.x !== undefined && el.y !== undefined) {
      ctx.font = `${Math.max(el.strokeWidth * 5, 14)}px sans-serif`;
      ctx.fillText(el.text || '', el.x, el.y);
    }
    ctx.restore();
  };

  const drawAll = (elems: WhiteboardElement[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const el of elems) {
      drawElement(ctx, el);
    }
  };

  // 1. Setup Canvas sizing & redraw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        drawAll(elements);
      }
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [elements]);

  // 2. Realtime listener on Firestore whiteboard document
  useEffect(() => {
    if (!roomId) return;
    const whiteboardDocRef = doc(db, 'quizRooms', roomId, 'whiteboard', 'state');

    const unsubscribe = onSnapshot(whiteboardDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.elementsJson) {
          try {
            const remoteElements: WhiteboardElement[] = JSON.parse(data.elementsJson);
            // If update came from another user, apply
            if (data.lastModifiedBy !== user?.uid) {
              isRemoteUpdateRef.current = true;
              setElements(remoteElements);
              drawAll(remoteElements);
              isRemoteUpdateRef.current = false;
            }
          } catch (e) {
            console.error('Whiteboard parse error:', e);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [roomId, user?.uid]);

  // 3. Redraw canvas whenever elements change
  useEffect(() => {
    drawAll(elements);
  }, [elements]);

  // Throttled sync to Firestore
  const syncToFirestore = async (newElements: WhiteboardElement[]) => {
    if (readOnly || !roomId || isRemoteUpdateRef.current) return;
    const now = Date.now();
    setSyncStatus('saving');

    try {
      const whiteboardDocRef = doc(db, 'quizRooms', roomId, 'whiteboard', 'state');
      await setDoc(whiteboardDocRef, {
        roomId,
        elementsJson: JSON.stringify(newElements),
        lastModifiedBy: user?.uid || 'anon',
        updatedAt: new Date().toISOString(),
      });
      lastSyncTimeRef.current = now;
      setSyncStatus('synced');
    } catch (err) {
      console.error('Whiteboard sync error:', err);
      setSyncStatus('offline');
    }
  };

  // Mouse / Touch handlers
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    const { x, y } = getCoordinates(e);
    setIsDrawing(true);

    if (tool === 'sticky') {
      const noteText = prompt('Enter note text:') || 'Study note';
      const newElem: WhiteboardElement = {
        id: `el_${Date.now()}`,
        type: 'sticky',
        x,
        y,
        width: 140,
        height: 90,
        color: '#fef08a',
        strokeWidth: 1,
        text: noteText,
      };
      const updated = [...elements, newElem];
      setUndoStack([...undoStack, elements]);
      setElements(updated);
      syncToFirestore(updated);
      setIsDrawing(false);
      return;
    }

    if (tool === 'text') {
      const userText = prompt('Enter text:') || '';
      if (!userText.trim()) {
        setIsDrawing(false);
        return;
      }
      const newElem: WhiteboardElement = {
        id: `el_${Date.now()}`,
        type: 'text',
        x,
        y,
        color,
        strokeWidth,
        text: userText,
      };
      const updated = [...elements, newElem];
      setUndoStack([...undoStack, elements]);
      setElements(updated);
      syncToFirestore(updated);
      setIsDrawing(false);
      return;
    }

    const newElement: WhiteboardElement = {
      id: `el_${Date.now()}`,
      type: tool === 'eraser' ? 'pen' : tool,
      color: tool === 'eraser' ? '#090d16' : color, // Erase with background dark color
      strokeWidth: tool === 'eraser' ? strokeWidth * 4 : strokeWidth,
      points: [{ x, y }],
      x,
      y,
      width: 0,
      height: 0,
    };

    setCurrentElement(newElement);
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentElement) return;
    const { x, y } = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (currentElement.type === 'pen') {
      const updatedPoints = [...(currentElement.points || []), { x, y }];
      const updatedEl = { ...currentElement, points: updatedPoints };
      setCurrentElement(updatedEl);

      // Draw active stroke
      drawAll(elements);
      drawElement(ctx, updatedEl);
    } else {
      const startX = currentElement.x || 0;
      const startY = currentElement.y || 0;
      const updatedEl = {
        ...currentElement,
        width: x - startX,
        height: y - startY,
        points: [
          { x: startX, y: startY },
          { x, y },
        ],
      };
      setCurrentElement(updatedEl);
      drawAll(elements);
      drawElement(ctx, updatedEl);
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing || !currentElement) return;
    setIsDrawing(false);

    setUndoStack([...undoStack, elements]);
    setRedoStack([]);
    const updated = [...elements, currentElement];
    setElements(updated);
    setCurrentElement(null);
    syncToFirestore(updated);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    sound.playClick();
    const prev = undoStack[undoStack.length - 1];
    setRedoStack([...redoStack, elements]);
    setUndoStack(undoStack.slice(0, -1));
    setElements(prev);
    syncToFirestore(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    sound.playClick();
    const next = redoStack[redoStack.length - 1];
    setUndoStack([...undoStack, elements]);
    setRedoStack(redoStack.slice(0, -1));
    setElements(next);
    syncToFirestore(next);
  };

  const handleClear = () => {
    if (confirm('Clear the entire whiteboard canvas for everyone in the room?')) {
      sound.playClick();
      setUndoStack([...undoStack, elements]);
      setElements([]);
      syncToFirestore([]);
    }
  };

  const handleDownload = () => {
    sound.playClick();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `quiznova-board-${roomId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="flex flex-col h-full bg-[#090d16] rounded-2xl border border-indigo-500/20 overflow-hidden relative shadow-2xl">
      {/* Whiteboard Toolbar */}
      <div className="p-2 sm:p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
          {/* Tools */}
          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setTool('pen');
            }}
            className={`p-2 rounded-lg text-xs font-medium transition-all ${
              tool === 'pen' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Pen"
          >
            <Pen className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setTool('eraser');
            }}
            className={`p-2 rounded-lg text-xs font-medium transition-all ${
              tool === 'eraser' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Eraser"
          >
            <Eraser className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setTool('line');
            }}
            className={`p-2 rounded-lg text-xs font-medium transition-all ${
              tool === 'line' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Line"
          >
            <Minus className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setTool('arrow');
            }}
            className={`p-2 rounded-lg text-xs font-medium transition-all ${
              tool === 'arrow' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Arrow"
          >
            <MoveRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setTool('rect');
            }}
            className={`p-2 rounded-lg text-xs font-medium transition-all ${
              tool === 'rect' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Rectangle"
          >
            <Square className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setTool('circle');
            }}
            className={`p-2 rounded-lg text-xs font-medium transition-all ${
              tool === 'circle' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Circle"
          >
            <Circle className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setTool('text');
            }}
            className={`p-2 rounded-lg text-xs font-medium transition-all ${
              tool === 'text' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Text Box"
          >
            <Type className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              sound.playClick();
              setTool('sticky');
            }}
            className={`p-2 rounded-lg text-xs font-medium transition-all ${
              tool === 'sticky' ? 'bg-amber-500 text-slate-900 shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="Sticky Note"
          >
            <StickyNote className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

          {/* Color Palette */}
          <div className="flex items-center gap-1">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => {
                  sound.playClick();
                  setColor(c);
                  if (tool === 'eraser') setTool('pen');
                }}
                className={`w-5 h-5 rounded-full border transition-transform ${
                  color === c ? 'scale-125 border-white shadow-md' : 'border-slate-700 hover:scale-110'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* Stroke Width */}
          <div className="hidden md:flex items-center gap-1.5 ml-2">
            <span className="text-[10px] text-slate-500">Size</span>
            <input
              type="range"
              min={1}
              max={15}
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="w-16 accent-indigo-500 h-1 bg-slate-800 rounded"
            />
          </div>
        </div>

        {/* Undo/Redo & Actions */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          <div className="flex items-center gap-1 mr-2 text-[10px] text-slate-400">
            <Cloud className={`w-3.5 h-3.5 ${syncStatus === 'saving' ? 'text-amber-400 animate-pulse' : 'text-emerald-400'}`} />
            <span className="hidden sm:inline">{syncStatus === 'saving' ? 'Syncing...' : 'Realtime Sync'}</span>
          </div>

          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
            title="Undo"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30"
            title="Redo"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
            title="Clear board"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-600/20 hover:text-indigo-300"
            title="Export image"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Drawing Canvas Area */}
      <div className="flex-1 w-full h-full relative cursor-crosshair overflow-hidden">
        <canvas
          ref={canvasRef}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          className="w-full h-full block touch-none"
        />

        {elements.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-600 space-y-2">
            <Pen className="w-8 h-8 opacity-30 animate-pulse" />
            <p className="text-xs font-medium">Collaborative Study Canvas • Pen, shapes & notes sync live</p>
          </div>
        )}
      </div>
    </div>
  );
};
