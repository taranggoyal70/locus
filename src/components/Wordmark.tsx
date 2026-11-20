import Image from "next/image";

/** The mark and the serif wordmark. */
export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <Image src="/locus-mark.svg" width={size} height={size} alt="" priority className="mark" />
      <span className="font-display text-[22px] leading-none tracking-[-0.02em]">Locus</span>
    </span>
  );
}
