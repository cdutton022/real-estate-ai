const express = require('express');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();

// Configure the express cloud router to handle up to 10MB of data text smoothly
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// 1. FRONTEND HOME ROUTE: Interactive Web Interface with client-side text extractor
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Real Estate AI Marketing Kit Generator</title>
    <script src="https://tailwindcss.com"></script>
    <!-- Include highly stable PDF text extraction core libraries directly in the browser -->
    <script src="https://cloudflare.com"></script>
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
        // Explicitly set the background worker script location required by PDF.js
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cloudflare.com';

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

        // Safe browser reader that parses raw PDF text arrays locally on the client screen
        function extractTextFromPdf(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = async function() {
                    try {
                        const typedarray = new Uint8Array(this.result);
                        const pdf = await pdfjsLib.getDocument(typedarray).promise;
                        let extractedText = "";
                        
                        // Process the top 15 data pages (perfect for large 10MB inspection files)
                        const maxPages = Math.min(pdf.numPages, 15);
                        for (let i = 1; i <= maxPages; i++) {
                            const page = await pdf.getPage(i);
                            const textContent = await page.getTextContent();
                            const pageText = textContent.items.map(item => item.str).join(" ");
                            extractedText += pageText + " ";
                        }
                        resolve(extractedText);
                    } catch (err) {
                        reject(err);
                    }
                };
                reader.onerror = err => reject(err);
                reader.readAsArrayBuffer(file);
            });
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            submitBtn.disabled = true;
            submitBtn.textContent = "Extracting Document Text (Up to 10MB)... 📝";
            outputSection.classList.add('hidden');

            try {
                // Securely index the target file from the input array container
                const targetFile = fileInput.files[0];
                const cleanText = await extractTextFromPdf(targetFile);

                if (!cleanText || cleanText.trim().length === 0) {
                    alert("Unable to extract text. Please ensure the PDF is not an unreadable picture scan.");
                    return;
                }

                submitBtn.textContent = "Connecting to OpenAI Engine... ⏳";

                // Post a clean JSON object containing the string instead of a heavy binary file stream
                const response = await fetch('/api/upload', { 
                    method: 'POST', 
                    body: JSON.stringify({ text: cleanText }),
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const data = await response.json();
                if (data.marketingKit) {
                    localStorage.setItem('lastGeneratedKit', data.marketingKit);
                    // REDIRECT TARGET PAYWALL: Swaps seamlessly into your Stripe checkpoint link
                    window.location.href = "https://buy.stripe.com/test_00w6oG37U4tD6h6bYs4Vy00";
                } else {
                    alert(data.error || "An unexpected generation error occurred.");
                }
            } catch (err) {
                console.error(err);
                alert("Failed to connect to the cloud engine network.");
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

// 2. BACKEND API ROUTE: Evaluates the extracted text and formats the OpenAI payload
app.post('/api/upload', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: "Missing required text metrics payload." });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const prompt = `
      You are an elite real estate copywriter. Analyze the following property data text:
      "${text.substring(0, 6000)}" 
      Generate a professional marketing kit with an [MLS LISTING] and a [SOCIAL MEDIA SCRIPT].
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    res.json({ marketingKit: response.choices.message.content });

  } catch (error) {
    console.error("Cloud Node Processing Failure:", error);
    res.status(500).json({ error: "The backend server engine failed to generate marketing resources." });
  }
});

module.exports = app;
