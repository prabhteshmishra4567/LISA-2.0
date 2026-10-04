import { useEffect, useRef, useState } from 'react';
import { ArrowUp, AudioLines, BookOpen, Check, ChevronDown, Code2, Copy, Download, Globe2, Keyboard, Menu, MessageSquare, Mic, MicOff, Moon, PhoneOff, Plus, Search, Settings2, Sparkles, Square, Sun, Trash2, Volume2, X, Pencil, Zap } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { api } from './api';
import { speak, useVoice } from './useVoice';
import './App.css';

const starters = [
  { icon: Sparkles, label: 'Make room for ideas', text: 'Brainstorm five creative project ideas I can build this weekend.', hint: 'A little inspiration goes a long way' },
  { icon: BookOpen, label: 'Understand something', text: 'Explain how AI assistants work, with a simple example.', hint: 'Break big concepts into small steps' },
  { icon: Code2, label: 'Build something great', text: 'Help me plan a React app from idea to launch.', hint: 'Your next project starts here' },
  { icon: Globe2, label: 'Explore what’s new', text: 'Research recent developments in artificial intelligence and include sources.', hint: 'Find answers with web research', research: true },
];
const markdownComponents = { a: ({ children, node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer">{children}</a> };

function App() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [research, setResearch] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('lisa-theme') || 'dark');
  const [readAloud, setReadAloud] = useState(() => localStorage.getItem('lisa-read-aloud') === 'true');
  const [language, setLanguage] = useState(() => localStorage.getItem('lisa-language') || 'en-US');
  const [settings, setSettings] = useState(false);
  const [sidebar, setSidebar] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [copied, setCopied] = useState(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const generation = useRef(null);
  const selection = useRef(null);
  const sending = useRef(false);
  const end = useRef(null);
  const input = useRef(null);
  const voiceModeRef = useRef(false);
  const transcription = useRef(null);
  const voice = useVoice({ language, onTranscript: handleVoiceTranscript, onAudio: handleVoiceAudio, onError: setNotice });
  const current = conversations.find(item => item.id === activeId);
  const modalOpen = settings || Boolean(dialog);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('lisa-theme', theme);
  }, [theme]);
  useEffect(() => { localStorage.setItem('lisa-read-aloud', String(readAloud)); }, [readAloud]);
  useEffect(() => { localStorage.setItem('lisa-language', language); }, [language]);
  useEffect(() => {
    if (loading) return;
    if (activeId) localStorage.setItem('lisa-active-id', activeId);
    else localStorage.removeItem('lisa-active-id');
  }, [activeId, loading]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy]);

  useEffect(() => {
    if (!modalOpen) return;
    const previousFocus = document.activeElement;
    const modal = document.querySelector('.modal');
    const controls = () => Array.from(modal.querySelectorAll('button:not(:disabled), input, select, textarea'));
    if (!modal.contains(document.activeElement)) controls()[0]?.focus();
    function handleKey(event) {
      if (event.key === 'Escape') { setSettings(false); setDialog(null); }
      if (event.key !== 'Tab') return;
      const elements = controls();
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); previousFocus?.focus(); };
  }, [modalOpen]);

  useEffect(() => {
    const controller = new AbortController();
    async function initialize() {
      try {
        const [status, list] = await Promise.all([api('/health', { signal: controller.signal }), api('/conversations', { signal: controller.signal })]);
        const saved = localStorage.getItem('lisa-active-id');
        const id = list.find(item => item.id === saved)?.id || list[0]?.id;
        const conversation = id ? await api(`/conversations/${id}`, { signal: controller.signal }) : null;
        if (controller.signal.aborted) return;
        setHealth(status);
        setConversations(list);
        setActiveId(id || null);
        setMessages(conversation?.messages || []);
      } catch (error) { if (error.name !== 'AbortError') setNotice(error.message); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    initialize();
    return () => { controller.abort(); generation.current?.abort(); selection.current?.abort(); transcription.current?.abort(); window.speechSynthesis?.cancel(); };
  }, []);

  function handleVoiceTranscript(text) {
    if (voiceModeRef.current) send(undefined, text);
    else setDraft(text);
  }

  async function handleVoiceAudio(audio) {
    const controller = new AbortController();
    transcription.current?.abort();
    transcription.current = controller;
    setTranscribing(true);
    setNotice('');
    try {
      const result = await api(`/transcribe?language=${encodeURIComponent(language)}`, { method: 'POST', body: audio, signal: controller.signal });
      if (controller.signal.aborted) return;
      setTranscribing(false);
      handleVoiceTranscript(result.transcript);
    } catch (error) {
      if (error.name !== 'AbortError') setNotice(error.message);
    } finally {
      if (transcription.current === controller) transcription.current = null;
      setTranscribing(false);
    }
  }

  function enterVoiceMode() {
    if (!voice.supported || busy || loading || transcribing) return;
    voiceModeRef.current = true;
    setVoiceMode(true);
    setSpeaking(false);
    setNotice('');
    window.speechSynthesis?.cancel();
    voice.start();
  }

  function leaveVoiceMode({ cancelResponse = false } = {}) {
    voiceModeRef.current = false;
    voice.stop();
    transcription.current?.abort();
    transcription.current = null;
    setTranscribing(false);
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setVoiceMode(false);
    if (cancelResponse) generation.current?.abort();
    setTimeout(() => input.current?.focus(), 0);
  }

  function resumeVoice() {
    if (busy) return generation.current?.abort();
    if (transcribing) return transcription.current?.abort();
    if (speaking) {
      window.speechSynthesis?.cancel();
      setSpeaking(false);
    }
    voice.toggle();
  }

  async function reconnect() {
    setLoading(true);
    try {
      const [status, list] = await Promise.all([api('/health'), api('/conversations')]);
      setHealth(status); setConversations(list); setNotice('Connected to LISA.');
    } catch (error) { setNotice(error.message); }
    finally { setLoading(false); }
  }

  async function openConversation(id) {
    if (sending.current) return;
    selection.current?.abort();
    const controller = new AbortController();
    selection.current = controller;
    setLoading(true); setNotice(''); voice.stop();
    window.speechSynthesis?.cancel();
    try {
      const conversation = await api(`/conversations/${id}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      setActiveId(id); setMessages(conversation.messages); setDraft(''); setSidebar(false);
    } catch (error) { if (error.name !== 'AbortError') setNotice(error.message); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }

  function newConversation() {
    if (sending.current) return;
    selection.current?.abort(); voice.stop(); window.speechSynthesis?.cancel();
    setActiveId(null); setMessages([]); setDraft(''); setNotice(''); setLoading(false); setSidebar(false);
    input.current?.focus();
  }

  async function send(event, spokenQuestion) {
    event?.preventDefault();
    const question = (spokenQuestion ?? draft).trim();
    if (!question || sending.current || loading) return;
    const fromVoice = spokenQuestion !== undefined && voiceModeRef.current;
    sending.current = true; setBusy(true); setNotice(''); voice.stop();
    const controller = new AbortController();
    generation.current = controller;
    const optimisticId = crypto.randomUUID();
    setDraft('');
    setMessages(previous => [...previous, { id: optimisticId, role: 'user', content: question }]);
    try {
      let id = activeId;
      if (!id) {
        const created = await api('/conversations', { method: 'POST', signal: controller.signal });
        id = created.id;
        setActiveId(id); setConversations(previous => [created, ...previous]);
      }
      const response = await api('/ask', {
        method: 'POST', signal: controller.signal,
        body: { question, conversationId: id, research, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      });
      setMessages(previous => [...previous.filter(message => message.id !== optimisticId), ...response.messages]);
      if (fromVoice && voiceModeRef.current) {
        setSpeaking(true);
        const started = speak(response.answer, language, {
          onStart: () => setSpeaking(true),
          onEnd: () => {
            setSpeaking(false);
            if (voiceModeRef.current) voice.start();
          },
          onError: () => {
            setSpeaking(false);
            if (voiceModeRef.current) setNotice('I could not play the answer aloud. Tap the microphone to continue.');
          },
        });
        if (!started) {
          setSpeaking(false);
          setNotice('Speech playback is unavailable in this browser. You can read the answer below.');
        }
      } else if (readAloud) speak(response.answer, language);
      api('/conversations').then(setConversations).catch(error => setNotice(error.message));
    } catch (error) {
      setMessages(previous => previous.filter(message => message.id !== optimisticId));
      if (!fromVoice) setDraft(question);
      setNotice(error.name === 'AbortError' ? (fromVoice ? 'Response stopped. Tap the microphone when you’re ready.' : 'Response stopped. Your message is ready to try again.') : error.message);
    } finally {
      sending.current = false; setBusy(false); generation.current = null;
      if (!fromVoice) input.current?.focus();
    }
  }

  async function changeConversation(event) {
    event.preventDefault();
    const target = dialog;
    if (!target || busy) return;
    try {
      if (target.type === 'delete') {
        await api(`/conversations/${target.id}`, { method: 'DELETE' });
        setConversations(previous => previous.filter(item => item.id !== target.id));
        if (activeId === target.id) newConversation();
      } else {
        const renamed = await api(`/conversations/${target.id}`, { method: 'PATCH', body: { title: target.title } });
        setConversations(previous => previous.map(item => item.id === target.id ? renamed : item));
      }
      setDialog(null);
    } catch (error) { setNotice(error.message); setDialog(null); }
  }

  async function copy(message) {
    try { await navigator.clipboard.writeText(message.content); setCopied(message.id); }
    catch { setNotice('Clipboard access is unavailable. Select and copy the message text.'); }
  }

  function exportChat() {
    const text = `# ${current?.title || 'LISA conversation'}\n\n` + messages.map(message =>
      `## ${message.role === 'user' ? 'You' : 'LISA'}\n\n${message.content}\n\n${message.sources?.length ? 'Sources:\n' + message.sources.map(source => `- [${source.title}](${source.url})`).join('\n') + '\n\n' : ''}`).join('');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'lisa-conversation.md'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (voiceMode) {
    const voiceStatus = transcribing ? 'Transcribing your voice' : busy ? (research ? 'Researching your question' : 'Thinking about that') : speaking ? 'Speaking' : voice.recording ? 'Recording for Gemini' : voice.listening ? 'Listening' : 'Ready when you are';
    const voiceHint = transcribing ? 'Turning your recording into text' : busy ? 'Tap stop if you want to interrupt' : speaking ? 'Tap the orb to interrupt' : voice.recording ? 'Tap the orb when you finish speaking' : voice.listening ? 'Go ahead, I’m listening' : voice.fallback ? 'Tap to record, then tap again when finished' : 'Tap the orb to speak';
    const recentMessages = messages.slice(-4);
    return (
      <main className="voice-live" aria-label="LISA Live voice conversation">
        <header className="voice-live-header">
          <div className="voice-live-brand"><span className="brand-mark"><Sparkles size={21} /></span><span><strong>LISA Live</strong><small>One-to-one voice conversation</small></span></div>
          <div className="voice-live-header-actions">
            {research && <span className="voice-research"><Globe2 size={13} /> Research on</span>}
            <button className="voice-header-button" onClick={() => leaveVoiceMode()}><Keyboard size={17} /> Switch to chat</button>
            <button className="voice-end-button" onClick={() => leaveVoiceMode({ cancelResponse: true })}><PhoneOff size={17} /> End</button>
          </div>
        </header>

        <section className="voice-live-stage">
          <div className={`voice-orb-wrap ${voice.listening ? 'is-listening' : ''} ${speaking ? 'is-speaking' : ''} ${busy || transcribing ? 'is-thinking' : ''}`}>
            <span className="voice-ring ring-one" />
            <span className="voice-ring ring-two" />
            <button className="voice-orb" onClick={resumeVoice} aria-label={busy ? 'Stop response' : transcribing ? 'Stop transcription' : voice.recording ? 'Finish recording' : voice.listening ? 'Mute microphone' : speaking ? 'Interrupt LISA' : 'Start listening'}>
              {busy || transcribing ? <Square size={28} fill="currentColor" /> : voice.listening ? <AudioLines size={42} /> : speaking ? <Sparkles size={42} /> : <Mic size={38} />}
            </button>
          </div>
          <div className="voice-live-status" role="status"><span className={voice.listening ? 'live-dot' : ''} />{voiceStatus}</div>
          <p className="voice-live-hint">{voiceHint}</p>

          <div className="voice-live-conversation" aria-live="polite">
            {!recentMessages.length && <p className="voice-empty">Ask me anything. I’ll listen, answer aloud, and stay ready for your next question.</p>}
            {recentMessages.map(message => <article className={`voice-turn ${message.role}`} key={message.id}>
              <span>{message.role === 'assistant' ? 'LISA' : 'YOU'}</span>
              <p>{message.content.replace(/[*#`]/g, '').slice(0, 420)}{message.content.length > 420 ? '…' : ''}</p>
            </article>)}
          </div>
          {notice && <div className="voice-notice"><span>{notice}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setNotice('')}><X size={15} /></button></div>}
        </section>

        <footer className="voice-live-controls">
          <button onClick={() => leaveVoiceMode()}><span><Keyboard size={20} /></span><small>Keyboard</small></button>
          <button className={`voice-control-main ${voice.listening ? 'active' : ''}`} onClick={resumeVoice} disabled={busy || transcribing}><span>{voice.recording ? <Square size={22} fill="currentColor" /> : voice.listening ? <MicOff size={24} /> : <Mic size={24} />}</span><small>{voice.recording ? 'Finish' : voice.listening ? 'Mute' : 'Speak'}</small></button>
          <button onClick={() => leaveVoiceMode({ cancelResponse: true })}><span className="hang-up"><PhoneOff size={20} /></span><small>End</small></button>
        </footer>
        <p className="voice-disclaimer">LISA can make mistakes. Check important information.</p>
      </main>
    );
  }

  return (
    <div className="workspace">
      {sidebar && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebar(false)} />}
      <aside className={`sidebar ${sidebar ? 'is-open' : ''}`}>
        <a className="brand" href="#" onClick={event => { event.preventDefault(); newConversation(); }}><span className="brand-mark"><Sparkles size={23} /></span><span>LISA<span className="brand-version">2.0</span></span></a>
        <button className="new-chat" onClick={newConversation} disabled={busy}><Plus size={18} /> New conversation <span>↗</span></button>
        <div className="history-search"><Search size={15} /><input aria-label="Search conversations" placeholder="Search your chats" value={search} onChange={event => setSearch(event.target.value)} /></div>
        <div className="sidebar-label">YOUR CONVERSATIONS <span>{conversations.length}</span></div>
        <nav className="history" aria-label="Conversation history">
          {conversations.filter(item => item.title.toLowerCase().includes(search.toLowerCase())).map(item => <div className={`history-item ${activeId === item.id ? 'selected' : ''}`} key={item.id}>
            <button className="history-select" onClick={() => openConversation(item.id)} disabled={busy}><MessageSquare size={15} /><span>{item.title}</span></button>
            <button className="history-edit icon-button" aria-label={`Rename ${item.title}`} disabled={busy} onClick={() => setDialog({ type: 'rename', id: item.id, title: item.title })}><Pencil size={13} /></button>
            <button className="history-edit icon-button" aria-label={`Delete ${item.title}`} disabled={busy} onClick={() => setDialog({ type: 'delete', id: item.id, title: item.title })}><Trash2 size={13} /></button>
          </div>)}
          {!conversations.length && <p className="history-empty">A fresh start.<br />Your conversations will appear here.</p>}
          {search && !conversations.some(item => item.title.toLowerCase().includes(search.toLowerCase())) && <p className="history-empty">No matching conversations.</p>}
        </nav>
        <div className="sidebar-note"><span className="note-symbol"><Zap size={16} /></span><strong>A little help, every day.</strong><p>Think it through. Make it happen.</p></div>
        <button className="settings-link" onClick={() => setSettings(true)}><Settings2 size={17} /> Preferences <span>↗</span></button>
        <div className="profile"><div className="avatar">Y</div><div><strong>Your workspace</strong><span>Personal assistant</span></div><span className={`status-dot ${health ? 'online' : ''}`} /></div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setSidebar(true)}><Menu size={20} /></button>
          <div className="workspace-name">Personal workspace <ChevronDown size={13} /></div>
          <div className="topbar-actions"><span className="connection"><span className={`status-dot ${health ? 'online' : ''}`} />{health ? 'Connected' : 'Offline'}</span><button className="icon-button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button><button className="icon-button" aria-label="Export conversation" disabled={!messages.length || busy} onClick={exportChat}><Download size={18} /></button></div>
        </header>
        <section className="chat-area" aria-label="Chat messages" aria-busy={busy || loading}>
          {!messages.length ? <div className="welcome">
            <div className="welcome-eyebrow"><span className="status-dot online" /> YOUR EVERYDAY CO-PILOT</div>
            <div className="welcome-symbol"><Sparkles size={36} strokeWidth={1.4} /></div>
            <h1>A little curiosity.<br /><span>Endless possibilities.</span></h1>
            <p>Hi, I’m LISA. A thinking partner for your ideas,<br className="desktop-break" /> questions, and whatever comes next.</p>
            <div className="starter-grid">{starters.map(({ icon: Icon, label, text, hint, research: useResearch }) => <button key={label} onClick={() => { setDraft(text); if (useResearch) setResearch(true); input.current?.focus(); }} disabled={loading || busy}><Icon size={20} /><strong>{label}</strong><span>{hint}</span><span className="card-arrow">↗</span></button>)}</div>
            <div className="quick-tip"><Mic size={14} /> Prefer to talk? Tap the microphone to add a message.</div>
          </div> : <div className="message-list">
            <div className="conversation-heading"><span>CONVERSATION</span><h1>{current?.title || 'New conversation'}</h1></div>
            {messages.map(message => <article key={message.id} className={`message ${message.role}`}>
              <div className={`message-avatar ${message.role}`}>{message.role === 'assistant' ? <Sparkles size={17} /> : 'Y'}</div>
              <div className="message-main"><div className="message-author">{message.role === 'assistant' ? 'LISA' : 'You'}<span>{message.role === 'assistant' ? 'Your thinking partner' : ''}</span></div>
                <div className="message-content">{message.role === 'assistant' ? <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{message.content}</Markdown> : <p className="user-text">{message.content}</p>}</div>
                {Boolean(message.sources?.length) && <div className="sources"><span><Globe2 size={13} /> Sources</span>{message.sources.map((source, index) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{index + 1}. {source.title}</a>)}</div>}
                {message.searchSuggestions && <iframe title="Google Search suggestions" className="search-suggestions" srcDoc={message.searchSuggestions} sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" />}
                {message.role === 'assistant' && <div className="message-actions"><button onClick={() => copy(message)} aria-label="Copy answer">{copied === message.id ? <Check size={14} /> : <Copy size={14} />}{copied === message.id ? 'Copied' : 'Copy'}</button><button onClick={() => speak(message.content, language)} disabled={!window.speechSynthesis}><Volume2 size={14} /> Listen</button></div>}
              </div>
            </article>)}
            {busy && <div className="thinking" role="status"><Sparkles size={16} /><span>LISA is {research ? 'researching' : 'thinking'}<span className="thinking-dots">…</span></span></div>}
          </div>}
          <div ref={end} />
        </section>
        <div className="composer-wrap">
          {notice && <div className="notice" role="status"><span>{notice}</span><button className="icon-button" aria-label="Dismiss message" onClick={() => setNotice('')}><X size={15} /></button></div>}
          {!health && !loading && <div className="setup-note">Start the backend to connect LISA. <button onClick={reconnect}>Reconnect</button></div>}
          {health && !health.aiConfigured && <div className="setup-note">AI setup needed. Add your Gemini key to the backend .env file. Local commands still work. <button onClick={reconnect}>Check again</button></div>}
          <form className={`composer ${voice.listening ? 'listening' : ''}`} onSubmit={send}>
            <label className="sr-only" htmlFor="message">Message LISA</label>
            <textarea ref={input} id="message" value={draft} onChange={event => setDraft(event.target.value)} placeholder={voice.listening ? 'Listening…' : 'Ask a question, share an idea, or try “open YouTube”…'} rows={2} maxLength={12000} disabled={busy || loading} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} />
            <div className="composer-bottom"><div className="composer-tools"><button type="button" className={`research-button ${research ? 'active' : ''}`} aria-pressed={research} onClick={() => setResearch(!research)} disabled={busy}><Globe2 size={15} /> Research</button><span className="composer-divider" /><button type="button" className="icon-button mic" aria-label="Start voice conversation" title={voice.supported ? 'Start LISA Live' : 'Voice conversations are unavailable in this browser'} onClick={enterVoiceMode} disabled={busy || loading || !voice.supported}><Mic size={18} /></button></div><div className="send-tools"><span>Enter to send</span>{busy ? <button className="send-button" type="button" aria-label="Stop response" onClick={() => generation.current?.abort()}><Square size={15} fill="currentColor" /></button> : <button className="send-button" type="submit" aria-label="Send message" disabled={!draft.trim() || loading}><ArrowUp size={20} /></button>}</div></div>
          </form>
          <div className="composer-caption"><span>LISA can make mistakes. Check important information.</span><span>{research ? 'Web research enabled' : 'Powered by Gemini'}</span></div>
        </div>
      </main>

      {settings && <div className="modal-backdrop" onClick={() => setSettings(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={event => event.stopPropagation()} onKeyDown={event => { if (event.key === 'Escape') setSettings(false); }}><div className="modal-heading"><h2 id="settings-title">Make LISA yours</h2><button className="icon-button" aria-label="Close preferences" autoFocus onClick={() => setSettings(false)}><X size={20} /></button></div><p>Small preferences for a better conversation.</p><label className="preference">Appearance<select value={theme} onChange={event => setTheme(event.target.value)}><option value="dark">Dark</option><option value="light">Light</option></select></label><label className="preference">Voice language<select value={language} disabled={voice.listening} onChange={event => setLanguage(event.target.value)}><option value="en-US">English (US)</option><option value="en-IN">English (India)</option><option value="hi-IN">Hindi</option></select></label><label className="preference">Read answers aloud<input type="checkbox" checked={readAloud} onChange={event => { setReadAloud(event.target.checked); if (!event.target.checked) window.speechSynthesis?.cancel(); }} /></label><button className="secondary-button" onClick={() => window.speechSynthesis?.cancel()}><Square size={14} /> Stop speaking</button><p className="settings-note">Chats are saved on your LISA backend and linked to this browser. Keep browser storage to retain access. Research uses Google Search through Gemini and may consume additional API quota.</p></section></div>}
      {dialog && <div className="modal-backdrop"><form className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onSubmit={changeConversation} onKeyDown={event => { if (event.key === 'Escape') setDialog(null); }}><h2 id="dialog-title">{dialog.type === 'delete' ? 'Delete this conversation?' : 'Rename conversation'}</h2>{dialog.type === 'delete' ? <p>“{dialog.title}” and its messages will be permanently deleted.</p> : <label className="dialog-field">Title<input autoFocus required maxLength={100} value={dialog.title} onChange={event => setDialog({ ...dialog, title: event.target.value })} /></label>}<div className="dialog-actions"><button type="button" className="secondary-button" autoFocus={dialog.type === 'delete'} onClick={() => setDialog(null)}>Cancel</button><button className={dialog.type === 'delete' ? 'danger-button' : 'primary-button'} type="submit">{dialog.type === 'delete' ? 'Delete conversation' : 'Save title'}</button></div></form></div>}
    </div>
  );
}
export default App;
