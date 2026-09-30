import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Box, Eye, EyeOff, Download, Layers, Activity, Flame, Ruler } from 'lucide-react';
import WoundRulerFrame from './WoundRulerFrame';
import clsx from 'clsx';

/**
 * WoundFullViewerModal - High-definition full view modal for clinical wound assessment
 * Features:
 * - High-res 4-sided calibrated ruler frame
 * - Layer switching: AI Tissue Map / Original Photo / Thermal Overlay
 * - Interactive Calipers Toggle
 * - 3D Depth Visualization button
 * - Zoom & Pan Controls
 * - Framed Image Export
 * - Real-time Dimension & Composition HUD
 */
export default function WoundFullViewerModal({
  isOpen,
  onClose,
  originalSrc,
  segmentationSrc,
  thermalSrc,
  pixelsPerCm,
  measurements,
  tissueStatistics,
  depthAssessment,
  onOpen3D,
}) {
  const [activeLayer, setActiveLayer] = useState('segmentation'); // 'segmentation' | 'original' | 'thermal'
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [showCalipers, setShowCalipers] = useState(true);
  const modalRulerRef = useRef(null);

  // Reset zoom on open
  useEffect(() => {
    if (isOpen) {
      setZoomLevel(1);
      setPan({ x: 0, y: 0 });
      setActiveLayer('segmentation');
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setZoomLevel(z => Math.min(3, z + 0.2));
      if (e.key === '-' || e.key === '_') setZoomLevel(z => Math.max(0.6, z - 0.2));
      if (e.key === '0') { setZoomLevel(1); setPan({ x: 0, y: 0 }); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Active image source based on selected layer
  const currentSrc = activeLayer === 'original'
    ? originalSrc
    : activeLayer === 'thermal' && thermalSrc
      ? thermalSrc
      : segmentationSrc;

  // Pan handlers
  const handleMouseDown = (e) => {
    if (zoomLevel > 1) {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
  };

  const handleMouseUp = () => setIsPanning(false);

  // Export current framed canvas
  const handleExportFramedImage = async () => {
    if (modalRulerRef.current?.getFramedCanvasDataUrl) {
      try {
        const dataUrl = await modalRulerRef.current.getFramedCanvasDataUrl();
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `WoundCare_Calibrated_${activeLayer}_${new Date().toISOString().slice(0,10)}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (err) {
        console.error('Export error:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md animate-fadeIn">
      {/* Top Header Toolbar */}
      <div className="flex items-center justify-between px-6 py-3.5 bg-slate-900 border-b border-slate-800 text-white select-none">
        {/* Left: Title & Scale Badge */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
            <Ruler className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
              Clinical Calibrated Analysis • Full View
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {pixelsPerCm ? (
                <span className="font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                  Scale: 1 cm = {Math.round(pixelsPerCm)} px
                </span>
              ) : (
                <span className="text-amber-400">Uncalibrated Scale</span>
              )}
              <span>•</span>
              <span>Zoom: {Math.round(zoomLevel * 100)}%</span>
            </div>
          </div>
        </div>

        {/* Center: Layer Selector */}
        <div className="flex items-center bg-slate-800/90 p-1 rounded-xl border border-slate-700">
          <button
            onClick={() => setActiveLayer('segmentation')}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all",
              activeLayer === 'segmentation' ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Layers className="w-3.5 h-3.5" />
            Tissue Map
          </button>
          <button
            onClick={() => setActiveLayer('original')}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all",
              activeLayer === 'original' ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Eye className="w-3.5 h-3.5" />
            Original Photo
          </button>
          {thermalSrc && (
            <button
              onClick={() => setActiveLayer('thermal')}
              className={clsx(
                "px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all",
                activeLayer === 'thermal' ? "bg-red-600 text-white shadow-sm" : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Flame className="w-3.5 h-3.5" />
              Thermal
            </button>
          )}
        </div>

        {/* Right: Actions (3D View, Calipers, Zoom, Export, Close) */}
        <div className="flex items-center gap-2">
          {/* Calipers Toggle */}
          <button
            onClick={() => setShowCalipers(s => !s)}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border",
              showCalipers
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                : "bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200"
            )}
            title="Toggle Caliper Projection Lines"
          >
            {showCalipers ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>{showCalipers ? "Calipers Active" : "Show Calipers"}</span>
          </button>

          {/* 3D Depth View Button */}
          {onOpen3D && (
            <button
              onClick={() => { onClose(); onOpen3D(); }}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md transition-all flex items-center gap-1.5 hover:scale-105"
            >
              <Box className="w-3.5 h-3.5" />
              <span>3D Depth View</span>
            </button>
          )}

          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-800 rounded-lg border border-slate-700 p-0.5">
            <button
              onClick={() => setZoomLevel(z => Math.max(0.6, z - 0.2))}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setZoomLevel(1); setPan({ x: 0, y: 0 }); }}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors"
              title="Reset Zoom (100%)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(z => Math.min(3, z + 0.2))}
              className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExportFramedImage}
            className="p-2 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            title="Download Framed Image"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-red-600/80 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition-colors ml-2"
            title="Close Full View (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Center Viewport */}
      <div
        className={clsx(
          "flex-1 relative overflow-hidden flex items-center justify-center p-6 select-none",
          zoomLevel > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-default"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
            transformOrigin: 'center center',
            transition: isPanning ? 'none' : 'transform 0.15s ease-out',
          }}
          className="max-w-full max-h-full flex items-center justify-center"
        >
          <WoundRulerFrame
            ref={modalRulerRef}
            src={currentSrc}
            pixelsPerCm={pixelsPerCm}
            measurements={measurements}
            showCalipersDefault={showCalipers}
            title={`Calibrated Analysis (${activeLayer.toUpperCase()})`}
            className="max-h-[75vh]"
          />
        </div>
      </div>

      {/* Bottom Clinical HUD Strip */}
      <div className="bg-slate-900 border-t border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-300">
        {/* Left: Extent Measurements */}
        {measurements && (
          <div className="flex items-center gap-4 font-medium">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <span className="text-slate-400">Width:</span>
              <span className="text-white font-bold font-mono">
                {pixelsPerCm
                  ? `${(measurements.width_px / pixelsPerCm).toFixed(2)} cm`
                  : `${measurements.width_px} px`}
              </span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Height:</span>
              <span className="text-white font-bold font-mono">
                {pixelsPerCm
                  ? `${(measurements.height_px / pixelsPerCm).toFixed(2)} cm`
                  : `${measurements.height_px} px`}
              </span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Area:</span>
              <span className="text-white font-bold font-mono">
                {pixelsPerCm
                  ? `${(measurements.area_px / (pixelsPerCm * pixelsPerCm)).toFixed(2)} cm²`
                  : `${measurements.area_px} px²`}
              </span>
            </div>
            {depthAssessment && (
              <>
                <span>•</span>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Depth:</span>
                  <span className={clsx(
                    "px-2 py-0.5 rounded font-bold text-[11px]",
                    depthAssessment === "Superficial" ? "bg-green-500/20 text-green-300 border border-green-500/30" :
                    depthAssessment === "Partial-Thickness" ? "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30" :
                    "bg-red-500/20 text-red-300 border border-red-500/30"
                  )}>
                    {depthAssessment}
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Right: Tissue Breakdown Pills */}
        {tissueStatistics && (
          <div className="flex items-center gap-3">
            {Object.entries(tissueStatistics).map(([tissue, pct]) => (
              <div key={tissue} className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700/80">
                <div className={clsx("w-2.5 h-2.5 rounded-full",
                  tissue === 'Granulation' ? 'bg-red-500' :
                  tissue === 'Slough' ? 'bg-yellow-400' :
                  tissue === 'Eschar' ? 'bg-black border border-slate-600' :
                  tissue === 'Tendon' ? 'bg-cyan-400' :
                  tissue === 'Bone' ? 'bg-amber-200' :
                  'bg-blue-400'
                )} />
                <span className="text-slate-400">{tissue}:</span>
                <span className="font-bold text-white font-mono">{pct}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
