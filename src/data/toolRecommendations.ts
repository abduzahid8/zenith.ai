import { ToolRecommendation } from '../types/goals';

type GoalPattern = {
  keywords: RegExp[];
  label: string;
  bottleneck: string;
  recommendations: ToolRecommendation[];
};

export const GOAL_PATTERNS: GoalPattern[] = [
  {
    keywords: [/influencer/i, /outreach/i, /instagram/i, /tiktok/i, /social.*follow/i],
    label: 'Slowest part: finding & contacting accounts',
    bottleneck: 'Manual search and DM copy-paste takes hours. Most accounts never respond because outreach isn\'t personalized.',
    recommendations: [
      {
        name: 'Apollo.io',
        description: 'Search 275M+ contacts with filters. One-click sequences with personalization variables.',
        category: 'discovery',
        cost: 'medium',
        setup: 'hours',
        effort: 'low',
        url: 'https://apollo.io',
        reason: 'Huge database, strong filters, built-in sequence automation — best ROI for volume outreach.',
      },
      {
        name: 'PhantomBuster',
        description: 'Automate profile visits, DMs, and follow-ups on Instagram/LinkedIn without API limits.',
        category: 'outreach',
        cost: 'low',
        setup: 'minutes',
        effort: 'none',
        url: 'https://phantombuster.com',
        reason: 'Cheapest entry to DM automation. No coding. Runs in cloud (no downtime).',
      },
      {
        name: 'Manual: filtered search + spreadsheet',
        description: 'Use platform search filters + manual copy-paste into a tracker. Full control, zero cost.',
        category: 'discovery',
        cost: 'free',
        setup: 'instant',
        effort: 'high',
        reason: 'Best for hyper-targeted niches where automation tools don\'t have enough data.',
      },
    ],
  },
  {
    keywords: [/lead/i, /client/i, /customer/i, /sales/, /pipeline/i, /b2b/i],
    label: 'Slowest part: finding & qualifying leads',
    bottleneck: 'Scrolling through platforms looking for leads is slow. Most prospects don\'t match your ideal profile.',
    recommendations: [
      {
        name: 'Clay.com',
        description: 'Enrich and score leads with 50+ data sources. Waterfall enrichment fills missing fields automatically.',
        category: 'discovery',
        cost: 'medium',
        setup: 'hours',
        effort: 'low',
        url: 'https://clay.com',
        reason: 'Best for qualifying — enriches raw lists with firmographic + technographic data before outreach.',
      },
      {
        name: 'Warmly',
        description: 'Identifies companies visiting your site and surfaces decision-makers. Free tier available.',
        category: 'analytics',
        cost: 'free',
        setup: 'minutes',
        effort: 'low',
        url: 'https://warmly.ai',
        reason: 'Zero-effort lead gen from existing traffic — catches intent signals automatically.',
      },
      {
        name: 'Manual: LinkedIn Sales Navigator',
        description: 'Advanced search filters + saved lists. Export to CSV for manual outreach.',
        category: 'discovery',
        cost: 'high',
        setup: 'minutes',
        effort: 'medium',
        reason: 'Best quality filters for B2B. Export + manual outreach keeps costs down.',
      },
    ],
  },
  {
    keywords: [/landing page/i, /website/i, /launch/i, /product.*page/, /waitlist/i],
    label: 'Slowest part: building & iterating the page',
    bottleneck: 'Design + copy + hosting setup takes days. Each iteration is slow without a builder.',
    recommendations: [
      {
        name: 'Framer',
        description: 'Visual landing page builder. AI copywriting built in. Publish to .com in 2 hours.',
        category: 'content',
        cost: 'low',
        setup: 'hours',
        effort: 'low',
        url: 'https://framer.com',
        reason: 'Fastest way from idea to live page. AI generates copy and layout from a brief.',
      },
      {
        name: 'Carrd',
        description: 'Single-page site builder. $19/year. Simple, fast, no maintenance.',
        category: 'content',
        cost: 'free',
        setup: 'minutes',
        effort: 'low',
        url: 'https://carrd.co',
        reason: 'Cheapest option for a one-page MVP. Insanely fast to set up.',
      },
      {
        name: 'Manual: Webflow cloneable + custom domain',
        description: 'Clone a free landing page template. Full design control, no code. Free tier available.',
        category: 'content',
        cost: 'free',
        setup: 'hours',
        effort: 'medium',
        reason: 'Best when you need custom branding and CMS capabilities later.',
      },
    ],
  },
  {
    keywords: [/content/i, /write.*post/i, /blog/i, /social.*post/i, /newsletter/i],
    label: 'Slowest part: writing & formatting every post',
    bottleneck: 'Writing each piece from scratch takes 1-2 hours. Consistency drops because it\'s exhausting.',
    recommendations: [
      {
        name: 'Lex.page',
        description: 'AI writing assistant designed for long-form. Typewriter-style, no formatting friction.',
        category: 'content',
        cost: 'free',
        setup: 'instant',
        effort: 'low',
        url: 'https://lex.page',
        reason: 'Best for writing quality. AI suggestions feel like a co-writer, not a generator.',
      },
      {
        name: 'Buffer + Canva',
        description: 'Schedule posts across platforms. Canva for visuals. Both have generous free tiers.',
        category: 'automation',
        cost: 'free',
        setup: 'minutes',
        effort: 'medium',
        url: 'https://buffer.com',
        reason: 'Free combo covers 95% of content publishing needs. Buffer queues, Canva designs.',
      },
      {
        name: 'Manual: Notion templates + batch writing',
        description: 'Create a template, write 5 posts in one sitting, schedule manually. Zero cost, full control.',
        category: 'content',
        cost: 'free',
        setup: 'instant',
        effort: 'high',
        reason: 'Best for writers who want authentic voice without AI-generated feel.',
      },
    ],
  },
  {
    keywords: [/email/i, /newsletter/i, /mail/i, /subscriber/i],
    label: 'Slowest part: writing & sending individual emails',
    bottleneck: 'Writing each email one-by-one. No autoresponder, no templates, no analytics.',
    recommendations: [
      {
        name: 'MailerLite',
        description: 'Drag-drop email builder. Autoresponders, forms, landing pages. Free up to 1k subscribers.',
        category: 'automation',
        cost: 'free',
        setup: 'minutes',
        effort: 'low',
        url: 'https://mailerlite.com',
        reason: 'Best free tier. Autoresponders and segmentation included. Scales cheaply.',
      },
      {
        name: 'ConvertKit',
        description: 'Creator-focused email platform. Tags, automation, and subscriber scoring. $0-9/mo starter.',
        category: 'automation',
        cost: 'low',
        setup: 'minutes',
        effort: 'low',
        url: 'https://convertkit.com',
        reason: 'Better than MailerLite for audience-building. Tag-based automation is powerful.',
      },
      {
        name: 'Manual: Gmail + Sheets + Mail Merge',
        description: 'Use Gmail with a mail-merge add-on. Free, full control, but no automation beyond sequences.',
        category: 'automation',
        cost: 'free',
        setup: 'hours',
        effort: 'high',
        reason: 'Zero cost, works with existing Gmail. Good for testing before committing to a platform.',
      },
    ],
  },
  {
    keywords: [/research/i, /data.*collect/i, /survey/i, /market.*research/i, /competitor/i],
    label: 'Slowest part: gathering & organizing information',
    bottleneck: 'Opening 20 tabs, copy-pasting into a doc. Data gets stale fast and is hard to organize.',
    recommendations: [
      {
        name: 'Bardeen.ai',
        description: 'No-code automation for web research. Scrape, enrich, and write to Sheets in one click.',
        category: 'automation',
        cost: 'free',
        setup: 'minutes',
        effort: 'none',
        url: 'https://bardeen.ai',
        reason: 'Fastest way to turn manual copy-paste into one-click automation. Free tier works well.',
      },
      {
        name: 'SimilarWeb',
        description: 'Competitor traffic, keywords, and audience insights. Free tier covers top-level data.',
        category: 'analytics',
        cost: 'free',
        setup: 'instant',
        effort: 'none',
        url: 'https://similarweb.com',
        reason: 'Instant competitor intel without any setup. Type a URL, get traffic data.',
      },
      {
        name: 'Manual: Google Sheets + IMPORTXML',
        description: 'Use IMPORTXML/IMPORTHTML functions to pull live data into sheets. Free, technical setup.',
        category: 'data',
        cost: 'free',
        setup: 'hours',
        effort: 'high',
        reason: 'Most flexible. You control exactly what data you collect and how it\'s structured.',
      },
    ],
  },
];

export function findPatterns(description: string): GoalPattern[] {
  const lower = description.toLowerCase();
  return GOAL_PATTERNS.filter(p =>
    p.keywords.some(kw => kw.test(lower))
  );
}

export function getRecommendations(description: string): {
  label: string;
  bottleneck: string;
  recommendations: ToolRecommendation[];
} | null {
  const patterns = findPatterns(description);
  if (patterns.length === 0) return null;

  const best = patterns.reduce((a, b) => {
    const aScore = a.keywords.filter(kw => kw.test(description.toLowerCase())).length;
    const bScore = b.keywords.filter(kw => kw.test(description.toLowerCase())).length;
    return bScore > aScore ? b : a;
  });

  return {
    label: best.label,
    bottleneck: best.bottleneck,
    recommendations: best.recommendations,
  };
}
