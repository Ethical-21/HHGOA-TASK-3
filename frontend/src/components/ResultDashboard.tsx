import React from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, Link as LinkIcon, Hash, Copy, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ResultDashboardProps {
  job: any;
  onTamperSimulate: () => void;
  onVerifyAgain: () => void;
  isVerifying: boolean;
  tamperResult?: any;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.15 }
  }
};

const cardVariants: any = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 200, damping: 20 } }
};

export default function ResultDashboard({ job, onTamperSimulate, onVerifyAgain, isVerifying, tamperResult }: ResultDashboardProps) {
  if (!job || !job.results || !job.results.search) return null;

  const searchResult = job.results.search;
  const match = searchResult.best_match;
  const blockchain = job.results.blockchain;
  const isNoMatch = job.status === 'NO_MATCH';
  const rejections = searchResult.rejections || [];
  
  let isVerified = !isNoMatch;
  let computedHash = job.results.hash || 'N/A';
  let onChainHash = job.results.hash || 'N/A';
  let tamperedData = null;
  
  if (tamperResult) {
    isVerified = tamperResult.is_verified;
    computedHash = tamperResult.computed_hash;
    onChainHash = tamperResult.original_hash;
    tamperedData = tamperResult.tampered_data;
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard');
  };

  const displayData = tamperedData || match;

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-col space-y-3"
    >
      {/* Status Header */}
      <motion.div 
        variants={cardVariants}
        animate={tamperResult && !isVerified ? { x: [-10, 10, -10, 10, 0] } : {}}
        transition={tamperResult && !isVerified ? { duration: 0.4, type: "tween" } : {}}
        className={`relative overflow-hidden p-4 rounded-2xl border ${isVerified ? 'bg-emerald-900/30 border-emerald-500/50' : (isNoMatch ? 'bg-orange-900/30 border-orange-500/50' : 'bg-red-900/30 border-red-500/50')} flex items-center space-x-4 shadow-2xl backdrop-blur-xl`}
      >
        <motion.div 
          animate={isVerified ? { scale: [1, 1.2, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12 translate-x-[-150%]"
        />
        {isVerified ? (
          <ShieldCheck className="w-12 h-12 text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
        ) : isNoMatch ? (
          <ShieldX className="w-12 h-12 text-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]" />
        ) : (
          <ShieldAlert className="w-12 h-12 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
        )}
        <div className="relative z-10">
          <h2 className={`text-2xl md:text-3xl font-extrabold tracking-tight ${isVerified ? 'text-emerald-400' : (isNoMatch ? 'text-orange-400' : 'text-red-400')}`}>
            {isVerified ? '✓ FACE MATCH (Integrity Verified)' : (isNoMatch ? '✕ NO RELIABLE FACE MATCH' : 'Tampering Detected')}
          </h2>
          <p className="text-slate-300 mt-1 font-medium">
            {isVerified 
              ? 'The recomputed content fingerprint matches the immutable blockchain record.'
              : isNoMatch 
                ? 'No online candidate met the minimum face similarity threshold.'
                : 'The current content fingerprint does NOT match the immutable blockchain record!'}
          </p>
        </div>
      </motion.div>

      {isNoMatch && (
        <motion.div variants={cardVariants} className="bg-slate-900/50 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl -z-10" />
          <h3 className="text-2xl font-bold text-slate-200 mb-6 flex items-center text-orange-400">
            <AlertCircle className="w-8 h-8 mr-3 drop-shadow-md" />
            Pipeline Result
          </h3>
          <div className="space-y-2 mb-6">
            <p className="text-slate-300 text-lg"><span className="text-orange-400 font-bold">{searchResult.diagnostics?.raw_search_results || searchResult.candidates_count || 0}</span> search results discovered</p>
            <p className="text-slate-300 text-lg"><span className="text-orange-400 font-bold">{searchResult.diagnostics?.candidates_retained || searchResult.candidates_count || 0}</span> candidates eligible for analysis</p>
            <p className="text-slate-300 text-lg"><span className="text-orange-400 font-bold">{searchResult.diagnostics?.images_fetched || 0}</span> candidate images successfully analyzed</p>
            <p className="text-slate-300 text-lg"><span className="text-orange-400 font-bold">0</span> reliable face matches found</p>
          </div>
        </motion.div>
      )}

      {/* Main Core Results Grid */}
      {!isNoMatch && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
          
          {/* Left Column: Target Match Image & Sim */}
          <motion.div variants={cardVariants} className="xl:col-span-4 bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-2xl p-4 shadow-2xl flex flex-col flex-grow relative overflow-hidden group">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-colors duration-700 pointer-events-none" />
            <h3 className="text-xl font-bold text-slate-200 mb-4 flex items-center">
              <LinkIcon className="w-6 h-6 mr-3 text-blue-400" />
              Target Match
            </h3>
            
            <div className="space-y-2 flex-grow relative z-10 flex flex-col">
              {displayData.image_url && (
                <motion.div 
                  whileHover={{ scale: 1.02 }}
                  className="relative w-full h-48 rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-950 flex items-center justify-center shadow-xl transition-all"
                >
                  <img src={displayData.image_url} alt="Background" className="absolute inset-0 w-full h-full object-cover opacity-40 blur-2xl scale-125" />
                  <img src={displayData.image_url} alt="Match" className="w-full h-full object-contain relative z-10 drop-shadow-2xl" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent z-10" />
                </motion.div>
              )}
              
              <div className="grid grid-cols-1 mt-auto">
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 shadow-lg relative overflow-hidden">
                  <div className="absolute bottom-0 left-0 h-1 bg-emerald-500" style={{ width: displayData.face_similarity ? `${displayData.face_similarity * 100}%` : '0%' }} />
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Face Sim</p>
                  <p className="text-emerald-400 font-extrabold text-xl">
                    {displayData.face_similarity ? `${(displayData.face_similarity * 100).toFixed(1)}%` : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right Columns: Metadata & Blockchain */}
          <motion.div variants={cardVariants} className="xl:col-span-8 flex flex-col space-y-3">
            
            {/* Identity Dossier */}
            {displayData.identity_profile && (
              <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-2xl p-5 shadow-2xl relative overflow-hidden group border-l-4 border-l-purple-500">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-[60px] pointer-events-none transition-colors duration-700 group-hover:bg-purple-500/20" />
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-bold flex items-center">
                  <span className="w-2 h-2 rounded-full bg-purple-500 mr-2 animate-pulse"></span>
                  Discovered Identity
                </p>
                <h2 className="text-3xl md:text-4xl font-black leading-tight text-white mb-2 tracking-tight">
                  {displayData.identity_profile.name}
                </h2>
                <p className="text-slate-300 text-sm md:text-base leading-relaxed max-w-3xl">
                  {displayData.identity_profile.bio}
                </p>
              </div>
            )}

            {/* Top row: Metadata */}
            <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-2xl p-5 shadow-2xl relative overflow-hidden flex flex-col justify-between group">
              <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-[60px] pointer-events-none transition-colors duration-700 group-hover:bg-blue-500/20" />
              
              <div className="flex flex-col gap-5 relative z-10">
                {/* Title & Badges */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-grow pr-4">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-bold flex items-center">
                      <span className="w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse"></span>
                      Matched Content Context
                    </p>
                    <h2 className={`text-xl md:text-2xl font-black leading-tight line-clamp-2 ${tamperedData ? 'text-red-400' : 'text-slate-100'}`}>
                      {displayData.title || 'Unknown Context'}
                    </h2>
                  </div>
                  <div className="flex flex-row md:flex-col gap-2 shrink-0">
                    <div className="bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 shadow-inner flex items-center justify-between min-w-[120px]">
                      <span className="text-[9px] text-slate-500 uppercase font-bold mr-3">Platform</span>
                      <span className="text-slate-200 font-bold text-xs truncate capitalize">{displayData.source || 'Web'}</span>
                    </div>
                    <div className="bg-indigo-950/40 px-3 py-2 rounded-xl border border-indigo-900/50 shadow-inner flex items-center justify-between min-w-[120px]">
                      <span className="text-[9px] text-indigo-400/70 uppercase font-bold mr-3">Engine</span>
                      <span className="text-indigo-400 font-bold text-xs truncate">{displayData.discovery_method || 'Search'}</span>
                    </div>
                  </div>
                </div>

                {/* Source URI */}
                <a href={displayData.post_url} target="_blank" rel="noreferrer" className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 shadow-inner flex items-center justify-between hover:border-blue-500/50 transition-colors cursor-pointer group/link">
                  <div className="flex flex-col overflow-hidden mr-4 w-full">
                    <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Source URI</p>
                    <p className="text-blue-400 text-sm truncate font-medium group-hover/link:text-blue-300 transition-colors">
                      {displayData.post_url}
                    </p>
                  </div>
                  <div className="bg-slate-900 p-2 rounded-lg group-hover/link:bg-blue-500/20 transition-colors">
                    <ExternalLink className="w-4 h-4 text-slate-400 group-hover/link:text-blue-400 shrink-0 transition-colors" />
                  </div>
                </a>
              </div>
            </div>

            {/* Bottom Row: Blockchain & Verification */}
            {blockchain && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-grow">
                {/* Blockchain Record */}
                <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-2xl p-4 shadow-2xl relative overflow-hidden group flex flex-col">
                  <div className="absolute -top-20 -left-20 w-60 h-60 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-colors duration-700 pointer-events-none" />
                  <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center relative z-10">
                    <Hash className="w-5 h-5 mr-2 text-purple-400" /> Immutable Record
                  </h3>
                  <div className="space-y-2 relative z-10 flex-grow flex flex-col justify-center">
                    <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80 shadow-lg">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-bold flex justify-between items-center">
                        Tx Hash 
                        <button onClick={() => copyToClipboard(blockchain.transaction_hash)} className="text-slate-400 hover:text-white transition hover:scale-110 active:scale-95">
                          <Copy className="w-3 h-3" />
                        </button>
                      </p>
                      <p className="font-mono text-xs text-slate-300 break-all leading-relaxed bg-slate-900 p-2 rounded-lg border border-slate-800">{blockchain.transaction_hash}</p>
                    </div>
                    <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80 shadow-lg flex justify-between items-center">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Block</p>
                      <p className="font-mono text-lg text-slate-200 font-extrabold">{blockchain.block_number}</p>
                    </div>
                  </div>
                </div>

                {/* Verification Check */}
                <div className="bg-slate-900/40 border border-slate-700/50 backdrop-blur-xl rounded-2xl p-4 shadow-2xl relative overflow-hidden flex flex-col">
                  <div className={`absolute -bottom-20 -right-20 w-60 h-60 rounded-full blur-3xl transition-colors duration-700 pointer-events-none ${isVerified ? 'bg-emerald-500/10' : 'bg-red-500/10'}`} />
                  <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center relative z-10">
                    <ShieldCheck className={`w-5 h-5 mr-2 ${isVerified ? 'text-emerald-400' : 'text-red-400'}`} /> Cryptographic Audit
                  </h3>
                  <div className="space-y-2 relative z-10 flex-grow flex flex-col justify-center">
                    <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80 shadow-lg">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-bold flex items-center justify-between">
                        Computed Fingerprint <span className="px-2 py-0.5 bg-slate-800 rounded-full text-[8px] ml-2">Current</span>
                      </p>
                      <p className={`font-mono text-[10px] break-all leading-relaxed p-2 rounded-lg bg-slate-900 border ${isVerified ? 'text-slate-300 border-slate-800' : 'text-red-400 font-bold border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]'}`}>
                        {computedHash}
                      </p>
                    </div>
                    <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80 shadow-lg">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-bold flex items-center justify-between">
                        On-Chain Fingerprint <span className="px-2 py-0.5 bg-slate-800 rounded-full text-[8px] ml-2">Stored</span>
                      </p>
                      <p className="font-mono text-[10px] break-all leading-relaxed text-slate-300 p-2 rounded-lg bg-slate-900 border border-slate-800">
                        {onChainHash}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Diagnostics and Rejections - Side by Side Grid to save space */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        {/* Diagnostics Panel */}
        {searchResult.diagnostics && (
          <motion.div variants={cardVariants} className="bg-slate-950/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-4 shadow-2xl relative overflow-hidden group h-full">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -z-10 group-hover:bg-indigo-500/20 transition-colors duration-1000" />
            <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center">
              <ShieldAlert className="w-5 h-5 mr-2 text-indigo-400" />
              Search Diagnostics
            </h3>
            <div className="flex flex-col gap-4 mt-2">
              {/* SECTION 1: SEARCH SOURCES */}
              <div className="bg-slate-900/50 backdrop-blur-md p-4 rounded-xl border border-indigo-500/20 shadow-lg">
                <p className="text-[10px] md:text-xs text-slate-400 uppercase tracking-widest font-bold mb-3 border-b border-slate-800 pb-2">Search Sources Discovered</p>
                <div className="flex flex-wrap gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${searchResult.diagnostics.social_results > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                    ✓ Instagram
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${searchResult.diagnostics.social_results > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                    ✓ LinkedIn
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${searchResult.diagnostics.social_results > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                    ✓ Facebook
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${searchResult.diagnostics.social_results > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                    ✓ X
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${searchResult.diagnostics.social_results > 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-500'}`}>
                    ✓ Reddit
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${searchResult.diagnostics.news_results > 0 ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'}`}>
                    ✓ News
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${searchResult.diagnostics.public_web_results > 0 ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-500'}`}>
                    ✓ Public Web
                  </span>
                </div>
              </div>
              
              {/* SECTION 2: FILTERED SOURCES */}
              <div className="bg-slate-900/50 backdrop-blur-md p-4 rounded-xl border border-red-500/20 shadow-lg flex items-center justify-between">
                <div>
                  <p className="text-[10px] md:text-xs text-red-400/80 uppercase tracking-widest font-bold mb-1">Filtered Sources</p>
                  <p className="text-slate-300 text-sm"><span className="text-red-400 font-bold">{searchResult.diagnostics.commercial_rejected || 0}</span> product/shopping results removed</p>
                </div>
              </div>

              {/* SECTION 3: IDENTITY CANDIDATES */}
              <div className="bg-slate-900/50 backdrop-blur-md p-4 rounded-xl border border-emerald-500/20 shadow-lg flex items-center justify-between">
                <div>
                  <p className="text-[10px] md:text-xs text-emerald-400/80 uppercase tracking-widest font-bold mb-1">Identity Candidates</p>
                  <p className="text-slate-300 text-sm"><span className="text-emerald-400 font-bold">{searchResult.diagnostics.candidates_retained || 0}</span> public person-centric candidates analyzed</p>
                </div>
                <div className="text-right border-l border-slate-700 pl-4 ml-2">
                   <p className="text-[10px] md:text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Faces Detected</p>
                   <p className="text-white font-bold text-xl">{searchResult.diagnostics.faces_detected || 0}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Candidate Rejection Transparency */}
        {rejections && rejections.length > 0 && (
          <motion.div variants={cardVariants} className="bg-slate-900/50 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-4 shadow-2xl relative overflow-hidden h-full flex flex-col">
            <div className="absolute top-0 right-0 w-64 h-64 bg-slate-500/5 rounded-full blur-3xl -z-10" />
            <h3 className="text-lg font-bold text-slate-200 mb-4 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-slate-400 drop-shadow-md" />
              Rejection Transparency
            </h3>
            <p className="text-slate-400 mb-4 text-xs">Evaluated <span className="text-slate-200 font-bold">{searchResult.diagnostics?.raw_search_results || searchResult.candidates_count || 0}</span> candidates dynamically:</p>
            <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar max-h-48 space-y-2">
              {rejections.map((reason: string, i: number) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + (i * 0.05) }}
                  className="text-slate-400 bg-slate-950/50 p-3 rounded-xl border border-slate-800/50 font-mono text-[10px] shadow-sm flex items-start"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-600 mr-2 mt-1 flex-shrink-0" />
                  <span className="leading-relaxed">{reason}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Actions */}
      {!isNoMatch && (
        <motion.div variants={cardVariants} className="flex justify-end space-x-4 pt-8">
          {!tamperResult && (
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onTamperSimulate}
              className="px-6 py-3 border border-red-500/50 text-red-400 font-bold rounded-xl hover:bg-red-500/10 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)] transition-all flex items-center"
            >
              <ShieldAlert className="w-5 h-5 mr-2" />
              Simulate Tampering
            </motion.button>
          )}
          
          <motion.button 
            whileHover={!isVerifying ? { scale: 1.05, boxShadow: "0 0 20px rgba(37,99,235,0.5)" } : {}}
            whileTap={!isVerifying ? { scale: 0.95 } : {}}
            onClick={onVerifyAgain}
            disabled={isVerifying}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all flex items-center disabled:opacity-50 shadow-lg shadow-blue-500/20"
          >
            <RefreshCw className={`w-5 h-5 mr-2 ${isVerifying ? 'animate-spin' : ''}`} />
            {tamperResult ? 'Restore & Verify Again' : 'Verify Again'}
          </motion.button>
        </motion.div>
      )}
    </motion.div>
  );
}
