'use strict';

// What the tokens in a conversation would cost at Anthropic's API list
// prices, in US dollars per million tokens. An estimate: plans with a fixed
// monthly price (Pro, Max, Team) are not billed per token, and providers
// such as Bedrock or Vertex have their own prices. Cache writes are counted
// at 1.25x the input price (the 5-minute cache); cache reads at the listed
// price, or 0.1x the input price where none is listed.
//
// Keys are model id prefixes, longest match wins, so dated ids
// ("claude-sonnet-4-5-20250929") find their family.
const PRICES = {
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25 },
  'claude-fable-5': { input: 10, output: 50 },
  'claude-mythos-5-1': { input: 10, output: 50, cacheRead: 0.25 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-opus-4-7': { input: 5, output: 25 },
  'claude-opus-4-6': { input: 5, output: 25 },
  'claude-opus-4-5': { input: 5, output: 25 },
  'claude-opus-4-1': { input: 15, output: 75 },
  'claude-opus-4': { input: 15, output: 75 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-sonnet-4': { input: 3, output: 15 },
  'claude-3-7-sonnet': { input: 3, output: 15 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-3-5-haiku': { input: 0.8, output: 4 },
};
const KEYS = Object.keys(PRICES).sort((a, b) => b.length - a.length);

function priceOf(model) {
  const id = String(model || '').toLowerCase().replace(/^(anthropic\.|us\.anthropic\.|eu\.anthropic\.)/, '');
  const key = KEYS.find((k) => id.startsWith(k));
  return key ? PRICES[key] : null;
}

// Dollars for one usage delta { input, output, cacheRead, cacheWrite } on
// `model`; null for a model with no known price.
function costOf(model, u) {
  const p = priceOf(model);
  if (!p) return null;
  const read = p.cacheRead ?? p.input * 0.1;
  return ((u.input || 0) * p.input + (u.output || 0) * p.output + (u.cacheWrite || 0) * p.input * 1.25 + (u.cacheRead || 0) * read) / 1e6;
}

module.exports = { priceOf, costOf, PRICES };
