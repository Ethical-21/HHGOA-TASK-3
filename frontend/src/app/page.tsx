"use client";

import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Upload, X, Shield, Search, ArrowRight, Activity, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PipelineStepper from '../components/PipelineStepper';
import ResultDashboard from '../components/ResultDashboard';
import AnimatedBackground from '../components/AnimatedBackground';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobState, setJobState] = useState<any>(null);
  const [liveStatus, setLiveStatus] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [tamperResult, setTamperResult] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const API_URL = "http://127.0.0.1:8000/api";

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing && jobId) {
      interval = setInterval(async () => {
        try {
          const res = await axios.get(`${API_URL}/status/${jobId}`);
          setLiveStatus(res.data);
        } catch (error) {
          console.error("Live status poll error", error);
        }
      }, 500);
    } else {
      setLiveStatus(null);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing, jobId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      // Reset state
      setJobId(null);
      setJobState(null);
      setTamperResult(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!isProcessing) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isProcessing) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setFile(droppedFile);
      setPreview(URL.createObjectURL(droppedFile));
      setJobId(null);
      setJobState(null);
      setTamperResult(null);
    }
  };

  const startVerification = async () => {
    if (!file) return;
    
    setIsProcessing(true);
    setJobState(null);
    setTamperResult(null);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await axios.post(`${API_URL}/verify/start`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const newJobId = response.data.job_id;
      setJobId(newJobId);
      
      // Start polling
      pollJobStatus(newJobId);
    } catch (error) {
      console.error("Failed to start verification:", error);
      setIsProcessing(false);
      alert("Failed to connect to backend API. Is the Python server running?");
    }
  };

  const pollJobStatus = async (id: string) => {
    try {
      const res = await axios.get(`${API_URL}/verification/${id}`);
      setJobState(res.data);
      
      if (res.data.status === 'COMPLETED' || res.data.status === 'ERROR' || res.data.status === 'NO_MATCH') {
        setIsProcessing(false);
      } else {
        setTimeout(() => pollJobStatus(id), 1000);
      }
    } catch (error) {
      console.error("Polling error:", error);
      setIsProcessing(false);
    }
  };

  const handleTamperSimulate = async () => {
    if (!jobId) return;
    try {
      const res = await axios.post(`${API_URL}/verification/${jobId}/tamper-test`);
      setTamperResult(res.data);
    } catch (error) {
      console.error("Tamper simulate failed:", error);
    }
  };

  const handleVerifyAgain = async () => {
    if (!jobId) return;
    setIsVerifying(true);
    try {
      if (tamperResult) setTamperResult(null);
      await axios.post(`${API_URL}/verification/${jobId}/verify`);
    } catch (error) {
      console.error("Verification failed:", error);
    } finally {
      setIsVerifying(false);
    }
  };

  const getPipelineSteps = () => {
    const steps = [
      { id: 'face', title: 'Face Identification', status: 'pending' as any, description: '' },
      { id: 'search', title: 'Web Search & Identity', status: 'pending' as any, description: '' },
      { id: 'hash', title: 'Content Fingerprint', status: 'pending' as any, description: '' },
      { id: 'blockchain', title: 'Blockchain Record', status: 'pending' as any, description: '' },
      { id: 'verify', title: 'Integrity Verification', status: 'pending' as any, description: '' }
    ];

    if (!jobState) return steps;

    const status = jobState.status;
    const results = jobState.results || {};
    
    const setCompleted = (untilIndex: number) => {
      for(let i=0; i<=untilIndex; i++) {
        steps[i].status = 'success';
      }
    };

    if (status === 'FACE_DETECTION') {
      steps[0].status = 'loading';
      steps[0].description = 'Detecting and encoding face...';
    } else if (status === 'WEB_SEARCH') {
      setCompleted(0);
      steps[1].status = 'loading';
      steps[1].description = 'Searching web & comparing faces...';
    } else if (status === 'HASHING') {
      setCompleted(1);
      steps[2].status = 'loading';
      steps[2].description = 'Generating SHA-256 fingerprint...';
    } else if (status === 'BLOCKCHAIN_SUBMISSION') {
      setCompleted(2);
      steps[3].status = 'loading';
      steps[3].description = 'Submitting to local blockchain...';
    } else if (status === 'COMPLETED') {
      setCompleted(4);
      steps[0].description = `Face detected.`;
      steps[1].description = `Found identity match: ${results.search?.best_match?.title?.substring(0,20)}...`;
      steps[2].description = `Hash: ${results.hash?.substring(0,16)}...`;
      steps[3].description = `Tx: ${results.blockchain?.transaction_hash?.substring(0,16)}...`;
      steps[4].description = `Immutable record verified.`;
    } else if (status === 'NO_MATCH') {
      setCompleted(0);
      steps[1].status = 'error';
      steps[1].description = `No valid identity match found online.`;
    } else if (status === 'ERROR') {
      if (!results.face) { steps[0].status = 'error'; steps[0].description = jobState.error; }
      else if (!results.search) { setCompleted(0); steps[1].status = 'error'; steps[1].description = jobState.error; }
      else if (!results.hash) { setCompleted(1); steps[2].status = 'error'; steps[2].description = jobState.error; }
      else if (!results.blockchain) { setCompleted(2); steps[3].status = 'error'; steps[3].description = jobState.error; }
    }

    return steps;
  };
  return (
    <main className="min-h-screen relative text-slate-200 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      <AnimatedBackground />
      <div className="w-full px-4 py-4 relative z-10 flex flex-col">
        
        {/* Header */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mb-4 flex flex-col items-center justify-center text-center shrink-0"
        >
          
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tighter mb-2 text-white drop-shadow-2xl max-w-4xl mx-auto leading-tight">
            Identity <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">Discovery</span>
          </h1>
          <p className="text-slate-400 text-sm md:text-base font-medium max-w-2xl mx-auto leading-relaxed">
            Upload a face to find matching public profiles and content across the web.
          </p>
        </motion.header>

        <div className="flex flex-col xl:flex-row gap-3 xl:gap-4 mt-2">
          
          {/* Left Column: Upload & Pipeline */}
          <div className="w-full xl:w-[350px] shrink-0 flex flex-col gap-4">
            
            <motion.div 
              layout
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              whileHover={!isProcessing ? { scale: 1.02, boxShadow: "0px 20px 40px rgba(0, 0, 0, 0.4)" } : {}}
              whileTap={!isProcessing ? { scale: 0.98 } : {}}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative bg-slate-900/40 backdrop-blur-xl border-2 border-dashed ${
                preview ? 'border-slate-700/50 shadow-[0_0_40px_rgba(59,130,246,0.15)]' : (isDragging ? 'border-blue-400 bg-blue-900/20 scale-105 shadow-[0_0_50px_rgba(59,130,246,0.3)]' : 'border-blue-500/30 hover:border-blue-500/80 shadow-2xl')
              } rounded-3xl p-6 text-center transition-all duration-300 flex flex-col items-center justify-center overflow-hidden h-[250px] xl:h-[280px] shrink-0 cursor-pointer group`}
              onClick={() => !isProcessing && fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                className="hidden" 
                ref={fileInputRef} 
                accept="image/jpeg, image/png, image/jpg"
                onChange={handleFileChange}
                disabled={isProcessing}
              />
              
              <AnimatePresence mode="wait">
                {preview ? (
                  <motion.div 
                    key="preview"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.4 }}
                    className="absolute inset-0 flex items-center justify-center bg-slate-950/80"
                  >
                    {/* Blurred Background Image */}
                    <img src={preview} alt="Background" className="absolute inset-0 w-full h-full object-cover opacity-20 blur-3xl scale-150" />
                    
                    {/* Foreground Image */}
                    <motion.div 
                      layoutId="uploadedImage"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      className="absolute inset-4 bg-slate-900/50 rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl backdrop-blur-sm"
                    >
                      <img 
                        src={preview} 
                        alt="Preview" 
                        className="w-full h-full object-contain relative z-10 drop-shadow-2xl rounded-lg" 
                      />
                      
                      {/* Scanning Laser Animation during processing */}
                      {isProcessing && (
                        <motion.div 
                          animate={{ top: ['0%', '100%', '0%'] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                          className="absolute left-0 right-0 h-1 bg-blue-400 shadow-[0_0_20px_rgba(59,130,246,1)] z-20"
                        />
                      )}
                    </motion.div>
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent z-10 pointer-events-none" />
                    
                    {!isProcessing && (
                      <motion.button 
                        whileHover={{ scale: 1.1, rotate: 90 }}
                        whileTap={{ scale: 0.9 }}
                        className="absolute top-4 right-4 p-2 bg-slate-900/80 rounded-full hover:bg-red-500/80 transition-colors z-20 backdrop-blur-md border border-slate-700/50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                          setPreview(null);
                          setJobId(null);
                          setJobState(null);
                        }}
                      >
                        <X className="w-5 h-5 text-white" />
                      </motion.button>
                    )}
                    
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center z-20">
                      <motion.button 
                        whileHover={{ scale: 1.05, boxShadow: "0 0 20px rgba(59, 130, 246, 0.5)" }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          startVerification();
                        }}
                        disabled={isProcessing || jobState?.status === 'COMPLETED' || jobState?.status === 'NO_MATCH'}
                        className="px-6 py-2 md:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed border border-blue-400/30 text-sm"
                      >
                        {isProcessing ? 'Processing...' : (jobState?.status === 'COMPLETED' || jobState?.status === 'NO_MATCH') ? 'Verification Finished' : 'Start Verification'}
                      </motion.button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div 
                    key="upload-prompt"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center z-10"
                  >
                    <motion.div 
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className="w-24 h-24 bg-gradient-to-br from-blue-500/20 to-indigo-500/10 rounded-full flex items-center justify-center mb-6 border border-blue-500/30 shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow duration-500"
                    >
                      <Upload className="w-12 h-12 text-blue-400 group-hover:text-blue-300 transition-colors" />
                    </motion.div>
                    <h3 className="text-2xl font-bold text-slate-200 mb-2">Upload a face image</h3>
                    <p className="text-slate-400 mb-8 font-medium">Drag & drop or click to browse</p>
                    <div className="bg-slate-900/80 px-4 py-2 rounded-lg border border-slate-700/50 backdrop-blur-md">
                      <p className="text-xs text-slate-500 font-bold tracking-widest uppercase">PNG, JPG, JPEG</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            
            {/* Pipeline Visualization */}
            <AnimatePresence>
              {(isProcessing || jobState) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.5, ease: "easeInOut" }}
                >
                  <PipelineStepper steps={getPipelineSteps()} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          {/* Right Column: Results */}
          <motion.div 
            layout
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="flex-grow flex flex-col relative w-full"
          >
            <AnimatePresence mode="wait">
              {(jobState?.status === 'COMPLETED' || jobState?.status === 'NO_MATCH') ? (
                <motion.div
                  layout
                  key="results"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.5 }}
                  className="w-full"
                >
                  <ResultDashboard 
                    job={jobState} 
                    onTamperSimulate={handleTamperSimulate}
                    onVerifyAgain={handleVerifyAgain}
                    isVerifying={isVerifying}
                    tamperResult={tamperResult}
                  />
                </motion.div>
              ) : isProcessing && liveStatus ? (
                <motion.div
                  key="live-progress"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className="flex-grow flex flex-col bg-slate-900/50 backdrop-blur-2xl border border-slate-700/50 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
                >
                  {/* Subtle Background Glows */}
                  <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                  {/* Header: Stage & Overall Progress */}
                  <div className="flex items-center justify-between mb-8 relative z-10">
                    <div className="flex items-center space-x-5">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-500/10">
                        {liveStatus.stage === "Completed" ? (
                           <CheckCircle className="w-7 h-7 text-green-400" />
                        ) : (
                           <Activity className="w-7 h-7 text-blue-400 animate-pulse" />
                        )}
                      </div>
                      <div>
                        <h3 className="text-2xl font-semibold text-white tracking-tight">{liveStatus.stage}</h3>
                        <p className="text-slate-400 text-sm mt-1">{liveStatus.detail}</p>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <div className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Scan Progress</div>
                      <div className="w-32 h-2 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-blue-500"
                          initial={{ width: '0%' }}
                          animate={{ width: `${liveStatus.candidates_total > 0 ? (liveStatus.candidates_checked / liveStatus.candidates_total) * 100 : 5}%` }}
                          transition={{ ease: "easeInOut", duration: 0.5 }}
                        />
                      </div>
                      <div className="text-slate-500 text-xs mt-2">{liveStatus.candidates_checked} of {liveStatus.candidates_total} candidates</div>
                    </div>
                  </div>

                  {/* Main Focus: The Evaluation Area */}
                  <div className="grid grid-cols-5 gap-8 flex-grow relative z-10">
                    
                    {/* Left: Source */}
                    <div className="col-span-2 flex flex-col items-center justify-center p-6 bg-slate-800/30 rounded-3xl border border-slate-700/50">
                      <h4 className="text-slate-400 text-xs font-medium uppercase tracking-widest mb-6">Source Identity</h4>
                      <div className="w-48 h-48 rounded-2xl overflow-hidden ring-4 ring-slate-800 shadow-2xl relative">
                        {preview && <img src={preview} className="w-full h-full object-cover" alt="Source" />}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      </div>
                    </div>

                    {/* Center: The Matcher */}
                    <div className="col-span-1 flex flex-col items-center justify-center relative">
                      <div className="absolute inset-x-0 top-1/2 h-0.5 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent -translate-y-1/2" />
                      <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center relative z-10 shadow-xl">
                        <motion.div 
                          animate={{ rotate: 360 }} 
                          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                          className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500 border-b-indigo-500 opacity-50"
                        />
                        <Search className="w-6 h-6 text-slate-300" />
                      </div>
                    </div>

                    {/* Right: Currently Scanning */}
                    <div className="col-span-2 flex flex-col items-center justify-center p-6 bg-slate-800/30 rounded-3xl border border-slate-700/50 relative overflow-hidden group">
                      <motion.div 
                        animate={{ opacity: [0.1, 0.3, 0.1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="absolute inset-0 bg-blue-500/10"
                      />
                      <h4 className="text-slate-400 text-xs font-medium uppercase tracking-widest mb-6 relative z-10">Evaluating Candidate</h4>
                      <div className="w-48 h-48 rounded-2xl overflow-hidden ring-4 ring-slate-800 shadow-2xl relative z-10 bg-slate-900">
                        <AnimatePresence mode="wait">
                          <motion.img 
                            key={liveStatus.current_candidate_url || "empty"}
                            src={liveStatus.current_candidate_url || "/globe.svg"}
                            initial={{ opacity: 0, scale: 1.1 }}
                            animate={{ opacity: 0.8, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.3 }}
                            className="w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        </AnimatePresence>
                        <div className="absolute inset-0 border-2 border-blue-500/20 rounded-2xl pointer-events-none" />
                      </div>
                    </div>

                  </div>

                  {/* Footer: Best Match Result */}
                  <div className="mt-8 relative z-10">
                    <div className="bg-slate-800/50 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between shadow-lg backdrop-blur-md">
                      <div className="flex items-center space-x-4">
                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-900 border border-slate-700">
                          <AnimatePresence mode="wait">
                            <motion.img 
                              key={liveStatus.best_candidate_url || "empty_best"}
                              src={liveStatus.best_candidate_url || "/globe.svg"}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                          </AnimatePresence>
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Best Match Candidate</div>
                          <div className="flex items-center space-x-3">
                            <span className={`text-xl font-semibold ${liveStatus.best_distance < 0.35 ? 'text-green-400' : 'text-slate-300'}`}>
                              {liveStatus.best_distance !== 1.0 ? `Distance: ${liveStatus.best_distance.toFixed(3)}` : "Awaiting results..."}
                            </span>
                            {liveStatus.best_distance < 0.35 && (
                              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] font-bold rounded uppercase border border-green-500/30">Verified</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500 uppercase">Threshold</div>
                        <div className="text-sm font-medium text-slate-400">&lt; 0.35</div>
                      </div>
                    </div>
                  </div>

                </motion.div>
              ) : (
                <motion.div 
                  key="placeholder"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-grow flex items-center justify-center border-2 border-slate-800/30 bg-slate-900/30 backdrop-blur-sm rounded-3xl p-12 shadow-2xl h-full"
                >
                  <div className="text-center max-w-md mx-auto">
                    <motion.div 
                      animate={isProcessing ? { scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] } : {}}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-28 h-28 bg-slate-800/40 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner border border-slate-700/50 backdrop-blur-md"
                    >
                      <Shield className={`w-14 h-14 ${isProcessing ? 'text-blue-400' : 'text-slate-600'} transition-colors duration-500`} />
                    </motion.div>
                    <h3 className="text-3xl font-bold text-slate-200 mb-4">Ready for Verification</h3>
                    <p className="text-slate-400 text-lg leading-relaxed font-light">
                      {isProcessing ? (
                        <motion.span
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          Processing image and searching the blockchain...
                        </motion.span>
                      ) : 'Upload a face image to the left and click start to begin the integrity check.'}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </main>
  );
}

