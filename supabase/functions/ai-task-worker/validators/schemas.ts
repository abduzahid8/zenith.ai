import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// --- Shared Types ---

export const TaskTypeSchema = z.enum(['learning', 'practice', 'action', 'wellbeing']);

// --- Profile Update ---

export const ProfileUpdateOutputSchema = z.object({
    ai_focus_area: z.string().describe("A specific focus area for the user"),
    ai_confidence_score: z.number().min(0).max(1).describe("Confidence score between 0 and 1"),
    weakness_tags: z.array(z.string()).describe("List of weakness tags derived from recent performance")
});

export type ProfileUpdateOutput = z.infer<typeof ProfileUpdateOutputSchema>;

// --- Rebuild Day ---

export const RebuildDayTaskSchema = z.object({
    title: z.string(),
    type: TaskTypeSchema.optional().default('practice'),
    duration_minutes: z.number().int().positive(),
    ai_rationale: z.string().optional()
});

export const RebuildDayOutputSchema = z.array(RebuildDayTaskSchema);

export type RebuildDayOutput = z.infer<typeof RebuildDayOutputSchema>;

// --- Behavior Recalibration ---

export const BehaviorRecalibrationOutputSchema = z.object({
    new_skill_level: z.number().int().min(1).max(10).optional(),
    message: z.string()
});

export type BehaviorRecalibrationOutput = z.infer<typeof BehaviorRecalibrationOutputSchema>;

// --- Raw JSON Schemas for Gemini ---

export const ProfileUpdateJSONSchema = {
    type: "object",
    properties: {
        ai_focus_area: { type: "string" },
        ai_confidence_score: { type: "number" },
        weakness_tags: { type: "array", items: { type: "string" } }
    },
    required: ["ai_focus_area", "ai_confidence_score", "weakness_tags"]
};

export const RebuildDayJSONSchema = {
    type: "array",
    items: {
        type: "object",
        properties: {
            title: { type: "string" },
            type: { type: "string", enum: ["learning", "practice", "action", "wellbeing"] },
            duration_minutes: { type: "integer" },
            ai_rationale: { type: "string" }
        },
        required: ["title", "duration_minutes"]
    }
};

export const BehaviorRecalibrationJSONSchema = {
    type: "object",
    properties: {
        new_skill_level: { type: "integer" },
        message: { type: "string" }
    },
    required: ["message"]
};
