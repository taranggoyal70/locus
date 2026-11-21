import Image from "next/image";

/**
 * The mark and the serif wordmark. `nameClassName` styles the name alone, so a
 * header short of room can drop it and keep the mark.
 */
export function Wordmark({ size = 28, nameClassName = "" }: { size?: number; nameClassName?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <Image src="/locus-mark.svg" width={size} height={size} alt="" priority className="mark" />
      <span className={`font-display text-[22px] leading-none tracking-[-0.02em] ${nameClassName}`}>Locus</span>
    </span>
  );
}
