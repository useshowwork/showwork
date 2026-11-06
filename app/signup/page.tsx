import { redirect } from "next/navigation";
import { getCurrentCreator } from "@/lib/auth";
import { journeyQuery, readProductJourney } from "@/lib/productJourney";
import SignupClient from "./SignupClient";

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const journey = readProductJourney(journeyQuery(await searchParams));
  if (await getCurrentCreator()) redirect(journey.destination ?? "/dashboard");
  return <SignupClient/>;
}
