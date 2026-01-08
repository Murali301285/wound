import React, { useState, useRef, useEffect } from 'react';
import { Upload, Activity, FileText, AlertCircle, Loader2, RefreshCw, Info, X, Ruler, Download, MessageSquare, PenTool, Lightbulb, Box, CheckCircle2, TrendingUp, User, Flame } from 'lucide-react';
import Wound3DViewer from './components/Wound3DViewer';
import { jsPDF } from "jspdf";
import clsx from 'clsx';

function App() {
  /* State */
  const [currentView, setCurrentView] = useState('single'); // 'single' | 'compare' | 'forecast'
  const [simulationResult, setSimulationResult] = useState(null);

  // Single Analysis State
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [result, setResult] = useState(null);

  // Comparison Analysis State (Image 2)
  const [compareImage, setCompareImage] = useState(null);
  const [comparePreviewUrl, setComparePreviewUrl] = useState(null);
  const [compareResult, setCompareResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showReference, setShowReference] = useState(false);

  // Doctor Notes State
  const [doctorNotes, setDoctorNotes] = useState("");
  const [show3D, setShow3D] = useState(false);
  const [simulateInfection, setSimulateInfection] = useState(false);
  const [view3DImage, setView3DImage] = useState(null);
  const [soapNote, setSoapNote] = useState(null);
  const [scribeLoading, setScribeLoading] = useState(false);
  const [showThermal, setShowThermal] = useState(false);
  const [thermalImage, setThermalImage] = useState(null);

  // Calibration State
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationLine, setCalibrationLine] = useState({ start: null, end: null });
  const [pixelsPerCm, setPixelsPerCm] = useState(null);
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [calibrationLength, setCalibrationLength] = useState(1);

  const fileInputRef = useRef(null);
  const compareInputRef = useRef(null); // Ref for 2nd image
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  const handleImageSelect = (e, isCompare = false) => {
    const file = e.target.files[0];
    if (file) {
      if (isCompare) {
        setCompareImage(file);
        setComparePreviewUrl(URL.createObjectURL(file));
        setCompareResult(null);
      } else {
        setSelectedImage(file);
        setPreviewUrl(URL.createObjectURL(file));
        setResult(null);
        setThermalImage(null);
        setShowThermal(false);
      }
      setError(null);
      setPixelsPerCm(null);
    }
  };

  const handleThermalToggle = async () => {
    if (showThermal) {
      setShowThermal(false);
      return;
    }

    if (thermalImage) {
      setShowThermal(true);
      return;
    }

    if (!selectedImage) return;

    try {
      const formData = new FormData();
      formData.append('image', selectedImage);

      const res = await fetch('http://127.0.0.1:6500/api/thermal', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      setThermalImage(data.thermal_image);
      setShowThermal(true);
    } catch (e) {
      console.error(e);
    }
  };

  const handleAnalyze = async () => {
    if (currentView === 'compare') {
      await handleCompareAnalyze();
      return;
    }

    if (!selectedImage) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('image', selectedImage);

    try {
      const response = await fetch('http://127.0.0.1:6500/api/predict', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Analysis failed');

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCompareAnalyze = async () => {
    if (!selectedImage || !compareImage) return;

    setLoading(true);
    setError(null);

    try {
      // Parallel Requests
      const fd1 = new FormData(); fd1.append('image', selectedImage);
      const fd2 = new FormData(); fd2.append('image', compareImage);

      const [res1, res2] = await Promise.all([
        fetch('http://127.0.0.1:6500/api/predict', { method: 'POST', body: fd1 }),
        fetch('http://127.0.0.1:6500/api/predict', { method: 'POST', body: fd2 })
      ]);

      if (!res1.ok || !res2.ok) throw new Error("One or both analyses failed.");

      const data1 = await res1.json();
      const data2 = await res2.json();

      setResult(data1);
      setCompareResult(data2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleScribe = async () => {
    if (!simulationResult) return;
    setScribeLoading(true);
    setSoapNote(null);
    try {
      const payload = {
        tissue_statistics: simulationResult.tissue_statistics,
        measurements: simulationResult.measurements,
        depth_assessment: simulationResult.depth_assessment,
        doctor_notes: doctorNotes
      };

      const response = await fetch('http://127.0.0.1:6500/api/scribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error('Scribe generation failed');
      const data = await response.json();
      setSoapNote(data.soap_note);
    } catch (err) {
      setError(err.message);
    } finally {
      setScribeLoading(false);
    }
  };

  const handleSimulation = async () => {
    if (!selectedImage) return;
    setLoading(true);
    setSimulationResult(null);
    setError(null);

    const formData = new FormData();
    formData.append('image', selectedImage);
    formData.append('infection', simulateInfection);

    try {
      const response = await fetch('http://127.0.0.1:6500/api/simulate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Simulation failed');
      const data = await response.json();
      setSimulationResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedImage(null);
    setPreviewUrl(null);
    setResult(null);
    setCompareImage(null);
    setComparePreviewUrl(null);
    setCompareResult(null);
    setError(null);
    setPixelsPerCm(null);
    setDoctorNotes("");
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (compareInputRef.current) compareInputRef.current.value = '';
  };

  // Calibration Logic
  const startCalibration = () => {
    setIsCalibrating(true);
    setCalibrationLine({ start: null, end: null });
  };

  const handleMouseDown = (e) => {
    if (!isCalibrating) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCalibrationLine({ start: { x, y }, end: { x, y } });
  };

  const handleMouseMove = (e) => {
    if (!isCalibrating || !calibrationLine.start) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCalibrationLine(prev => ({ ...prev, end: { x, y } }));
  };

  const handleMouseUp = () => {
    if (!isCalibrating) return;
    setIsCalibrating(false);
    setShowCalibrationModal(true);
  };

  const confirmCalibration = () => {
    if (!calibrationLine.start || !calibrationLine.end) return;

    // Calculate distance in screen pixels
    const dx = calibrationLine.end.x - calibrationLine.start.x;
    const dy = calibrationLine.end.y - calibrationLine.start.y;
    const distancePx = Math.sqrt(dx * dx + dy * dy);

    // Determine actual image scaling factor (Screen px vs Natural px)
    const naturalWidth = imageRef.current.naturalWidth;
    const clientWidth = imageRef.current.width;
    const scaleFactor = naturalWidth / clientWidth;

    // Calculate Pixels Per CM (in natural image coordinates)
    const naturalDistancePx = distancePx * scaleFactor;
    const newPixelsPerCm = naturalDistancePx / calibrationLength;

    setPixelsPerCm(newPixelsPerCm);
    setShowCalibrationModal(false);
  };

  const convertPxToCm = (px) => {
    if (!pixelsPerCm) return null;
    return (px / pixelsPerCm).toFixed(2);
  };

  const convertAreaToCm2 = (pxArea) => {
    if (!pixelsPerCm) return null;
    return (pxArea / (pixelsPerCm * pixelsPerCm)).toFixed(2);
  };

  /* Recommendation Logic */
  const getRecommendations = (stats) => {
    const recs = [];
    if (stats.Eschar > 10) recs.push("⚠️ Presence of necrotic tissue. Urgent debridement evaluation recommended. Assess vascular status.");
    if (stats.Slough > 30) recs.push("⚠️ Significant slough detected. Cleanse wound and consider enzymatic or autolytic debridement.");
    if (stats.Granulation > 50) recs.push("✅ Good granulation. Maintain moist wound environment to support angiogenesis.");
    if (recs.length === 0) recs.push("Continue standard wound care protocol and monitor for infection.");
    return recs;
  };

  const generateComparisonPDF = async () => {
    try {
      if (!result || !compareResult) return;

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 15;
      let yPos = 20;

      // Header
      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("WoundAI Progress Report", margin, 20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 30);
      yPos += 50;

      // Side-by-Side Images
      const imgWidth = (pageWidth - (margin * 3)) / 2;
      const imgHeight = imgWidth * 0.75;

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("1. Visual Comparison", margin, yPos);
      yPos += 10;

      const loadImage = (url) => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          const timer = setTimeout(() => reject(new Error("Timeout loading image")), 5000);
          img.onload = () => { clearTimeout(timer); resolve(img); };
          img.onerror = (e) => { clearTimeout(timer); reject(e); };
          img.src = url;
        });
      };

      try {
        if (previewUrl && comparePreviewUrl) {
          const [img1, img2] = await Promise.all([
            loadImage(previewUrl),
            loadImage(comparePreviewUrl)
          ]);

          // Baseline
          doc.setFontSize(10);
          doc.text("Baseline (Initial)", margin, yPos - 2);
          doc.addImage(img1, 'JPEG', margin, yPos, imgWidth, imgHeight);

          // Current
          doc.text("Current (Follow-up)", margin + imgWidth + margin, yPos - 2);
          doc.addImage(img2, 'JPEG', margin + imgWidth + margin, yPos, imgWidth, imgHeight);

          yPos += imgHeight + 10;
        }
      } catch (err) {
        console.error("Error loading images for PDF:", err);
      }

      // Metrics Comparison Table
      doc.text("2. Metrics Comparison", margin, yPos);
      let tableY = yPos + imgHeight + 20;

      const col1 = margin;
      const col2 = margin + 60;
      const col3 = margin + 110;
      const col4 = margin + 160;

      doc.setFontSize(10);
      doc.text("Metric", col1, tableY);
      doc.text("Baseline", col2, tableY);
      doc.text("Current", col3, tableY);
      doc.text("Change", col4, tableY);

      tableY += 5;
      doc.line(margin, tableY, pageWidth - margin, tableY);
      tableY += 10;

      const metrics = [
        { label: "Max Width (px)", v1: result.measurements.width_px, v2: compareResult.measurements.width_px },
        { label: "Max Height (px)", v1: result.measurements.height_px, v2: compareResult.measurements.height_px },
        { label: "Area (px²)", v1: result.measurements.area_px, v2: compareResult.measurements.area_px },
        { label: "Granulation %", v1: result.tissue_statistics.Granulation, v2: compareResult.tissue_statistics.Granulation },
        { label: "Slough %", v1: result.tissue_statistics.Slough, v2: compareResult.tissue_statistics.Slough },
        { label: "Necrosis %", v1: result.tissue_statistics.Eschar, v2: compareResult.tissue_statistics.Eschar },
      ];

      metrics.forEach(m => {
        const v1 = Number(m.v1) || 0;
        const v2 = Number(m.v2) || 0;
        const diff = (v2 - v1).toFixed(1);
        const sign = diff > 0 ? "+" : "";

        doc.text(m.label, col1, tableY);
        doc.text(v1.toString(), col2, tableY);
        doc.text(v2.toString(), col3, tableY);

        if (m.label.includes("Granulation") && diff > 0) doc.setTextColor(0, 150, 0); // Good
        else if (m.label.includes("Slough") && diff < 0) doc.setTextColor(0, 150, 0); // Good
        else doc.setTextColor(100, 100, 100);

        doc.text(`${sign}${diff}`, col4, tableY);
        doc.setTextColor(0, 0, 0);
        tableY += 8;
      });

      doc.save("WoundAI_Comparison_Report.pdf");
    } catch (e) {
      alert("Failed to generate PDF: " + e.message);
      console.error(e);
    }
  };

  /* PDF Generation Logic */
  const generatePDF = () => {
    if (!result || !previewUrl) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = 20;

    // --- Header ---
    doc.setFillColor(37, 99, 235); // Blue-600
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("WoundAI Clinical Report", margin, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const dateStr = new Date().toLocaleString();
    doc.text(`Generated: ${dateStr}`, margin, 30);
    doc.text("Automated Tissue Classification & Measurement System", margin, 35);
    yPos += 30;

    // --- Clinical Assessment ---
    yPos += 15;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("1. Clinical Assessment", margin, yPos);
    yPos += 8;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    // Depth Assessment Box
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 250, 252); // Slate-50
    doc.roundedRect(margin, yPos, pageWidth - (margin * 2), 32, 2, 2, 'FD'); // Increased height

    doc.text(`Predicted Depth: ${result.depth_assessment}`, margin + 5, yPos + 12);

    let riskText = "Attention Required";
    let riskColor = [220, 38, 38]; // Red-600
    if (result.depth_assessment === "Superficial") {
      riskText = "Low Risk";
      riskColor = [22, 163, 74]; // Green-600
    }

    // Label
    doc.setTextColor(0, 0, 0);
    doc.text("Risk Assessment:", margin + 5, yPos + 24);
    const labelWidth = doc.getTextWidth("Risk Assessment: ");

    // Badge
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    const badgeWidth = doc.getTextWidth(riskText) + 6; // Padding

    doc.setFillColor(...riskColor);
    doc.roundedRect(margin + 5 + labelWidth, yPos + 19, badgeWidth, 7, 1, 1, 'F');

    doc.setTextColor(255, 255, 255);
    doc.text(riskText, margin + 5 + labelWidth + 3, yPos + 23.5);

    // Reset standard font
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    yPos += 45; // Increased spacing

    // --- Quantitative Metrics ---
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("2. Quantitative Metrics", margin, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    // Table Header
    const col1 = margin;
    const col2 = margin + 60;
    const col3 = margin + 120;

    doc.setFont("helvetica", "bold");
    doc.text("Dimensions", col1, yPos);
    doc.text("Value", col2, yPos);
    doc.text("Tissue Type", col3, yPos);
    doc.text("Composition", col3 + 40, yPos);
    yPos += 2;
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    doc.setFont("helvetica", "normal");

    // Dimensions Data
    const widthVal = pixelsPerCm ? `${convertPxToCm(result.measurements.width_px)} cm` : `${result.measurements.width_px} px`;
    const heightVal = pixelsPerCm ? `${convertPxToCm(result.measurements.height_px)} cm` : `${result.measurements.height_px} px`;
    const areaVal = pixelsPerCm ? `${convertAreaToCm2(result.measurements.area_px)} cm²` : `${result.measurements.area_px} px²`;

    doc.text("Max Width", col1, yPos); doc.text(widthVal, col2, yPos); yPos += 7;
    doc.text("Max Height", col1, yPos); doc.text(heightVal, col2, yPos); yPos += 7;
    doc.text("Total Area", col1, yPos); doc.text(areaVal, col2, yPos);

    let yRight = yPos - 14;

    Object.entries(result.tissue_statistics).forEach(([tissue, percentage]) => {
      doc.text(tissue, col3, yRight);
      doc.text(`${percentage}%`, col3 + 40, yRight);
      yRight += 7;
    });

    yPos = Math.max(yPos, yRight) + 10;

    // --- Visual Evidence ---
    if (yPos > 200) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("3. Visual Evidence", margin, yPos);
    yPos += 10;

    const imgWidth = (pageWidth - (margin * 3)) / 2;
    const imgHeight = imgWidth * 0.75;

    try {
      if (imageRef.current) {
        doc.setFontSize(10);
        doc.text("Original Image", margin, yPos - 2);
        doc.addImage(imageRef.current, "JPEG", margin, yPos, imgWidth, imgHeight);
      }

      if (result.segmentation_map) {
        doc.text("AI Segmentation Map", margin + imgWidth + margin, yPos - 2);
        doc.addImage(result.segmentation_map, "PNG", margin + imgWidth + margin, yPos, imgWidth, imgHeight);
      }
    } catch (err) {
      console.error("Error adding images to PDF:", err);
      doc.setTextColor(255, 0, 0);
      doc.text("Error loading images.", margin, yPos + 20);
    }

    // --- Physician Notes ---
    if (doctorNotes) {
      yPos += imgHeight + 20; // Move below images
      if (yPos > pageHeight - 40) { doc.addPage(); yPos = 20; }

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("4. Physician Notes", margin, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(50, 50, 50);

      const splitNotes = doc.splitTextToSize(doctorNotes, pageWidth - (margin * 2));
      doc.text(splitNotes, margin, yPos);
    }

    // --- AI Recommendations ---
    yPos = Math.max(yPos, 20); // Safety reset
    if (doctorNotes) yPos += 15;
    else yPos += imgHeight + 20;

    if (yPos > pageHeight - 50) { doc.addPage(); yPos = 20; }

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("5. AI Recommendations", margin, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 100, 100);
    doc.text("(Automated suggestions based on tissue composition - Consult Clinical Protocols)", margin, yPos);
    yPos += 10;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(0, 0, 0);
    const recs = getRecommendations(result.tissue_statistics);
    recs.forEach(rec => {
      // Strip emojis for PDF compatibility
      const cleanRec = rec.replace(/^[✅⚠️] /, '');

      // Use splitTextToSize for safe multi-line calculation
      const splitRec = doc.splitTextToSize(`• ${cleanRec}`, pageWidth - (margin * 2));
      doc.text(splitRec, margin, yPos);
      yPos += (splitRec.length * 5) + 3; // Adjusted line height
    });

    // Disclaimer Footer
    const footerY = pageHeight - 15;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);
    doc.text("Results verified by AI only. Consult a clinician.", margin, footerY);
    doc.text("WoundAI v1.0", pageWidth - margin - 20, footerY);

    doc.save(`WoundAI_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      <header className="max-w-6xl mx-auto mb-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="WoundAI Logo" className="w-12 h-12 object-contain" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">WoundAI</h1>
            <p className="text-slate-500 text-sm">Automated Wound Tissue Classification and Depth Measurement System</p>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
            <button
              onClick={() => setCurrentView('single')}
              className={clsx(
                "px-4 py-2 rounded-md text-sm font-medium transition-all",
                currentView === 'single' ? "bg-blue-50 text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Single Analysis
            </button>
            <button
              onClick={() => setCurrentView('compare')}
              className={clsx(
                "px-4 py-2 rounded-md text-sm font-medium transition-all",
                currentView === 'compare' ? "bg-blue-50 text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Progress Comparison
            </button>
            <button
              onClick={() => setCurrentView('forecast')}
              className={clsx(
                "px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1",
                currentView === 'forecast' ? "bg-purple-50 text-purple-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Lightbulb className="w-4 h-4" />
              Healing Forecast
            </button>
            <button
              onClick={() => setCurrentView('report')}
              className={clsx(
                "px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1",
                currentView === 'report' ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <FileText className="w-4 h-4" />
              Clinical Report
            </button>
          </div>
          <button
            onClick={() => setShowReference(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors font-medium shadow-sm"
          >
            <Info className="w-4 h-4" />
            Reference Guide
          </button>
        </div>
      </header>

      {currentView === 'single' && (
        <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Upload & Preview */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-600" />
                Image Upload
              </h2>

              <div
                className={clsx(
                  "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer relative",
                  previewUrl ? "border-blue-200 bg-blue-50" : "border-slate-300 hover:border-blue-400"
                )}
                onClick={() => !previewUrl && fileInputRef.current?.click()}
                ref={containerRef}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageSelect}
                />

                {previewUrl ? (
                  <div className="relative inline-block">
                    <img
                      ref={imageRef}
                      src={previewUrl}
                      alt="Preview"
                      className={clsx("max-h-80 mx-auto rounded-lg shadow-md", isCalibrating && "cursor-crosshair")}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onDragStart={(e) => e.preventDefault()}
                    />

                    {/* Thermal Overlay */}
                    {showThermal && thermalImage && (
                      <img
                        src={thermalImage}
                        alt="Thermal Map"
                        className="absolute inset-0 w-full h-full object-contain rounded-lg pointer-events-none opacity-80"
                      />
                    )}

                    {/* Floating Tools */}
                    <div className="absolute top-3 right-3 flex flex-col gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleThermalToggle(); }}
                        className={clsx(
                          "p-2 rounded-full shadow-sm backdrop-blur-sm transition-all border",
                          showThermal ? "bg-red-500/90 border-red-400 text-white shadow-red-200" : "bg-white/80 border-slate-200 text-slate-400 hover:text-red-500 hover:bg-white"
                        )}
                        title="Thermal Inflammation View"
                      >
                        <Flame className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Draw Calibration Line */}
                    {calibrationLine.start && calibrationLine.end && (
                      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
                        <line
                          x1={calibrationLine.start.x}
                          y1={calibrationLine.start.y}
                          x2={calibrationLine.end.x}
                          y2={calibrationLine.end.y}
                          stroke="#3b82f6"
                          strokeWidth="3"
                          strokeDasharray="5,5"
                        />
                        <circle cx={calibrationLine.start.x} cy={calibrationLine.start.y} r="4" fill="#3b82f6" />
                        <circle cx={calibrationLine.end.x} cy={calibrationLine.end.y} r="4" fill="#3b82f6" />
                      </svg>
                    )}
                  </div>
                ) : (
                  <div className="py-10">
                    <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Upload className="w-8 h-8 text-blue-600" />
                    </div>
                    <p className="text-slate-600 font-medium">Click to upload wound image</p>
                    <p className="text-slate-400 text-sm mt-1">Supports JPG, PNG</p>
                  </div>
                )}
              </div>

              {/* Calibration Controls */}
              {previewUrl && !loading && (
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={startCalibration}
                    className={clsx(
                      "flex-1 py-2 rounded-lg font-medium text-sm border flex items-center justify-center gap-2",
                      isCalibrating ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    <Ruler className="w-4 h-4" />
                    {isCalibrating ? "Drag line on image..." : (pixelsPerCm ? "Recalibrate Scale" : "Set Scale (Optional)")}
                  </button>

                  {pixelsPerCm && (
                    <div className="px-3 py-2 bg-green-50 text-green-700 text-xs rounded-lg border border-green-200 flex items-center">
                      Scale Set: 1cm = {Math.round(pixelsPerCm)}px
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={!selectedImage || loading}
                className={clsx(
                  "w-full mt-4 py-3 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2",
                  !selectedImage || loading
                    ? "bg-slate-300 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Analyzing Tissue Structure...
                  </>
                ) : (
                  <>
                    <Activity className="w-5 h-5" />
                    Analyze Wound
                  </>
                )}
              </button>

              {selectedImage && !loading && (
                <button
                  onClick={handleReset}
                  className="w-full mt-2 py-3 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  Reset / Upload New
                </button>
              )}

              {error && (
                <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3 border border-red-100">
                  <AlertCircle className="w-5 h-5" />
                  {error}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Results */}
          <div className="space-y-6">
            {
              result ? (
                <>
                  {/* Depth Assessment Card */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        Clinical Assessment
                      </h2>
                      <div className="flex gap-2">
                        <button
                          onClick={generatePDF}
                          className="text-sm text-green-600 hover:text-green-800 font-medium flex items-center gap-1 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors shadow-sm"
                        >
                          <Download className="w-4 h-4" />
                          Download Report
                        </button>
                        <button
                          onClick={handleReset}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 px-3 py-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <RefreshCw className="w-4 h-4" />
                          New Analysis
                        </button>
                      </div>
                    </div>

                    {/* 3D View Button */}
                    <button
                      onClick={() => setShow3D(true)}
                      className="w-full mb-6 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all font-semibold"
                    >
                      <Box className="w-5 h-5" />
                      View in 3D (Depth Visualization)
                    </button>

                    <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-slate-500 text-sm">Predicted Depth</p>
                        <p className="text-xl font-bold text-slate-900">{result.depth_assessment}</p>
                      </div>
                      <div className={clsx(
                        "px-4 py-1 rounded-full text-sm font-medium",
                        result.depth_assessment === "Superficial" ? "bg-green-100 text-green-700" :
                          result.depth_assessment === "Partial-Thickness" ? "bg-yellow-100 text-yellow-700" :
                            "bg-red-100 text-red-700"
                      )}>
                        {result.depth_assessment === "Superficial" ? "Low Risk" : "Attention Required"}
                      </div>
                    </div>
                  </div>

                  {/* AI Recommendations Card */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-yellow-500" />
                      AI Smart Recommendations
                    </h2>
                    <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-100">
                      <ul className="space-y-2">
                        {getRecommendations(result.tissue_statistics).map((rec, idx) => (
                          <li key={idx} className="flex gap-2 text-sm text-slate-700">
                            <span className="mt-0.5">•</span>
                            <span>{rec}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-[10px] text-slate-400 mt-3 border-t border-yellow-200 pt-2 font-medium uppercase tracking-wider">
                        AI Generated Suggestion • Clinical verification required
                      </p>
                    </div>
                  </div>

                  {/* Measurements Card */}
                  {result.measurements && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-600" />
                        Wound Dimensions {pixelsPerCm ? "(Calibrated)" : "(Approx)"}
                      </h2>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-slate-50 p-3 rounded-lg text-center border border-slate-100">
                          <p className="text-xs text-slate-500 mb-1">Max Width</p>
                          <p className="font-bold text-slate-900">
                            {pixelsPerCm
                              ? `${convertPxToCm(result.measurements.width_px)} cm`
                              : `${result.measurements.width_px} px`}
                          </p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg text-center border border-slate-100">
                          <p className="text-xs text-slate-500 mb-1">Max Height</p>
                          <p className="font-bold text-slate-900">
                            {pixelsPerCm
                              ? `${convertPxToCm(result.measurements.height_px)} cm`
                              : `${result.measurements.height_px} px`}
                          </p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg text-center border border-slate-100">
                          <p className="text-xs text-slate-500 mb-1">Area</p>
                          <p className="font-bold text-slate-900">
                            {pixelsPerCm
                              ? `${convertAreaToCm2(result.measurements.area_px)} cm²`
                              : `${result.measurements.area_px} px²`}
                          </p>
                        </div>
                      </div>
                      {!pixelsPerCm && (
                        <p className="text-xs text-slate-400 mt-3 italic">
                          * Values are in pixels. Use the "Set Scale" tool above to convert to cm.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Tissue Statistics */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-semibold mb-4">Tissue Composition</h2>
                    <div className="space-y-4">
                      {Object.entries(result.tissue_statistics).map(([tissue, percentage]) => (
                        <div key={tissue}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-slate-700">{tissue}</span>
                            <span className="text-slate-500">{percentage}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={clsx("h-full rounded-full",
                                tissue === 'Granulation' ? 'bg-red-500' :
                                  tissue === 'Slough' ? 'bg-yellow-400' :
                                    tissue === 'Eschar' ? 'bg-black' :
                                      'bg-blue-400'
                              )}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Segmentation Map */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-semibold mb-4">Segmentation Map</h2>
                    <div className="rounded-xl overflow-hidden border border-slate-200">
                      <img
                        src={result.segmentation_map}
                        alt="Segmentation Result"
                        className="w-full h-auto"
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-500">
                      <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-500"></div> Granulation</div>
                      <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-yellow-400"></div> Slough</div>
                      <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-black"></div> Eschar</div>
                    </div>
                  </div>


                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <Activity className="w-16 h-16 mb-4 opacity-20" />
                  <p>Upload an image to see analysis results</p>
                </div>
              )
            }
          </div >
        </main >
      )}

      {/* Forecast View */}
      {currentView === 'forecast' && (
        <div className="w-full max-w-6xl mx-auto space-y-6">
          {!simulationResult ? (
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
              <h2 className="text-xl font-bold text-slate-900 mb-4">AI Healing Projection</h2>
              <p className="text-slate-600 mb-6 max-w-md mx-auto">
                Generate a visual simulation of wound closure over the next 4 weeks.
                Enable "Infection Simulation" to see potential risks if untreated.
              </p>

              {!selectedImage ? (
                <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg inline-block border border-yellow-200">
                  Please upload an image in "Single Analysis" first.
                </div>
              ) : (
                <div className="max-w-xs mx-auto space-y-4">
                  <label className="flex items-center justify-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={simulateInfection}
                      onChange={(e) => setSimulateInfection(e.target.checked)}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 border-gray-300"
                    />
                    <span className="font-medium text-slate-700">Simulate Infection Risk</span>
                  </label>

                  <button
                    onClick={handleSimulation}
                    disabled={loading}
                    className="w-full px-8 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Activity className="w-5 h-5" />}
                    {loading ? "Running Simulation..." : "Run Healing Forecast"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Narrative Card */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-6 rounded-2xl border border-purple-100 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="bg-purple-100 p-2 rounded-full">
                    <Lightbulb className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-purple-900 mb-2">Clinical Growth Projection</h3>
                    <p className="text-slate-700 leading-relaxed font-medium">
                      {simulationResult.narrative}
                    </p>

                  </div>
                </div>
              </div>

              {/* Visual Timeline */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {simulationResult.simulation.map((sim, idx) => (
                  <div key={idx} className={clsx("p-4 rounded-xl shadow-sm border transition-all",
                    sim.is_risk ? "bg-red-50 border-red-200" : "bg-white border-slate-200 hover:shadow-md"
                  )}>
                    <div className="flex justify-between items-center mb-3">
                      <span className={clsx("font-bold", sim.is_risk ? "text-red-700" : "text-slate-700")}>{sim.stage}</span>
                      <span className="text-xs bg-slate-100 px-2 py-1 rounded-md text-slate-500">Day {sim.day}</span>
                    </div>
                    <div className="relative group">
                      <img
                        src={sim.image}
                        alt={sim.stage}
                        className="w-full h-48 object-cover rounded-lg border border-slate-100"
                      />
                      <button
                        onClick={() => setView3DImage(sim.image)}
                        className="absolute bottom-2 right-2 px-3 py-1.5 bg-black/70 text-white text-xs font-bold rounded-lg backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                      >
                        <Box className="w-3 h-3" />
                        3D
                      </button>
                    </div>
                    <div className="mt-3 text-center">
                      <p className={clsx("text-sm", sim.is_risk ? "text-red-500 font-medium" : "text-slate-500")}>
                        {sim.is_risk ? "Potential Complication" : "Projected Status"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setSimulationResult(null)}
                className="text-slate-500 hover:text-slate-800 text-sm font-medium mx-auto block"
              >
                ← Run New Simulation
              </button>
            </div>
          )}
        </div>
      )}

      {
        currentView === 'compare' && (
          <main className="max-w-7xl mx-auto">
            {/* Compare Header */}
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-xl font-bold text-slate-900">Healing Progress Comparison</h2>
              <div className="flex gap-2">
                <button
                  onClick={generateComparisonPDF}
                  disabled={!result || !compareResult}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm font-semibold"
                >
                  <Download className="w-4 h-4" />
                  Download Progress Report
                </button>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm font-medium"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Column 1: Baseline */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-700 text-center">Baseline Image (Initial)</h3>
                <div
                  className={clsx(
                    "bg-white p-4 rounded-xl border-2 border-dashed h-80 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-colors relative overflow-hidden",
                    previewUrl ? "border-blue-200 bg-slate-50" : "border-slate-300"
                  )}
                  onClick={() => !previewUrl && fileInputRef.current?.click()}
                >
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleImageSelect(e, false)} />
                  {previewUrl ? (
                    <img src={previewUrl} className="max-h-full max-w-full rounded-lg object-contain" alt="Baseline" />
                  ) : (
                    <div className="text-center text-slate-400">
                      <Upload className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">Upload Baseline</p>
                    </div>
                  )}
                  {result && <img src={result.segmentation_map} className="absolute bottom-2 right-2 w-16 h-16 rounded border border-white shadow-lg" alt="Seg" />}
                </div>
                {result && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-sm">
                    <p className="font-semibold mb-1">Depth: <span className={result.depth_assessment === "Superficial" ? "text-green-600" : "text-red-600"}>{result.depth_assessment}</span></p>
                    <p>Area: {result.measurements.area_px} px²</p>
                  </div>
                )}
              </div>

              {/* Column 2: Metrics / Delta */}
              <div className="flex flex-col gap-4">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex-1">
                  <h3 className="font-semibold text-slate-900 mb-6 text-center">Progress Metrics</h3>
                  {result && compareResult ? (
                    <div className="space-y-6">
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <span className="text-slate-600">Area Reduction</span>
                        <span className={clsx("font-bold", result.measurements.area_px > compareResult.measurements.area_px ? "text-green-600" : "text-red-500")}>
                          {((result.measurements.area_px - compareResult.measurements.area_px) / result.measurements.area_px * 100).toFixed(1)}%
                        </span>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Tissue Changes</h4>
                        <div className="space-y-3">
                          {[
                            { label: "Granulation (Healing)", diff: compareResult.tissue_statistics.Granulation - result.tissue_statistics.Granulation },
                            { label: "Slough (Non-viable)", diff: compareResult.tissue_statistics.Slough - result.tissue_statistics.Slough },
                            { label: "Necrosis (Critical)", diff: compareResult.tissue_statistics.Eschar - result.tissue_statistics.Eschar },
                          ].map(m => (
                            <div key={m.label} className="flex justify-between text-sm">
                              <span>{m.label}</span>
                              <span className={clsx("font-medium", m.diff > 0 ? "text-blue-600" : "text-slate-500")}>
                                {m.diff > 0 ? "+" : ""}{m.diff.toFixed(1)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        onClick={handleCompareAnalyze}
                        className="w-full py-3 bg-blue-50 text-blue-700 rounded-xl font-semibold hover:bg-blue-100 transition-colors"
                      >
                        Re-Analyze Comparison
                      </button>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center">
                      <Activity className="w-12 h-12 mb-3 opacity-20" />
                      <p className="text-sm">Upload both images and analyze to see comparison metrics</p>
                      <button
                        onClick={handleCompareAnalyze}
                        disabled={!selectedImage || !compareImage || loading}
                        className={clsx(
                          "mt-6 w-full py-2 rounded-lg font-medium text-white transition-all",
                          !selectedImage || !compareImage || loading ? "bg-slate-300" : "bg-blue-600 hover:bg-blue-700"
                        )}
                      >
                        {loading ? "Analyze..." : "Run Comparison"}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Column 3: Current */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-700 text-center">Current Image (Follow-up)</h3>
                <div
                  className={clsx(
                    "bg-white p-4 rounded-xl border-2 border-dashed h-80 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 transition-colors relative overflow-hidden",
                    comparePreviewUrl ? "border-blue-200 bg-slate-50" : "border-slate-300"
                  )}
                  onClick={() => !comparePreviewUrl && compareInputRef.current?.click()}
                >
                  <input ref={compareInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => handleImageSelect(e, true)} />
                  {comparePreviewUrl ? (
                    <img src={comparePreviewUrl} className="max-h-full max-w-full rounded-lg object-contain" alt="Current" />
                  ) : (
                    <div className="text-center text-slate-400">
                      <Upload className="w-8 h-8 mx-auto mb-2" />
                      <p className="text-sm">Upload Current</p>
                    </div>
                  )}
                  {compareResult && <img src={compareResult.segmentation_map} className="absolute bottom-2 right-2 w-16 h-16 rounded border border-white shadow-lg" alt="Seg" />}
                </div>
                {compareResult && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-sm">
                    <p className="font-semibold mb-1">Depth: <span className={compareResult.depth_assessment === "Superficial" ? "text-green-600" : "text-red-600"}>{compareResult.depth_assessment}</span></p>
                    <p>Area: {compareResult.measurements.area_px} px²</p>
                  </div>
                )}
              </div>
            </div>
          </main>
        )
      }

      {/* Clinical Report View */}
      {currentView === 'report' && (
        <div className="w-full max-w-4xl mx-auto">
          {!simulationResult ? (
            <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center">
              <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-slate-700 mb-2">No Analysis Data Available</h3>
              <p className="text-slate-500 max-w-md mx-auto">
                Please go to "Single Analysis" and analyze a wound image first. The clinical report relies on the automated metrics generated there.
              </p>
              <button
                onClick={() => setCurrentView('single')}
                className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                Go to Analysis
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Physician Notes & AI Scribe */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-600" />
                  Physician Notes
                </h2>

                <div className="mb-4 flex flex-wrap gap-2">
                  {["Patient Improving", "No Change", "High Exudate", "Signs of Infection", "Dressing Changed", "Debridement Performed", "Antibiotics Prescribed"].map((note) => (
                    <button
                      key={note}
                      onClick={() => setDoctorNotes(prev => prev ? `${prev}, ${note}` : note)}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-medium transition-colors border border-slate-200"
                    >
                      + {note}
                    </button>
                  ))}
                </div>

                <div className="relative mb-4">
                  <textarea
                    value={doctorNotes}
                    onChange={(e) => setDoctorNotes(e.target.value)}
                    placeholder="Enter brief clinical observations here... AI will use this."
                    className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-[100px] text-slate-700"
                  />
                  <PenTool className="absolute bottom-3 right-3 w-4 h-4 text-slate-400" />
                </div>

                <button
                  onClick={handleScribe}
                  disabled={scribeLoading}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold hover:shadow-lg transition-all flex items-center justify-center gap-2 mb-4"
                >
                  {scribeLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                  {scribeLoading ? "Generating AI Report..." : "Generate Professional SOAP Report"}
                </button>

                {soapNote && (
                  <div className="mt-6 border-t border-slate-200 pt-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-600" />
                        AI Clinical Analysis
                      </h3>
                      <button onClick={() => navigator.clipboard.writeText(JSON.stringify(soapNote, null, 2))} className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition-colors">
                        <FileText className="w-3 h-3" /> Copy JSON
                      </button>
                    </div>

                    <div className="grid gap-4">
                      {/* Subjective */}
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 mb-2 text-slate-500 text-xs uppercase font-bold tracking-wider">
                          <User className="w-3 h-3" /> Subjective
                        </div>
                        <p className="text-slate-700 italic">"{soapNote.subjective}"</p>
                      </div>

                      {/* Objective & Assessment Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                          <div className="flex items-center gap-2 mb-2 text-blue-700 text-xs uppercase font-bold tracking-wider">
                            <Activity className="w-3 h-3" /> Objective
                          </div>
                          <p className="text-slate-700 text-sm">{soapNote.objective_summary}</p>
                        </div>

                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-purple-700 text-xs uppercase font-bold tracking-wider">
                              <TrendingUp className="w-3 h-3" /> Assessment
                            </div>
                            <span className={clsx("px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                              soapNote.assessment_status === 'Improving' ? "bg-green-200 text-green-800" : "bg-yellow-200 text-yellow-800"
                            )}>
                              {soapNote.assessment_status || "Analysis"}
                            </span>
                          </div>
                          <p className="text-slate-700 text-sm font-medium">{soapNote.assessment}</p>
                        </div>
                      </div>

                      {/* Plan */}
                      <div className="bg-white p-4 rounded-xl border-l-4 border-indigo-500 shadow-sm ring-1 ring-slate-100">
                        <div className="flex items-center gap-2 mb-3 text-indigo-700 text-xs uppercase font-bold tracking-wider">
                          <CheckCircle2 className="w-3 h-3" /> Treatment Plan
                        </div>
                        <ul className="space-y-2">
                          {soapNote.plan_steps?.map((step, i) => (
                            <li key={i} className="flex items-start gap-2 text-slate-700 text-sm group">
                              <div className="mt-0.5 w-4 h-4 rounded border border-slate-300 group-hover:border-indigo-400 transition-colors flex items-center justify-center bg-slate-50">
                                <div className="w-2 h-2 rounded-sm bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reference Modal */}
      {
        showReference && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-blue-600" />
                  Tissue Classification Reference Guide
                </h2>
                <button
                  onClick={() => setShowReference(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 hover:text-slate-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="py-4 px-4 font-semibold text-slate-700 w-16">SNo</th>
                        <th className="py-4 px-4 font-semibold text-slate-700">Tissue Type</th>
                        <th className="py-4 px-4 font-semibold text-slate-700">Appearance</th>
                        <th className="py-4 px-4 font-semibold text-slate-700">Action Needed</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-4 px-4 text-slate-500">1</td>
                        <td className="py-4 px-4 font-bold text-blue-600">Epithelial</td>
                        <td className="py-4 px-4 text-slate-600">Pink, shiny, thin new skin</td>
                        <td className="py-4 px-4 text-slate-700">Protect & Cover</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-4 px-4 text-slate-500">2</td>
                        <td className="py-4 px-4 font-bold text-red-500">Granulation</td>
                        <td className="py-4 px-4 text-slate-600">Bright red, moist, bumpy</td>
                        <td className="py-4 px-4 text-slate-700">Maintain Moisture</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-4 px-4 text-slate-500">3</td>
                        <td className="py-4 px-4 font-bold text-yellow-600">Slough</td>
                        <td className="py-4 px-4 text-slate-600">Yellow/cream, stringy/sticky</td>
                        <td className="py-4 px-4 text-slate-700">Debride (Remove)</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-4 px-4 text-slate-500">4</td>
                        <td className="py-4 px-4 font-bold text-slate-900">Necrotic (Eschar)</td>
                        <td className="py-4 px-4 text-slate-600">Black/brown, dry, leathery</td>
                        <td className="py-4 px-4 text-slate-700">Debride (if safe)</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-4 px-4 text-slate-500">5</td>
                        <td className="py-4 px-4 font-bold text-slate-900">Fibrinous</td>
                        <td className="py-4 px-4 text-slate-600">Yellowish-white, shiny</td>
                        <td className="py-4 px-4 text-slate-700">Clean/Debride</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-4 px-4 text-slate-500">6</td>
                        <td className="py-4 px-4 font-bold text-red-600">Hypergranulation</td>
                        <td className="py-4 px-4 text-slate-600">Overgrown bright red tissue</td>
                        <td className="py-4 px-4 text-slate-700">Reduce Growth</td>
                      </tr>
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-4 px-4 text-slate-500">7</td>
                        <td className="py-4 px-4 font-bold text-yellow-500">Adipose</td>
                        <td className="py-4 px-4 text-slate-600">Yellow, shiny fat tissue</td>
                        <td className="py-4 px-4 text-slate-700">Protect/Infection Control</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
                <button
                  onClick={() => setShowReference(false)}
                  className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors"
                >
                  Close Guide
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Calibration Modal */}
      {
        showCalibrationModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
              <h3 className="text-xl font-bold mb-4 text-slate-900">Set Reference Scale</h3>
              <p className="text-slate-600 text-sm mb-4">
                Enter the real-world length of the line you just drew (e.g., width of a coin, ruler mark).
              </p>

              <div className="flex gap-2 mb-6">
                <input
                  type="number"
                  value={calibrationLength}
                  onChange={(e) => setCalibrationLength(e.target.value)}
                  className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <div className="px-4 py-2 bg-slate-100 rounded-lg text-slate-600 font-medium">cm</div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCalibrationModal(false)}
                  className="flex-1 py-2 text-slate-600 hover:bg-slate-50 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmCalibration}
                  className="flex-1 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium shadow-lg shadow-blue-200"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )
      }
      {
        show3D && previewUrl && (
          <Wound3DViewer
            imageUrl={previewUrl}
            onClose={() => setShow3D(false)}
          />
        )
      }
      {
        view3DImage && (
          <Wound3DViewer
            imageUrl={view3DImage}
            onClose={() => setView3DImage(null)}
          />
        )
      }
    </div >
  );
}

export default App;
