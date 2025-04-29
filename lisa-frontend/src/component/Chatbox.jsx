import React, { useState } from "react";
import Message from "./Message";
import InputBar from "./InputBar";

function ChatBox() {
  const [messages, setMessages] = useState([]);

  const sendMessage = (text) => {
    setMessages([...messages, { text, sender: "user" }]);
    // Simulate AI Response
    setTimeout(() => {
      setMessages((prev) => [...prev, { text: "AI Response", sender: "ai" }]);
    }, 1000);
  };

  return (
    <div className="chat-box">
      <div className="messages">
        {messages.map((msg, index) => (
          <Message key={index} text={msg.text} sender={msg.sender} />
        ))}
      </div>
      <InputBar sendMessage={sendMessage} />
    </div>
  );
}

export default ChatBox;
