async function scrapeHome() {
  try {
    const res = await fetch('https://alapi.chat/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const html = await res.text();
    const matches = html.match(/<(h[1-4]|p|li|button|a)[^>]*>(.*?)<\/\1>/gi) || [];
    const cleanTexts = matches
      .map(m => m.replace(/<[^>]+>/g, '').trim())
      .filter(t => t.length > 5 && !t.includes('{') && !t.includes('function'));
    
    console.log('--- EXTRACTED ALAPI HOMEPAGE TEXT ---');
    console.log(cleanTexts.slice(0, 70).join('\n'));
  } catch (err) {
    console.error('Home scrape error:', err);
  }
}
scrapeHome();
