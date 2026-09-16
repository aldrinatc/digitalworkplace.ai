const STOP_WORDS = new Set(['what', 'when', 'where', 'which', 'how', 'does', 'are', 'the', 'for', 'and', 'can', 'could', 'would', 'please', 'with', 'that', 'this', 'have', 'get', 'from']);
const normalized = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function queryTerms(query: string): string[] {
  return [...new Set(normalized(query).split(' ').filter(word => word.length > 2 && !STOP_WORDS.has(word)))].slice(0, 16);
}
const containsWord = (text: string, word: string) => ` ${normalized(text)} `.includes(` ${word} `);
export function scoreFAQMatch(faq: { title: string; keywords: string[]; priority: number }, query: string): number {
  const terms = queryTerms(query);
  if (!terms.length) return 0;
  const phrase = ` ${normalized(query)} `;
  const keywordHit = faq.keywords.some(keyword => queryTerms(keyword).length > 0 && phrase.includes(` ${normalized(keyword)} `));
  const titleHits = terms.filter(word => containsWord(faq.title, word)).length;
  // Generic words in long curated FAQs must not outrank relevant documents.
  if (!keywordHit && titleHits < Math.min(2, terms.length)) return 0;
  return (keywordHit ? 80 : 0) + titleHits * 25 + Math.min(10, Math.max(0, faq.priority));
}
export function scoreMatch(page: { title: string; content: string }, query: string): number {
  const terms = queryTerms(query);
  if (!terms.length) return 0;
  const titleHits = terms.filter(word => containsWord(page.title, word)).length;
  const contentHits = terms.filter(word => containsWord(page.content, word)).length;
  if (Math.max(titleHits, contentHits) < Math.min(2, terms.length)) return 0;
  return titleHits * 30 + contentHits * 5;
}
