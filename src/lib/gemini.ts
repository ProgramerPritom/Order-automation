/**
 * Google Gemini AI Helper for KothaShop.ai
 * Utilizes gemini-2.5-flash for ultra-fast, high-accuracy conversational responses
 */

export async function askGemini(prompt: string, systemInstruction?: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY is not set in environment.');
    return 'দুঃখিত, এআই এপিআই কি কনফিগার করা নেই। অনুগ্রহ করে অ্যাডমিনের সাথে যোগাযোগ করুন।';
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  try {
    const contents: any[] = [];
    if (systemInstruction) {
      contents.push({
        role: 'user',
        parts: [{ text: `[System Instructions / Rules]:\n${systemInstruction}\n\n[User Message]:\n${prompt}` }],
      });
    } else {
      contents.push({
        role: 'user',
        parts: [{ text: prompt }],
      });
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 800,
        },
      }),
    });

    const data = await res.json();
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text.trim();
    }

    if (data.error) {
      console.error('Gemini API Error:', data.error);
    }

    return 'দুঃখিত, বর্তমানে এআই রেসপন্স তৈরিতে কিছুটা সমস্যা হচ্ছে। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।';
  } catch (error: any) {
    console.error('askGemini network error:', error);
    return 'নেটওয়ার্ক সমস্যার কারণে উত্তর পেতে ব্যর্থ হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।';
  }
}
