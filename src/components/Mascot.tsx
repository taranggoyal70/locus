/**
 * The Locus mark as a character: the ink tile with two eyes, carrying the
 * orange square, a file of the Slice. It shows up where the product talks back:
 * the hero demo, its toasts, empty states, the 404 page and the footer.
 *
 * Drawn on a 16 by 19 pixel grid in theme colours, with every move a whole
 * pixel (globals.css, "The mascot"). Decorative: the words beside it carry the
 * meaning, so it is hidden from assistive tech.
 */
export type MascotMood = "idle" | "sleep" | "scan" | "found" | "walk" | "look";

export function Mascot({
  mood = "idle",
  size = 32,
  className = "",
}: {
  mood?: MascotMood;
  /** Width in CSS pixels; a multiple of 16 keeps every pixel whole. */
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 19"
      width={size}
      height={(size * 19) / 16}
      shapeRendering="crispEdges"
      className={`mascot ${className}`}
      data-mood={mood}
    >
      <g className="mascot-z">
        <path d="M12 1h3v1h-3zM14 2h1v1h-1zM13 3h1v1h-1zM12 4h3v1h-3z" />
      </g>
      <g className="mascot-legs">
        <rect className="mascot-leg mascot-leg--a" x="3" y="17" width="2" height="2" />
        <rect className="mascot-leg mascot-leg--b" x="9" y="17" width="2" height="2" />
      </g>
      <g className="mascot-body">
        <path className="mascot-tile" d="M2 6h10v1h1v9h-1v1H2v-1H1V7h1z" />
        <g className="mascot-eyes">
          <rect x="4" y="9" width="2" height="3" />
          <rect x="8" y="9" width="2" height="3" />
        </g>
      </g>
      <rect className="mascot-file" x="11" y="13" width="4" height="4" />
    </svg>
  );
}
