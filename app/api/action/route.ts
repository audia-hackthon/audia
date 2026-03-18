import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: Request) {
  try {
    const { command, elements } = await req.json();

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ action: "say", text: "I cannot do this because the OpenAI API key is missing." });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `You are Voivr, an AI voice assistant executing commands on a webpage.
The user said: "${command}"

Here is a JSON list of all the visible clickable elements on the screen:
${JSON.stringify(elements)}

Figure out what the user wants to do. Output a JSON object matching this schema exactly:
{
  "action": "click" | "scroll" | "say",
  "id": number (Required if action is "click". The ID of the element to interact with),
  "direction": "up" | "down" | "top" | "bottom" (Required if action is "scroll"),
  "text": string (A short conversational response confirming the action, e.g., "Opening the cart." or "Here is the electronics section.")
}

Only return valid JSON. Do not return anything else.`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You output valid JSON and nothing else. You map natural language to UI actions." },
        { role: "user", content: prompt }
      ],
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content;
    let result = {};
    if (content) {
      result = JSON.parse(content);
    }
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Smart Action API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
