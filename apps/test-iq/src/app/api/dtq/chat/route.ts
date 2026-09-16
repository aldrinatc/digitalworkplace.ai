import { aiKey, resilientAIFetch } from '@/lib/ai-provider';
import { NextRequest, NextResponse } from 'next/server';
import { generateEmbedding } from '@/lib/embeddings';
import { createClient } from '@supabase/supabase-js';
import { resolveLinks } from '@/lib/dtq/link-resolver';
import { PersonaType } from '@/lib/dtq/types';
import { personas } from '@/lib/dtq/data';
import { getPersonaData } from '@/lib/dtq/persona-data';

// Persona display names
const PERSONA_TITLES: Record<string, string> = {
  csuite: 'C-Suite Executive',
  manager: 'QA Manager',
  techlead: 'Tech Lead / Engineer',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, persona = 'manager', history = [] } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (!['csuite', 'manager', 'techlead'].includes(persona)) {
      return NextResponse.json({ error: 'Invalid persona' }, { status: 400 });
    }

    const anthropicKey = aiKey('anthropic');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // Fail clearly when no generation provider is configured
    if (!anthropicKey) {
      return NextResponse.json({ error: 'The AI service is temporarily unavailable.', code: 'AI_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } });
    }

    // --- RAG: Generate query embedding and search knowledge base ---
    let ragContext = '';
    const sources: { title: string; type: string; similarity: number }[] = [];

    try {
      if (!supabaseUrl || !supabaseKey) throw new Error('Knowledge store not configured');
      const queryEmbedding = await generateEmbedding(message);

      // Use public schema — dtq schema is not exposed via PostgREST.
      // public.search_dtq_knowledge_semantic is a SECURITY DEFINER wrapper that queries dtq.knowledge_base.
      const supabase = createClient(supabaseUrl, supabaseKey!);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: matches, error: searchError } = await (supabase as any).rpc(
        'search_dtq_knowledge_semantic',
        {
          query_embedding: queryEmbedding,
          match_threshold: 0.3,
          match_count: 8,
          filter_persona: persona,
          filter_types: null,
        }
      );

      if (searchError) {
        console.error('RAG search error:', searchError.message, searchError);
      }

      if (!searchError && matches && matches.length > 0) {
        ragContext = matches
          .map(
            (m: { title: string; item_type: string; content: string; similarity: number }, i: number) =>
              `[${i + 1}] ${m.title} (${m.item_type}, similarity: ${(m.similarity * 100).toFixed(1)}%)\n${m.content}`
          )
          .join('\n\n---\n\n');

        sources.push(
          ...matches.map((m: { title: string; item_type: string; similarity: number }) => ({
            title: m.title,
            type: m.item_type,
            similarity: Math.round(m.similarity * 100) / 100,
          }))
        );
      }
    } catch (embeddingError) {
      console.warn('Semantic retrieval unavailable; using labelled dashboard data');
    }

    if (!ragContext) {
      // These are the same bundled sample data shown by the dashboard. Label
      // their provenance so they cannot be mistaken for live test telemetry.
      const { features } = getPersonaData(persona as PersonaType);
      ragContext = 'Bundled dashboard SAMPLE DATA (not live test results):\n' + JSON.stringify({
        riskThresholds: { high: 'riskScore >= 40', medium: '20 <= riskScore < 40', low: 'riskScore < 20' },
        highRiskFeatures: features.filter(f => f.riskScore >= 40).sort((a, b) => b.riskScore - a.riskScore),
        features: [...features].sort((a, b) => b.riskScore - a.riskScore), metrics: personas.find(p => p.id === persona)?.metrics || [],
      });
      sources.push({ title: 'Dashboard sample dataset', type: 'sample_data', similarity: 1 });
    }

    // --- Build system prompt ---
    const personaTitle = PERSONA_TITLES[persona] || 'QA Professional';
    const systemPrompt = buildSystemPrompt(persona, personaTitle, ragContext);

    // --- Build messages for Claude ---
    const claudeMessages = [
      ...history.slice(-10).map((h: { role: string; content: string }) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user' as const, content: message },
    ];

    // --- Call Claude API with 30s timeout ---
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let claudeResponse: Response;
    try {
      claudeResponse = await resilientAIFetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: systemPrompt,
          messages: claudeMessages,
        }),
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
        console.error('Claude API timed out after 30s');
      }
      return NextResponse.json({ error: 'The AI service is temporarily unavailable.', code: 'AI_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } });
    } finally {
      clearTimeout(timeout);
    }

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude API error:', claudeResponse.status, errorText);
      return NextResponse.json({ error: 'The AI service is temporarily unavailable.', code: 'AI_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } });
    }

    const claudeData = await claudeResponse.json();
    const responseText =
      claudeData.content?.[0]?.text || "I wasn't able to generate a response. Please try again.";

    const personaMetrics = personas.find(p => p.id === persona)?.metrics || [];
    const relatedLinks = resolveLinks({
      responseText, sources, persona: persona as PersonaType,
      userMessage: message, personaMetrics,
    });

    return NextResponse.json({
      response: responseText,
      sources,
      relatedLinks,
      model: claudeData.model || 'claude-sonnet-4-6',
      persona,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
}

function buildSystemPrompt(persona: string, personaTitle: string, ragContext: string): string {
  let prompt = `You are Test Pilot IQ, an AI-powered testing intelligence assistant for a QA and testing platform.
You help ${personaTitle} users analyze QA metrics, test coverage, risk areas, and testing strategy.

Current persona: ${persona} (${personaTitle})

Guidelines:
- Reference specific features, metrics, and data points from the knowledge base context
- Use the supplied risk thresholds exactly: high risk means riskScore >= 40. Do not classify lower scores as high risk.
- When context is labelled SAMPLE DATA, explicitly state that the answer uses dashboard sample data; never present it as live production results
- Provide actionable recommendations backed by data
- Format responses with markdown (headers, bold, lists)
- Be concise but thorough — aim for 150-300 words
- If the context doesn't contain relevant information, say so honestly
- Use the persona context to tailor your language (executives want ROI/strategy, managers want operational metrics, tech leads want technical details)
- IMPORTANT: Always bold feature names, category names, and metric names using **Name** syntax so they can be extracted as navigation links`;

  if (ragContext) {
    prompt += `\n\nUse the following knowledge base context to answer the user's question:\n\n${ragContext}`;
  } else {
    prompt += `\n\nNo specific knowledge base context was found for this query. Provide general testing intelligence guidance based on your expertise.`;
  }

  return prompt;
}

