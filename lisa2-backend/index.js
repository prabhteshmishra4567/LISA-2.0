
// const express = require('express');
// const cors = require('cors');
// const mysql = require('mysql2');

// const app = express();
// const port = 5000;

// // Middleware
// app.use(cors());
// app.use(express.json()); // To parse JSON body

// // MySQL database connection
// const db = mysql.createConnection({
//     host: 'localhost',
//     user: 'root',       // Change to your MySQL username
//     password: '',       // Change to your MySQL password
//     database: 'lisa2'   // Replace with your actual database name
// });

// db.connect((err) => {
//     if (err) throw err;
//     console.log('MySQL Connected!');
// });

// // Test endpoint
// app.get('/', (req, res) => {
//     res.send('Welcome to Lisa 2.0 Backend');
// });
// // Sample API to handle question responses
// app.post('/ask', (req, res) => {
//     const question = req.body.question;

//     // Here, you can integrate your logic for answering questions or querying a database
//     // For example, if you're storing pre-defined responses in the database:
//     db.query('SELECT * FROM responses WHERE question = ?', [question], (err, results) => {
//         if (err) throw err;
//         if (results.length > 0) {
//             res.json({ answer: results[0].answer });
//         } else {
//             res.json({ answer: 'Sorry, I don\'t have an answer for that question.' });
//         }
//     });
// });


// // Start the server
// app.listen(port, () => {
//     console.log(`Backend running at http://localhost:${port}`);
// });





// require("dotenv").config();
// const express = require("express");
// const cors = require("cors");
// const { GoogleGenerativeAI } = require("@google/generative-ai");

// const app = express();
// app.use(cors());
// app.use(express.json());

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// app.post("/ask", async (req, res) => {
//   const { question } = req.body;
//   if (!question) {
//     return res.status(400).json({ error: "Question is required" });
//   }

//   try {
//     const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
//     const result = await model.generateContent(question);
//     const response = result.response.text(); // Extract text response

//     res.json({ answer: response });
//   } catch (error) {
//     console.error("Gemini API Error:", error);
//     res.status(500).json({ error: "Failed to fetch response from Gemini" });
//   }
// });

// app.listen(5000, () => console.log("Backend running on port 5000"));


require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const db = require("./database"); // Import SQLite Database

const app = express();
app.use(cors());
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post("/ask", async (req, res) => {
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: "Question is required" });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(question);
    const response = result.response.text(); // Extract AI response

    // Save to database
    db.run("INSERT INTO conversations (prompt, response) VALUES (?, ?)", [question, response], (err) => {
      if (err) {
        console.error("Error saving to database:", err);
      } else {
        console.log("Conversation saved to database ✅");
      }
    });

    res.json({ answer: response });
  } catch (error) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: "Failed to fetch response from Gemini" });
  }
});

app.listen(5000, () => console.log("Backend running on port 5000 🚀"));

