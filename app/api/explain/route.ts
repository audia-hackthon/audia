import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'Visible text is required' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ explanation: "I cannot explain this right now because the OpenAI API key is missing." });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are Voivr, a helpful voice assistant for a website. Explain the following webpage content in simple terms for the user as if you are talking to them. Keep your response brief and conversational, under 3 sentences." },
        { role: "user", content: text }
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    const explanation = response.choices[0]?.message?.content?.trim() || "Sorry, I couldn't explain this section.";

    return NextResponse.json({ explanation });
  } catch (error: any) {
    console.error('Explain API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
