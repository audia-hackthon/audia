'use client';

import React from 'react';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-slate-100 flex flex-col items-center p-8 sm:p-20 font-[family-name:var(--font-geist-sans)] selection:bg-blue-300 selection:text-black">
      
      {/* Hero Section */}
      <section className="w-full max-w-5xl flex flex-col items-center text-center space-y-6 pt-20 pb-40">
        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Welcome to Voivr
        </h1>
        <p className="text-xl sm:text-2xl text-slate-600 dark:text-slate-400 max-w-2xl">
          The ultimate voice layer for any website. Click the microphone in the bottom right corner and try saying <strong className="text-blue-500">"Scroll down"</strong>.
        </p>
        <div className="flex gap-4 pt-8">
          <button className="px-8 py-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors shadow-lg shadow-blue-500/30">
            Get Started
          </button>
          <button className="px-8 py-3 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700 font-semibold transition-colors">
            View Documentation
          </button>
        </div>
      </section>

      {/* Features Section */}
      <section className="w-full max-w-5xl py-32 border-t border-slate-200 dark:border-zinc-800" id="features">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Powerful Features</h2>
          <p className="text-lg text-slate-600 dark:text-slate-400">Try saying <strong className="text-purple-500">"Explain this section"</strong> while looking at these features.</p>
        </div>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {[
            { title: "Voice Navigation", desc: "Easily navigate through pages, scroll up, scroll down, or jump to specific sections just by talking." },
            { title: "AI Summarization", desc: "Understand long pages instantly. Say 'Summarize this page' to get a quick audio overview." },
            { title: "Contextual Explanations", desc: "Confused by a chart or block of text? Say 'Explain this section' to get a simple breakdown." },
            { title: "Smart Search", desc: "Say 'Search for pricing' and Voivr will automatically find the relevant section and scroll to it." },
            { title: "Murf TTS Voices", desc: "Experience ultra-realistic, studio-quality AI voices for a premium auditory experience." },
            { title: "A11y Friendly", desc: "Make your website completely accessible to visually impaired or mobility-challenged users." }
          ].map((feature, idx) => (
            <div key={idx} className="p-8 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 shadow-sm hover:shadow-xl transition-shadow">
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="w-full max-w-5xl py-32 border-t border-slate-200 dark:border-zinc-800 text-center" id="pricing">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">Simple Pricing</h2>
        <p className="text-lg text-slate-600 dark:text-slate-400 mb-16">Try saying <strong className="text-blue-500">"Go to Pricing"</strong> from anywhere on the page.</p>
        
        <div className="flex flex-col sm:flex-row justify-center gap-8">
          <div className="p-8 rounded-3xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 w-full max-w-sm">
            <h3 className="text-2xl font-bold mb-2">Basic</h3>
            <p className="text-4xl font-extrabold mb-6">$0<span className="text-lg text-slate-500 font-normal">/mo</span></p>
            <ul className="text-left space-y-4 mb-8">
              <li>✓ Basic voice commands</li>
              <li>✓ 100 summaries per month</li>
              <li>✓ Standard voices</li>
            </ul>
            <button className="w-full py-3 rounded-xl bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 font-semibold transition-colors">Choose Basic</button>
          </div>
          
          <div className="p-8 rounded-3xl bg-blue-600 text-white shadow-2xl shadow-blue-500/20 w-full max-w-sm transform sm:-translate-y-4">
            <div className="text-sm font-bold tracking-wider uppercase mb-2 text-blue-200">Most Popular</div>
            <h3 className="text-2xl font-bold mb-2">Pro</h3>
            <p className="text-4xl font-extrabold mb-6">$29<span className="text-lg text-blue-300 font-normal">/mo</span></p>
            <ul className="text-left space-y-4 mb-8">
              <li>✓ Advanced voice commands</li>
              <li>✓ Unlimited summaries</li>
              <li>✓ Premium Murf AI voices</li>
              <li>✓ DOM explanation engine</li>
            </ul>
            <button className="w-full py-3 rounded-xl bg-white text-blue-600 hover:bg-blue-50 font-bold transition-colors">Choose Pro</button>
          </div>
        </div>
      </section>

      {/* Footer / Contact */}
      <footer className="w-full max-w-5xl py-12 border-t border-slate-200 dark:border-zinc-800 text-center" id="contact">
        <h2 className="text-2xl font-bold mb-4">Contact Us</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-8">Ready to integrate Voivr? Say <strong className="text-purple-500">"Go to Contact"</strong>.</p>
        <div className="flex justify-center gap-6">
          <a href="#" className="text-blue-500 hover:underline">Twitter</a>
          <a href="#" className="text-blue-500 hover:underline">LinkedIn</a>
          <a href="#" className="text-blue-500 hover:underline">GitHub</a>
        </div>
        <p className="mt-12 text-sm text-slate-500">© 2026 Voivr Inc. All rights reserved.</p>
      </footer>

    </main>
  );
}
