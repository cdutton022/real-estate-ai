const express = require('express');
const multer = require('multer');
const { PdfReader } = require('pdfreader');
const { OpenAI } = require('openai');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();
const upload = multer({ dest: 'uploads/' });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.json());
app.use(express.static('public')); // Serves our website frontend files

// Function to handle the asynchronous PDF parsing inside our web request
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

// The web endpoint that receives the PDF file from the browser
app.post('/api/upload', upload.single('propertyPdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    console.log(`Web request received. Parsing uploaded file: ${req.file.path}`);
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

    // Send the generated text back to the user's browser screen
    res.json({ marketingKit: response.choices[0].message.content });

  } catch (error) {
    console.error("Web server error:", error);
    res.status(500).json({ error: "Failed to generate marketing kit." });
  }
});

const PORT = 3000;
// Endpoint to create a secure Stripe Checkout Session
app.post('/api/create-checkout', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'AI Real Estate Marketing Kit',
            description: 'Instant professional MLS listing and social media script generation.',
          },
          unit_amount: 2000, // $20.00 represented in cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      // Redirect paths after payment completes or gets cancelled
      success_url: `http://localhost:3000/?status=success`,
      cancel_url: `http://localhost:3000/?status=cancel`,
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Stripe session creation error:", error);
    res.status(500).json({ error: "Failed to initialize payment gateway." });
  }
});
app.listen(PORT, () => {
  console.log(`Dashboard backend running live at http://localhost:${PORT}`);
});
