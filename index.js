const express = require('express');
const { PdfReader } = require('pdfreader');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();

// Use Express built-in raw body parser to handle binary PDF data directly in memory
app.use(express.raw({ type: 'application/pdf', limit: '10mb' }));
app.use(express.json());

// 1. FRONTEND HOME ROUTE: Inline HTML Interface
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Real Estate AI Marketing Kit Generator</title>
    <script src="https://tailwindcss.com"></script>
</head>
<body class="bg-gray-50 font-sans min-h-screen flex flex-col justify-between">
    <header class="bg-white shadow-sm py-4 px-6 border-b">
        <h1 class="text-xl font-bold text-gray-800">🏠 ListingAI <span class="text-sm font-normal text-blue-600 font-mono">v1.0 Pro</span></h1>
    </header>
    <main class="max-w-4xl w-full mx-auto p-6 flex-grow">
        <div class="text-center my-8">
            <h2 class="text-3xl font-extrabold text-gray-900 tracking-tight">Turn Property PDFs into Marketing Kits</h2>
            <p class="text-gray-600 mt-2">Upload disclosure or inspection documents. Get instant MLS listings and video scripts.</p>
        </div>
        <div class="bg-white p-8 rounded-xl shadow-md border border-gray-100 max-w-xl mx-auto">
            <form id="uploadForm" class="space-y-4">
                <div class="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition cursor-pointer">
                    <input type="file" id="pdfFile" accept=".pdf" class="hidden" required>
                    <label for="pdfFile" class="cursor-pointer block text-gray-600 font-medium">
                        <span class="text-blue-600 underline">Click to upload</span> or drag and drop
                        <span class="block text-xs text-gray-400 mt-1">Property PDF up to 10MB</span>
                    </label>
                    <div id="fileName" class="text-sm text-green-600 font-medium mt-2 hidden"></div>
                </div>
                <button type="submit" id="submitBtn" class="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition disabled:bg-blue-300">
                    Generate Marketing Kit ($20)
                </button>
            </form>
        </div>
        <div id="outputSection" class="mt-12 bg-white p-8 rounded-xl shadow-md border border-gray-100 hidden">
            <h3 class="text-xl font-bold text-gray-800 border-b pb-3 mb-4">✨ Your Generated Marketing Kit</h3>
            <pre id="kitResult" class="whitespace-pre-wrap text-gray-700 leading-relaxed font-sans bg-gray-50 p-4 rounded-lg border border-gray-200"></pre>
        </div>
    </main>
    <script>
        const fileInput = document.getElementById('pdfFile');
        const fileNameDiv = document.getElementById('fileName');
        const form = document.getElementById('uploadForm');
        const submitBtn = document.getElementById('submitBtn');
        const outputSection = document.getElementById('outputSection');
        const kitResult = document.getElementById('kitResult');

        fileInput.addEventListener('change', () => {
            if(fileInput.files.length > 0) {
                fileNameDiv.textContent = 'Selected: ' + fileInput.files[0].name;
                fileNameDiv.classList.remove('hidden');
            }
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            submitBtn.disabled = true;
            submitBtn.textContent = "Processing PDF & Generating... ⏳";
            outputSection.classList.add('hidden');

            try {
                // Send the raw binary file directly in the body for maximum speed in serverless functions
                const file = fileInput.files[0];
                const response = await fetch('/api/upload', { 
                    method: 'POST', 
                    body: file,
                    headers: { 'Content-Type': 'application/pdf' }
                });
                
                const data = await response.json();
                if (data.marketingKit) {
                    localStorage.setItem('lastGeneratedKit', data.marketingKit);
                    window.location.href = "PASTE_YOUR_STRIPE_LINK_HERE";
                } else {
                    alert(data.error || "An unexpected error occurred.");
                }
            } catch (err) {
                alert("Failed to connect to the processing server.");
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Generate Marketing Kit ($20)";
            }
        });
    </script>
</body>
</html>
  `);
});

// 2. BACKEND API ROUTE: Reads file buffers strictly from system memory
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

app.post('/api/upload', async (req, res) => {
  try {
    if (!req.body || req.body.length === 0) {
      return res.status(400).json({ error: "Empty file stream received." });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const propertyText = await parsePdfBuffer(req.body);

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
    console.error("Server processing error:", error);
    res.status(500).json({ error: "Processing failed inside the cloud function node." });
  }
});

module.exports = app;
