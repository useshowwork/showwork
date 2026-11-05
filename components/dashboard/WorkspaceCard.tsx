import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./WorkspaceCard.module.css";

type Props = {
  product: string;
  description: string;
  href: string;
  action: string;
  icon: ReactNode;
  variant: "workspace" | "delivery" | "portfolio";
};

export default function WorkspaceCard({ product, description, href, action, icon, variant }: Props) {
  const featured = variant === "workspace";
  return (
    <Link href={href} className={`${styles.card} ${styles[variant]}`}>
      <div className={styles.cardTop}>
        <span className={styles.toolIcon} aria-hidden="true">{icon}</span>
        {featured && <span className={styles.flagship}>Our flagship tool</span>}
        {!featured && <span className={styles.arrow}><ArrowUpRight size={20} aria-hidden="true" /></span>}
      </div>
      <div className={styles.copy}>
        <h3 className={styles.title}>{product}</h3>
        <p className={styles.description}>{description}</p>
      </div>
      {featured && <div className={styles.cardFooter}><span>{action}</span><span className={styles.arrow}><ArrowUpRight size={22} aria-hidden="true" /></span></div>}
      {!featured && <span className="sr-only">{action}</span>}
    </Link>
  );
}
