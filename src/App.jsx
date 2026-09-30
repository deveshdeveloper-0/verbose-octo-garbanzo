import { useEffect, useRef, useState } from 'react'
import './App.css'

const prompts = [
  'Search the web for today\'s headlines',
  'Find mellow jazz on YouTube',
  'Search Spotify for focus music',
  'Open wikipedia.org',
]

function getResult(rawCommand) {
  const command = rawCommand.trim()
  const youtube = command.match(/^(?:play|search|find)\s+(.+?)\s+(?:on|in)\s+(?:youtube|yt)$/i)
    ?? command.match(/^(?:search\s+)?(?:youtube|yt)\s+(?:for\s+)?(.+)$/i)
  const spotify = command.match(/^(?:play|search|find)\s+(.+?)\s+(?:on|in)\s+spotify$/i)
    ?? command.match(/^(?:search\s+)?spotify\s+(?:for\s+)?(.+)$/i)

  if (youtube || spotify) {
    const query = (youtube || spotify)[1].trim()
    const service = youtube ? 'YouTube' : 'Spotify'
    const url = youtube
      ? `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
      : `https://open.spotify.com/search/${encodeURIComponent(query)}`
    return { text: `Here are ${service} results for “${query}”.`, action: { label: `Open ${service} results`, url } }
  }

  const directMessage = command.match(/^(?:send|text|message)\s+(.+?)\s+to\s+(\+?[\d][\d\s().-]{5,}\d)(?:\s+on\s+whats?app)?$/i)
  const sayingMessage = command.match(/^(?:send|text|message)\s+(?:a\s+)?(?:whats?app\s+)?(?:message\s+)?to\s+(\+?[\d][\d\s().-]{5,}\d)\s+(?:saying|that says)\s+(.+)$/i)
  if (directMessage || sayingMessage) {
    const phone = (directMessage ? directMessage[2] : sayingMessage[1]).replace(/\D/g, '')
    const message = (directMessage ? directMessage[1] : sayingMessage[2]).trim()
    if (phone.length >= 7 && phone.length <= 15) {
      return {
        text: `Your message is ready for ${phone}. Review it in WhatsApp, then press Send there.`,
        action: {
          label: 'Review message in WhatsApp',
          url: `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
          note: 'WhatsApp will ask you to send the message. MJ cannot send it in the background.',
        },
      }
    }
  }

  const open = command.match(/^(?:open|go to|visit|launch)\s+(.+)$/i)
  if (open) {
    const domain = open[1].trim().replace(/^https?:\/\//i, '')
    try {
      const url = new URL(`https://${domain}`)
      if (url.hostname.includes('.')) return { text: `Ready to open ${url.hostname}.`, action: { label: `Open ${url.hostname}`, url: url.href } }
    } catch { return { text: 'Try a website address like example.com.' } }
    return { text: 'Try a website address like example.com.' }
  }

  if (/^(?:hi|hello|hey)(?:\s+mj|\s+there)?[.!\s]*$/i.test(command)) {
    return { text: 'Hey! What would you like to look up or do?' }
  }
  if (/^(?:what can you do|help|show commands)\??$/i.test(command)) {
    return { text: 'I can search the web, find music on YouTube or Spotify, open websites, and prepare WhatsApp messages for you to review.' }
  }

  const play = command.match(/^play\s+(.+)$/i)
  const search = command.match(/^(?:search(?:\s+(?:the\s+)?web)?(?:\s+for)?|google)\s+(.+)$/i)
  const query = (play?.[1] ?? search?.[1] ?? command).trim()
  if (play) return { text: `Here are YouTube results for “${query}”.`, action: { label: 'Open YouTube results', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}` } }
  return { text: `Here are web results for “${query}”.`, action: { label: 'Search the web', url: `https://www.google.com/search?q=${encodeURIComponent(query)}` } }
}

function whatsappUrl(phone, message) {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15 && message.trim()
    ? `https://wa.me/${digits}?text=${encodeURIComponent(message.trim())}`
    : ''
}

function App() {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [listening, setListening] = useState(false)
  const [voiceReplies, setVoiceReplies] = useState(true)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const recognitionRef = useRef(null)
  const bottomRef = useRef(null)
  const micAvailable = typeof window !== 'undefined'
    && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)

  useEffect(() => {
    return () => recognitionRef.current?.stop()
  }, [])
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function speak(text) {
    if (!voiceReplies || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1.02
    window.speechSynthesis.speak(utterance)
  }

  function submitCommand(raw) {
    const command = raw.trim()
    if (!command) return
    setDraft('')
    setNotice('')
    setBusy(true)
    window.setTimeout(() => {
      const result = getResult(command)
      setMessages((current) => [...current,
        { id: `${Date.now()}-u`, role: 'user', text: command },
        { id: `${Date.now()}-m`, role: 'assistant', ...result },
      ])
      setBusy(false)
      speak(result.text)
    }, 180)
  }

  function startListening() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) {
      setNotice('Voice input is not supported here. Try Chrome or Edge, or type below.')
      return
    }
    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }
    const recognition = new Recognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onstart = () => { setListening(true); setNotice('Listening now. Say a command, then pause.') }
    recognition.onresult = (event) => submitCommand(event.results[event.results.length - 1][0].transcript)
    recognition.onerror = (event) => {
      setListening(false)
      setNotice(event.error === 'not-allowed'
        ? 'Microphone access is blocked. Allow it in browser settings to use voice input.'
        : 'I missed that. Tap the microphone and try again.')
    }
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    try { recognition.start() } catch {
      setListening(false)
      setNotice('I couldn’t start the microphone. Please try again.')
    }
  }

  function prepareWhatsApp(event) {
    event.preventDefault()
    const url = whatsappUrl(phone, message)
    if (!url) {
      setNotice('Enter a phone number with country code and a message to prepare a WhatsApp chat.')
      return
    }
    setMessages((current) => [...current, {
      id: `${Date.now()}-m`, role: 'assistant',
      text: `Your message is ready for ${phone.replace(/\D/g, '')}. Review it in WhatsApp, then press Send there.`,
      action: { label: 'Review message in WhatsApp', url, note: 'WhatsApp will ask you to send the message. MJ cannot send it in the background.' },
    }])
    setMessage('')
  }

  function newConversation() {
    setMessages([])
    setDraft('')
    setNotice('')
    window.speechSynthesis?.cancel()
  }

  const greeting = 'READY WHEN YOU ARE'
  const preparedUrl = whatsappUrl(phone, message)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><div className="brand-mark"><span>m</span><i /></div><div><strong>MJ</strong><span>voice companion</span></div></div>
        <button className="new-chat-button" type="button" onClick={newConversation}><span className="plus-icon">+</span> New conversation</button>
        <div className="sidebar-section"><span className="section-label">YOUR SPACE</span><button className="nav-link active" type="button" onClick={newConversation}><span className="nav-orbit" />Assistant</button></div>
        <div className="sidebar-section shortcuts-section">
          <span className="section-label">QUICK ACTIONS</span>
          <button className="shortcut-link" type="button" onClick={() => submitCommand('Search the web for today’s headlines')}><span className="shortcut-icon">⌕</span>Search the web</button>
          <button className="shortcut-link" type="button" onClick={() => submitCommand('Search YouTube for lo-fi beats')}><span className="shortcut-icon youtube-icon">▶</span>YouTube</button>
          <button className="shortcut-link" type="button" onClick={() => submitCommand('Search Spotify for focus music')}><span className="shortcut-icon spotify-icon">◉</span>Spotify</button>
        </div>
        <div className="sidebar-bottom">
          <div className="mic-status"><span className={`status-dot ${micAvailable ? 'available' : ''}`} /><div><strong>{micAvailable ? 'Voice ready' : 'Voice unavailable'}</strong><span>{micAvailable ? 'Browser microphone' : 'Try Chrome or Edge'}</span></div></div>
          <div className="profile-row"><div className="profile-avatar">M</div><div><strong>My assistant</strong><span>Personal space</span></div><span className="profile-menu">···</span></div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="mobile-brand"><div className="brand-mark"><span>m</span><i /></div><strong>MJ</strong></div>
          <div className="workspace-title"><span className="eyebrow">YOUR ASSISTANT</span><span className="topbar-subtitle">A little help, right on cue.</span></div>
          <button className={`voice-toggle ${voiceReplies ? 'enabled' : ''}`} type="button" role="switch" aria-checked={voiceReplies} onClick={() => setVoiceReplies((enabled) => !enabled)}><span className="voice-toggle-label">Voice replies</span><span className="toggle-track"><i /></span></button>
        </header>

        <div className="main-layout">
          <section className="conversation-column" aria-label="Conversation with MJ">
            <div className="conversation-scroll">
              {messages.length === 0 ? <div className="empty-state">
                <div className={`voice-orb ${listening ? 'is-listening' : ''}`} aria-hidden="true"><div className="orb-ring" /><div className="orb-ring ring-two" /><div className="orb-core"><span /><span /><span /><span /><span /></div></div>
                <span className="greeting-label">{greeting}</span><h1>What can I do<br />for you?</h1><p>Ask out loud or type it in. I’m right here.</p>
                <div className="prompt-grid">{prompts.map((prompt) => <button key={prompt} type="button" className="prompt-chip" onClick={() => submitCommand(prompt)}>{prompt}<span>↗</span></button>)}</div>
              </div> : <div className="message-list">
                <div className="conversation-date">TODAY</div>
                {messages.map((item) => <article className={`message-row ${item.role}`} key={item.id}>
                  {item.role === 'assistant' && <div className="message-avatar" aria-label="MJ">m</div>}
                  <div className="message-content"><span className="message-author">{item.role === 'assistant' ? 'MJ' : 'You'}</span><div className="message-bubble">{item.text}</div>
                    {item.action && <div className="message-action"><a href={item.action.url} target="_blank" rel="noreferrer">{item.action.label}<span>↗</span></a>{item.action.note && <p>{item.action.note}</p>}</div>}
                  </div>
                </article>)}
                {busy && <div className="thinking-row"><div className="message-avatar">m</div><span className="thinking-dots"><i /><i /><i /></span><span>MJ is thinking</span></div>}
                <div ref={bottomRef} />
              </div>}
            </div>
            <div className="composer-wrap">
              {notice && <div className="notice" role="status">{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}>×</button></div>}
              <form className="composer" onSubmit={(event) => { event.preventDefault(); submitCommand(draft) }}>
                <button className={`mic-button ${listening ? 'listening' : ''}`} type="button" onClick={startListening} aria-label={listening ? 'Stop listening' : 'Start voice input'} title={listening ? 'Stop listening' : 'Start voice input'}><span className="mic-icon" /></button>
                <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={listening ? 'Listening…' : 'Message MJ or ask for anything'} aria-label="Message MJ" />
                <span className="enter-hint">↵</span><button className="send-button" type="submit" disabled={!draft.trim()} aria-label="Send message" title="Send message">↑</button>
              </form>
              <div className="composer-caption">{listening ? 'Listening now · Tap the microphone to stop' : 'Microphone is only active while you’re listening'}</div>
            </div>
          </section>

          <aside className="tools-panel" aria-label="Assistant tools">
            <section className="tool-section say-section"><div className="panel-heading"><div><span className="eyebrow">A FEW IDEAS</span><h2>Try saying</h2></div><span className="sparkle">✳</span></div>
              <button className="idea-row" type="button" onClick={() => submitCommand('Search for easy dinner recipes')}><span className="idea-icon">⌕</span>“Search for a recipe”</button>
              <button className="idea-row" type="button" onClick={() => submitCommand('Play a relaxing song')}><span className="idea-icon play-idea">▶</span>“Find a song on YouTube”</button>
              <button className="idea-row" type="button" onClick={() => submitCommand('Open wikipedia.org')}><span className="idea-icon open-idea">↗</span>“Open a website”</button>
            </section>
            <section className="tool-section whatsapp-section"><div className="panel-heading"><div><span className="eyebrow">STAY IN TOUCH</span><h2>WhatsApp</h2></div><span className="whatsapp-mark">w</span></div>
              <p className="tool-description">Prepare a message, then review and send it in WhatsApp.</p>
              <form className="whatsapp-form" onSubmit={prepareWhatsApp}><label htmlFor="phone-number">Phone number</label><input id="phone-number" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+1 555 000 0000" autoComplete="tel" /><label htmlFor="whatsapp-message">Message</label><textarea id="whatsapp-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a message…" rows="2" /><button className="whatsapp-button" type="submit" disabled={!preparedUrl}>Continue to WhatsApp <span>↗</span></button></form>
            </section>
            <div className="privacy-note"><span className="privacy-mark">◎</span><p><strong>You’re in control</strong><br />MJ asks before opening links. Messages are never sent without you.</p></div>
          </aside>
        </div>
      </main>
    </div>
  )
}

export default App
