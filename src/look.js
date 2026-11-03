// One gradient per concept so posts about the same idea look related in the feed.
const GRADIENTS = [
  ["#833ab4", "#fd1d1d"], ["#405de6", "#c13584"], ["#f77737", "#e1306c"], ["#0f9b8e", "#2f80ed"],
  ["#6a11cb", "#2575fc"], ["#ee0979", "#ff6a00"], ["#11998e", "#38ef7d"], ["#8e2de2", "#4a00e0"],
  ["#fc466b", "#3f5efb"], ["#f857a6", "#ff5858"], ["#1d976c", "#2f80ed"], ["#c94b4b", "#4b134f"],
];

export function conceptIndex(kb, key) {
  return Math.max(0, kb.concepts.findIndex((c) => c.key === key));
}

export function gradient(kb, key) {
  const [a, b] = GRADIENTS[conceptIndex(kb, key) % GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

export function initials(label) {
  return label.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && !/^(and|the|of|vs|a|to|what|how)$/i.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

export const conceptLabel = (kb, k) => kb.concepts.find((c) => c.key === k)?.label || k;
export const variantLabel = (kb, k) => kb.variants.find((v) => v.key === k)?.label || k;
export const VARIANT_SHORT = {
  "claim-reason": "Claim + reason",
  "claim-challenge": "Claim, answer the challenge",
  recommendation: "Recommendation",
  statement: "Statement",
  "two-views": "Two views",
  policy: "Policy",
};
