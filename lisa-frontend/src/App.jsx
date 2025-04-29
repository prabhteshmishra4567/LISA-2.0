// import React from "react";
// import ChatBox from "./components/ChatBox";

// function App() {
//   return (

//     <div className="app">
//       <ChatBox />
//     </div>
//   );
// }

// export default App;

// import { useState } from "react";
// import axios from "axios";

// function App() {
//   const [question, setQuestion] = useState("");
//   const [response, setResponse] = useState("");

//   const handleAskQuestion = async () => {
//     if (!question.trim()) return; // Prevent empty requests

//     try {
//       const res = await axios.post("http://localhost:5000/ask", { question });
//       setResponse(res.data.answer);
//     } catch (error) {
//       console.error("Error fetching answer:", error);
//       setResponse("Error fetching response. Try again.");
//     }
//   };

//   return (
//     <div className="container">
//       <h1>Lisa 2.0 Virtual Assistant</h1>
//       <input
//         type="text"
//         value={question}
//         onChange={(e) => setQuestion(e.target.value)}
//         placeholder="Ask me anything..."
//       />
//       <button onClick={handleAskQuestion}>Ask</button>
//       <p>{response}</p>
//     </div>
//   );
// }

// export default App;

// import { useState } from "react";
// import axios from "axios";
// import "./App.css"; // make sure CSS is imported

// function App() {
//   const [question, setQuestion] = useState("");
//   const [response, setResponse] = useState("");

//   const handleAskQuestion = async () => {
//     if (!question.trim()) return;

//     try {
//       const res = await axios.post("http://localhost:5000/ask", { question });
//       setResponse(res.data.answer);
//     } catch (error) {
//       console.error("Error fetching answer:", error);
//       setResponse("Error fetching response. Try again.");
//     }
//   };

//   return (
//     <div className="container">
//       <h1>Lisa 2.0 Virtual Assistant</h1>
//       <input
//         type="text"
//         value={question}
//         onChange={(e) => setQuestion(e.target.value)}
//         placeholder="Ask me anything..."
//       />
//       <button onClick={handleAskQuestion}>Ask</button>

//       {/* ✅ Wrapped AI Response */}
//       <div className="response-box">
//         {response && (
//           <div className="ai-response">
//             <p>{response}</p>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// export default App;




// import { useState, useEffect, useRef } from "react";
// import axios from "axios";
// import "./App.css";

// function App() {
//   const [question, setQuestion] = useState("");
//   const [chat, setChat] = useState([]);
//   const [isTyping, setIsTyping] = useState(false);
//   const [voiceMode, setVoiceMode] = useState(false);
//   const [isListening, setIsListening] = useState(false);
//   const chatEndRef = useRef(null);
//   const recognitionRef = useRef(null);

//   useEffect(() => {
//     const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

//     if (Recognition) {
//       recognitionRef.current = new Recognition();
//       recognitionRef.current.continuous = false;
//       recognitionRef.current.interimResults = false;
//       recognitionRef.current.lang = "en-US";

//       recognitionRef.current.onresult = async (event) => {
//         const transcript = event.results[0][0].transcript;
//         console.log("Recognized:", transcript);
//         setIsListening(false);
//         recognitionRef.current.stop();
//         await handleVoiceCommand(transcript);
//       };

//       recognitionRef.current.onend = () => {
//         setIsListening(false); // Important to stop UI state
//       };

//       recognitionRef.current.onerror = (event) => {
//         console.error("Speech error:", event.error);
//         setIsListening(false);
//         recognitionRef.current.stop();
//       };
//     }
//   }, []);

//   useEffect(() => {
//     chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [chat, isTyping]);

//   const handleVoiceCommand = async (command) => {
//     const lowerCommand = command.toLowerCase();

//     console.log("Voice command:", lowerCommand);

//     if (lowerCommand.includes("open spotify")) {
//       speak("Opening Spotify");
//       window.open("https://open.spotify.com", "_blank");
//     } else if (lowerCommand.includes("open youtube")) {
//       speak("Opening YouTube");
//       window.open("https://www.youtube.com", "_blank");
//     } else if (lowerCommand.includes("search for")) {
//       const query = lowerCommand.split("search for")[1].trim();
//       speak(`Searching for ${query}`);
//       window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
//     } else if (lowerCommand.includes("time")) {
//       const now = new Date();
//       const time = now.toLocaleTimeString();
//       speak(`The current time is ${time}`);
//     } else if (lowerCommand.includes("joke")) {
//       speak("Why don't scientists trust atoms? Because they make up everything!");
//     } else {
//       const userMessage = { sender: "user", text: lowerCommand };
//       setChat((prev) => [...prev, userMessage]);
//       setIsTyping(true);
//       try {
//         const res = await axios.post("http://localhost:5000/ask", { question: lowerCommand });
//         const botMessage = { sender: "bot", text: res.data.answer };
//         setChat((prev) => [...prev, botMessage]);
//         speak(res.data.answer);
//       } catch (error) {
//         speak("Sorry, I couldn't understand that.");
//       } finally {
//         setIsTyping(false);
//       }
//     }
//   };

//   const speak = (text) => {
//     const utterance = new SpeechSynthesisUtterance(text);
//     window.speechSynthesis.speak(utterance);
//   };

//   const handleAskQuestion = async () => {
//     if (!question.trim()) return;

//     const userMessage = { sender: "user", text: question };
//     setChat((prev) => [...prev, userMessage]);
//     setQuestion("");
//     setIsTyping(true);

//     try {
//       const res = await axios.post("http://localhost:5000/ask", { question });
//       const botMessage = { sender: "bot", text: res.data.answer };
//       setChat((prev) => [...prev, botMessage]);
//       speak(res.data.answer);
//     } catch (error) {
//       const errorMessage = {
//         sender: "bot",
//         text: "Error fetching response. Try again.",
//       };
//       setChat((prev) => [...prev, errorMessage]);
//       speak("Error fetching response. Try again.");
//     } finally {
//       setIsTyping(false);
//     }
//   };

//   const toggleListening = () => {
//     if (isListening) {
//       recognitionRef.current.stop();
//       setIsListening(false);
//     } else {
//       recognitionRef.current.start();
//       setIsListening(true);
//     }
//   };

//   return (
//     <div className="container">
//       <div className="chat-container">
//         <h1 className="sticky-header">
//           🤖 Lisa 2.0 <span className="sub-heading">Virtual Assistant</span>
//         </h1>

//         <div className="chat-window">
//           {chat.length === 0 ? (
//             <div className="placeholder-message">
//               👋 Hi, I’m <strong>Lisa 2.0</strong> — Ask me anything!
//             </div>
//           ) : (
//             <>
//               {chat.map((msg, index) => (
//                 <div key={index} className={`chat-bubble ${msg.sender === "user" ? "user" : "bot"}`}>
//                   <p>{msg.text}</p>
//                 </div>
//               ))}
//               {isTyping && (
//                 <div className="chat-bubble bot">
//                   <p>Typing...</p>
//                 </div>
//               )}
//             </>
//           )}
//           <div ref={chatEndRef}></div>
//         </div>

//         <div className="input-area">
//           {!voiceMode && (
//             <>
//               <input
//                 type="text"
//                 value={question}
//                 onChange={(e) => setQuestion(e.target.value)}
//                 onKeyDown={(e) => e.key === "Enter" && handleAskQuestion()}
//                 placeholder="Ask me anything..."
//               />
//               <button onClick={handleAskQuestion}>Ask</button>
//             </>
//           )}
//           {voiceMode && (
//             <>
//               <button onClick={toggleListening}>
//                 {isListening ? "🛑 Stop Listening" : "🎙️ Start Listening"}
//               </button>
//               <button
//                 onClick={() => {
//                   recognitionRef.current?.stop();
//                   recognitionRef.current?.start();
//                   setIsListening(true);
//                 }}
//               >
//                 🔁
//               </button>
//             </>
//           )}
//           <button
//             className={`mode-toggle ${voiceMode ? "voice" : "text"}`}
//             onClick={() => {
//               setVoiceMode(!voiceMode);
//               setIsListening(false);
//               recognitionRef.current?.stop();
//             }}
//           >
//             {voiceMode ? "⌨️" : "🎤"}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default App;



//------------------------

// import { useState, useEffect, useRef } from "react";
// import axios from "axios";
// import "./App.css";  // Inside App.jsx

// import oneGif from './assets/images/one.gif';



// function App() {
//   const [question, setQuestion] = useState("");
//   const [chat, setChat] = useState([]);
//   const [isTyping, setIsTyping] = useState(false);
//   const [voiceMode, setVoiceMode] = useState(false);
//   const [isListening, setIsListening] = useState(false);
//   const chatEndRef = useRef(null);
//   const recognitionRef = useRef(null);

//   useEffect(() => {
//     const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

//     if (Recognition) {
//       recognitionRef.current = new Recognition();
//       recognitionRef.current.continuous = false;
//       recognitionRef.current.interimResults = false;
//       recognitionRef.current.lang = "en-US";

//       recognitionRef.current.onresult = async (event) => {
//         const transcript = event.results[0][0].transcript;
//         console.log("Recognized:", transcript);
//         setIsListening(false);
//         recognitionRef.current.stop();
//         await handleVoiceCommand(transcript);
//       };

//       recognitionRef.current.onend = () => {
//         setIsListening(false);
//       };

//       recognitionRef.current.onerror = (event) => {
//         console.error("Speech error:", event.error);
//         setIsListening(false);
//         recognitionRef.current.stop();
//       };
//     }
//   }, []);

//   useEffect(() => {
//     chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [chat, isTyping]);

//   const handleVoiceCommand = async (command) => {
//     const lowerCommand = command.toLowerCase();

//     console.log("Voice command:", lowerCommand);

//     if (lowerCommand.includes("open spotify")) {
//       speak("Opening Spotify");
//       window.open("https://open.spotify.com", "_blank");
//     } else if (lowerCommand.includes("open youtube")) {
//       speak("Opening YouTube");
//       window.open("https://www.youtube.com", "_blank");
//     } else if (lowerCommand.includes("search for")) {
//       const query = lowerCommand.split("search for")[1].trim();
//       speak(`Searching for ${query}`);
//       window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
//     } else if (lowerCommand.includes("time")) {
//       const now = new Date();
//       const time = now.toLocaleTimeString();
//       speak(`The current time is ${time}`);
//     } else if (lowerCommand.includes("joke")) {
//       speak("Why don't scientists trust atoms? Because they make up everything!");
//     } else {
//       const userMessage = { sender: "user", text: lowerCommand };
//       setChat((prev) => [...prev, userMessage]);
//       setIsTyping(true);
//       try {
//         const res = await axios.post("http://localhost:5000/ask", { question: lowerCommand });
//         const botMessage = { sender: "bot", text: res.data.answer };
//         setChat((prev) => [...prev, botMessage]);
//         speak(res.data.answer);
//       } catch (error) {
//         speak("Sorry, I couldn't understand that.");
//       } finally {
//         setIsTyping(false);
//       }
//     }
//   };

//   const speak = (text) => {
//     const utterance = new SpeechSynthesisUtterance(text);
//     window.speechSynthesis.speak(utterance);
//   };

//   const handleAskQuestion = async () => {
//     if (!question.trim()) return;

//     const userMessage = { sender: "user", text: question };
//     setChat((prev) => [...prev, userMessage]);
//     setQuestion("");
//     setIsTyping(true);

//     try {
//       const res = await axios.post("http://localhost:5000/ask", { question });
//       const botMessage = { sender: "bot", text: res.data.answer };
//       setChat((prev) => [...prev, botMessage]);
//       speak(res.data.answer);
//     } catch (error) {
//       const errorMessage = {
//         sender: "bot",
//         text: "Error fetching response. Try again.",
//       };
//       setChat((prev) => [...prev, errorMessage]);
//       speak("Error fetching response. Try again.");
//     } finally {
//       setIsTyping(false);
//     }
//   };

//   const toggleListening = () => {
//     if (isListening) {
//       recognitionRef.current.stop();
//       setIsListening(false);
//     } else {
//       recognitionRef.current.start();
//       setIsListening(true);
//     }
//   };

//   return (
//     <div className="container">
//       <div className="chat-container">
//         <h1 className="sticky-header">
//           🤖 Lisa 2.0 <span className="sub-heading">Virtual Assistant</span>
//         </h1>

//         <div className="chat-window">
//           {voiceMode ? (
//             // Render GIF in voice mode
//             <div className="voice-mode-gif">
//               <img
//                 src={oneGif} alt="Voice Mode"
              
//               />
//             </div>
//           ) : chat.length === 0 ? (
//             // Show placeholder if no chat
//             <div className="placeholder-message">
//               👋 Hi, I’m <strong>Lisa 2.0</strong> — Ask me anything!
//             </div>
//           ) : (
//             // Render chat bubbles in text mode
//             <>
//               {chat.map((msg, index) => (
//                 <div
//                   key={index}
//                   className={`chat-bubble ${msg.sender === "user" ? "user" : "bot"}`}
//                 >
//                   <p>{msg.text}</p>
//                 </div>
//               ))}
//               {isTyping && (
//                 <div className="chat-bubble bot">
//                   <p>Typing...</p>
//                 </div>
//               )}
//             </>
//           )}
//           <div ref={chatEndRef}></div>
//         </div>

//         <div className="input-area">
//           {!voiceMode && (
//             <>
//               <input
//                 type="text"
//                 value={question}
//                 onChange={(e) => setQuestion(e.target.value)}
//                 onKeyDown={(e) => e.key === "Enter" && handleAskQuestion()}
//                 placeholder="Ask me anything..."
//               />
//               <button onClick={handleAskQuestion}>Ask</button>
//             </>
//           )}
//           {voiceMode && (
//             <>
//               <button onClick={toggleListening}>
//                 {isListening ? "🛑 Stop Listening" : "🎙️ Start Listening"}
//               </button>
//               <button
//                 onClick={() => {
//                   recognitionRef.current?.stop();
//                   recognitionRef.current?.start();
//                   setIsListening(true);
//                 }}
//               >
//                 🔁
//               </button>
//             </>
//           )}
//           <button
//             className={`mode-toggle ${voiceMode ? "voice" : "text"}`}
//             onClick={() => {
//               setVoiceMode(!voiceMode);
//               setIsListening(false);
//               recognitionRef.current?.stop();
//             }}
//           >
//             {voiceMode ? "⌨️" : "🎤"}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }

// export default App;

// 6th of march
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./App.css";
import oneGif from './assets/images/one.gif';

function App() {
  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const voicesRef = useRef([]);

  useEffect(() => {
    // Load voices once available
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      voicesRef.current = voices;
      console.log("Available voices:", voices);  // ✅ Console log for reference
    };

    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices(); // Run once

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (Recognition) {
      recognitionRef.current = new Recognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = async (event) => {
        const transcript = event.results[0][0].transcript;
        console.log("Recognized:", transcript);
        setIsListening(false);
        recognitionRef.current.stop();
        await handleVoiceCommand(transcript);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech error:", event.error);
        setIsListening(false);
        recognitionRef.current.stop();
      };
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, isTyping]);

  const handleVoiceCommand = async (command) => {
    const lowerCommand = command.toLowerCase();
    console.log("Voice command:", lowerCommand);

    if (lowerCommand.includes("open spotify")) {
      speak("Opening Spotify");
      window.open("https://open.spotify.com", "_blank");
    } else if (lowerCommand.includes("open youtube")) {
      speak("Opening YouTube");
      window.open("https://www.youtube.com", "_blank");
    } else if (lowerCommand.includes("search for")) {
      const query = lowerCommand.split("search for")[1].trim();
      speak(`Searching for ${query}`);
      window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
    } else if (lowerCommand.includes("time")) {
      const now = new Date();
      const time = now.toLocaleTimeString();
      speak(`The current time is ${time}`);
    } else if (lowerCommand.includes("joke")) {
      speak("Why don't scientists trust atoms? Because they make up everything!");
    } else {
      const userMessage = { sender: "user", text: lowerCommand };
      setChat((prev) => [...prev, userMessage]);
      setIsTyping(true);
      try {
        const res = await axios.post("http://localhost:5000/ask", { question: lowerCommand });
        const botMessage = { sender: "bot", text: res.data.answer };
        setChat((prev) => [...prev, botMessage]);
        speak(res.data.answer);
      } catch (error) {
        speak("Sorry, I couldn't understand that.");
      } finally {
        setIsTyping(false);
      }
    }
  };

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = voicesRef.current;

    // Try to pick a female or natural-sounding English voice
    const femaleVoice = voices.find(
      (voice) =>
        voice.lang.includes("en") &&
        (voice.name.toLowerCase().includes("female") ||
          voice.name.toLowerCase().includes("woman") ||
          voice.name.toLowerCase().includes("zira") ||         // Windows
          voice.name.toLowerCase().includes("samantha") ||     // macOS
          voice.name.toLowerCase().includes("google"))         // Chrome
    );

    if (femaleVoice) {
      utterance.voice = femaleVoice;
      console.log("Using voice:", femaleVoice.name);
    } else {
      console.log("No preferred female voice found. Using default.");
    }

    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const handleAskQuestion = async () => {
    if (!question.trim()) return;

    const userMessage = { sender: "user", text: question };
    setChat((prev) => [...prev, userMessage]);
    setQuestion("");
    setIsTyping(true);

    try {
      const res = await axios.post("http://localhost:5000/ask", { question });
      const botMessage = { sender: "bot", text: res.data.answer };
      setChat((prev) => [...prev, botMessage]);
      speak(res.data.answer);
    } catch (error) {
      const errorMessage = {
        sender: "bot",
        text: "Error fetching response. Try again.",
      };
      setChat((prev) => [...prev, errorMessage]);
      speak("Error fetching response. Try again.");
    } finally {
      setIsTyping(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  return (
    <div className="container">
      <div className="chat-container">
        <h1 className="sticky-header">
          🤖 Lisa 2.0 <span className="sub-heading">Virtual Assistant</span>
        </h1>

        <div className="chat-window">
          {voiceMode ? (
            <div className="voice-mode-gif">
              <img src={oneGif} alt="Voice Mode" />
            </div>
          ) : chat.length === 0 ? (
            <div className="placeholder-message">
              👋 Hi, I’m <strong>Lisa 2.0</strong> — Ask me anything!
            </div>
          ) : (
            <>
              {chat.map((msg, index) => (
                <div
                  key={index}
                  className={`chat-bubble ${msg.sender === "user" ? "user" : "bot"}`}
                >
                  <p>{msg.text}</p>
                </div>
              ))}
              {isTyping && (
                <div className="chat-bubble bot">
                  <p>Typing...</p>
                </div>
              )}
            </>
          )}
          <div ref={chatEndRef}></div>
        </div>

        <div className="input-area">
          {!voiceMode && (
            <>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAskQuestion()}
                placeholder="Ask me anything..."
              />
              <button onClick={handleAskQuestion}>Ask</button>
            </>
          )}
          {voiceMode && (
            <>
              <button onClick={toggleListening}>
                {isListening ? "🛑 Stop Listening" : "🎙️ Start Listening"}
              </button>
              <button
                onClick={() => {
                  recognitionRef.current?.stop();
                  recognitionRef.current?.start();
                  setIsListening(true);
                }}
              >
                🔁
              </button>
            </>
          )}
          <button
            className={`mode-toggle ${voiceMode ? "voice" : "text"}`}
            onClick={() => {
              setVoiceMode(!voiceMode);
              setIsListening(false);
              recognitionRef.current?.stop();
            }}
          >
            {voiceMode ? "⌨️" : "🎤"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
