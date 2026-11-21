/**
 * A small grid of file marks for empty and error states. `slice` marks are
 * filled with the orange signal, `hole` is drawn as a dashed outline: the file
 * that is not there.
 * Decorative; the text beside it carries the meaning.
 */
export function MiniField({
  columns = 9,
  rows = 5,
  slice = [],
  hole,
  tone = "accent",
}: {
  columns?: number;
  rows?: number;
  slice?: number[];
  hole?: number;
  tone?: "accent" | "danger";
}) {
  const inked = new Set(slice);
  return (
    <div
      aria-hidden="true"
      className="grid w-fit gap-[5px]"
      style={{ gridTemplateColumns: `repeat(${columns}, 10px)` }}
    >
      {Array.from({ length: columns * rows }, (_, index) => {
        if (index === hole) {
          return (
            <span
              key={index}
              className={`h-[10px] w-[10px] rounded-[2px] border border-dashed ${tone === "danger" ? "border-failed" : "border-ink"}`}
            />
          );
        }
        return (
          <span
            key={index}
            className={`h-[10px] w-[10px] rounded-[2px] ${inked.has(index) ? (tone === "danger" ? "bg-failed" : "bg-included") : "bg-excluded"}`}
          />
        );
      })}
    </div>
  );
}
