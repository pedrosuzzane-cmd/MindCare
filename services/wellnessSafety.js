const HIGH_RISK_PATTERNS = [
  "kill myself",
  "i want to die",
  "i want to kill myself",
  "i want to end my life",
  "i want to disappear forever",
  "i don't want to live",
  "i dont want to live",
  "i do not want to live",
  "i don't want to be alive",
  "i dont want to be alive",
  "i feel like dying",
  "i feel like i am dying",
  "i wish i was dead",
  "i wish i wouldn't wake up",
  "i can't go on",
  "i cant go on",
  "i don't think i can keep going",
  "i dont think i can keep going",
  "i have been cutting myself",
  "i am cutting myself",
  "i have been hurting myself",
  "i am hurting myself",
  "i have hurt myself",
  "i am thinking about suicide",
  "i am thinking about killing myself",
  "i am thinking of suicide",
  "i am thinking of ending my life",
  "i want to die tonight",
  "i want to kill me",
  "suicide",
  "end my life",
  "self harm",
  "self-harm",
  "hurt myself",
  "harming myself",
  "cutting myself",
  "overdose",
  "no reason to live",
  "better off dead",
  "no reason to be here",
  "life isn't worth living",
  "life is not worth living",
  "i am not sure i can keep going",
  "i don't care if i wake up",
  "i dont care if i wake up",
  "i wish i could disappear",
  "i want everything to end",
  "i think about dying all the time",
  "i want to vanish forever",
  "i want to disappear",
  "i can not go on",
  "i cannot go on",
];

const SELF_HARM_CONTEXT_PATTERNS = [
  "cut myself",
  "cutting myself",
  "hurt myself",
  "harming myself",
  "kill myself",
  "want to die",
  "end my life",
  "dont want to live",
  "don't want to live",
  "wish i was dead",
  "wish i wouldn't wake up",
  "can't go on",
  "cant go on",
  "better off dead",
  "no reason to live",
];

const MODERATE_PATTERNS = [
  "i feel hopeless",
  "i am hopeless",
  "i feel worthless",
  "i am worthless",
  "i feel empty",
  "i am empty",
  "nothing matters",
  "no one understands",
  "nobody understands",
  "i feel trapped",
  "i don't want to be here",
  "i dont want to be here",
  "i don't want to wake up",
  "i dont want to wake up",
  "i don't know how to keep going",
  "i dont know how to keep going",
  "i don't know what to do with myself",
  "i dont know what to do with myself",
  "i am not sure i can keep going",
  "i can't keep going",
  "i cant keep going",
];

const POSITIVE_PATTERNS = [
  "finished my assignment",
  "productive day",
  "proud of myself",
  "feeling better",
  "good day",
  "felt calm",
  "accomplished",
  "i did well",
  "i finally finished",
  "i am proud",
  "i feel supported",
  "i had a good day",
  "productive day and finished",
];

const ACADEMIC_PATTERNS = [
  "deadline",
  "assignments due",
  "overwhelmed by school",
  "exams",
  "study stress",
  "three deadlines",
  "can't keep up with class",
  "behind on work",
  "stress from school",
  "overloaded with work",
  "academic pressure",
  "finals",
  "midterm",
  "essay due",
  "project due",
  "overwhelmed",
  "too much work",
];

const ANXIETY_PATTERNS = [
  "anxious",
  "panic",
  "worried",
  "nervous",
  "racing thoughts",
  "can't stop worrying",
  "mental pressure",
  "anxiety",
  "exam anxiety",
  "overthinking",
  "constant worry",
  "worrying about my exam",
  "worrying",
];

const SADNESS_PATTERNS = [
  "sad",
  "down",
  "crying",
  "upset",
  "miserable",
  "grief",
  "miss my grandma",
  "my grandmother died",
  "i miss them",
  "feeling low",
  "tears",
  "hurt",
  "i miss her",
  "i miss him",
];

const LONELINESS_PATTERNS = [
  "alone",
  "lonely",
  "isolated",
  "no one to talk to",
  "nobody to talk to",
  "i feel alone at university",
  "i don't feel connected",
  "i feel disconnected",
  "i have no support",
  "i feel really alone",
  "i feel so alone",
  "i don't have anyone",
  "i dont have anyone",
];

const ANGER_PATTERNS = [
  "angry",
  "furious",
  "irritated",
  "frustrated",
  "mad",
  "annoyed",
  "rage",
  "boiling",
  "fed up",
];

const RELATIONSHIP_PATTERNS = [
  "relationship",
  "breakup",
  "boyfriend",
  "girlfriend",
  "conflict with my partner",
  "argument with my partner",
  "relationship stress",
  "family conflict",
  "friend conflict",
  "fighting with my friend",
  "argument with my friend",
];

const SLEEP_PATTERNS = [
  "can't sleep",
  "cant sleep",
  "sleep deprivation",
  "not sleeping",
  "insomnia",
  "tired",
  "exhausted",
  "barely slept",
  "woke up too early",
  "trouble sleeping",
  "can t sleep",
];

const MOTIVATION_PATTERNS = [
  "unmotivated",
  "lack motivation",
  "can't focus",
  "cant focus",
  "burnout",
  "no energy",
  "difficulty getting started",
  "procrastinating",
  "drained",
  "low drive",
];

const GENERAL_WELLNESS_PATTERNS = [
  "feeling okay",
  "balanced",
  "ready for the week",
  "calm",
  "doing better",
  "i am managing",
  "coping",
  "trying to take care of myself",
  "recovery",
  "taking care of myself",
];

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function matchesText(normalizedText, patterns) {
  if (!normalizedText) return [];
  const matches = [];
  for (const pattern of patterns) {
    const normalizedPattern = normalizeText(pattern);
    if (!normalizedPattern) continue;
    if (
      normalizedText.includes(normalizedPattern) ||
      normalizedText.includes(normalizedPattern.replace(/\s+/g, ""))
    ) {
      matches.push(pattern);
    }
  }
  return matches;
}

function hasDirectSelfReference(normalizedText) {
  return /(\bi\b|\bme\b|\bmy\b|\bmyself\b|\bi'm\b|\bi am\b|\bim\b)/.test(
    normalizedText,
  );
}

function determineSafetyLevel(text, matches) {
  if (!text || !text.trim()) return "none";
  const normalized = normalizeText(text);

  if (
    matches.includes("suicide") ||
    matches.includes("self harm") ||
    matches.includes("self-harm")
  ) {
    return "high";
  }

  const directRisk = HIGH_RISK_PATTERNS.filter((pattern) => {
    const normalizedPattern = normalizeText(pattern);
    if (!normalizedPattern) return false;
    const directMatch = normalized.includes(normalizedPattern);
    return (
      directMatch &&
      (hasDirectSelfReference(normalized) ||
        normalizedPattern.includes("myself") ||
        normalizedPattern.includes("my life") ||
        normalizedPattern.includes("i ") ||
        normalizedPattern.startsWith("kill") ||
        normalizedPattern.startsWith("want"))
    );
  });

  if (directRisk.length > 0) return "high";

  const moderateRisk = matchesText(normalized, MODERATE_PATTERNS);
  if (moderateRisk.length > 0) return "moderate";

  return "none";
}

function classifyContext(normalizedText) {
  const highRiskMatches = matchesText(normalizedText, HIGH_RISK_PATTERNS);
  if (highRiskMatches.length > 0) {
    return "self_harm";
  }

  const positiveMatches = matchesText(normalizedText, POSITIVE_PATTERNS);
  if (positiveMatches.length > 0) {
    return "positive";
  }

  const scoreMap = {
    academic_stress: matchesText(normalizedText, ACADEMIC_PATTERNS).length,
    anxiety: matchesText(normalizedText, ANXIETY_PATTERNS).length,
    loneliness: matchesText(normalizedText, LONELINESS_PATTERNS).length,
    sadness: matchesText(normalizedText, SADNESS_PATTERNS).length,
    anger: matchesText(normalizedText, ANGER_PATTERNS).length,
    relationship: matchesText(normalizedText, RELATIONSHIP_PATTERNS).length,
    sleep: matchesText(normalizedText, SLEEP_PATTERNS).length,
    motivation: matchesText(normalizedText, MOTIVATION_PATTERNS).length,
    general_wellness: matchesText(normalizedText, GENERAL_WELLNESS_PATTERNS)
      .length,
    positive: positiveMatches.length,
  };

  const ranked = Object.entries(scoreMap).sort(([, a], [, b]) => b - a);
  const topCategory = ranked[0];
  if (topCategory && topCategory[1] > 0) {
    return topCategory[0];
  }

  return "unknown";
}

function classifyWellnessText(inputText) {
  const text = String(inputText || "");
  const normalized = normalizeText(text);
  if (!normalized) {
    return {
      context: "unknown",
      safetyLevel: "none",
      matches: [],
      requiresSafetyResponse: false,
      safetyCategory: "none",
    };
  }

  const possibleHighRisk = matchesText(normalized, HIGH_RISK_PATTERNS);
  const directSelfHarm = matchesText(normalized, SELF_HARM_CONTEXT_PATTERNS);

  const highRiskMatches =
    possibleHighRisk.length > 0 ? possibleHighRisk : directSelfHarm;
  if (
    highRiskMatches.length > 0 &&
    determineSafetyLevel(text, highRiskMatches) === "high"
  ) {
    return {
      context: "self_harm",
      safetyLevel: "high",
      matches: [...new Set(highRiskMatches)],
      requiresSafetyResponse: true,
      safetyCategory: "crisis",
    };
  }

  const moderateMatches = matchesText(normalized, MODERATE_PATTERNS);
  if (
    moderateMatches.length > 0 &&
    determineSafetyLevel(text, moderateMatches) === "moderate"
  ) {
    return {
      context: "unknown",
      safetyLevel: "moderate",
      matches: [...new Set(moderateMatches)],
      requiresSafetyResponse: true,
      safetyCategory: "severe_distress",
    };
  }

  const context = classifyContext(normalized);

  return {
    context,
    safetyLevel: "none",
    matches: [],
    requiresSafetyResponse: false,
    safetyCategory: "none",
  };
}

const AFFECTIVE_CONTEXT_PATTERNS = [
  ...POSITIVE_PATTERNS,
  ...ACADEMIC_PATTERNS,
  ...ANXIETY_PATTERNS,
  ...SADNESS_PATTERNS,
  ...LONELINESS_PATTERNS,
  ...ANGER_PATTERNS,
  ...RELATIONSHIP_PATTERNS,
  ...SLEEP_PATTERNS,
  ...MOTIVATION_PATTERNS,
  ...GENERAL_WELLNESS_PATTERNS,
];

const WELLNESS_INSIGHTS = {
  academic_stress: [
    "Your entry suggests academic pressure. Breaking your workload into smaller tasks may make the situation feel more manageable.",
    "You seem to be carrying a lot of pressure right now. Focusing on one assignment or deadline at a time can help reduce overwhelm.",
    "Your entry suggests school stress is weighing on you. Setting a clear next step can help turn a heavy workload into something manageable.",
  ],
  anxiety: [
    "Your entry suggests anxiety is active right now. A short grounding exercise and focusing on one manageable task may help lower the intensity.",
    "You seem to be carrying a lot of worry. Pausing for a few slow breaths and naming the next smallest step may help create steadiness.",
    "Your entry suggests exam or worry-related stress. A brief reset and a short plan for the next hour may help your mind feel less crowded.",
  ],
  loneliness: [
    "Your entry suggests feelings of loneliness. Reaching out to someone you trust or connecting with a supportive person on campus may help you feel less isolated.",
    "You seem to be feeling disconnected. A small outreach to a friend, classmate, or guidance counselor could help create more support.",
    "Your entry points to loneliness. Even a brief check-in with one trusted person may help reduce the feeling of carrying this alone.",
  ],
  sadness: [
    "Your entry suggests sadness or grief. Giving yourself permission to feel that loss and lean on support can make the weight a little more manageable.",
    "What you shared sounds heavy. Acknowledging the pain without judgment is a gentle first step, and support from someone safe may help.",
    "Your entry suggests emotional pain. Taking a moment to rest, reflect, and reach out to someone you trust may help you feel less alone with it.",
  ],
  anger: [
    "Your entry suggests frustration or anger. Finding a short way to release that energy safely may help you feel less stuck.",
    "You seem to be carrying a strong feeling of frustration. A brief reset or a direct conversation about what triggered it may help you process it.",
    "Your entry points to a strong emotional reaction. Taking a pause and naming what you need right now may help you regain some control.",
  ],
  relationship: [
    "Your entry suggests relationship stress. Talking through what feels hardest and naming what support you need may help bring clarity.",
    "This sounds like a relationship challenge. A grounded conversation or a moment to sort what is within your control may help.",
    "Your entry points to interpersonal stress. It may help to pause, reflect, and decide what kind of support or boundaries you need right now.",
  ],
  sleep: [
    "Your entry suggests sleep or energy strain. A calmer evening routine and reducing stimulation may help your body settle.",
    "You seem to be carrying a lot of fatigue. Prioritizing a small reset and a more restful wind-down could help.",
    "Your entry suggests exhaustion or sleep disruption. A gentler routine and reducing pressure on your mind may help your body recover.",
  ],
  motivation: [
    "Your entry suggests low motivation or burnout. Starting with the smallest next action may make the task feel less overwhelming.",
    "You seem to be struggling to find momentum. A short, manageable first step can help create a sense of progress without pressure.",
    "Your entry points to low energy or focus. Aim for one tiny, realistic step rather than a big reset.",
  ],
  positive: [
    "You seem to be recognizing a meaningful accomplishment today. Taking a moment to acknowledge that progress can reinforce positive habits.",
    "Your entry suggests a strong sense of growth or progress. Noticing what went well can help build momentum and confidence.",
    "You appear to be noticing something healthy and meaningful in your day. Acknowledging that progress can support steadiness going forward.",
  ],
  general_wellness: [
    "Your entry suggests you are assessing your overall wellbeing. A gentle check-in with yourself and one small supportive action may help keep things steady.",
    "You seem to be paying attention to how you are doing. A small step toward rest, connection, or balance may support your wellbeing.",
    "Your entry suggests a general sense of self-reflection. Checking in with what will help you feel supported today is a good next move.",
  ],
};

function getWellnessInsightForContext(context) {
  const arr = WELLNESS_INSIGHTS[context] || WELLNESS_INSIGHTS.general_wellness;
  return arr[Math.floor(Math.random() * arr.length)];
}

function getSafetyResponse(context) {
  const base =
    "I'm really sorry you're going through this. What you've shared sounds serious, and you don't have to handle it alone.";
  const followUp =
    "Please talk to a trusted person, contact campus guidance, or use the support resources available in MindCare right away.";
  return `${base} ${followUp}`;
}

module.exports = {
  classifyWellnessText,
  getWellnessInsightForContext,
  getSafetyResponse,
  normalizeText,
};
