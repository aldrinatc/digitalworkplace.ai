import { supabase } from './supabase';

interface Message {
  role: string;
  content: string;
  timestamp: string;
}

export interface ConversationEntry {
  id: string;
  sessionId: string;
  startTime: string;
  endTime: string | null;
  messages: Message[];
  channel?: 'web' | 'ivr' | 'sms' | 'facebook' | 'instagram' | 'whatsapp';
  language: string;
  sentiment: string;
  escalated: boolean;
  feedbackGiven: boolean;
  userAgent: string;
  referrer: string;
}

interface ConversationData {
  conversations: ConversationEntry[];
  lastUpdated: string | null;
}

// Vercel functions have a read-only application filesystem. Persist in the
// already-configured dcq_conversations store; never silently discard writes.
export async function readConversationData(): Promise<ConversationData> {
  const { data, error } = await supabase.from('dcq_conversations')
    .select('id, session_id, language, metadata, created_at')
    .order('created_at', { ascending: false }).limit(1000);
  if (error) throw new Error(`Conversation store unavailable: ${error.code}`);
  const conversations = (data || []).flatMap(row => {
    const entry = row.metadata?.conversationLog as ConversationEntry | undefined;
    return entry ? [{ ...entry, id: row.id }] : [];
  }).reverse();
  return { conversations, lastUpdated: data?.[0]?.created_at || null };
}

export async function writeConversation(entry: ConversationEntry): Promise<string> {
  const { data, error } = await supabase.from('dcq_conversations').insert({
    session_id: entry.sessionId,
    channel: 'web',
    language: entry.language,
    metadata: { conversationLog: entry },
  }).select('id').single();
  if (error || !data) throw new Error(`Conversation write failed: ${error?.code || 'no_id'}`);
  return data.id;
}

