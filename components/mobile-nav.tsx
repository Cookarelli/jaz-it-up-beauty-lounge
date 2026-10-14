"use client";
import Link from "next/link";
import { useRef } from "react";
export function MobileNav() {
  const menu = useRef<HTMLDetailsElement>(null);
  function close() {
    if (menu.current) menu.current.open = false;
  }
  return (
    <details
      className="mobile"
      ref={menu}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          close();
          menu.current?.querySelector("summary")?.focus();
        }
      }}
    >
      <summary>Menu</summary>
      <nav aria-label="Mobile">
        <Link href="/services" onClick={close}>
          Services
        </Link>
        <Link href="/gallery" onClick={close}>
          Gallery
        </Link>
        <Link href="/contact" onClick={close}>
          Contact
        </Link>
        <Link href="/book" onClick={close}>
          Book your visit
        </Link>
      </nav>
    </details>
  );
}
