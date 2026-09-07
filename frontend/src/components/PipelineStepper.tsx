import React from 'react';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface Step {
  id: string;
  title: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  description?: string;
}

interface PipelineStepperProps {
  steps: Step[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants: any = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export default function PipelineStepper({ steps }: PipelineStepperProps) {
  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-col space-y-6 bg-slate-900/40 backdrop-blur-xl p-8 rounded-3xl border border-slate-700/50 shadow-2xl"
    >
      <h3 className="text-xl font-bold text-slate-200 mb-4 tracking-wide">Verification Pipeline</h3>
      {steps.map((step, index) => (
        <motion.div variants={itemVariants} key={step.id} className="relative flex items-start group">
          {/* Connector Line */}
          {index < steps.length - 1 && (
            <div className="absolute top-6 -bottom-6 left-[11px] w-[2px] bg-slate-800/50">
              <motion.div 
                className={`w-full ${step.status === 'success' ? 'bg-emerald-500' : step.status === 'error' ? 'bg-red-500' : 'bg-transparent'}`}
                initial={{ height: 0 }}
                animate={{ height: (step.status === 'success' || step.status === 'error') ? '100%' : '0%' }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              />
            </div>
          )}
          
          {/* Icon */}
          <div className="relative z-10 flex-shrink-0 mr-4">
            {step.status === 'success' && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/50">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </motion.div>
            )}
            {step.status === 'loading' && (
              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/50">
                <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              </div>
            )}
            {step.status === 'error' && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/50">
                <XCircle className="w-5 h-5 text-red-400" />
              </motion.div>
            )}
            {step.status === 'pending' && (
              <div className="w-6 h-6 rounded-full bg-slate-800/50 flex items-center justify-center border border-slate-700">
                <Circle className="w-4 h-4 text-slate-500" />
              </div>
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 pb-2 pt-0.5">
            <h4 className={`text-lg font-bold transition-colors duration-300 ${
              step.status === 'success' ? 'text-emerald-400' :
              step.status === 'loading' ? 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]' :
              step.status === 'error' ? 'text-red-400' :
              'text-slate-500'
            }`}>
              {step.title}
            </h4>
            {step.description && (
              <motion.p 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                className="text-sm text-slate-400 mt-1 font-medium"
              >
                {step.description}
              </motion.p>
            )}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
