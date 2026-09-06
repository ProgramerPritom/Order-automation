async function scrape() {
  try {
    const res = await fetch('https://alapi.chat/features/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    const html = await res.text();
    
    // Extract titles, headings, and feature blocks
    const matches = html.match(/<(h[1-4]|p|li)[^>]*>(.*?)<\/\1>/gi) || [];
    console.log(`Found ${matches.length} elements.`);
    const cleanTexts = matches
      .map(m => m.replace(/<[^>]+>/g, '').trim())
      .filter(t => t.length > 5 && !t.includes('{') && !t.includes('function'));
    
    console.log('--- EXTRACTED ALAPI FEATURES TEXT ---');
    console.log(cleanTexts.slice(0, 80).join('\n'));
  } catch (err) {
    console.error('Scrape error:', err);
  }
}
scrape();
