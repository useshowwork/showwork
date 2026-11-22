import ProductLanding, { productPageMetadata } from "@/components/landing/ProductLanding";

export const metadata = productPageMetadata("workspace");

export default function Page() {
  return <ProductLanding product="workspace" />;
}
