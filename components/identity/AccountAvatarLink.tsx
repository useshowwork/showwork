import Link from "next/link";
import IdentityImage from "./IdentityImage";

export default function AccountAvatarLink({ name, src }: { name: string; src?: string | null }) {
  return (
    <Link href="/dashboard/profile" aria-label="Edit your profile" title="Your profile" className="inline-grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-700">
      <IdentityImage name={name} src={src} />
    </Link>
  );
}
