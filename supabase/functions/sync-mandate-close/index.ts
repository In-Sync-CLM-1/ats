import { createSupabaseClient } from '../_shared/supabase-client.ts';
import { corsHeaders } from '../_shared/cors-headers.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mandateId } = await req.json();

    if (!mandateId) {
      return new Response(JSON.stringify({ error: 'mandateId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createSupabaseClient();

    // Find all candidates linked to this mandate
    const { data: candidates, error: candidatesError } = await supabase
      .from('candidates')
      .select('*')
      .eq('matched_mandate_id', mandateId);

    if (candidatesError) {
      throw candidatesError;
    }

    let synced = 0;
    let errors = 0;

    // Sync each candidate back to master
    for (const candidate of candidates || []) {
      try {
        // Update master with latest information
        const { error: updateError } = await supabase
          .from('master')
          .update({
            latest_disposition: candidate.latest_disposition,
            latest_subdisposition: candidate.latest_subdisposition,
            recruitment_status: 'unassigned', // Reset to unassigned
            interview_feedback: candidate.interview_feedback,
            interview_stage: candidate.interview_stage,
            internal_notes: candidate.internal_notes,
            // Important: Do NOT sync assigned_recruiter, assigned_by, assigned_at
            matched_mandate_id: null, // Clear the match
            match_score: null,
            matched_at: null,
            match_source: null,
          })
          .eq('phone', candidate.phone);

        if (updateError) {
          console.error(`Error syncing candidate ${candidate.id}:`, updateError);
          errors++;
        } else {
          synced++;
        }

        // Delete from candidates table
        await supabase
          .from('candidates')
          .delete()
          .eq('id', candidate.id);

      } catch (error) {
        console.error(`Error processing candidate ${candidate.id}:`, error);
        errors++;
      }
    }

    // Archive mandate_candidates records
    await supabase
      .from('mandate_candidates')
      .update({ status: 'archived' })
      .eq('mandate_id', mandateId);

    return new Response(
      JSON.stringify({
        message: 'Mandate closed and candidates synced',
        synced,
        errors,
        total: candidates?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in sync-mandate-close:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
