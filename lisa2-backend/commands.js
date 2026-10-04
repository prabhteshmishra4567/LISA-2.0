function localCommand(question, timeZone = 'UTC') {
  const command = question.trim().toLowerCase().replace(/[?.!]+$/, '');
  const sites = { spotify: 'https://open.spotify.com', youtube: 'https://www.youtube.com', google: 'https://www.google.com', github: 'https://github.com' };
  const open = command.match(/^open (spotify|youtube|google|github)$/);
  if (open) return `Here is [Open ${open[1]}](${sites[open[1]]}). Click the link to open it in a new tab.`;
  const search = question.trim().match(/^search (?:for )?(.+)$/i);
  if (search) return `[Search Google](https://www.google.com/search?q=${encodeURIComponent(search[1])}) for “${search[1].replace(/[\[\]<>]/g, '')}”. Turn on **Research** if you want me to research a question and summarize the sources.`;
  if (/^(what(?:'s| is) (?:the )?(?:current )?time|tell me the time|time)$/.test(command)) {
    try { return `The current time is **${new Date().toLocaleTimeString('en-US', { timeZone })}** (${timeZone}).`; }
    catch { return 'I could not determine your time zone. Check your browser settings.'; }
  }
  if (/^(what(?:'s| is) (?:the )?(?:today's )?date|tell me the date|date)$/.test(command)) {
    try { return `Today is **${new Date().toLocaleDateString('en-US', { dateStyle: 'full', timeZone })}**.`; }
    catch { return 'I could not determine your time zone. Check your browser settings.'; }
  }
  if (/^(tell (?:me )?(?:a )?joke|joke)$/.test(command)) return 'Why do programmers prefer dark mode? Because light attracts bugs.';
  return null;
}
module.exports = { localCommand };
