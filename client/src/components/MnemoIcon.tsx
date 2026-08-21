import { useId, type SVGProps } from "react";

const upperLeftLines = [
  ["M10,14L26,14", "matrix(1,0,0,1,5.5098,1)"],
  ["M46,14L62,14", "matrix(1,0,0,1,-3.208418,1)"],
  ["M10,24L26,24", "matrix(1,0,0,1,5.5098,1)"],
  ["M46,24L62,24", "matrix(1,0,0,1,-3.208418,1)"],
  ["M10,34L26,34", "matrix(1,0,0,1,5.5098,1)"],
  ["M46,34L62,34", "matrix(1,0,0,1,-3.208418,1)"],
  ["M10,44L26,44", "matrix(1,0,0,1,5.5098,1)"],
  ["M46,44L62,44", "matrix(1,0,0,1,-3.208418,1)"],
  ["M10,54L26,54", "matrix(1,0,0,1,5.5098,1)"],
  ["M10,64L26,64", "matrix(1,0,0,1,5.5098,1)"],
  ["M46,64L62,64", "matrix(1,0,0,1,0.791582,1)"],
  ["M10,74L26,74", "matrix(1,0,0,1,5.5098,1)"],
  ["M46,74L62,74", "matrix(1,0,0,1,0.791582,1)"],
  ["M46,84L62,84", "matrix(1,0,0,1,0.791582,1)"],
] as const;

export function MnemoIcon(props: SVGProps<SVGSVGElement>) {
  const idPrefix = useId();
  const frameClipId = `${idPrefix}-frame`;
  const upperLeftClipId = `${idPrefix}-upper-left`;
  const lowerRightClipId = `${idPrefix}-lower-right`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1024 1024"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <g transform="matrix(10.24,0,0,10.24,0,0)">
        <path
          d="M86.878,4C89.298,4 91.618,4.961 93.328,6.672C95.039,8.382 96,10.702 96,13.122L96,86.878C96,89.298 95.039,91.618 93.328,93.328C91.618,95.039 89.298,96 86.878,96L13.122,96C10.702,96 8.382,95.039 6.672,93.328C4.961,91.618 4,89.298 4,86.878L4,13.122C4,10.702 4.961,8.382 6.672,6.672C8.382,4.961 10.702,4 13.122,4L86.878,4Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="7.5"
        />
      </g>
      <g transform="matrix(10.24,0,0,10.24,0,0)">
        <defs>
          <clipPath id={frameClipId}>
            <path d="M96,10L96,90C96,93.311 93.311,96 90,96L10,96C6.689,96 4,93.311 4,90L4,10C4,6.689 6.689,4 10,4L90,4C93.311,4 96,6.689 96,10Z" />
          </clipPath>
          <clipPath id={upperLeftClipId}>
            <path d="M0,0L100,0L0,100L0,0Z" />
          </clipPath>
          <clipPath id={lowerRightClipId}>
            <path d="M100,0L100,100L0,100L100,0Z" />
          </clipPath>
        </defs>
        <g clipPath={`url(#${frameClipId})`} fill="none" stroke="currentColor">
          <g clipPath={`url(#${upperLeftClipId})`}>
            {upperLeftLines.map(([d, transform]) => (
              <path
                key={`${d}-${transform}`}
                d={d}
                transform={transform}
                strokeWidth="4.38"
                strokeLinecap="round"
              />
            ))}
          </g>
          <g clipPath={`url(#${lowerRightClipId})`}>
            <circle cx="80" cy="42" r="8" strokeWidth="4.38" />
            <path
              d="M4,96L45,55L55,62L65,50L80,58L96,70L96,96"
              strokeWidth="6.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
          <path d="M4,96L96,4" strokeWidth="6.25" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}
