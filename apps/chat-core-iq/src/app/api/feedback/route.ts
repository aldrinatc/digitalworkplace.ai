import { NextRequest, NextResponse } from 'next/server';
import { readFeedbackData, writeFeedback, type FeedbackEntry } from '@/lib/feedback-store';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://dcq.digitalworkplace.ai',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  try {
    const data = await readFeedbackData();

    const stats = {
      total: data.feedback.length,
      positive: data.feedback.filter(f => f.rating === 'positive').length,
      negative: data.feedback.filter(f => f.rating === 'negative').length,
      lastUpdated: data.lastUpdated,
    };

    return NextResponse.json({
      stats,
      recentFeedback: data.feedback.slice(-10).reverse(),
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Failed to read feedback:', error);
    return NextResponse.json(
      { error: 'Failed to read feedback data' },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messageId, conversationId, rating, query, response, language } = body;

    if (!messageId || !rating || !['positive', 'negative'].includes(rating)) {
      return NextResponse.json(
        { error: 'Invalid feedback data. messageId and rating (positive/negative) are required.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const feedbackEntry: FeedbackEntry = {
      id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      messageId,
      conversationId: conversationId || 'unknown',
      rating,
      query: query || '',
      response: response || '',
      timestamp: new Date().toISOString(),
      language: language || 'en',
    };

    const feedbackId = await writeFeedback(feedbackEntry);

    return NextResponse.json({
      success: true,
      feedbackId,
      message: rating === 'positive'
        ? 'Thank you for your positive feedback!'
        : 'Thank you for your feedback. We will work to improve.',
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Failed to save feedback:', error);
    return NextResponse.json(
      { error: 'Failed to save feedback' },
      { status: 500, headers: corsHeaders }
    );
  }
}
