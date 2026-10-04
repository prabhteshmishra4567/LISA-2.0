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

function recorderMimeType() {
  const choices = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return choices.find(type => window.MediaRecorder?.isTypeSupported?.(type)) || '';
}

export function useVoice({ language, onTranscript, onAudio, onError }) {
  const nativeSupported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const recorderSupported = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  const [nativeListening, setNativeListening] = useState(false);
  const [recording, setRecording] = useState(false);
  const [fallback, setFallback] = useState(!nativeSupported && recorderSupported);
  const recognition = useRef(null);
  const recorder = useRef(null);
  const stream = useRef(null);
  const chunks = useRef([]);
  const recordTimer = useRef(null);
  const active = useRef(false);
  const recordingRef = useRef(false);
  const recorderSupportedRef = useRef(recorderSupported);
  const fallbackRef = useRef(!nativeSupported && recorderSupported);
  const startRecorderRef = useRef(null);
  const callbacks = useRef({ onTranscript, onAudio, onError });

  useEffect(() => { callbacks.current = { onTranscript, onAudio, onError }; }, [onTranscript, onAudio, onError]);

  function releaseStream() {
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
  }

  function finishRecording({ discard = false } = {}) {
    active.current = false;
    clearTimeout(recordTimer.current);
    const instance = recorder.current;
    if (!instance || instance.state === 'inactive') {
      releaseStream();
      recordingRef.current = false;
      setRecording(false);
      return;
    }
    instance._lisaDiscard = discard;
    instance.stop();
  }

  async function startRecorder() {
    if (!recorderSupported || recordingRef.current) {
      if (!recorderSupported) callbacks.current.onError('This browser cannot record audio. You can still type your message.');
      return;
    }
    active.current = true;
    window.speechSynthesis?.cancel();
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (!active.current) {
        mediaStream.getTracks().forEach(track => track.stop());
        return;
      }
      stream.current = mediaStream;
      chunks.current = [];
      const mimeType = recorderMimeType();
      const instance = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);
      recorder.current = instance;
      instance.ondataavailable = event => { if (event.data?.size) chunks.current.push(event.data); };
      instance.onerror = () => callbacks.current.onError('Audio recording failed. Check microphone access and try again.');
      instance.onstop = () => {
        clearTimeout(recordTimer.current);
        releaseStream();
        recordingRef.current = false;
        setRecording(false);
        recorder.current = null;
        const audio = new Blob(chunks.current, { type: instance.mimeType || mimeType || 'audio/webm' });
        chunks.current = [];
        if (!instance._lisaDiscard && audio.size) callbacks.current.onAudio(audio);
      };
      instance.start();
      recordingRef.current = true;
      setRecording(true);
      recordTimer.current = setTimeout(() => finishRecording(), 20000);
    } catch (error) {
      active.current = false;
      releaseStream();
      callbacks.current.onError(error?.name === 'NotAllowedError'
        ? 'Microphone permission was denied. Allow microphone access in your browser settings.'
        : 'Could not start audio recording. Check your microphone and try again.');
    }
  }
  startRecorderRef.current = startRecorder;

  useEffect(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;
    const instance = new Recognition();
    instance.lang = language;
    instance.continuous = false;
    instance.interimResults = false;
    instance.onresult = event => callbacks.current.onTranscript(event.results[0][0].transcript);
    instance.onend = () => { setNativeListening(false); };
    instance.onerror = event => {
      setNativeListening(false);
      if (event.error === 'aborted') return;
      if (event.error === 'not-allowed' || event.error === 'audio-capture') {
        callbacks.current.onError(event.error === 'not-allowed'
          ? 'Microphone permission was denied. Allow microphone access in your browser settings.'
          : 'No working microphone was found. Check your audio input and try again.');
        return;
      }
      if (event.error === 'no-speech') {
        callbacks.current.onError('No speech detected. Tap the microphone and try again.');
        return;
      }
      if (recorderSupportedRef.current) {
        fallbackRef.current = true;
        setFallback(true);
        callbacks.current.onError('Browser speech service unavailable. Gemini recording is active—tap the orb when you finish.');
        startRecorderRef.current();
      } else {
        callbacks.current.onError('Voice recognition is unavailable. You can still type your message.');
      }
    };
    recognition.current = instance;
    return () => {
      instance.onresult = instance.onend = instance.onerror = null;
      instance.abort();
      recognition.current = null;
    };
  }, [language]);

  useEffect(() => () => {
    active.current = false;
    clearTimeout(recordTimer.current);
    const instance = recorder.current;
    if (instance && instance.state !== 'inactive') {
      instance._lisaDiscard = true;
      instance.stop();
    }
    releaseStream();
  }, []);

  function stop({ discard = true } = {}) {
    active.current = false;
    recognition.current?.abort();
    setNativeListening(false);
    if (recordingRef.current) finishRecording({ discard });
  }

  function start() {
    if (nativeListening || recordingRef.current) return;
    active.current = true;
    window.speechSynthesis?.cancel();
    if (fallbackRef.current || !recognition.current) return startRecorder();
    try {
      recognition.current.start();
      setNativeListening(true);
    } catch {
      active.current = false;
      callbacks.current.onError('The microphone is already starting. Please try again.');
    }
  }

  function toggle() {
    if (recordingRef.current) finishRecording();
    else if (nativeListening) stop();
    else start();
  }

  return {
    supported: nativeSupported || recorderSupported,
    listening: nativeListening || recording,
    recording,
    fallback,
    start,
    toggle,
    stop,
  };
}
