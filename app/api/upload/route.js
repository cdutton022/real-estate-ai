const { PdfReader } = require('pdfreader');
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Helper function to extract text from a binary file buffer stream
function parsePdfBuffer(buffer) {
  return new Promise((resolve, reject) => {
    let text = "";
    new PdfReader().parseBuffer(buffer, (err, item) => {
      if (err) reject(err);
      else if (item && item.text) text += item.text + " ";
      else if (!item) resolve(text);
    });
  });
}

// Vercel Serverless POST handler
export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('propertyPdf');

    if (!file) {
      return new Response(JSON.stringify({ error: "No file uploaded." }), { status: 400 });
    }

    // Convert the web file upload into a data buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    console.log("Vercel Serverless: Parsing PDF stream...");
    const propertyText = await parsePdfBuffer(buffer);

    const prompt = `
      You are an elite real estate copywriter. Analyze the following property text:
      "${propertyText.substring(0, 4000)}" 
      Generate a professional marketing kit with an [MLS LISTING] and a [SOCIAL MEDIA SCRIPT].
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    return new Response(JSON.stringify({ marketingKit: response.choices.message.content }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("Serverless route error:", error);
    return new Response(JSON.stringify({ error: "Failed to process marketing kit." }), { status: 500 });
  }
}