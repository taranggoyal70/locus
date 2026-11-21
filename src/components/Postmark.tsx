/**
 * The ticket's stamp: a tiny Repo of 49 file marks with its Slice inked in,
 * ringed like a postmark. Decorative, so it is hidden from assistive tech.
 */
const SLICE = new Set([10, 11, 17, 18, 19, 24, 25, 31]);
const ANCHORS = new Set([18]);

export function Postmark() {
  return (
    <div aria-hidden="true" className="flex items-center gap-4 self-start">
      <div className="relative grid h-[92px] w-[92px] place-items-center rounded-full border border-dashed border-line-2">
        <div className="grid grid-cols-7 gap-[3px]">
          {Array.from({ length: 49 }, (_, index) =>
            ANCHORS.has(index) ? (
              <span key={index} className="h-[6px] w-[6px] rounded-[1px] border-[1.5px] border-included" />
            ) : (
              <span key={index} className={`h-[6px] w-[6px] rounded-[1px] ${SLICE.has(index) ? "bg-included" : "bg-excluded"}`} />
            ),
          )}
        </div>
      </div>
      <div className="font-mono text-[11px] leading-5 tracking-[0.08em] text-muted">
        <p>SLICE 8 / 49</p>
        <p>ANCHOR 1</p>
        <p>WIDEN 0</p>
      </div>
    </div>
  );
}
