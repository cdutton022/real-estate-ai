const { PdfReader } = require('pdfreader');
const { OpenAI } = require('openai');

// Helper function to process raw binary buffers into strings
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

// Native Vercel Serverless Function Handler
module.exports = async (req, res) => {
  // Enable Cross-Origin Resource Sharing (CORS) so your frontend can talk to it safely
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle browser pre-flight checks
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    const rawBody = req.body;
    if (!rawBody || rawBody.length === 0) {
      return res.status(400).json({ error: "Empty file stream received." });
    }

    console.log("Vercel Serverless Function: Extracting PDF data...");
    const propertyText = await parsePdfBuffer(rawBody);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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

    return res.status(200).json({ marketingKit: response.choices.message.content });

  } catch (error) {
    console.error("Cloud processing error:", error);
    return res.status(500).json({ error: "Processing failed inside the cloud function node." });
  }
};
