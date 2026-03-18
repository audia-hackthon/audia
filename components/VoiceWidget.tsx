'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { initWebSpeech } from '@/lib/speechRecognition';
import { processCommand } from '@/lib/commandHandler';
import VoiceTranscript from './VoiceTranscript';

export default function VoiceWidget() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const recognitionRef = useRef<any>(null);

  // Initialize Web Speech on Mount
  useEffect(() => {
    recognitionRef.current = initWebSpeech(
      (text: string, isFinal: boolean) => {
        setTranscript(text);
        if (isFinal) {
          handleFinalCommand(text);
        }
      },
      () => {
        setIsListening(false);
        // Automatically restart if it was abruptly stopped but we still thought it was listening
        // Only if not processing a command
      }
    );

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleFinalCommand = async (command: string) => {
    if (isProcessing) return; // Prevent overlapping commands
    
    // Temporarily pause listening while we process and play audio
    setIsProcessing(true);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);

    await processCommand(command, setTranscript);
    
    // Auto-resume listening after response if user wants continuous experience (Optional)
    // For now, let's keep it manual or user has to click again after it finishes speaking.
    setIsProcessing(false);
    
    // Clear transcript after a delay
    setTimeout(() => {
      setTranscript('');
    }, 4000);
  };

  const toggleListening = () => {
    if (isProcessing) return; // Cannot toggle while speaking/processing

    if (isListening) {
      // Stop
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
    } else {
      // Start
      if (recognitionRef.current) {
        setTranscript('');
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch (e) {
          console.error('Speech recognition error:', e);
        }
      }
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      
      <VoiceTranscript transcript={transcript} isListening={isListening} />

      <motion.button
        onClick={toggleListening}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`relative flex items-center justify-center w-16 h-16 rounded-full shadow-2xl text-white transition-all duration-300 ${
          isProcessing 
            ? 'bg-purple-600 shadow-purple-500/50' 
            : isListening 
              ? 'bg-blue-600 shadow-blue-500/50' 
              : 'bg-zinc-800 dark:bg-white dark:text-zinc-900 shadow-zinc-500/30'
        }`}
        aria-label="Voice Assistant"
      >
        {isProcessing ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          >
            <Volume2 size={28} />
          </motion.div>
        ) : isListening ? (
          <Mic size={28} className="animate-pulse" />
        ) : (
          <MicOff size={28} />
        )}
        
        {/* Glowing rings when listening */}
        {isListening && (
          <span className="absolute inset-0 rounded-full flex items-center justify-center -z-10">
            <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-30 animate-ping duration-1000" />
            <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-20 animate-ping duration-700" style={{ animationDelay: '150ms' }} />
          </span>
        )}
        
      </motion.button>
    </div>
  );
}
