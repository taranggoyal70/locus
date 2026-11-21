import { Fragment } from "react";

/** A file path that wraps at its slashes, so a narrow column never splits a name mid-word. */
export function PathText({ path }: { path: string }) {
  const parts = path.split("/");
  return parts.map((part, index) => (
    <Fragment key={index}>
      {part}
      {index < parts.length - 1 && (
        <>
          /<wbr />
        </>
      )}
    </Fragment>
  ));
}
