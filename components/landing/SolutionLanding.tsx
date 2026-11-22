import Image from "next/image";
import Link from "next/link";
import MarketingHeader from "@/components/landing/MarketingHeader";
import { ProductPreview } from "@/components/landing/ProductLanding";
import SiteFooter from "@/components/landing/SiteFooter";
import { getCurrentCreator } from "@/lib/auth";
import { productEntryHref } from "@/lib/productJourney";
import { productPages } from "@/lib/productPages";
import { solutionPages, type SolutionRecommendations } from "@/lib/solutionPages";
import { solutionAudiences, solutionNavigation } from "@/lib/solutionNavigation";
import { pageMetadata } from "@/lib/seo";
import styles from "./ProductLanding.module.css";

const previews = {
  delivery: <ProductPreview product="delivery" />,
};

type Audience = keyof typeof solutionPages;

export function solutionPageMetadata(audience: Audience) {
  return pageMetadata({
    title: `Showwork for ${solutionAudiences[audience].label}`,
    description: solutionPages[audience].description,
    path: `/solutions/${audience}`,
  });
}

export default async function SolutionLanding({ audience }: { audience: Audience }) {
  const page = solutionPages[audience];
  const recommendations: SolutionRecommendations = page.recommendations;
  const path = `/solutions/${audience}`;
  const signedIn = Boolean(await getCurrentCreator());
  const href = productEntryHref(audience === "creatives" ? "delivery" : "workspace", { signedIn });
  const action = signedIn ? page.signedInAction : page.action;

  return (
    <div className={styles.page}>
      <a href="#main-content" className={styles.skip}>Skip to content</a>
      <MarketingHeader currentPath={path} isLoggedIn={signedIn} />
      <main id="main-content" data-marketing-motion>
        <section className={styles.hero} aria-labelledby="solution-title">
          <div className={`${styles.container} ${styles.heroGrid}`}>
            <div className={styles.copy} data-marketing-hero-copy>
              <p className={styles.label}>{solutionAudiences[audience].label}</p>
              <h1 id="solution-title">{page.headline[0]} <em>{page.headline[1]}</em></h1>
              <p className={styles.description}>{page.description}</p>
              <div className={styles.actions}>
                <Link href={href} className={styles.primary}>{action}</Link>
                <a href="#workflow" className={styles.secondary}>See the workflow</a>
              </div>
            </div>
            <div className={styles.heroPhoto} data-marketing-hero-visual>
              <Image src={page.photo.src} alt={page.photo.alt} fill priority sizes="(max-width: 900px) 94vw, 650px" />
            </div>
          </div>
        </section>
        <section id="workflow" className={`${styles.container} ${styles.workflow}`} aria-labelledby="workflow-title">
          <h2 id="workflow-title">{page.workflowTitle}</h2>
          <ol className={styles.steps} data-marketing-reveal>
            {page.steps.map(([title, copy]) => <li key={title}><h3>{title}</h3><p>{copy}</p></li>)}
          </ol>
        </section>
        <section className={styles.story} aria-labelledby="example-title">
          <div className={`${styles.container} ${styles.storyGrid}`}>
            <div>
              <h2 id="example-title">{page.scenario.title}</h2>
              <p className={styles.description}>{page.scenario.description}</p>
            </div>
            <div className={styles.preview} data-marketing-reveal>{previews[page.scenario.preview]}</div>
          </div>
        </section>
        <section id="pricing" className={`${styles.container} ${styles.freePricing}`} aria-labelledby="pricing-title">
          <div>
            <h2 id="pricing-title">Recommended plans</h2>
            <p className={styles.description}>Compare two starting points and see the full pricing on each product page.</p>
          </div>
          <div className={styles.portfolioPlans}>
            {recommendations.map(option => (
              <article key={option.plan} className={styles.freePlan} data-marketing-card>
                {productPages[option.product].name !== option.plan && <p className={styles.label}>{productPages[option.product].name}</p>}
                <h3>{option.plan}</h3>
                <p className={styles.price}>₦{option.monthly.toLocaleString("en-NG")}{option.monthly > 0 && <small> / month</small>}</p>
                <p className={styles.planNote}>{option.reason}</p>
                <Link className={styles.primary} href={productEntryHref(option.product, { plan: option.planKey, signedIn })}>
                  {option.monthly > 0 ? `Choose ${option.plan}` : productPages[option.product].action}
                </Link>
                <Link className={styles.planDetailsLink} href={`${productPages[option.product].href}#pricing`}>See {productPages[option.product].name} pricing</Link>
              </article>
            ))}
          </div>
        </section>
        <section className={`${styles.container} ${styles.faq}`} aria-labelledby="buyer-questions">
          <h2 id="buyer-questions">Before you get started</h2>
          <div className={styles.questions}>
            {page.questions.map(([question, answer]) => (
              <details key={question}><summary>{question}</summary><p>{answer}</p></details>
            ))}
          </div>
        </section>
        <section className={styles.closing} aria-labelledby="next-step">
          <div className={`${styles.container} ${styles.closingInner}`}>
            <h2 id="next-step">{page.closing}</h2>
            <div className={styles.actions}>
              <Link href={href} className={styles.primary}>{action}</Link>
            </div>
          </div>
        </section>
        <nav className={`${styles.container} ${styles.related}`} aria-label="Explore other solutions">
          <h2>Explore other solutions</h2>
          <ul>
            {solutionNavigation.filter(solution => solution.href !== path).map(solution => (
              <li key={solution.href}><Link href={solution.href}><strong>{solution.label}</strong></Link></li>
            ))}
          </ul>
        </nav>
      </main>
      <SiteFooter compact />
    </div>
  );
}
