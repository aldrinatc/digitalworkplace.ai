import { supabase } from './supabase';

export interface FeedbackEntry {
  id: string;
  messageId: string;
  conversationId: string;
  rating: 'positive' | 'negative';
  query: string;
  response: string;
  timestamp: string;
  language: string;
}

interface FeedbackData {
  feedback: FeedbackEntry[];
  lastUpdated: string | null;
}


const isUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
export async function readFeedbackData(): Promise<FeedbackData> {
  const { data, error } = await supabase.from('dcq_feedback')
    .select('id,message_id,conversation_id,rating,comment,created_at')
    .order('created_at', { ascending: false }).limit(1000);
  if (error) throw new Error(`Feedback store unavailable: ${error.code}`);
  const feedback = (data || []).map(row => {
    let details: Partial<FeedbackEntry> = {};
    try { details = JSON.parse(row.comment || '{}').feedbackLog || {}; } catch { /* Legacy plain comment */ }
    return {
      id: row.id, messageId: details.messageId || row.message_id || '',
      conversationId: details.conversationId || row.conversation_id || '',
      rating: row.rating, query: details.query || '', response: details.response || '',
      timestamp: row.created_at, language: details.language || 'en',
    } as FeedbackEntry;
  }).reverse();
  return { feedback, lastUpdated: data?.[0]?.created_at || null };
}
export async function writeFeedback(entry: FeedbackEntry): Promise<string> {
  const { data, error } = await supabase.from('dcq_feedback').insert({
    // Widget-generated IDs are not database UUID foreign keys. Preserve them in
    // structured comment metadata, and link actual database IDs when available.
    message_id: null,
    conversation_id: isUuid(entry.conversationId) ? entry.conversationId : null,
    rating: entry.rating,
    comment: JSON.stringify({ feedbackLog: entry }),
  }).select('id').single();
  if (error || !data) throw new Error(`Feedback write failed: ${error?.code || 'no_id'}`);
  return data.id;
}
