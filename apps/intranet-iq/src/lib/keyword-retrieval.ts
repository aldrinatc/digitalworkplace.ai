import { createClient } from '@supabase/supabase-js';
import { searchTerms as tokenizeQuery, keywordRelevance } from './retrieval-quality';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
interface Source { id: string; type: string; title: string; url?: string; relevance: number; content?: string; }
export async function getRAGContextKeyword(query: string, limit: number = 5): Promise<Source[]> {
  try {
    const searchTerms = tokenizeQuery(query);
    if (!searchTerms.length) return [];
    const sources: Source[] = [];

    // Search articles in diq schema using ilike for partial matching
    const { data: articles, error: artError } = await supabase
      .schema('diq')
      .from('articles')
      .select('id, title, content, slug')
      .or(searchTerms.map(term => `title.ilike.%${term}%,content.ilike.%${term}%`).join(','))
      .eq('status', 'published')
      .limit(50);

    if (!artError && articles) {
      articles.forEach((article) => {
        sources.push({
          id: article.id,
          type: 'article',
          title: article.title || 'Untitled Article',
          url: `/diq/content/${article.slug || article.id}`,
          relevance: keywordRelevance(searchTerms, article.title || '', article.content || ''),
          content: article.content?.slice(0, 500) || '',
        });
      });
    }

    // Also search knowledge items in public schema
    const { data: knowledgeItems, error: kiError } = await supabase
      .from('knowledge_items')
      .select('id, title, content, type, source_url')
      .or(searchTerms.map(term => `title.ilike.%${term}%,content.ilike.%${term}%`).join(','))
      .limit(50);

    if (!kiError && knowledgeItems) {
      knowledgeItems.forEach((item) => {
        sources.push({
          id: item.id,
          type: item.type || 'document',
          title: item.title || 'Untitled Document',
          url: item.source_url || '/diq/content',
          relevance: keywordRelevance(searchTerms, item.title || '', item.content || ''),
          content: item.content?.slice(0, 500) || '',
        });
      });
    }

    // Sort by relevance and return top sources
    return sources.sort((a, b) => b.relevance - a.relevance).slice(0, limit);
  } catch (error) {
    console.error('Error fetching RAG context:', error);
    return [];
  }
}

