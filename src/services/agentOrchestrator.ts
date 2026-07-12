import { GoalDefinition, GoalProgress, DailyGoalContent, StepInstruction, BuiltAsset, DailyPlan } from '../types/goals';
import { computeDailyFocus } from './dailyFocusEngine';
import aiService from './ai';

// ───── Step generation ─────

function generateSteps(
  goal: GoalDefinition,
  progress: GoalProgress,
  content: DailyGoalContent | null,
  focusReason: string,
): StepInstruction[] {
  const steps: StepInstruction[] = [];

  if (content?.learn?.title) {
    steps.push({
      step: 1, type: 'learn', assetRefs: [],
      title: content.learn.title,
      description: content.learn.body?.substring(0, 120) || 'Understand the key concept.',
      duration: '5 min',
    });
  } else {
    steps.push({
      step: 1, type: 'learn', assetRefs: [],
      title: 'Review your goal',
      description: goal.description.substring(0, 80),
      duration: '3 min',
    });
  }

  if (content?.doNow?.title) {
    steps.push({
      step: 2, type: 'practice', assetRefs: [],
      title: content.doNow.title,
      description: content.doNow.instructions?.substring(0, 120) || 'Complete the hands-on exercise.',
      duration: `${content.doNow.estimatedMinutes || 10} min`,
    });
  } else {
    steps.push({
      step: 2, type: 'practice', assetRefs: [],
      title: `${Math.round((progress.currentValue / Math.max(1, goal.target)) * 100)}% to goal — keep going`,
      description: `Current: ${progress.currentValue} / ${goal.target} ${goal.unitLabel || 'units'}`,
      duration: '10 min',
    });
  }

  steps.push({
    step: 3, type: 'review', assetRefs: [],
    title: 'Review what was built for you',
    description: 'Check the assets the system prepared to support your goal.',
    duration: '3 min',
  });

  steps.push({
    step: 4, type: 'log', assetRefs: [],
    title: 'Log your progress',
    description: `Mark today as done and extend your streak to ${progress.streak + 1} days.`,
    duration: '1 min',
  });

  return steps;
}

// ───── Asset generation ─────

async function generateAssets(
  goal: GoalDefinition,
  progress: GoalProgress,
  content: DailyGoalContent | null,
  focusReason: string,
): Promise<BuiltAsset[]> {
  const assets: BuiltAsset[] = [];
  const hobby = goal.hobby || 'general';
  const dayNum = progress.history.length + 1;

  // 1. Research asset — use AI if available, else fallback
  try {
    const learnTitle = content?.learn?.title || goal.description;
    const learnBody = content?.learn?.body || '';
    const researchPrompt = `Summarize key information about "${learnTitle}" for a ${hobby} learner. Keep it under 100 words. Context: ${learnBody.substring(0, 200)}`;

    let researchContent: string;
    try {
      const aiResult = await aiService.sendMessage([
        { role: 'system', content: 'You are a research assistant. Provide concise, actionable summaries.' },
        { role: 'user', content: researchPrompt },
      ], hobby);
      researchContent = aiResult;
    } catch {
      researchContent = learnBody?.substring(0, 150) || `Key concepts related to "${learnTitle}" for ${hobby}.`;
    }

    assets.push({
      id: `research-${dayNum}`,
      type: 'research',
      title: `${learnTitle} — Research Summary`,
      description: researchContent.substring(0, 100),
      content: researchContent,
      action: 'Read',
      supportsStep: 1,
    });
  } catch {
    // fallback — skip research asset
  }

  // 2. Code / template asset (for coding/technical goals)
  if (hobby === 'coding' || hobby === 'python') {
    const taskTitle = content?.doNow?.title || 'practice exercise';
    const codeTemplate = generateCodeTemplate(taskTitle, hobby);
    assets.push({
      id: `code-${dayNum}`,
      type: 'code',
      title: `${taskTitle} — Starter Code`,
      description: `Ready-to-run template for today's ${hobby} exercise.`,
      content: codeTemplate,
      action: 'Open',
      supportsStep: 2,
    });
  }

  // 3. Summary asset — extract key points from daily content
  if (content?.learn?.body) {
    const bodyLines = content.learn.body.split(/[.!?]+\s*/).filter(s => s.trim().length > 0);
    const summary = bodyLines.slice(0, 3).join('. ') + '.';
    assets.push({
      id: `summary-${dayNum}`,
      type: 'summary',
      title: `Day ${dayNum} — Key Points`,
      description: summary.substring(0, 100),
      content: summary,
      action: 'Review',
      supportsStep: 1,
    });
  }

  // 4. Deployment / config asset (for deployment-type goals)
  if (hobby === 'coding' || goal.category === 'execution') {
    assets.push({
      id: `deploy-${dayNum}`,
      type: 'deployment',
      title: 'Build Configuration',
      description: `Auto-generated config for your ${hobby} project.`,
      action: 'Deploy',
      supportsStep: 2,
    });
  }

  return assets;
}

function generateCodeTemplate(title: string, hobby: string): string {
  if (hobby === 'python') {
    return `# ${title}\n\ndef main():\n    # TODO: implement\n    pass\n\nif __name__ == '__main__':\n    main()\n`;
  }
  return `// ${title}\n\nfunction main() {\n  // TODO: implement\n}\n\nmain();\n`;
}

// ───── Main orchestrator ─────

export async function orchestrateDailyPlan(
  goal: GoalDefinition,
  progress: GoalProgress,
  content: DailyGoalContent | null,
): Promise<DailyPlan> {
  const todayStr = new Date().toISOString().split('T')[0];
  const focusResult = computeDailyFocus({ goal, progress, todayStr });
  const focusReason = content?.focusReason || focusResult.reason;

  const steps = generateSteps(goal, progress, content, focusReason);

  const [assets] = await Promise.all([
    generateAssets(goal, progress, content, focusReason),
  ]);

  // ── Wire bidirectional links between steps and assets ──
  for (const asset of assets) {
    const step = steps.find(s => s.step === asset.supportsStep);
    if (step && !step.assetRefs.includes(asset.id)) {
      step.assetRefs.push(asset.id);
    }
  }

  // Update step 3 (review) description to list all assets
  const reviewStep = steps.find(s => s.type === 'review');
  if (reviewStep && assets.length > 0) {
    reviewStep.description = `Review ${assets.length} asset(s): ${assets.map(a => a.title).join(' › ')}`;
    reviewStep.assetRefs = assets.map(a => a.id);
  }

  return { steps, assets, focusReason };
}
