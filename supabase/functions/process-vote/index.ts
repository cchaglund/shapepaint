import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_REQUIRED_VOTES = 5;

interface VoteRequest {
  submissionAId: string;
  submissionBId: string;
  winnerId: string | null; // null if skipped
}

/**
 * Calculate required votes server-side based on available submissions.
 * Mirrors client-side logic in votingRules.ts.
 */
function calculateRequiredVotes(submissionCount: number): number {
  if (submissionCount === 0) return 0;
  const totalPairs = (submissionCount * (submissionCount - 1)) / 2;
  return Math.min(DEFAULT_REQUIRED_VOTES, totalPairs);
}

/**
 * Get yesterday's date in UTC (YYYY-MM-DD format)
 * Voting always happens on submissions from the previous day
 */
function getYesterdayDateUTC(): string {
  const now = new Date();
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return yesterday.toISOString().split('T')[0];
}

/**
 * Get today's date in UTC (YYYY-MM-DD format)
 */
function getTodayDateUTC(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    .toISOString().split('T')[0];
}

interface EloResult {
  newRatingA: number;
  newRatingB: number;
}

/**
 * Calculate new Elo ratings after a match
 * K-factor of 32 is standard for most rating systems
 */
function calculateElo(ratingA: number, ratingB: number, winner: 'A' | 'B'): EloResult {
  const K = 32;

  // Expected scores based on current ratings
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;

  // Actual scores
  const scoreA = winner === 'A' ? 1 : 0;
  const scoreB = winner === 'B' ? 1 : 0;

  // New ratings
  const newRatingA = Math.round(ratingA + K * (scoreA - expectedA));
  const newRatingB = Math.round(ratingB + K * (scoreB - expectedB));

  return { newRatingA, newRatingB };
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with user's auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const { submissionAId, submissionBId, winnerId }: VoteRequest = await req.json();

    // Validate required fields
    if (!submissionAId || !submissionBId) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate UUID format
    if (!UUID_REGEX.test(submissionAId) || !UUID_REGEX.test(submissionBId)) {
      return new Response(JSON.stringify({ error: 'Invalid submission ID format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate winnerId if provided
    if (winnerId !== null && winnerId !== submissionAId && winnerId !== submissionBId) {
      return new Response(JSON.stringify({ error: 'winnerId must match one of the submissions or be null' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalize pair order so (A,B) and (B,A) are stored identically
    const [normalizedA, normalizedB] = submissionAId < submissionBId
      ? [submissionAId, submissionBId]
      : [submissionBId, submissionAId];

    // Calculate challenge date server-side (voting is always for yesterday's submissions)
    const challengeDate = getYesterdayDateUTC();
    const todayDate = getTodayDateUTC();

    // Create service role client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Calculate requiredVotes server-side based on submissions from other users
    const { count: otherSubmissionCount, error: countError } = await supabaseAdmin
      .from('submissions')
      .select('*', { count: 'exact', head: true })
      .eq('challenge_date', challengeDate)
      .neq('user_id', user.id);

    if (countError) throw countError;
    const requiredVotes = calculateRequiredVotes(otherSubmissionCount ?? 0);

    // Record the comparison (using normalized order for consistent uniqueness)
    const { error: comparisonError } = await supabaseAdmin.from('comparisons').insert({
      voter_id: user.id,
      challenge_date: challengeDate,
      submission_a_id: normalizedA,
      submission_b_id: normalizedB,
      winner_id: winnerId,
    });

    if (comparisonError) {
      // Check if it's a duplicate vote
      if (comparisonError.code === '23505') {
        return new Response(JSON.stringify({ error: 'Already voted on this pair' }), {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw comparisonError;
    }

    // If not skipped, update Elo scores
    if (winnerId) {
      // Get current ratings (use normalized IDs for lookup)
      const { data: rankings, error: rankingsError } = await supabaseAdmin
        .from('daily_rankings')
        .select('submission_id, elo_score, vote_count')
        .in('submission_id', [normalizedA, normalizedB])
        .eq('challenge_date', challengeDate);

      if (rankingsError) throw rankingsError;

      const rankingA = rankings?.find((r) => r.submission_id === normalizedA);
      const rankingB = rankings?.find((r) => r.submission_id === normalizedB);

      if (rankingA && rankingB) {
        const winner = winnerId === normalizedA ? 'A' : 'B';
        const { newRatingA, newRatingB } = calculateElo(rankingA.elo_score, rankingB.elo_score, winner);

        await supabaseAdmin
          .from('daily_rankings')
          .update({ elo_score: newRatingA, vote_count: rankingA.vote_count + 1 })
          .eq('submission_id', normalizedA)
          .eq('challenge_date', challengeDate);

        await supabaseAdmin
          .from('daily_rankings')
          .update({ elo_score: newRatingB, vote_count: rankingB.vote_count + 1 })
          .eq('submission_id', normalizedB)
          .eq('challenge_date', challengeDate);
      }
    }

    // Update user voting status
    const isActualVote = winnerId !== null;

    // Get or create voting status
    const { data: existingStatus } = await supabaseAdmin
      .from('user_voting_status')
      .select('*')
      .eq('user_id', user.id)
      .eq('challenge_date', challengeDate)
      .single();

    if (existingStatus) {
      // Update existing status
      const newVoteCount = isActualVote ? existingStatus.vote_count + 1 : existingStatus.vote_count;
      const enteredRanking = newVoteCount >= requiredVotes;

      await supabaseAdmin
        .from('user_voting_status')
        .update({
          vote_count: newVoteCount,
          entered_ranking: enteredRanking,
        })
        .eq('id', existingStatus.id);

      // If user just hit 5 votes, mark their submission as included in ranking
      if (enteredRanking && !existingStatus.entered_ranking) {
        await supabaseAdmin
          .from('submissions')
          .update({ included_in_ranking: true })
          .eq('user_id', user.id)
          .eq('challenge_date', todayDate);
      }

      return new Response(
        JSON.stringify({
          success: true,
          voteCount: newVoteCount,
          requiredVotes,
          enteredRanking,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    } else {
      // Create new status
      const voteCount = isActualVote ? 1 : 0;
      const enteredRanking = voteCount >= requiredVotes;

      await supabaseAdmin.from('user_voting_status').insert({
        user_id: user.id,
        challenge_date: challengeDate,
        vote_count: voteCount,
        entered_ranking: enteredRanking,
      });

      // If entered on first vote, mark today's submission as included in ranking
      if (enteredRanking) {
        await supabaseAdmin
          .from('submissions')
          .update({ included_in_ranking: true })
          .eq('user_id', user.id)
          .eq('challenge_date', todayDate);
      }

      return new Response(
        JSON.stringify({
          success: true,
          voteCount,
          requiredVotes,
          enteredRanking,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error('Error processing vote:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
