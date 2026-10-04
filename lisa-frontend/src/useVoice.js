import { useEffect, useRef, useState } from 'react';

export function speak(text, language = 'en-US', { onStart, onEnd, onError } = {}) {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.replace(/```[\s\S]*?```/g, 'Code example.').replace(/[*#`]/g, ''));
  utterance.lang = language;
  const voice = window.speechSynthesis.getVoices().find(item => item.lang === language);
  if (voice) utterance.voice = voice;
  utterance.onstart = () => onStart?.();
  utterance.onend = () => onEnd?.();
  utterance.onerror = event => onError?.(event);
  window.speechSynthesis.speak(utterance);
  return true;
}

export function useVoice({ language, onTranscript, onError }) {
  const [listening, setListening] = useState(false);
  const listeningRef = useRef(false);
  const recognition = useRef(null);
  const callbacks = useRef({ onTranscript, onError });
  const supported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  useEffect(() => { callbacks.current = { onTranscript, onError }; }, [onTranscript, onError]);
  useEffect(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;
    const instance = new Recognition();
    instance.lang = language;
    instance.continuous = false;
    instance.interimResults = false;
    instance.onresult = event => callbacks.current.onTranscript(event.results[0][0].transcript);
    instance.onend = () => { listeningRef.current = false; setListening(false); };
    instance.onerror = event => {
      listeningRef.current = false;
      setListening(false);
      if (event.error === 'aborted') return;
      callbacks.current.onError(event.error === 'not-allowed'
        ? 'Microphone permission was denied. Allow microphone access in your browser settings.'
        : event.error === 'no-speech' ? 'No speech detected. Try the microphone again.' : 'Voice recognition is unavailable. You can still type your message.');
    };
    recognition.current = instance;
    return () => {
      instance.onresult = instance.onend = instance.onerror = null;
      instance.abort();
      recognition.current = null;
    };
  }, [language]);
  function stop() { recognition.current?.abort(); listeningRef.current = false; setListening(false); }
  function start() {
    if (listeningRef.current) return;
    if (!recognition.current) return callbacks.current.onError('This browser does not support voice recognition. Try Chrome or Edge.');
    window.speechSynthesis?.cancel();
    try { recognition.current.start(); listeningRef.current = true; setListening(true); }
    catch { callbacks.current.onError('The microphone is already starting. Please try again.'); }
  }
  function toggle() { if (listening) stop(); else start(); }
  return { supported, listening, start, toggle, stop };
}
