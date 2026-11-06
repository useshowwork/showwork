import styles from "./KnowledgeStudio.module.css";
export default function KnowledgeWorkspaceHeader({ clientName }: { clientName: string }) {
  return <header className={styles.simpleHeader}><h1>Business knowledge</h1><p>Add documents or a website to help Showwork understand {clientName}.</p></header>;
}
