import { NextResponse } from 'next/server';
import fs from 'fs';
import { fileURLToPath } from 'url';
const pdfParse = require('pdf-parse');

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      const { url } = await req.json();
      if (!url || !url.startsWith('file://')) {
        return NextResponse.json({ error: 'Invalid local file URL' }, { status: 400 });
      }
      const filePath = fileURLToPath(url);
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);
      return NextResponse.json({ text: data.text });
    } else {
      const arrayBuffer = await req.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const data = await pdfParse(buffer);
      return NextResponse.json({ text: data.text });
    }
  } catch (error: any) {
    console.error('PDF Parse API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
