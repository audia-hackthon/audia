# Voivr - Voice Layer for Websites

Voivr acts like **“Alexa for websites”**. It adds a floating voice assistant widget to your webpage. Users can talk to control the website using voice, and Voivr relies on:
- Web Speech API for transcription
- OpenAI for interpreting DOM contents / Summarization
- Murf AI for Text-to-Speech playback

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Rename `.env.local` or create it with the following:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   MURF_API_KEY=your_murf_api_key_here
   ```

3. **Run Locally**
   Start the Next.js development server:
   ```bash
   npm run dev
   ```

4. **Testing the App**
   - Open your browser and go to `http://localhost:3000`.
   - Grant microphone permissions when prompted after clicking the microphone widget.
   - Say commands like:
     - "Scroll down"
     - "Scroll up"
     - "Go to pricing"
     - "Summarize this page"
     - "Explain this section"
     - "Search for accessibility"

## Features

- **DOM Interactions**: Navigate to text or scroll automatically based on natural phrasing.
- **AI Summary**: Scrapes visible text or specific DOM elements to create high-quality audio summaries on the fly.
- **Micro-Animations**: A polished responsive interface, leveraging framer-motion.
