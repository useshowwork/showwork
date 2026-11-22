import ProductLanding, { productPageMetadata } from "@/components/landing/ProductLanding";

export const metadata = productPageMetadata("delivery");

export default function Page() {
  return <ProductLanding product="delivery" />;
}
