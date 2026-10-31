import { useId } from "react";

/** A decorative printed border: quatrefoils and dots repeating along a 24px band. */
export default function PrintBand() {
  const id = `print-band-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  return (
    <svg className="print-band" aria-hidden="true" focusable="false" width="100%" height="24">
      <defs>
        <pattern id={id} width="24" height="24" patternUnits="userSpaceOnUse">
          <g className="print-band-motif">
            <ellipse cx="8.4" cy="12" rx="3" ry="1.6" />
            <ellipse cx="15.6" cy="12" rx="3" ry="1.6" />
            <ellipse cx="12" cy="8.4" rx="1.6" ry="3" />
            <ellipse cx="12" cy="15.6" rx="1.6" ry="3" />
            <circle cx="0" cy="12" r="1.5" />
            <circle cx="24" cy="12" r="1.5" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="24" fill={`url(#${id})`} />
    </svg>
  );
}
