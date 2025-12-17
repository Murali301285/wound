import React, { useState, useRef, useEffect } from 'react';
import { Upload, Activity, FileText, AlertCircle, Loader2, RefreshCw, Info, X, Ruler } from 'lucide-react';
import clsx from 'clsx';

function App() {
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showReference, setShowReference] = useState(false);

  // Calibration State
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationLine, setCalibrationLine] = useState({ start: null, end: null });
  const [pixelsPerCm, setPixelsPerCm] = useState(null);
  const [showCalibrationModal, setShowCalibrationModal] = useState(false);
  const [calibrationLength, setCalibrationLength] = useState(1); // Default 1cm

  const fileInputRef = useRef(null);
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setError(null);
      setPixelsPerCm(null); // Reset calibration
    }
  };

  const handleAnalyze = async () => {
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

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const data = await response.json();
      setResult(data);
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
    setError(null);
    setPixelsPerCm(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
        <button
          onClick={() => setShowReference(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors font-medium shadow-sm"
        >
          <Info className="w-4 h-4" />
          Reference Guide
        </button>
      </header>

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
                  {/* Draw Calibration Line */}
                  {calibrationLine.start && calibrationLine.end && (
                    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
                      <line
                        x1={calibrationLine.start.x}
                        y1={calibrationLine.start.y}
                        x2={calibrationLine.end.x}
                        y2={calibrationLine.end.y}
                        stroke="#ef4444"
                        strokeWidth="3"
                        strokeDasharray="5,5"
                      />
                      <circle cx={calibrationLine.start.x} cy={calibrationLine.start.y} r="4" fill="#ef4444" />
                      <circle cx={calibrationLine.end.x} cy={calibrationLine.end.y} r="4" fill="#ef4444" />
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
                    isCalibrating ? "bg-red-50 text-red-600 border-red-200" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
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
          {result ? (
            <>
              {/* Depth Assessment Card */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" />
                    Clinical Assessment
                  </h2>
                  <button
                    onClick={handleReset}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                  >
                    <RefreshCw className="w-4 h-4" />
                    New Analysis
                  </button>
                </div>

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
          )}
        </div>
      </main>

      {/* Reference Modal */}
      {showReference && (
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
      )}

      {/* Calibration Modal */}
      {showCalibrationModal && (
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
      )}
    </div>
  );
}

export default App;
