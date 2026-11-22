import ProductLanding, { productPageMetadata } from "@/components/landing/ProductLanding";

export const metadata = productPageMetadata("engage");

export default function Page() {
  return <ProductLanding product="engage" />;
}
