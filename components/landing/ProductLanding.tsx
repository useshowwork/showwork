import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Check, Download, FileImage, LayoutGrid, MessageCircle, Workflow } from "lucide-react";
import ConnectedInboxVisual from "@/components/landing/ConnectedInboxVisual";
import PricingSection from "@/components/landing/PricingSection";
import MarketingHeader from "@/components/landing/MarketingHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import WorkspaceFeatureVisual from "@/components/landing/WorkspaceFeatureVisual";
import { getCurrentCreator } from "@/lib/auth";
import { CONTENT_WORKSPACE_TRIAL_DAYS } from "@/lib/contentWorkspaceEntitlements";
import { productEntryHref, type EntryProduct } from "@/lib/productJourney";
import { productNavigation, productPages } from "@/lib/productPages";
import { PORTFOLIO_YEARLY_NGN } from "@/lib/portfolioPricing";
import { pageMetadata } from "@/lib/seo";
import styles from "./ProductLanding.module.css";

const icons = { portfolio: LayoutGrid, workspace: CalendarDays, engage: MessageCircle, delivery: Workflow };

export function productPageMetadata(product: EntryProduct) {
  const page = productPages[product];
  return pageMetadata({ title: `${page.name} | Showwork`, description: page.description, path: page.href });
}

export function ProductPreview({ product }: { product: EntryProduct }) {
  if (product === "workspace") return <WorkspaceFeatureVisual kind={1} />;
  if (product === "engage") return <ConnectedInboxVisual />;

  if (product === "portfolio") {
    return (
      <figure className={styles.example}>
        <div className={styles.exampleBar}><LayoutGrid size={16} aria-hidden="true" /> Portfolio preview</div>
        <div className={styles.portfolioPreview}>
          <Image src="/images/ports.png" alt="Photographer reviewing portraits in a studio" fill sizes="(max-width: 900px) 94vw, 650px" />
          <div><p>Studio Ayo</p><strong>Portraits in light<br />and shadow.</strong></div>
        </div>
        <figcaption>Example portfolio · Photography</figcaption>
      </figure>
    );
  }

  return (
    <figure className={styles.example}>
      <div className={styles.exampleBar}><Workflow size={16} aria-hidden="true" /> Client project preview</div>
      <div className={styles.deliveryPreview}>
        <Image src="/images/del.png" alt="Automotive campaign photography arranged as a contact sheet" fill sizes="(max-width: 900px) 94vw, 650px" />
      </div>
      <div className={styles.fileRow}>
        <span><FileImage size={19} aria-hidden="true" /><strong>Campaign photography</strong></span>
        <span><Check size={16} aria-hidden="true" /> Approved</span>
      </div>
      <figcaption><Download size={14} aria-hidden="true" /> Example handover · Final files ready</figcaption>
    </figure>
  );
}

export default async function ProductLanding({ product }: { product: EntryProduct }) {
  const page = productPages[product];
  const Icon = icons[product];
  const signedIn = Boolean(await getCurrentCreator());
  const href = productEntryHref(product, { signedIn });
  const action = signedIn ? page.signedInAction : page.action;
  const workflowId = product === "portfolio" ? "experience" : product === "delivery" ? "workflow" : "how-it-works";

  return (
    <div className={styles.page} data-product={product}>
      <a href="#main-content" className={styles.skip}>Skip to content</a>
      <MarketingHeader isLoggedIn={signedIn} currentPath={page.href} />
      <main id="main-content" data-marketing-motion>
        <section className={styles.hero} aria-labelledby="product-title">
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.copy} data-marketing-hero-copy>
              <p className={styles.label}><Icon size={18} aria-hidden="true" /> {page.name}</p>
              <h1 id="product-title">{page.headline[0]} <em>{page.headline[1]}</em></h1>
              <p className={styles.description}>{page.description}</p>
              <p className={styles.audience}>{page.audience}</p>
              <div className={styles.actions}>
                <Link className={styles.primary} href={href}>{action}</Link>
                <a className={styles.secondary} href="#pricing">{product === "portfolio" ? "See what’s free" : "See pricing"}</a>
              </div>
              {!signedIn && (product === "workspace" || product === "engage") &&
                <p className={styles.trial}>{CONTENT_WORKSPACE_TRIAL_DAYS}-day free trial for eligible accounts. No card required.</p>}
            </div>
            <div className={styles.heroPhoto} data-marketing-hero-visual>
              <Image src={page.photo.src} alt={page.photo.alt} fill priority
                sizes="(max-width: 900px) 94vw, 650px"
                style={{ objectPosition: "position" in page.photo ? page.photo.position : undefined }} />
            </div>
          </div>
        </section>
        <section id={workflowId} className={`${styles.container} ${styles.workflow}`} aria-labelledby="workflow-title">
          <h2 id="workflow-title">{page.workflow}</h2>
          <ol className={styles.steps} data-marketing-reveal>
            {page.features.map(([title, description]) => (
              <li key={title}><h3>{title}</h3><p>{description}</p></li>
            ))}
          </ol>
        </section>
        <section className={styles.story} aria-labelledby="example-title">
          <div className={`${styles.container} ${styles.storyGrid}`}>
            <div>
              <p className={styles.label}>See {page.name} in action</p>
              <h2 id="example-title">{page.example.title}</h2>
              <p className={styles.description}>{page.example.description}</p>
            </div>
            <div className={styles.preview} data-marketing-reveal><ProductPreview product={product} /></div>
          </div>
        </section>
        {product === "portfolio" ? (
          <section id="pricing" className={`${styles.container} ${styles.freePricing}`} aria-labelledby="portfolio-price">
            <div>
              <h2 id="portfolio-price">Portfolio pricing</h2>
              <p className={styles.description}>Create a personal portfolio for free. Agency accounts can also set up separate showcases for the brands they manage.</p>
            </div>
            <div className={styles.portfolioPlans}>
              <div className={styles.freePlan} data-marketing-card>
                <h3>Personal Portfolio</h3>
                <p className={styles.price}>₦0</p>
                <ul>
                  {["Public portfolio link", "Project galleries and media", "Services, testimonials and contact details"].map(feature => (
                    <li key={feature}><Check size={16} aria-hidden="true" /> {feature}</li>
                  ))}
                </ul>
                <Link className={styles.primary} href={href}>{action}</Link>
              </div>
              <div className={styles.freePlan} data-marketing-card>
                <h3>Agency Client Portfolio</h3>
                <p className={styles.price}>₦{PORTFOLIO_YEARLY_NGN.toLocaleString("en-NG")}<small> / year</small></p>
                <p className={styles.planNote}>Per additional client portfolio. Manage each brand’s own work, identity and public link from an agency account.</p>
                <Link className={styles.secondary} href="/help/portfolio?guide=agency-portfolio">How agency portfolios work</Link>
              </div>
            </div>
          </section>
        ) : (
          <PricingSection compact fixedProduct={product} signedIn={signedIn} />
        )}
        <section className={`${styles.container} ${styles.faq}`} aria-labelledby="buyer-questions">
          <h2 id="buyer-questions">Before you get started</h2>
          <div className={styles.questions}>
            {page.questions.map(([question, answer]) => (
              <details key={question}>
                <summary>{question}</summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className={styles.closing} aria-labelledby="next-step">
          <div className={`${styles.container} ${styles.closingInner}`}>
            <h2 id="next-step">{page.closing}</h2>
            <div className={styles.actions}>
              <Link className={styles.primary} href={href}>{action}</Link>
              <Link className={styles.secondary} href={page.guide}>{product === "engage" ? "See pricing" : "Read the guide"}</Link>
            </div>
          </div>
        </section>
        <nav className={`${styles.container} ${styles.related}`} aria-label="Explore other products">
          <h2>Explore other products</h2>
          <ul>
            {productNavigation.filter(other => other.href !== page.href).map(other => (
              <li key={other.href}><Link href={other.href}><strong>{other.name}</strong><span>{other.summary}</span></Link></li>
            ))}
          </ul>
        </nav>
      </main>
      <SiteFooter compact />
    </div>
  );
}
