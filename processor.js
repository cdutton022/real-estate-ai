const fs = require('fs');
const { PdfReader } = require('pdfreader');
const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper function to read the PDF and return a Promise
function readPdfText(pdfPath) {
  return new Promise((resolve, reject) => {
    let extractedText = "";
    console.log("Reading property PDF...");

    new PdfReader().parseFileItems(pdfPath, (err, item) => {
      if (err) {
        reject(err);
      } else if (item && item.text) {
        extractedText += item.text + " ";
      } else if (!item) {
        // File reading is completely done
        resolve(extractedText);
      }
    });
  });
}

async function startPipeline() {
  try {
    const pdfPath = './property.pdf';
    
    // Force Node.js to wait for the file reading to finish
    const propertyText = await readPdfText(pdfPath);

    if (!propertyText || propertyText.trim().length === 0) {
      console.error("Error: Could not extract text from the PDF. Is it an empty scan?");
      return;
    }

    console.log(`Successfully extracted ${propertyText.length} characters. Connecting to AI...`);
    
    const prompt = `
      You are an elite real estate copywriter. Analyze the following property inspection/disclosure text:
      "${propertyText.substring(0, 4000)}" 
      
      Generate a professional marketing kit with two distinct sections:
      1. [MLS LISTING]: A compelling, high-converting 200-word MLS description highlighting the property's best features.
      2. [SOCIAL MEDIA SCRIPT]: A 60-second engaging TikTok/Instagram Reels script with visual cues.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    console.log("\n=== GENERATED MARKETING KIT ===\n");
    if (response && response.choices && response.choices[0] && response.choices[0].message) {
      console.log(response.choices[0].message.content);
    } else {
      console.log("No text content returned from AI.");
    }
    
  } catch (error) {
    console.error("Pipeline Error:", error);
  }
}

// Run the script
startPipeline();
