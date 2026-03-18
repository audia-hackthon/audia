import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Text content is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      // Provide a fallback in case API key is missing to not break the MVP
      return NextResponse.json({ summary: "I cannot summarize right now because the OpenAI API key is missing." });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are Voivr, a helpful voice assistant for a website. Summarize the following webpage content concisely and clearly in simple terms. Keep the summary under 3 sentences so it can be spoken out loud." },
        { role: "user", content: text }
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    const summary = response.choices[0]?.message?.content?.trim() || "Sorry, I couldn't summarize this page.";

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error('Summarize API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
