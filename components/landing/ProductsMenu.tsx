"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { productNavigation } from "@/lib/productPages";
import styles from "./ProductsMenu.module.css";

export default function ProductsMenu({ currentPath }: { currentPath?: string }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const pointerOpened = useRef(false);

  function close() {
    if (menu.current) menu.current.open = false;
    pointerOpened.current = false;
  }

  useEffect(() => {
    function outside(event: PointerEvent) {
      if (!menu.current?.contains(event.target as Node)) close();
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);

  return (
    <details
      ref={menu}
      className={styles.menu}
      onPointerEnter={event => {
        if (event.pointerType === "mouse" && !event.currentTarget.open) {
          event.currentTarget.open = true;
          pointerOpened.current = true;
        }
      }}
      onPointerLeave={event => {
        if (event.pointerType === "mouse" && pointerOpened.current && !event.currentTarget.contains(document.activeElement)) close();
      }}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
      onKeyDown={event => {
        if (event.key === "Escape" && event.currentTarget.open) {
          event.stopPropagation();
          close();
          event.currentTarget.querySelector("summary")?.focus();
        }
      }}
    >
      <summary onClick={event => {
        if (event.detail > 0 && pointerOpened.current) {
          event.preventDefault();
          pointerOpened.current = false;
        } else {
          pointerOpened.current = false;
        }
      }}>
        Products <ChevronDown size={15} aria-hidden="true" />
      </summary>
      <ul className={styles.panel}>
        {productNavigation.map(product => (
          <li key={product.href}>
            <Link href={product.href} aria-current={currentPath === product.href ? "page" : undefined} onClick={close}>
              <strong>{product.name}</strong>
              <span>{product.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
