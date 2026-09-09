import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Activity, Search, ShieldAlert, Pill, Dumbbell, 
  Clipboard, CheckCircle, X, Sun, Moon, Sparkles, Layers, Heart, Coffee, UserCheck, Users, RotateCcw, Target, Printer,
  Maximize2, Minimize2
} from 'lucide-react';

const API_BASE_URL = 'http://127.0.0.1:8000';

function App() {
  const [availableSymptoms, setAvailableSymptoms] = useState([]);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [predictionResult, setPredictionResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('clinical-theme');
    return saved ? JSON.parse(saved) : false;
  });

  const [isFullscreen, setIsFullscreen] = useState(false);

  const [breakType, setBreakType] = useState('');
  const [showBreakMenu, setShowBreakMenu] = useState(false);
  const [activeBreakPopup, setActiveBreakPopup] = useState('');

  const [patientCount, setPatientCount] = useState(0);
  const [showPatientMenu, setShowPatientMenu] = useState(false);

  const [pdfLoading, setPdfLoading] = useState(false);

  // Sync Dark/Light Themes
  useEffect(() => {
    localStorage.setItem('clinical-theme', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Fetch Symptoms Matrix
  useEffect(() => {
    axios.get(`${API_BASE_URL}/api/symptoms`)
      .then(res => {
        if (res.data && res.data.symptoms) {
          setAvailableSymptoms(res.data.symptoms.sort());
        }
      })
      .catch(err => {
        console.error("Backend offline:", err);
        setError("AI Core Engine Offline. Please ensure your Python Uvicorn server is running.");
      });
  }, []);

  // Monitor Native Fullscreen Events (Like when user hits ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch((err) => {
          console.error(`Error attempting to enable fullscreen display mode: ${err.message}`);
        });
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleAddSymptom = (symptom) => {
    if (!selectedSymptoms.includes(symptom)) {
      setSelectedSymptoms([...selectedSymptoms, symptom]);
    }
    setSearchQuery('');
  };

  const handleRemoveSymptom = (symptom) => {
    setSelectedSymptoms(selectedSymptoms.filter(s => s !== symptom));
  };

  const handlePredict = async () => {
    if (selectedSymptoms.length === 0) {
      setError("Please select at least one clinical symptom vector before analyzing.");
      return;
    }
    setLoading(true);
    setError('');
    setPredictionResult(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/predict`, {
        symptoms: selectedSymptoms
      });
      
      setTimeout(() => {
        setPredictionResult(response.data);
        setLoading(false);
        setPatientCount(prev => prev + 1);
      }, 2000);

    } catch (err) {
      setError(err.response?.data?.detail || "An error occurred during diagnostic computation.");
      setLoading(false);
    }
  };

  const handlePrintPDF = async () => {
    if (!predictionResult) return;
    setPdfLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/generate-pdf`, {
        prediction: predictionResult.prediction,
        confidence: predictionResult.confidence,
        matchedSymptoms: selectedSymptoms,
        details: {
          description: predictionResult.details.description,
          medication: predictionResult.details.medication,
          workout: predictionResult.details.workout,
          diet: predictionResult.details.diet || "Standard metabolic hydration strategy recommended.",
          precautions: predictionResult.details.precautions
        }
      }, {
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      const reportName = predictionResult.prediction.toLowerCase().replace(/ /g, '_');
      link.setAttribute('download', `AlgoMedix_Report_${reportName}.pdf`);
      
      document.body.appendChild(link);
      link.click();
      
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("PDF generation failure sequence:", err);
      alert("Failed to render printable asset document template from backend server.");
    } finally {
      setPdfLoading(false);
    }
  };

  const triggerBreakSession = (type) => {
    setBreakType(type);
    setShowBreakMenu(false);
    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setActiveBreakPopup(`System on ${type} since ${timeString}. Please wait until the session concludes.`);
  };

  const terminateBreakSession = () => {
    setActiveBreakPopup('');
    setBreakType('');
  };

  const resetPatientCounter = () => {
    setPatientCount(0);
    setShowPatientMenu(false);
  };

  const handleNextPatient = () => {
    setSelectedSymptoms([]);
    setSearchQuery('');
    setPredictionResult(null);
    setError('');
    setLoading(false);
  };

  // Helper helper to convert python style literal list string safely into array rows
  const parseClinicalInput = (rawInput) => {
    if (!rawInput) return [];
    if (Array.isArray(rawInput)) return rawInput;
    
    try {
      // Clean string expressions like ['Item 1', 'Item 2'] to standard clean formats
      let processed = rawInput.trim();
      if (processed.startsWith('[') && processed.endsWith(']')) {
        processed = processed.slice(1, -1);
        // split components carefully, stripping residual quotes
        return processed.split(/','|", " |", "|', '/g).map(item => 
          item.replace(/^['"]|['"]$/g, '').trim()
        ).filter(Boolean);
      }
    } catch (e) {
      console.error("String normalization anomaly:", e);
    }
    return [rawInput]; 
  };

  const filteredSymptoms = searchQuery
    ? availableSymptoms.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()) && !selectedSymptoms.includes(s))
    : [];

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors duration-500 flex flex-col justify-between overflow-x-hidden relative ${
      darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50/60 text-slate-800'
    }`}>
      
      <style>{`
        @keyframes heartbeat {
          0% { transform: scale(1); }
          14% { transform: scale(1.15); }
          28% { transform: scale(1); }
          42% { transform: scale(1.15); }
          70% { transform: scale(1); }
        }
        .animate-heartbeat {
          animation: heartbeat 1.2s infinite ease-in-out;
        }

        @keyframes panoramic {
          0% { transform: scale(1.05) translate(0px, 0px); }
          50% { transform: scale(1.12) translate(-15px, 10px); }
          100% { transform: scale(1.05) translate(0px, 0px); }
        }
        .animate-bg-flow {
          animation: panoramic 25s infinite ease-in-out;
        }

        @keyframes singleLineMarquee {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-slow-marquee {
          display: inline-flex;
          animation: singleLineMarquee 60s linear infinite;
        }
      `}</style>

      {/* BACKGROUND LAYER */}
      <div className="absolute inset-0 z-0 overflow-hidden opacity-[0.14] dark:opacity-[0.06] pointer-events-none mix-blend-luminosity">
        <div 
          className="w-full h-full bg-cover bg-center scale-105 animate-bg-flow" 
          style={{ backgroundImage: `url('https://encrypted-tbn2.gstatic.com/licensed-image?q=tbn:ANd9GcQel4hxiuxUKHO8Huvst8vgJ_kJa1B80fj8swuCwPLFk3uCcB34MUHec6G1sRN5Y4hZZfX3m-3MwxyibN0')` }}
        />
      </div>

      {/* ACTIVE BREAK OVERLAY POPUP */}
      {activeBreakPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl bg-slate-950/80 transition-all duration-300">
          <div className="w-full max-w-md p-6 rounded-2xl border border-cyan-500/30 bg-slate-900 text-center shadow-2xl space-y-5">
            <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-cyan-500/10 text-cyan-400">
              <Coffee className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-black uppercase tracking-widest text-cyan-400">
                {breakType} Session Active
              </h3>
              <p className="text-xs font-medium text-slate-300 leading-relaxed tracking-wide uppercase">
                {activeBreakPopup}
              </p>
            </div>
            <button
              onClick={terminateBreakSession}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold uppercase tracking-widest text-[10px] rounded-xl shadow-md transition-all duration-200 flex items-center justify-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5" /> Finish Break
            </button>
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* HEADER CONTROL STRIP */}
        <header className={`sticky top-0 z-40 backdrop-blur-md border-b transition-colors duration-300 ${
          darkMode ? 'bg-slate-900/70 border-slate-800/60' : 'bg-white/70 border-slate-200/80 shadow-sm'
        }`}>
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-3.5">
              <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-md shadow-cyan-500/20">
                <Activity className="h-5 w-5 text-white animate-pulse" />
              </div>
              <div>
                <h1 className={`text-lg font-black tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                  ALGOMEDIX
                </h1>
                <p className="text-[10px] font-bold tracking-wide text-slate-400 dark:text-slate-500">
                  Seeing tomorrow’s health, today.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* BREAK DROPDOWN CONSOLE */}
              <div className="relative">
                <button
                  onClick={() => setShowBreakMenu(!showBreakMenu)}
                  className={`px-4 py-2 rounded-xl border font-bold uppercase tracking-widest text-[10px] transition-all duration-300 flex items-center gap-1.5 ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'
                  }`}
                >
                  <Coffee className="w-3.5 h-3.5 text-cyan-500" /> Break
                </button>
                
                {showBreakMenu && (
                  <div className={`absolute right-0 mt-2 w-44 rounded-xl border backdrop-blur-xl shadow-2xl z-50 overflow-hidden ${
                    darkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
                  }`}>
                    <button
                      type="button"
                      onClick={() => triggerBreakSession('Lunch Break')}
                      className="w-full text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider hover:bg-cyan-500/10 transition-colors"
                    >
                      1. Lunch Break
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerBreakSession('Prayer Break')}
                      className="w-full text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider hover:bg-cyan-500/10 transition-colors border-t border-slate-100 dark:border-slate-800/60"
                    >
                      2. Prayer Break
                    </button>
                  </div>
                )}
              </div>

              {/* PATIENT COUNTER SYSTEM */}
              <div className="relative">
                <button
                  onClick={() => setShowPatientMenu(!showPatientMenu)}
                  className={`p-2.5 rounded-xl border transition-all duration-300 relative ${
                    darkMode ? 'bg-slate-800 border-slate-700 text-cyan-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-cyan-600 hover:bg-slate-50 shadow-sm'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  {patientCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[8px] font-black bg-rose-500 text-white rounded-full animate-bounce">
                      {patientCount}
                    </span>
                  )}
                </button>

                {showPatientMenu && (
                  <div className={`absolute right-0 mt-2 w-48 p-4 rounded-xl border backdrop-blur-xl shadow-2xl z-50 text-center space-y-3.5 ${
                    darkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
                  }`}>
                    <div>
                      <span className="block text-[8px] font-black tracking-widest text-slate-400 uppercase">Analyzed Cases</span>
                      <span className="text-2xl font-black text-cyan-500 tracking-tight">{patientCount}</span>
                    </div>
                    <button
                      type="button"
                      onClick={resetPatientCounter}
                      className="w-full py-1.5 bg-gradient-to-r from-rose-500 to-red-600 text-white font-bold uppercase tracking-widest text-[9px] rounded-lg transition-all flex items-center justify-center gap-1 hover:opacity-90"
                    >
                      <RotateCcw className="w-3 h-3" /> End Session
                    </button>
                  </div>
                )}
              </div>

              {/* DARK MODE BUTTON */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2.5 rounded-xl border transition-all duration-300 ${
                  darkMode ? 'bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 shadow-sm'
                }`}
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* FULLSCREEN SYSTEM MAXIMIZE BUTTON */}
              <button
                onClick={toggleFullscreen}
                className={`p-2.5 rounded-xl border transition-all duration-300 ${
                  darkMode 
                    ? 'bg-slate-800 border-slate-700 text-cyan-400 hover:bg-slate-700 hover:text-cyan-300' 
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-cyan-600 shadow-sm'
                }`}
                title={isFullscreen ? "Exit Fullscreen" : "Maximize to Fullscreen"}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

            </div>
          </div>
        </header>

        {/* APPLICATION BODY DECK */}
        <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch flex-grow w-full relative z-10">
          
          {/* ELONGATED SIDEBAR WITH INTAKE CONSOLE */}
          <div className={`lg:col-span-4 p-6 rounded-2xl border transition-all duration-300 flex flex-col justify-between min-h-[580px] lg:min-h-full ${
            darkMode 
              ? 'bg-slate-900/40 border-slate-800/80 backdrop-blur-xl shadow-xl' 
              : 'bg-white/80 border-slate-200/60 shadow-xl shadow-slate-200/30'
          }`}>
            <div className="flex-grow flex flex-col">
              
              {/* TOP HEADER BLOCK WITH TITLE & REPOSITIONED ACTION BUTTON */}
              <div className="flex flex-row items-center justify-between mb-4">
                <h2 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                  <Layers className="h-3.5 w-3.5 text-cyan-500" /> Clinical Symptoms
                </h2>
                
                <button
                  onClick={handlePredict}
                  disabled={loading || selectedSymptoms.length === 0}
                  className={`p-2 rounded-xl border transition-all duration-300 disabled:opacity-20 disabled:cursor-not-allowed ${
                    darkMode 
                      ? 'bg-gradient-to-tr from-cyan-600 to-blue-600 border-cyan-500 text-white shadow-md shadow-cyan-950/40 hover:opacity-90' 
                      : 'bg-gradient-to-tr from-cyan-500 to-blue-500 border-cyan-400 text-white shadow-sm hover:opacity-90'
                  }`}
                  title="Execute Clinical Field Prediction Scan"
                >
                  {loading ? (
                    <Heart className="w-3.5 h-3.5 text-white fill-white animate-pulse" />
                  ) : (
                    <Target className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
              
              {error && (
                <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium rounded-xl flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 text-rose-500 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Type to add clinical markers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-11 pr-4 py-2.5 border rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/40 transition-all duration-300 ${
                    darkMode 
                      ? 'bg-slate-950/60 border-slate-800 text-slate-100 placeholder-slate-500 focus:border-cyan-500' 
                      : 'bg-slate-50 border-slate-200/80 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-cyan-500'
                  }`}
                />
                
                {filteredSymptoms.length > 0 && (
                  <ul className={`absolute z-50 w-full mt-2 max-h-56 overflow-y-auto rounded-xl border backdrop-blur-xl shadow-2xl ${
                    darkMode ? 'bg-slate-900/95 border-slate-800 divide-slate-800/50' : 'bg-white border-slate-200 divide-slate-100'
                  } divide-y`}>
                    {filteredSymptoms.slice(0, 10).map((symptom) => (
                      <li key={symptom}>
                        <button
                          type="button"
                          onClick={() => handleAddSymptom(symptom)}
                          className="w-full text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider hover:bg-cyan-500/10 transition-all flex items-center justify-between group"
                        >
                          <span className={darkMode ? 'text-slate-300 group-hover:text-cyan-400' : 'text-slate-600 group-hover:text-cyan-600'}>
                            {symptom.replace(/_/g, ' ')}
                          </span>
                          <Sparkles className="w-3 h-3 opacity-0 group-hover:opacity-100 text-cyan-400 transition-all" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* TOP-TO-BOTTOM ALIGNED SELECTED SYMPTOMS WRAPPER */}
              <div className="flex-grow mt-2">
                {selectedSymptoms.length > 0 ? (
                  <div className="flex flex-col items-start gap-2.5 max-h-[340px] overflow-y-auto transition-all w-full">
                    {selectedSymptoms.map((symptom) => (
                      <span
                        key={symptom}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 border rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-200 hover:scale-[1.02] w-auto ${
                          darkMode 
                            ? 'bg-cyan-950/30 border-cyan-800/40 text-cyan-400' 
                            : 'bg-cyan-50/60 border-cyan-100 text-cyan-700 shadow-sm'
                        }`}
                      >
                        {symptom.replace(/_/g, ' ')}
                        <button 
                          onClick={() => handleRemoveSymptom(symptom)} 
                          className="text-cyan-500 hover:text-rose-400 p-0.5 rounded transition-colors group ml-1"
                        >
                          <X className="h-2.5 w-2.5 transform group-hover:scale-110" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-center opacity-40 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      No Metrics Selected
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* DIAGNOSTIC GRAPHIC DATA BOARDS */}
          <div className="lg:col-span-8 flex flex-col justify-between">
            <div className="w-full h-full flex flex-col justify-start space-y-6">
              
              {!predictionResult && !loading && (
                <div className={`p-12 rounded-2xl border border-dashed flex flex-col items-center justify-center text-center flex-grow min-h-[480px] ${
                  darkMode ? 'bg-slate-900/10 border-slate-800' : 'bg-white border-slate-200/80 shadow-sm'
                }`}>
                  <Clipboard className={`h-8 w-8 mb-3 ${darkMode ? 'text-slate-800' : 'text-slate-200'}`} />
                  <h3 className={`text-xs font-bold uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    Awaiting Clinical System Telemetry
                  </h3>
                </div>
              )}

              {loading && (
                <div className={`p-12 rounded-2xl border flex flex-col items-center justify-center text-center flex-grow min-h-[480px] ${
                  darkMode ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-slate-200'
                }`}>
                  <div className="relative flex items-center justify-center w-14 h-14 mb-4">
                    <Heart className="w-7 h-7 text-rose-500 fill-rose-500 animate-heartbeat" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-slate-200 animate-pulse flex items-center gap-1.5">
                    Analyzing ❤️
                  </h3>
                </div>
              )}

              {predictionResult && (
                <div className="space-y-6 animate-fadeIn w-full">
                  
                  {/* MAIN PREDICTIONS HEADER BLOCK */}
                  <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative overflow-hidden ${
                    darkMode ? 'bg-slate-900/50 border-slate-800/80 backdrop-blur-xl' : 'bg-white border-slate-200 shadow-md shadow-slate-100/40'
                  }`}>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-cyan-500 block">
                        Predicted Disease
                      </label>
                      <h2 className={`text-base font-black tracking-tight capitalize ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                        {predictionResult.prediction.replace(/_/g, ' ')}
                      </h2>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* PRINT ASSET ACTION */}
                      <button
                        onClick={handlePrintPDF}
                        disabled={pdfLoading}
                        className={`px-4 py-2 rounded-xl border font-bold uppercase tracking-widest text-[10px] transition-all duration-300 flex items-center gap-1.5 disabled:opacity-50 ${
                          darkMode 
                            ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700/80' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm'
                        }`}
                      >
                        <Printer className={`w-3.5 h-3.5 ${pdfLoading ? 'animate-spin text-amber-500' : 'text-cyan-500'}`} />
                        {pdfLoading ? "Compiling..." : "Print Report"}
                      </button>

                      {/* NEXT PATIENT BUTTON */}
                      <button
                        onClick={handleNextPatient}
                        className={`px-4 py-2 rounded-xl border font-bold uppercase tracking-widest text-[10px] transition-all duration-300 flex items-center gap-1.5 ${
                          darkMode
                            ? 'bg-gradient-to-r from-emerald-700 to-teal-700 border-emerald-600 text-white hover:opacity-90 shadow-md shadow-emerald-950/40'
                            : 'bg-gradient-to-r from-emerald-500 to-teal-500 border-emerald-400 text-white hover:opacity-90 shadow-sm'
                        }`}
                        title="Clear all fields and start fresh for next patient"
                      >
                        <Users className="w-3.5 h-3.5" />
                        Next Patient
                      </button>
                    </div>
                  </div>

                  {/* METRICS CLINICAL TEXT FIELDS */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full">
                    <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900/30 border-slate-800/80' : 'bg-white border-slate-200'} sm:col-span-2`}>
                      <h4 className="font-bold uppercase tracking-wider text-[10px] text-blue-500 flex items-center gap-2 mb-3">
                        <Clipboard className="h-3.5 w-3.5" /> Disease Description
                      </h4>
                      <div className={`p-3 rounded-xl border text-xs leading-relaxed font-semibold uppercase tracking-wide ${
                        darkMode ? 'bg-slate-950/40 border-slate-800/60 text-slate-300' : 'bg-slate-50/60 border-slate-100 text-slate-600'
                      }`}>
                        {predictionResult.details.description}
                      </div>
                    </div>

                    {/* ORGANIZED PRESCRIBED MEDICINE COMPONENT */}
                    <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900/30 border-slate-800/80' : 'bg-white border-slate-200'}`}>
                      <h4 className="font-bold uppercase tracking-wider text-[10px] text-emerald-500 flex items-center gap-2 mb-3">
                        <Pill className="h-3.5 w-3.5" /> Prescribed Medicine
                      </h4>
                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {parseClinicalInput(predictionResult.details.medication).map((med, index) => (
                          <div 
                            key={index}
                            className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs leading-relaxed font-semibold uppercase tracking-wide transition-all ${
                              darkMode ? 'bg-slate-950/40 border-slate-800/60 text-slate-300' : 'bg-slate-50/60 border-slate-100 text-slate-600 shadow-sm'
                            }`}
                          >
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                            <span>{med}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ORGANIZED WORKOUT COMPONENT */}
                    <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900/30 border-slate-800/80' : 'bg-white border-slate-200'}`}>
                      <h4 className="font-bold uppercase tracking-wider text-[10px] text-purple-500 flex items-center gap-2 mb-3">
                        <Dumbbell className="h-3.5 w-3.5" /> Workout Strategy
                      </h4>
                      <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                        {parseClinicalInput(predictionResult.details.workout).map((work, index) => (
                          <div 
                            key={index}
                            className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs leading-relaxed font-semibold uppercase tracking-wide transition-all ${
                              darkMode ? 'bg-slate-950/40 border-slate-800/60 text-slate-300' : 'bg-slate-50/60 border-slate-100 text-slate-600 shadow-sm'
                            }`}
                          >
                            <CheckCircle className="h-3.5 w-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
                            <span>{work}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={`p-5 rounded-2xl border ${darkMode ? 'bg-slate-900/30 border-slate-800/80' : 'bg-white border-slate-200'} sm:col-span-2`}>
                      <h4 className="font-bold uppercase tracking-wider text-[10px] text-amber-500 flex items-center gap-2 mb-3">
                        <ShieldAlert className="h-3.5 w-3.5" /> Mandatory Prevention
                      </h4>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {predictionResult.details.precautions.map((precaution, index) => (
                          <li 
                            key={index} 
                            className={`flex items-start gap-2.5 p-2.5 rounded-xl border ${
                              darkMode ? 'bg-slate-950/40 border-slate-800/60' : 'bg-slate-50/60 border-slate-100'
                            }`}
                          >
                            <CheckCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                            <span className={`text-[11px] font-semibold uppercase tracking-wide ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                              {precaution}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* FOOTER MARQUEE TICKER ROW */}
      <footer className={`w-full border-t text-[10px] font-bold uppercase tracking-widest backdrop-blur-md transition-all duration-300 relative z-20 overflow-hidden h-11 flex items-center ${
        darkMode ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'
      }`}>
        <div className="w-full overflow-hidden whitespace-nowrap flex items-center">
          <div className="animate-slow-marquee items-center gap-24">
            <span className="text-amber-600 dark:text-amber-500/90 font-black tracking-widest flex-shrink-0">
              ALGOMEDIX CONFIDENTIAL DIAGNOSTIC PIPELINE // AUTHORIZED PROFESSIONAL USE PROTOCOLS ONLY // INACCURATE ENTRIES VOID EVALUATION RESULTS.
            </span>
            <span className="text-cyan-600 dark:text-cyan-400 font-bold tracking-wider flex-shrink-0">
              قُرْآنِ پَاک: ”وَإِذَا مَرِضْتُ فَهو يَشْفِينِ“ (اَور جَب مَیں بِیمَار ہوتَا ہُوں تو وُہی مجھے شِفَا دیتَا ہے)
            </span>
            <span className="text-amber-600 dark:text-amber-500/90 font-black tracking-widest flex-shrink-0">
              ALGOMEDIX CONFIDENTIAL DIAGNOSTIC PIPELINE // AUTHORIZED PROFESSIONAL USE PROTOCOLS ONLY // INACCURATE ENTRIES VOID EVALUATION RESULTS.
            </span>
            <span className="text-cyan-600 dark:text-cyan-400 font-bold tracking-wider flex-shrink-0">
              قُرْآنِ پَاک: ”وَإِذَا مَرِضْتُ فَهو يَشْفِينِ“ (اَور جَب مَیں بِیمَار ہوتَا ہُوں تو وُہی مجھے شِفَا دیتَا ہے)
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default App;