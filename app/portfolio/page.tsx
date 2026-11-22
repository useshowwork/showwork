import ProductLanding, { productPageMetadata } from "@/components/landing/ProductLanding";

export const metadata = productPageMetadata("portfolio");

export default function Page() {
  return <ProductLanding product="portfolio" />;
}
