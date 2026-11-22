import Image from "next/image";
import Link from "next/link";
import { BookOpen, CalendarDays, Mail } from "lucide-react";
import MarketingHeader from "@/components/landing/MarketingHeader";
import SiteFooter from "@/components/landing/SiteFooter";
import { getCurrentCreator } from "@/lib/auth";
import { pageMetadata } from "@/lib/seo";
import homepageStyles from "@/app/HomePage.module.css";
import styles from "./ContactPage.module.css";

const email = "hello@useshowwork.com";

export const metadata = pageMetadata({
  title: "Contact Us",
  description: "Get in touch with Showwork for account support, product questions, demos, and partnerships.",
  path: "/contact",
});

export default async function ContactPage() {
  const isLoggedIn = Boolean(await getCurrentCreator());

  return (
    <>
      <a href="#main-content" className={homepageStyles.skipLink}>Skip to content</a>
      <MarketingHeader currentPath="/contact" pricingHref="/#pricing" isLoggedIn={isLoggedIn} />
      <main id="main-content" className={styles.page} data-marketing-motion>
        <section className={styles.hero} aria-labelledby="contact-title">
          <div className={`${styles.container} ${styles.heroLayout}`}>
            <div className={styles.heroContent} data-marketing-hero-copy>
              <span className={styles.label}>Contact Showwork</span>
              <h1 id="contact-title">Let’s talk about <em>your work.</em></h1>
              <p>Whether you’re exploring Showwork or already using it with your team, tell us what you need a hand with.</p>
              <a className={styles.email} href={`mailto:${email}`}>
                <Mail size={18} aria-hidden="true" />
                {email}
              </a>
            </div>
            <div className={styles.photo} data-marketing-hero-visual>
              <Image src="/images/landing/9.webp" alt="A creative team standing together in their office" fill priority sizes="(max-width: 760px) 90vw, 600px" />
            </div>
          </div>
        </section>
        <section className={`${styles.container} ${styles.options}`} aria-labelledby="contact-options">
          <h2 id="contact-options">How can we help?</h2>
          <ul className={styles.grid}>
            <li data-marketing-card>
              <BookOpen aria-hidden="true" />
              <h3>Account and product support</h3>
              <p>Find setup guides or email us about billing, your account, or something that isn’t working.</p>
              <div className={styles.links}>
                <Link href="/help/workspace">Browse help guides</Link>
                <a href={`mailto:${email}?subject=Showwork%20support`}>Email support</a>
              </div>
            </li>
            <li className={styles.sales} data-marketing-card>
              <CalendarDays aria-hidden="true" />
              <h3>Sales and demos</h3>
              <p>Tell us how your team works and see which Showwork products and plans fit.</p>
              <div className={styles.links}><Link href="/book-demo">Book a demo</Link></div>
            </li>
            <li data-marketing-card>
              <Mail aria-hidden="true" />
              <h3>Partnerships and general enquiries</h3>
              <p>Get in touch about working together, or ask us a question.</p>
              <div className={styles.links}><a href={`mailto:${email}?subject=Showwork%20enquiry`}>Email Showwork</a></div>
            </li>
          </ul>
        </section>
      </main>
      <SiteFooter homepage />
    </>
  );
}
