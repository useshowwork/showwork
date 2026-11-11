import { pageMetadata } from "@/lib/seo";
import type {Metadata} from 'next';
import ProductHelpCenter from '@/components/help/ProductHelpCenter';
import {portfolioGuides} from '@/lib/help/portfolioGuides';
export const metadata: Metadata = pageMetadata({
  "title": "Portfolio Builder Help & Setup Guides | Showwork",
  "description": "Learn to build and share your Showwork portfolio. Set up branding, photo and video collections, services, testimonials and agency portfolios.",
  "path": "/help/portfolio",
  "keywords": [
    "Showwork portfolio help",
    "portfolio setup guide",
    "photography portfolio guide"
  ]
});
export default async function PortfolioHelpPage({searchParams}:{searchParams:Promise<{guide?:string|string[]}>}) {
 const params=await searchParams;
 const guide=typeof params.guide==='string'&&portfolioGuides.some(item=>item.id===params.guide)?params.guide:undefined;
 return <ProductHelpCenter product="portfolio" initialGuideId={guide}/>;
}
