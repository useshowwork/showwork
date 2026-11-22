import Image from "next/image";
import Link from "next/link";
import homepageStyles from "@/app/HomePage.module.css";
import ConnectedInboxVisual from "@/components/landing/ConnectedInboxVisual";
import MarketingHeader from "@/components/landing/MarketingHeader";
import PricingSection from "@/components/landing/PricingSection";
import SiteFooter from "@/components/landing/SiteFooter";
import { getCurrentCreator } from "@/lib/auth";
import { productPages } from "@/lib/productPages";
import { productEntryHref } from "@/lib/productJourney";
import { solutionAudiences } from "@/lib/solutionNavigation";
import { pageMetadata } from "@/lib/seo";
import styles from "../businesses/BusinessLanding.module.css";
import retail from "./RetailLanding.module.css";

const audience = solutionAudiences["small-businesses-retailers"];
const path = "/solutions/small-businesses-retailers";
const description = "Keep up with questions about stock, prices, delivery and bookings while you run the business. Showwork Engage brings WhatsApp, Instagram and Facebook into one inbox.";

export const metadata = pageMetadata({ title: "Showwork Engage for Small Businesses & Retailers", description, path });

const useCases = [
  ["Local shops", "Answer questions about stock, opening hours and pickup while your team serves customers in-store."],
  ["Online sellers", "Keep price, delivery and ordering questions together, even when customers message on different channels."],
  ["Service businesses", "Give people a clear next step when they ask what you offer or how to book."],
];

const questions = [
  ["Do I need an online store?", "No. Connect supported business accounts and add the information customers ask for, such as your shop hours, location or booking instructions."],
  ["Can someone on my team reply instead?", "Yes. Your team can send replies directly, review AI drafts before sending, or take over a conversation when needed."],
  ["When can automatic replies go out?", "Automatic replies are opt-in. Eligibility depends on your connected account, channel permissions and the platform’s reply window."],
];

export default async function Page() {
  const signedIn = Boolean(await getCurrentCreator());
  const href = productEntryHref("engage", { signedIn });
  const action = signedIn ? "Open Showwork Engage" : "Try Showwork Engage";

  return (
    <div className={styles.page}>
      <a href="#main-content" className={styles.skip}>Skip to content</a>
      <MarketingHeader currentPath={path} isLoggedIn={signedIn} />
      <main id="main-content" data-marketing-motion>
        <section className={styles.hero} aria-labelledby="retail-title">
          <div className={`${styles.wrap} ${styles.heroGrid}`}>
            <div className={styles.heroCopy} data-marketing-hero-copy>
              <p className={styles.kicker}>{audience.label}</p>
              <h1 id="retail-title">Customers are ready to buy. <em>Who’s answering?</em></h1>
              <p className={styles.lede}>{description}</p>
              <div className={styles.actions}>
                <Link href={href} className={styles.primary}>{action}</Link>
                <a href="#inbox" className={styles.secondary}>See the inbox</a>
              </div>
            </div>
            <div className={retail.heroPhotos} data-marketing-hero-visual>
              <Image className={retail.heroMain} src="/images/landing/freelancers/hospitality.webp" alt="A restaurant dish with jollof rice and grilled chicken" width={500} height={500} priority sizes="(max-width: 900px) 58vw, 390px" />
              <Image src="/images/landing/freelancers/beauty.webp" alt="Skincare products on a shop display" width={500} height={500} sizes="(max-width: 900px) 30vw, 210px" />
              <Image src="/images/landing/freelancers/client-review.webp" alt="Two people discussing their work in a local studio" width={500} height={500} sizes="(max-width: 900px) 30vw, 210px" />
            </div>
          </div>
        </section>

        <section id="inbox" className={`${styles.inboxSection} ${retail.inbox}`} aria-labelledby="inbox-title">
          <div className={`${styles.wrap} ${styles.inboxLayout}`}>
            <div>
              <p className={styles.kicker}>Showwork Engage</p>
              <h2 id="inbox-title">Give every enquiry a clear next step.</h2>
              <p className={styles.lede}>Add your prices, hours, delivery details and policies. Engage can use that information to draft replies for your team to review.</p>
              <p className={retail.note}>If you opt in, AI can reply automatically to eligible messages while you’re busy. Your team can take over whenever a conversation needs their attention.</p>
              <Link href={productPages.engage.href} className={styles.secondary}>Explore Showwork Engage</Link>
            </div>
            <div data-marketing-reveal><ConnectedInboxVisual scenario="retail" /></div>
          </div>
        </section>

        <section className={retail.useCases} aria-labelledby="use-cases-title">
          <div className={styles.wrap}>
            <h2 id="use-cases-title">Wherever you sell, customers have questions.</h2>
            <ul className={retail.useCaseGrid}>
              {useCases.map(([title, copy]) => <li key={title}><h3>{title}</h3><p>{copy}</p></li>)}
            </ul>
          </div>
        </section>

        <div className={retail.pricing}><PricingSection compact fixedProduct="engage" signedIn={signedIn} /></div>

        <section className={styles.faq} aria-labelledby="retail-questions">
          <div className={`${styles.wrap} ${styles.faqGrid}`}>
            <h2 id="retail-questions">Before you get started</h2>
            <div>{questions.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
          </div>
        </section>
      </main>
      <div className={homepageStyles.footerReveal}><SiteFooter homepage /></div>
    </div>
  );
}
