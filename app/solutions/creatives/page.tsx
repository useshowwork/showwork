import SolutionLanding, { solutionPageMetadata } from "@/components/landing/SolutionLanding";

export const metadata = solutionPageMetadata("creatives");

export default function Page() {
  return <SolutionLanding audience="creatives" />;
}
