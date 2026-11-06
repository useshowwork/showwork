import { redirect } from "next/navigation";
import { getCurrentCreator } from "@/lib/auth";
import { journeyQuery, readProductJourney } from "@/lib/productJourney";
import LoginClient from "./LoginClient";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const journey = readProductJourney(journeyQuery(await searchParams));
  if (await getCurrentCreator()) redirect(journey.destination ?? "/dashboard");
  return <LoginClient/>;
}
