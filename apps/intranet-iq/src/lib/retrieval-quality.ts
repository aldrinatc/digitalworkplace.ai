const STOP_WORDS = new Set(['the', 'is', 'are', 'was', 'what', 'how', 'can', 'could', 'would', 'should', 'with', 'about', 'for', 'and', 'this', 'that', 'our', 'your', 'you', 'please', 'tell', 'does', 'have']);

export function searchTerms(query: string): string[] {
  return [...new Set((query.toLowerCase().match(/[a-z0-9]+/g) || [])
    .filter(term => term.length > 2 && !STOP_WORDS.has(term)))].slice(0, 12);
}

export function keywordRelevance(terms: string[], title: string, content: string): number {
  if (!terms.length) return 0;
  const heading = title.toLowerCase();
  const body = content.toLowerCase();
  const score = terms.reduce((sum, term) => sum + (heading.includes(term) ? 2 : body.includes(term) ? 1 : 0), 0);
  return score / (2 * terms.length);
}

export function isPersistedThread(id: string | undefined): boolean {
  return Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));
}
