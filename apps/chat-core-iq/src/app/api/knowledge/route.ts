import {searchDocumentEntries} from '@/lib/server/document-store';
import { scoreFAQMatch, scoreMatch } from '@/lib/knowledge-ranking';
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface Page {
  id: string;
  title: string;
  section: string;
  url: string;
  content: string;
  summary: string;
}

interface DemoFAQ {
  verifiedAnswer?: Record<string, string>;
  id: string;
  title: string;
  keywords: string[];
  section: string;
  url: string;
  priority: number;
  content: string;
  summary: string;
}

interface KnowledgeBase {
  pages: Page[];
  sections: string[];
  stats: {
    totalPages: number;
    bySection: Record<string, number>;
  };
  generatedAt: string;
}

// Load knowledge base at startup
let kb: KnowledgeBase;
let demoFAQs: DemoFAQ[] = [];

try {
  const filePath = join(process.cwd(), 'public', 'knowledge-base.json');
  kb = JSON.parse(readFileSync(filePath, 'utf-8'));
} catch {
  kb = { pages: [], sections: [], stats: { totalPages: 0, bySection: {} }, generatedAt: '' };
}

// Load curated demo FAQs
try {
  const faqPath = join(process.cwd(), 'data', 'demo-faq.json');
  if (existsSync(faqPath)) {
    demoFAQs = JSON.parse(readFileSync(faqPath, 'utf-8'));
  }
} catch {
  demoFAQs = [];
}

// Load Tyler Technologies FAQs
try {
  const tylerPath = join(process.cwd(), 'data', 'tyler-faq.json');
  if (existsSync(tylerPath)) {
    const tylerFAQs: DemoFAQ[] = JSON.parse(readFileSync(tylerPath, 'utf-8'));
    demoFAQs = [...demoFAQs, ...tylerFAQs];
  }
} catch {
  // Tyler FAQs not available
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const section = searchParams.get('section') || '';
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  // If no query, return stats
  if (!query) {
    return NextResponse.json({
      stats: kb.stats,
      sections: kb.sections,
      generatedAt: kb.generatedAt,
      curatedFAQs: demoFAQs.length
    });
  }

  // First, check for matching curated FAQs
  const faqResults = demoFAQs
    .map(faq => ({ faq, score: scoreFAQMatch(faq, query) }))
    .filter(item => item.score > 50) // Only return good matches
    .sort((a, b) => b.score - a.score);

  // Filter pages by section if provided
  let pages = [...kb.pages, ...await searchDocumentEntries(query)];
  if (section) {
    pages = pages.filter(p => p.section.toLowerCase() === section.toLowerCase());
  }

  // Score and sort regular pages
  const pageResults = pages
    .map(page => ({ page, score: scoreMatch(page, query) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  // Combine results - curated FAQs first, then regular pages
  const results: Array<{
    id: string;
    title: string;
    section: string;
    url: string;
    summary: string;
    score: number;
    isCurated?: boolean;
  }> = [];

  // Add FAQ results first (with boost)
  for (const { faq, score } of faqResults.slice(0, 3)) {
    results.push({
      id: faq.id,
      title: faq.title,
      section: faq.section,
      url: faq.url,
      summary: faq.summary,
      score: score + 200, // Boost curated content
      isCurated: true
    });
  }

  // Add regular page results
  for (const { page, score } of pageResults) {
    if (results.length >= limit) break;
    // Avoid duplicates
    if (!results.some(r => r.url === page.url)) {
      results.push({
        id: page.id,
        title: page.title,
        section: page.section,
        url: page.url,
        summary: page.summary,
        score
      });
    }
  }

  return NextResponse.json({
    query,
    section: section || null,
    count: results.length,
    results: results.slice(0, limit)
  });
}

// POST endpoint for chatbot context retrieval
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { query, limit = 5, includeContent = true, domain } = body;

  if (!query) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
  }

  // First, check for matching curated FAQs (highest priority)
  const faqResults = demoFAQs
    .map(faq => ({ faq, score: scoreFAQMatch(faq, query) }))
    .filter(item => item.score > 50)
    .sort((a, b) => b.score - a.score);

  // An explicitly verified FAQ is authoritative for its exact keyword match.
  // Return its cited answer without adding unrelated pages to the model context.
  const verified = faqResults.find(({ faq, score }) => faq.verifiedAnswer && score >= 80);
  if (verified) {
    const { faq, score } = verified;
    return NextResponse.json({ query, count: 1, results: [{
      id: faq.id, title: faq.title, section: faq.section, url: faq.url,
      content: includeContent ? faq.content : undefined, summary: faq.summary,
      score, isCurated: true, verifiedAnswer: faq.verifiedAnswer,
    }] });
  }

  // Filter pages based on domain (multi-URL support for doralpd.com)
  const searchablePages = [...kb.pages, ...await searchDocumentEntries(query)];
  let filteredPages = searchablePages;
  if (domain && domain.includes('doralpd')) {
    filteredPages = searchablePages.filter(p =>
      p.url.toLowerCase().includes('police') ||
      p.section.toLowerCase().includes('police') ||
      p.title.toLowerCase().includes('police') ||
      p.content.toLowerCase().includes('police department')
    );
    if (filteredPages.length === 0) {
      filteredPages = searchablePages;
    }
  }

  // Score and sort regular pages
  const pageResults = filteredPages
    .map(page => ({ page, score: scoreMatch(page, query) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  // Combine results - curated FAQs always first with full content
  const results: Array<{
    id: string;
    title: string;
    section: string;
    url: string;
    content?: string;
    summary: string;
    score: number;
    isCurated?: boolean;
  }> = [];

  // Add FAQ results first (these have the most accurate, detailed content)
  for (const { faq, score } of faqResults.slice(0, 2)) {
    results.push({
      id: faq.id,
      title: faq.title,
      section: faq.section,
      url: faq.url,
      content: includeContent ? faq.content : undefined,
      summary: faq.summary,
      score: score + 500, // High boost for curated content
      isCurated: true
    });
  }

  // Add regular page results
  for (const { page, score } of pageResults) {
    if (results.length >= limit) break;
    if (!results.some(r => r.url === page.url)) {
      results.push({
        id: page.id,
        title: page.title,
        section: page.section,
        url: page.url,
        content: includeContent ? page.content : undefined,
        summary: page.summary,
        score
      });
    }
  }

  return NextResponse.json({
    query,
    count: results.length,
    results: results.slice(0, limit)
  });
}
