import { pageMetadata } from "@/lib/seo";
import type { Metadata } from 'next';
import ProductHelpCenter from '@/components/help/ProductHelpCenter';
import { deliveryGuides } from '@/lib/help/deliveryGuides';
export const metadata: Metadata = pageMetadata({
  "title": "Project Delivery & Client File Review Help | Showwork",
  "description": "Get help with project uploads, client access, file reviews, revisions, payment confirmation, downloads and collaboration in Showwork Project Delivery.",
  "path": "/help/project-delivery",
  "keywords": [
    "Showwork delivery help",
    "client file review guide",
    "project delivery guide"
  ]
});
export default async function DeliveryHelpPage({searchParams}:{searchParams:Promise<{guide?:string|string[]}>}) {
  const params=await searchParams;
  const guide=typeof params.guide==='string' && deliveryGuides.some(item=>item.id===params.guide) ? params.guide : undefined;
  return <ProductHelpCenter product="delivery" initialGuideId={guide}/>;
}
