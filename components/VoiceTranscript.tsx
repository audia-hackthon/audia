'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface VoiceTranscriptProps {
  transcript: string;
  isListening: boolean;
}

export default function VoiceTranscript({ transcript, isListening }: VoiceTranscriptProps) {
  return (
    <AnimatePresence>
      {(transcript || isListening) && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="absolute bottom-full mb-4 right-0 min-w-[250px] max-w-[320px] p-4 rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-white/20 dark:border-zinc-700/50 shadow-2xl overflow-hidden"
        >
          {/* Subtle glowing background effect */}
          <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 via-purple-500/10 to-transparent pointer-events-none" />

          <div className="relative z-10 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-500 dark:text-blue-400">
                {isListening ? 'Listening...' : 'Voivr'}
              </span>
              {isListening && (
                <span className="flex gap-1">
                  {[1, 2, 3].map((i) => (
                    <motion.span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-blue-500"
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.3, 1, 0.3],
                      }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                    />
                  ))}
                </span>
              )}
            </div>
            
            {transcript && (
              <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed font-medium">
                "{transcript}"
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
