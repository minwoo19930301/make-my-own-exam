// Our own wording of a 0-6 holistic scale, modeled on the structure of the public GRE Issue scoring guide.
export const LEVELS = {
  6: "Outstanding: an insightful position on the exact task, developed with compelling, well-chosen reasons and examples; tightly organized; precise, varied language with only trivial errors.",
  5: "Strong: a thoughtful position on the task, developed with well-chosen reasons and examples; clearly organized; fluent language with minor errors.",
  4: "Adequate: a clear position on the task with relevant reasons and examples; mostly organized; generally clear language with some errors.",
  3: "Limited: addresses the task but with vague or thin support, weak organization, or language problems that sometimes obscure meaning.",
  2: "Seriously flawed: unclear or barely relevant position, little support, poor organization, or frequent errors that obscure meaning.",
  1: "Fundamentally deficient: little evidence of understanding the issue, almost no development, or pervasive errors.",
  0: "Off topic, copied from the prompt, not in English, or blank.",
};

export const DIMENSIONS = [
  { id: "position", label: "Position & task fit", ask: "Does the essay take a clear, nuanced position and do exactly what this task's instructions require?" },
  { id: "development", label: "Reasons & examples", ask: "Are the reasons persuasive and the examples specific, relevant and explained?" },
  { id: "organization", label: "Organization", ask: "Do ideas progress logically with clear transitions and paragraphs that each do one job?" },
  { id: "language", label: "Language & conventions", ask: "Is the language precise and varied, with grammar and mechanics under control?" },
];

// What each ETS task variant explicitly demands beyond taking a position.
export const TASK_DEMANDS = {
  "claim-reason": "Address BOTH the claim and the reason it rests on, and explain how the reason affects your view of the claim.",
  "claim-challenge": "Address the most compelling reasons or examples that could be used to challenge your position.",
  recommendation: "Describe specific circumstances in which adopting the recommendation would or would not be advantageous.",
  statement: "Consider ways in which the statement might or might not hold true.",
  "two-views": "Address both of the views presented, not only the one you choose.",
  policy: "Consider the possible consequences of implementing the policy and how they shape your position.",
};
