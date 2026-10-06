/**
 * Short looping explainer: how property reaches family through probate versus a funded
 * living trust. Pure SVG and CSS, and it holds still for visitors who prefer reduced motion.
 * Timelines are illustrative, not a promise about any estate.
 */
export default function ProbateVsTrustAnimation() {
  return (
    <figure className="explainer">
      <svg viewBox="0 0 640 230" role="img" aria-labelledby="pvt-title pvt-desc">
        <title id="pvt-title">Probate compared with a living trust</title>
        <desc id="pvt-desc">
          With a will, property usually passes through a court process called probate before it reaches family, which
          can take months. With a funded living trust, a successor trustee can usually transfer property to family
          without court.
        </desc>

        <text x="16" y="34" className="explainer__label">With a will (probate)</text>
        <line x1="70" y1="70" x2="570" y2="70" className="explainer__track" />
        <g className="explainer__node"><circle cx="70" cy="70" r="22" /><text x="70" y="76">🏠</text><text x="70" y="112" className="explainer__cap">Your property</text></g>
        <g className="explainer__node explainer__node--court"><circle cx="320" cy="70" r="22" /><text x="320" y="76">⚖️</text><text x="320" y="112" className="explainer__cap">Court, notices, waiting</text></g>
        <g className="explainer__node"><circle cx="570" cy="70" r="22" /><text x="570" y="76">👪</text><text x="570" y="112" className="explainer__cap">Family</text></g>
        <circle r="8" cx="70" cy="70" className="explainer__token explainer__token--slow" />

        <text x="16" y="150" className="explainer__label">With a funded living trust</text>
        <line x1="70" y1="186" x2="570" y2="186" className="explainer__track" />
        <g className="explainer__node"><circle cx="70" cy="186" r="22" /><text x="70" y="192">🏠</text></g>
        <g className="explainer__node"><circle cx="320" cy="186" r="22" /><text x="320" y="192">🗝️</text><text x="320" y="226" className="explainer__cap">Successor trustee</text></g>
        <g className="explainer__node"><circle cx="570" cy="186" r="22" /><text x="570" y="192">👪</text></g>
        <circle r="8" cx="70" cy="186" className="explainer__token explainer__token--fast" />
      </svg>
      <figcaption className="notice">
        Illustration only. How long either path takes depends on the estate, the state and the family.
      </figcaption>
    </figure>
  );
}
