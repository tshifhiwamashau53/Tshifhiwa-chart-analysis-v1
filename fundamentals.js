const macroEvents = [
  {
    name: 'Central-bank decisions',
    tags: 'Fed • ECB • BoE • BoJ',
    effect: 'Can rapidly change expectations about interest rates, currencies, bonds and gold.',
    reversal: 'The first move can reverse if the decision is already expected but the statement or press conference changes the expected future path.'
  },
  {
    name: 'Inflation data',
    tags: 'CPI • PPI',
    effect: 'Changes expectations about whether monetary policy may stay tight or become less restrictive.',
    reversal: 'A headline number can look supportive in one direction while the core components, revisions or central-bank interpretation point the other way.'
  },
  {
    name: 'Employment data',
    tags: 'NFP • unemployment • wages',
    effect: 'Strong or weak labour data can change expectations for economic growth and interest-rate policy.',
    reversal: 'The headline jobs number may surprise while wages, unemployment or prior-month revisions tell a different story.'
  },
  {
    name: 'Growth data',
    tags: 'GDP • PMI • retail sales',
    effect: 'Provides information about whether economic activity is accelerating or slowing.',
    reversal: 'A growth surprise can be offset by inflation or policy expectations, so the market reaction is not always one-directional.'
  },
  {
    name: 'Bond yields & currency strength',
    tags: 'Treasuries • real yields • USD',
    effect: 'Changes in yields and the currency can transmit quickly into other markets, including precious metals and risk assets.',
    reversal: 'Price can change direction when yields or the currency move differently from what the earlier market reaction implied.'
  },
  {
    name: 'Geopolitical / supply shocks',
    tags: 'Energy • conflict • trade • supply',
    effect: 'Unexpected events can change inflation, growth and safe-haven expectations very quickly.',
    reversal: 'A headline can create an immediate shock, followed by a reversal when more information reduces or changes the perceived impact.'
  }
];

function renderFundamentals() {
  const grid = document.getElementById('fundamentalGrid');
  const explanation = document.getElementById('fundamentalExplanation');
  if (!grid || !explanation) return;

  grid.innerHTML = macroEvents.map(event => `
    <article class="fund-card">
      <span class="fund-tag">${event.tags}</span>
      <h4>${event.name}</h4>
      <p>${event.effect}</p>
      <strong>Why direction can suddenly change</strong>
      <p>${event.reversal}</p>
    </article>
  `).join('');

  explanation.innerHTML = `
    <b>Fundamentals are a context layer, not a prediction engine.</b>
    <span>When major news arrives, the chart can invalidate a technical structure very quickly. The analyzer should therefore flag nearby high-impact events, explain what the event measures, compare the result with expectations when reliable data is available, and explain which macro assumptions could change. It should never treat a news headline as proof that price must move one way.</span>
  `;
}

document.addEventListener('DOMContentLoaded', renderFundamentals);
renderFundamentals();
