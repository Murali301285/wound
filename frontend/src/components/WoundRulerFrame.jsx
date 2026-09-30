import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { Ruler, Maximize2, Eye, EyeOff, Box } from 'lucide-react';

/**
 * WoundRulerFrame - Frames a wound image with high-precision 4-sided medical rulers (Top, Bottom, Left, Right)
 * and optional caliper projection lines based on calibration (pixelsPerCm).
 */
const WoundRulerFrame = forwardRef(({
  src,
  alt = "Wound Analysis",
  pixelsPerCm = null,
  measurements = null,
  showCalipersDefault = true,
  className = "",
  title = "Calibrated Scale Frame",
  onView3D = null,
  onMaximize = null,
}, ref) => {
  const [showCalipers, setShowCalipers] = useState(showCalipersDefault);
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef(null);
  const containerRef = useRef(null);

  // Ruler margin sizes (px)
  const TOP_RULER_H = 32;
  const BOTTOM_RULER_H = 32;
  const LEFT_RULER_W = 44;
  const RIGHT_RULER_W = 44;

  const handleImageLoad = () => {
    if (!imgRef.current) return;
    const { clientWidth, clientHeight, naturalWidth, naturalHeight } = imgRef.current;
    setImgDimensions({
      width: clientWidth,
      height: clientHeight,
      naturalWidth: naturalWidth || clientWidth,
      naturalHeight: naturalHeight || clientHeight,
    });
    setIsLoaded(true);
  };

  useEffect(() => {
    const handleResize = () => {
      if (imgRef.current) {
        setImgDimensions(prev => ({
          ...prev,
          width: imgRef.current.clientWidth,
          height: imgRef.current.clientHeight,
        }));
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Compute scale conversions
  const naturalW = imgDimensions.naturalWidth || 1;
  const naturalH = imgDimensions.naturalHeight || 1;
  const displayW = imgDimensions.width || 1;
  const displayH = imgDimensions.height || 1;

  const scaleFactorX = displayW / naturalW;
  const scaleFactorY = displayH / naturalH;

  // Real-world dimensions in CM (if calibrated)
  const totalWidthCm = pixelsPerCm ? naturalW / pixelsPerCm : null;
  const totalHeightCm = pixelsPerCm ? naturalH / pixelsPerCm : null;

  // Bounding box in display coordinates
  const bbox = measurements?.bbox; // [x, y, w, h] in natural image px
  const hasBbox = Array.isArray(bbox) && bbox.length === 4 && bbox[2] > 0 && bbox[3] > 0;

  const bboxDisplay = hasBbox ? {
    x: bbox[0] * scaleFactorX,
    y: bbox[1] * scaleFactorY,
    w: bbox[2] * scaleFactorX,
    h: bbox[3] * scaleFactorY,
    x2: (bbox[0] + bbox[2]) * scaleFactorX,
    y2: (bbox[1] + bbox[3]) * scaleFactorY,
  } : null;

  // Caliper values in CM
  const woundWidthCm = (hasBbox && pixelsPerCm) ? (bbox[2] / pixelsPerCm).toFixed(2) : null;
  const woundHeightCm = (hasBbox && pixelsPerCm) ? (bbox[3] / pixelsPerCm).toFixed(2) : null;

  // Helper to determine tick and label intervals based on pxPerCm display density
  const getIntervals = (pxPerCmDisplay) => {
    let labelStep = 1;
    if (pxPerCmDisplay < 6) labelStep = 20;
    else if (pxPerCmDisplay < 12) labelStep = 10;
    else if (pxPerCmDisplay < 24) labelStep = 5;
    else if (pxPerCmDisplay < 38) labelStep = 2;
    else labelStep = 1;

    const showMinorMm = pxPerCmDisplay >= 40; // 0.1cm minor ticks only when scale is high
    const showHalfCm = pxPerCmDisplay >= 16;  // 0.5cm ticks
    const step = showMinorMm ? 0.1 : (showHalfCm ? 0.5 : 1);

    return { labelStep, showMinorMm, showHalfCm, step };
  };

  // Generate Ticks for Horizontal Rulers (Top & Bottom)
  const renderHorizontalTicks = (isTop = true) => {
    if (!isLoaded || displayW <= 0) return null;

    const ticks = [];
    if (pixelsPerCm && totalWidthCm) {
      const maxCm = Math.ceil(totalWidthCm);
      const pxPerCmDisplay = pixelsPerCm * scaleFactorX;
      const { labelStep, showMinorMm, showHalfCm, step } = getIntervals(pxPerCmDisplay);

      for (let cm = 0; cm <= maxCm; cm = Math.round((cm + step) * 10) / 10) {
        const xPos = cm * pxPerCmDisplay;
        if (xPos > displayW + 1) break;

        const isLabel = Math.abs(cm % labelStep) < 0.01 || Math.abs((cm % labelStep) - labelStep) < 0.01;
        const isIntegerCm = Math.abs(cm - Math.round(cm)) < 0.01;
        const isHalfCm = Math.abs(cm - (Math.floor(cm) + 0.5)) < 0.01;

        if (isLabel) {
          ticks.push(
            <g key={`h-lbl-${cm}`} transform={`translate(${xPos}, 0)`}>
              <line
                x1="0"
                y1={isTop ? TOP_RULER_H - 12 : 0}
                x2="0"
                y2={isTop ? TOP_RULER_H : 12}
                stroke="#facc15"
                strokeWidth="1.5"
              />
              <text
                x="0"
                y={isTop ? TOP_RULER_H - 15 : 24}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill="#f8fafc"
                className="select-none font-mono"
              >
                {Math.round(cm)}
              </text>
            </g>
          );
        } else if (isIntegerCm) {
          ticks.push(
            <line
              key={`h-int-${cm}`}
              x1={xPos}
              y1={isTop ? TOP_RULER_H - 10 : 0}
              x2={xPos}
              y2={isTop ? TOP_RULER_H : 10}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          );
        } else if (isHalfCm) {
          ticks.push(
            <line
              key={`h-half-${cm}`}
              x1={xPos}
              y1={isTop ? TOP_RULER_H - 7 : 0}
              x2={xPos}
              y2={isTop ? TOP_RULER_H : 7}
              stroke="#94a3b8"
              strokeWidth="1"
            />
          );
        } else if (showMinorMm) {
          ticks.push(
            <line
              key={`h-minor-${cm}`}
              x1={xPos}
              y1={isTop ? TOP_RULER_H - 4 : 0}
              x2={xPos}
              y2={isTop ? TOP_RULER_H : 4}
              stroke="#64748b"
              strokeWidth="0.75"
            />
          );
        }
      }
    } else {
      // Uncalibrated fallback: Percentage grid (0% to 100%)
      for (let p = 0; p <= 100; p += 10) {
        const xPos = (p / 100) * displayW;
        ticks.push(
          <g key={`h-pct-${p}`} transform={`translate(${xPos}, 0)`}>
            <line
              x1="0"
              y1={isTop ? TOP_RULER_H - 8 : 0}
              x2="0"
              y2={isTop ? TOP_RULER_H : 8}
              stroke="#94a3b8"
              strokeWidth="1"
            />
            {p % 20 === 0 && (
              <text
                x="0"
                y={isTop ? TOP_RULER_H - 12 : 20}
                textAnchor="middle"
                fontSize="9"
                fill="#cbd5e1"
                className="select-none font-mono"
              >
                {p}%
              </text>
            )}
          </g>
        );
      }
    }

    return ticks;
  };

  // Generate Ticks for Vertical Rulers (Left & Right)
  const renderVerticalTicks = (isLeft = true) => {
    if (!isLoaded || displayH <= 0) return null;

    const ticks = [];
    if (pixelsPerCm && totalHeightCm) {
      const maxCm = Math.ceil(totalHeightCm);
      const pxPerCmDisplay = pixelsPerCm * scaleFactorY;
      const { labelStep, showMinorMm, showHalfCm, step } = getIntervals(pxPerCmDisplay);

      for (let cm = 0; cm <= maxCm; cm = Math.round((cm + step) * 10) / 10) {
        const yPos = cm * pxPerCmDisplay;
        if (yPos > displayH + 1) break;

        const isLabel = Math.abs(cm % labelStep) < 0.01 || Math.abs((cm % labelStep) - labelStep) < 0.01;
        const isIntegerCm = Math.abs(cm - Math.round(cm)) < 0.01;
        const isHalfCm = Math.abs(cm - (Math.floor(cm) + 0.5)) < 0.01;

        if (isLabel) {
          ticks.push(
            <g key={`v-lbl-${cm}`} transform={`translate(0, ${yPos})`}>
              <line
                x1={isLeft ? LEFT_RULER_W - 12 : 0}
                y1="0"
                x2={isLeft ? LEFT_RULER_W : 12}
                y2="0"
                stroke="#facc15"
                strokeWidth="1.5"
              />
              <text
                x={isLeft ? LEFT_RULER_W - 16 : 18}
                y="3.5"
                textAnchor={isLeft ? "end" : "start"}
                fontSize="10"
                fontWeight="700"
                fill="#f8fafc"
                className="select-none font-mono"
              >
                {Math.round(cm)}
              </text>
            </g>
          );
        } else if (isIntegerCm) {
          ticks.push(
            <line
              key={`v-int-${cm}`}
              x1={isLeft ? LEFT_RULER_W - 10 : 0}
              y1={yPos}
              x2={isLeft ? LEFT_RULER_W : 10}
              y2={yPos}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          );
        } else if (isHalfCm) {
          ticks.push(
            <line
              key={`v-half-${cm}`}
              x1={isLeft ? LEFT_RULER_W - 7 : 0}
              y1={yPos}
              x2={isLeft ? LEFT_RULER_W : 7}
              y2={yPos}
              stroke="#94a3b8"
              strokeWidth="1"
            />
          );
        } else if (showMinorMm) {
          ticks.push(
            <line
              key={`v-minor-${cm}`}
              x1={isLeft ? LEFT_RULER_W - 4 : 0}
              y1={yPos}
              x2={isLeft ? LEFT_RULER_W : 4}
              y2={yPos}
              stroke="#64748b"
              strokeWidth="0.75"
            />
          );
        }
      }
    } else {
      // Uncalibrated fallback: Percentage grid (0% to 100%)
      for (let p = 0; p <= 100; p += 10) {
        const yPos = (p / 100) * displayH;
        ticks.push(
          <g key={`v-pct-${p}`} transform={`translate(0, ${yPos})`}>
            <line
              x1={isLeft ? LEFT_RULER_W - 8 : 0}
              y1="0"
              x2={isLeft ? LEFT_RULER_W : 8}
              y2="0"
              stroke="#94a3b8"
              strokeWidth="1"
            />
            {p % 20 === 0 && (
              <text
                x={isLeft ? LEFT_RULER_W - 12 : 14}
                y="3"
                textAnchor={isLeft ? "end" : "start"}
                fontSize="9"
                fill="#cbd5e1"
                className="select-none font-mono"
              >
                {p}%
              </text>
            )}
          </g>
        );
      }
    }

    return ticks;
  };

  // Imperative Canvas Export (for High-Res PDF inclusion)
  useImperativeHandle(ref, () => ({
    getFramedCanvasDataUrl: async () => {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = src;
        img.onload = () => {
          const natW = img.naturalWidth;
          const natH = img.naturalHeight;

          // Target canvas sizing with high-res borders
          const borderW = Math.max(50, Math.round(natW * 0.08));
          const borderH = Math.max(40, Math.round(natH * 0.06));

          const totalW = natW + borderW * 2;
          const totalH = natH + borderH * 2;

          const canvas = document.createElement("canvas");
          canvas.width = totalW;
          canvas.height = totalH;
          const ctx = canvas.getContext("2d");

          // Background
          ctx.fillStyle = "#0f172a"; // Slate 900
          ctx.fillRect(0, 0, totalW, totalH);

          // Draw Image in Center
          ctx.drawImage(img, borderW, borderH, natW, natH);

          // Draw Outer Border Frame Line
          ctx.strokeStyle = "#38bdf8"; // Sky 400
          ctx.lineWidth = 2;
          ctx.strokeRect(borderW, borderH, natW, natH);

          // Draw Ticks & Labels (in natural coordinates)
          ctx.fillStyle = "#f8fafc";
          ctx.font = `bold ${Math.max(12, Math.round(borderH * 0.35))}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          if (pixelsPerCm) {
            const maxCmX = Math.ceil(natW / pixelsPerCm);
            const maxCmY = Math.ceil(natH / pixelsPerCm);

            // Horizontal Ticks (Top & Bottom)
            for (let cm = 0; cm <= maxCmX; cm++) {
              const x = borderW + cm * pixelsPerCm;
              if (x > borderW + natW) break;

              // Top Major Tick
              ctx.strokeStyle = "#facc15";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(x, borderH);
              ctx.lineTo(x, borderH - 12);
              ctx.stroke();

              // Top Label
              ctx.fillText(`${cm}`, x, borderH - 22);

              // Bottom Major Tick
              ctx.beginPath();
              ctx.moveTo(x, borderH + natH);
              ctx.lineTo(x, borderH + natH + 12);
              ctx.stroke();

              // Bottom Label
              ctx.fillText(`${cm}`, x, borderH + natH + 24);
            }

            // Vertical Ticks (Left & Right)
            ctx.textAlign = "right";
            for (let cm = 0; cm <= maxCmY; cm++) {
              const y = borderH + cm * pixelsPerCm;
              if (y > borderH + natH) break;

              // Left Major Tick
              ctx.strokeStyle = "#facc15";
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(borderW, y);
              ctx.lineTo(borderW - 12, y);
              ctx.stroke();

              // Left Label
              ctx.fillText(`${cm}`, borderW - 16, y);

              // Right Major Tick
              ctx.beginPath();
              ctx.moveTo(borderW + natW, y);
              ctx.lineTo(borderW + natW + 12, y);
              ctx.stroke();

              // Right Label
              ctx.save();
              ctx.textAlign = "left";
              ctx.fillText(`${cm}`, borderW + natW + 16, y);
              ctx.restore();
            }
          }

          // Corner Unit Badges
          ctx.fillStyle = "#38bdf8";
          ctx.font = `bold ${Math.max(11, Math.round(borderH * 0.3))}px sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText("cm", borderW / 2, borderH / 2);

          resolve(canvas.toDataURL("image/jpeg", 0.92));
        };
        img.onerror = () => resolve(src);
      });
    },
  }));

  return (
    <div className={`flex flex-col bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 shadow-xl select-none ${className}`}>
      {/* Frame Header Bar */}
      <div className="bg-slate-800 px-4 py-2 flex items-center justify-between border-b border-slate-700 text-xs">
        <div className="flex items-center gap-2 text-slate-300 font-semibold">
          <Ruler className="w-4 h-4 text-yellow-400" />
          <span>{title}</span>
          {pixelsPerCm ? (
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-mono">
              1 cm = {Math.round(pixelsPerCm)} px
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px]">
              Approx Scale (Uncalibrated)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onMaximize && (
            <button
              onClick={onMaximize}
              className="px-2.5 py-1 rounded-md bg-slate-700/80 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-600/80 shadow-sm transition-all flex items-center gap-1.5 text-xs font-semibold"
              title="Full View / Maximize Modal"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Full View</span>
            </button>
          )}

          {onView3D && (
            <button
              onClick={onView3D}
              className="px-2.5 py-1 rounded-md bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-sm transition-all flex items-center gap-1.5 text-xs font-semibold"
              title="View in 3D (Depth Visualization)"
            >
              <Box className="w-3.5 h-3.5" />
              <span>3D View</span>
            </button>
          )}

          {hasBbox && (
            <button
              onClick={() => setShowCalipers(!showCalipers)}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition-colors ${
                showCalipers
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "bg-slate-700 text-slate-400 hover:text-slate-200"
              }`}
              title="Toggle Wound Caliper Projection Lines"
            >
              {showCalipers ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{showCalipers ? "Calipers Active" : "Show Calipers"}</span>
            </button>
          )}
        </div>
      </div>

      {/* 4-Sided Calibrated Frame Grid */}
      <div
        ref={containerRef}
        className="relative bg-slate-950 p-2 flex items-center justify-center overflow-auto"
      >
        <div className="inline-grid grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] items-center justify-items-center">
          
          {/* Top-Left Corner Badge */}
          <div
            style={{ width: LEFT_RULER_W, height: TOP_RULER_H }}
            className="flex items-center justify-center bg-slate-900 border-r border-b border-slate-700/80 rounded-tl-lg"
          >
            <span className="text-[11px] font-black text-yellow-400 font-mono tracking-wider">
              {pixelsPerCm ? "cm" : "%"}
            </span>
          </div>

          {/* Top Horizontal Ruler */}
          <div
            style={{ width: displayW || '100%', height: TOP_RULER_H }}
            className="relative bg-slate-900 border-b border-slate-700/80"
          >
            <svg className="w-full h-full">
              {renderHorizontalTicks(true)}

              {/* Wound Width Caliper Highlight on Top Ruler */}
              {showCalipers && bboxDisplay && (
                <g>
                  {/* Highlight bar */}
                  <rect
                    x={bboxDisplay.x}
                    y={TOP_RULER_H - 6}
                    width={bboxDisplay.w}
                    height="6"
                    fill="#06b6d4"
                    opacity="0.85"
                  />
                  {/* Caliper start marker */}
                  <line
                    x1={bboxDisplay.x}
                    y1={0}
                    x2={bboxDisplay.x}
                    y2={TOP_RULER_H}
                    stroke="#06b6d4"
                    strokeWidth="2"
                  />
                  {/* Caliper end marker */}
                  <line
                    x1={bboxDisplay.x2}
                    y1={0}
                    x2={bboxDisplay.x2}
                    y2={TOP_RULER_H}
                    stroke="#06b6d4"
                    strokeWidth="2"
                  />
                </g>
              )}
            </svg>
          </div>

          {/* Top-Right Corner Badge */}
          <div
            style={{ width: RIGHT_RULER_W, height: TOP_RULER_H }}
            className="flex items-center justify-center bg-slate-900 border-l border-b border-slate-700/80 rounded-tr-lg text-[10px] text-slate-400 font-mono"
          >
            0
          </div>

          {/* Left Vertical Ruler */}
          <div
            style={{ width: LEFT_RULER_W, height: displayH || 'auto' }}
            className="relative bg-slate-900 border-r border-slate-700/80"
          >
            <svg className="w-full h-full">
              {renderVerticalTicks(true)}

              {/* Wound Height Caliper Highlight on Left Ruler */}
              {showCalipers && bboxDisplay && (
                <g>
                  <rect
                    x={LEFT_RULER_W - 6}
                    y={bboxDisplay.y}
                    width="6"
                    height={bboxDisplay.h}
                    fill="#06b6d4"
                    opacity="0.85"
                  />
                  <line
                    x1={0}
                    y1={bboxDisplay.y}
                    x2={LEFT_RULER_W}
                    y2={bboxDisplay.y}
                    stroke="#06b6d4"
                    strokeWidth="2"
                  />
                  <line
                    x1={0}
                    y1={bboxDisplay.y2}
                    x2={LEFT_RULER_W}
                    y2={bboxDisplay.y2}
                    stroke="#06b6d4"
                    strokeWidth="2"
                  />
                </g>
              )}
            </svg>
          </div>

          {/* Center Image Container */}
          <div className="relative inline-block bg-black shadow-inner">
            <img
              ref={imgRef}
              src={src}
              alt={alt}
              onLoad={handleImageLoad}
              className="max-h-[500px] w-auto object-contain block mx-auto"
            />

            {/* Floating Action Buttons inside image */}
            <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5">
              {onMaximize && (
                <button
                  onClick={(e) => { e.stopPropagation(); onMaximize(); }}
                  className="p-2 rounded-full shadow-lg backdrop-blur-md bg-slate-800/90 hover:bg-slate-700 text-white border border-slate-600/60 transition-all hover:scale-110 flex items-center justify-center cursor-pointer"
                  title="Full View / Maximize Modal"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}
              {onView3D && (
                <button
                  onClick={(e) => { e.stopPropagation(); onView3D(); }}
                  className="p-2 rounded-full shadow-lg backdrop-blur-md bg-indigo-600/90 hover:bg-indigo-600 text-white border border-indigo-400/50 transition-all hover:scale-110 flex items-center justify-center cursor-pointer"
                  title="View in 3D (Depth Visualization)"
                >
                  <Box className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Caliper Projection Overlay on Top of Image */}
            {isLoaded && showCalipers && bboxDisplay && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                {/* Horizontal Caliper Projection Lines to Left & Right Rulers */}
                <line
                  x1={0}
                  y1={bboxDisplay.y}
                  x2={displayW}
                  y2={bboxDisplay.y}
                  stroke="#06b6d4"
                  strokeWidth="1.2"
                  strokeDasharray="4,4"
                  opacity="0.75"
                />
                <line
                  x1={0}
                  y1={bboxDisplay.y2}
                  x2={displayW}
                  y2={bboxDisplay.y2}
                  stroke="#06b6d4"
                  strokeWidth="1.2"
                  strokeDasharray="4,4"
                  opacity="0.75"
                />

                {/* Vertical Caliper Projection Lines to Top & Bottom Rulers */}
                <line
                  x1={bboxDisplay.x}
                  y1={0}
                  x2={bboxDisplay.x}
                  y2={displayH}
                  stroke="#06b6d4"
                  strokeWidth="1.2"
                  strokeDasharray="4,4"
                  opacity="0.75"
                />
                <line
                  x1={bboxDisplay.x2}
                  y1={0}
                  x2={bboxDisplay.x2}
                  y2={displayH}
                  stroke="#06b6d4"
                  strokeWidth="1.2"
                  strokeDasharray="4,4"
                  opacity="0.75"
                />

                {/* Caliper Width Dimension Callout Pill */}
                {woundWidthCm && (
                  <g transform={`translate(${bboxDisplay.x + bboxDisplay.w / 2}, ${Math.max(16, bboxDisplay.y - 12)})`}>
                    <rect
                      x="-38"
                      y="-11"
                      width="76"
                      height="20"
                      rx="6"
                      fill="#0e7490"
                      stroke="#22d3ee"
                      strokeWidth="1.5"
                      className="shadow-md"
                    />
                    <text
                      x="0"
                      y="3"
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="bold"
                      fill="#ffffff"
                      fontFamily="monospace"
                    >
                      ↔ {woundWidthCm} cm
                    </text>
                  </g>
                )}

                {/* Caliper Height Dimension Callout Pill */}
                {woundHeightCm && (
                  <g transform={`translate(${Math.max(24, bboxDisplay.x - 18)}, ${bboxDisplay.y + bboxDisplay.h / 2})`}>
                    <rect
                      x="-38"
                      y="-10"
                      width="76"
                      height="20"
                      rx="6"
                      fill="#0e7490"
                      stroke="#22d3ee"
                      strokeWidth="1.5"
                      className="shadow-md"
                    />
                    <text
                      x="0"
                      y="4"
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="bold"
                      fill="#ffffff"
                      fontFamily="monospace"
                    >
                      ↕ {woundHeightCm} cm
                    </text>
                  </g>
                )}
              </svg>
            )}
          </div>

          {/* Right Vertical Ruler */}
          <div
            style={{ width: RIGHT_RULER_W, height: displayH || 'auto' }}
            className="relative bg-slate-900 border-l border-slate-700/80"
          >
            <svg className="w-full h-full">
              {renderVerticalTicks(false)}

              {/* Wound Height Caliper Highlight on Right Ruler */}
              {showCalipers && bboxDisplay && (
                <g>
                  <rect
                    x="0"
                    y={bboxDisplay.y}
                    width="6"
                    height={bboxDisplay.h}
                    fill="#06b6d4"
                    opacity="0.85"
                  />
                  <line
                    x1={0}
                    y1={bboxDisplay.y}
                    x2={RIGHT_RULER_W}
                    y2={bboxDisplay.y}
                    stroke="#06b6d4"
                    strokeWidth="2"
                  />
                  <line
                    x1={0}
                    y1={bboxDisplay.y2}
                    x2={RIGHT_RULER_W}
                    y2={bboxDisplay.y2}
                    stroke="#06b6d4"
                    strokeWidth="2"
                  />
                </g>
              )}
            </svg>
          </div>

          {/* Bottom-Left Corner Badge */}
          <div
            style={{ width: LEFT_RULER_W, height: BOTTOM_RULER_H }}
            className="flex items-center justify-center bg-slate-900 border-r border-t border-slate-700/80 rounded-bl-lg text-[10px] text-slate-400 font-mono"
          >
            0
          </div>

          {/* Bottom Horizontal Ruler */}
          <div
            style={{ width: displayW || '100%', height: BOTTOM_RULER_H }}
            className="relative bg-slate-900 border-t border-slate-700/80"
          >
            <svg className="w-full h-full">
              {renderHorizontalTicks(false)}

              {/* Wound Width Caliper Highlight on Bottom Ruler */}
              {showCalipers && bboxDisplay && (
                <g>
                  <rect
                    x={bboxDisplay.x}
                    y="0"
                    width={bboxDisplay.w}
                    height="6"
                    fill="#06b6d4"
                    opacity="0.85"
                  />
                  <line
                    x1={bboxDisplay.x}
                    y1={0}
                    x2={bboxDisplay.x}
                    y2={BOTTOM_RULER_H}
                    stroke="#06b6d4"
                    strokeWidth="2"
                  />
                  <line
                    x1={bboxDisplay.x2}
                    y1={0}
                    x2={bboxDisplay.x2}
                    y2={BOTTOM_RULER_H}
                    stroke="#06b6d4"
                    strokeWidth="2"
                  />
                </g>
              )}
            </svg>
          </div>

          {/* Bottom-Right Corner Badge */}
          <div
            style={{ width: RIGHT_RULER_W, height: BOTTOM_RULER_H }}
            className="flex items-center justify-center bg-slate-900 border-l border-t border-slate-700/80 rounded-br-lg text-[10px] text-yellow-400 font-mono font-bold"
          >
            cm
          </div>

        </div>
      </div>

      {/* Frame Footer Info */}
      <div className="bg-slate-900/90 px-4 py-2 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-4">
          {woundWidthCm && woundHeightCm ? (
            <>
              <span>Wound Extent: <strong className="text-cyan-300 font-mono">{woundWidthCm} cm (W) × {woundHeightCm} cm (H)</strong></span>
              {measurements?.area_px && pixelsPerCm && (
                <span>Area: <strong className="text-emerald-300 font-mono">{(measurements.area_px / (pixelsPerCm * pixelsPerCm)).toFixed(2)} cm²</strong></span>
              )}
            </>
          ) : (
            <span>Use the scale calibration tool to see real-world cm measurements.</span>
          )}
        </div>
        <div className="text-[11px] text-slate-500">
          Major: 1.0 cm • Minor: 0.5 cm / 0.1 cm
        </div>
      </div>
    </div>
  );
});

export default WoundRulerFrame;
