const express = require('express');
const multer = require('multer');
const { PdfReader } = require('pdfreader');
const { OpenAI } = require('openai');
const path = require('path');
require('dotenv').config();

const app = express();
const upload = multer({ dest: '/tmp/' }); // Use serverless write-safe /tmp/ directory
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json());

// Serve static assets out of the absolute public folder path
app.use(express.static(path.join(process.cwd(), 'public')));

// FORCE HOME ROUTE: Serve the index.html from the absolute working directory
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

function parsePdf(filePath) {
  return new Promise((resolve, reject) => {
    let text = "";
    new PdfReader().parseFileItems(filePath, (err, item) => {
      if (err) reject(err);
      else if (item && item.text) text += item.text + " ";
      else if (!item) resolve(text);
    });
  });
}

app.post('/api/upload', upload.single('propertyPdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const propertyText = await parsePdf(req.file.path);

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

    res.json({ marketingKit: response.choices.message.content });

  } catch (error) {
    console.error("Web server error:", error);
    res.status(500).json({ error: "Failed to generate marketing kit." });
  }
});

// Export the Express server natively for Vercel Serverless
module.exports = app;
