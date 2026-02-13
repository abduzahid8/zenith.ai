// Supabase Edge Function: AI Task Worker
// Processes background AI jobs: profile updates, daily rebuilds, behavior recalibration
// Deploy: npx supabase functions deploy ai-task-worker

import { createClient } from 'jsr:@supabase/supabase-js@2'

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const GEMINI_MODEL = 'gemini-1.5-flash';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── Gemini Helper ────────────────────────────────────────

async function callGemini(
    prompt: string,
    systemPrompt: string,
    temperature = 0.5
): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [
                { role: 'user', parts: [{ text: systemPrompt + '\n\n' + prompt }] }
            ],
            generationConfig: { temperature, maxOutputTokens: 1000 },
        }),
    });

    if (!response.ok) throw new Error(`Gemini API Error: ${response.statusText}`);

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
}

function parseJson(text: string): any {
    try {
        return JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch {
        return {};
    }
}

// ── Job Handlers ─────────────────────────────────────────

async function handleProfileUpdate(supabase: any, job: any) {
    // 1. Fetch user data
    const { data: snapshot } = await supabase.from('user_state_snapshot').select('*').eq('user_id', job.user_id).single();
    const { data: recentTasks } = await supabase.from('tasks').select('*').eq('user_id', job.user_id).order('created_at', { ascending: false }).limit(20);

    // 2. Analyze with AI
    const prompt = `Current Snapshot: ${JSON.stringify(snapshot)}
Recent Tasks: ${JSON.stringify(recentTasks)}

Analyze the user's recent performance. 
- Identify a new focus area (e.g., "Endgame tactics", "Color consistency", "Focus endurance").
- Calculate a confidence score (0.0 - 1.0).
- Suggest weakness tags to add/remove.

Return JSON: {"ai_focus_area": string, "ai_confidence_score": number, "weakness_tags": string[]}`;

    const raw = await callGemini(prompt, 'You are a chess/hobby coach analyst. Output strict JSON.');
    const result = parseJson(raw);

    // 3. Update Snapshot
    await supabase.from('user_state_snapshot').upsert({
        user_id: job.user_id,
        ai_focus_area: result.ai_focus_area || snapshot.ai_focus_area,
        ai_confidence_score: result.ai_confidence_score || 0.8,
        weakness_tags: result.weakness_tags || snapshot.weakness_tags || [],
        last_ai_update_at: new Date().toISOString()
    });

    return result;
}

async function handleRebuildDay(supabase: any, job: any) {
    // 1. Fetch current tasks and snapshot
    const today = new Date().toISOString().split('T')[0];
    const { data: tasks } = await supabase.from('tasks').select('*').eq('user_id', job.user_id).eq('scheduled_date', today);
    const { data: snapshot } = await supabase.from('user_state_snapshot').select('*').eq('user_id', job.user_id).single();

    // 2. Generate new tasks
    const prompt = `User Snapshot: ${JSON.stringify(snapshot)}
Current Tasks: ${JSON.stringify(tasks)}
Reason: User has low completion rate or requested a rebuild.

Generate 2 replacement tasks that are easier or more engaging (recovery mode).
Return JSON array of tasks: [{"title": string, "type": "learning|practice", "duration_minutes": number, "ai_rationale": string}]`;

    const raw = await callGemini(prompt, 'You are a supportive coach. Output strict JSON array.');
    const newTasksData = parseJson(raw);

    if (Array.isArray(newTasksData) && newTasksData.length > 0) {
        // 3. Mark old pending tasks as replaced
        await supabase.from('tasks')
            .update({ status: 'replaced' })
            .eq('user_id', job.user_id)
            .eq('scheduled_date', today)
            .eq('status', 'pending');

        // 4. Insert new tasks
        const tasksToInsert = newTasksData.map((t: any) => ({
            user_id: job.user_id,
            title: t.title,
            type: t.type || 'practice',
            status: 'pending',
            scheduled_date: today,
            duration_minutes: t.duration_minutes || 10,
            is_ai_generated: true,
            ai_rationale: t.ai_rationale
        }));

        await supabase.from('tasks').insert(tasksToInsert);
    }

    return { replaced_count: tasks?.length, new_count: newTasksData.length };
}

async function handleBehaviorRecalibration(supabase: any, job: any) {
    // 1. Fetch snapshot
    const { data: snapshot } = await supabase.from('user_state_snapshot').select('*').eq('user_id', job.user_id).single();

    // 2. Decide on recalibration
    const prompt = `Snapshot: ${JSON.stringify(snapshot)}
User has missed days or is struggling.
Suggest a new difficulty level (1-10) and a motivating message.
Return JSON: {"new_skill_level": number, "message": string}`;

    const raw = await callGemini(prompt, 'You are a behavioral psychologist. Output strict JSON.');
    const result = parseJson(raw);

    // 3. Update snapshot
    if (result.new_skill_level) {
        await supabase.from('user_state_snapshot').update({
            skill_level: result.new_skill_level,
            ai_focus_area: result.message // Store message as focus area or separate field? storing here for now as notification isn't set up
        }).eq('user_id', job.user_id);
    }

    // 4. Optionally create a notification (if table exists/is used)

    return result;
}

// ── Main Handler ─────────────────────────────────────────

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { jobId } = await req.json();

        if (!jobId) throw new Error('Missing jobId');

        // 1. Get Job
        const { data: job, error: jobError } = await supabase.from('ai_jobs').select('*').eq('id', jobId).single();
        if (jobError || !job) throw new Error('Job not found');

        // 2. Set Status to Processing
        await supabase.from('ai_jobs').update({ status: 'processing', started_at: new Date() }).eq('id', jobId);

        // 3. Process
        let result = {};
        if (job.type === 'PROFILE_UPDATE') {
            result = await handleProfileUpdate(supabase, job);
        } else if (job.type === 'REBUILD_DAY') {
            result = await handleRebuildDay(supabase, job);
        } else if (job.type === 'BEHAVIOR_RECALIBRATION') {
            result = await handleBehaviorRecalibration(supabase, job);
        }

        // 4. Set Status to Completed
        await supabase.from('ai_jobs').update({
            status: 'completed',
            finished_at: new Date(),
            result_json: result
        }).eq('id', jobId);

        return new Response(JSON.stringify({ success: true, result }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Worker Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
