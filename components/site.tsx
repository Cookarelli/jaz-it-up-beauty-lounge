import { MobileNav } from "./mobile-nav";
import Link from "next/link";
import { ArrowUpRight, Scissors } from "lucide-react";
export function Button({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: React.ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link className={`button ${secondary ? "secondary" : ""}`} href={href}>
      {children}
      <ArrowUpRight size={17} />
    </Link>
  );
}
const links = [
  ["Services", "/services"],
  ["Gallery", "/gallery"],
  ["Contact", "/contact"],
];
export function Header() {
  return (
    <header>
      <Link href="/" className="wordmark">
        Jaz It Up<span>BEAUTY LOUNGE</span>
      </Link>
      <nav className="desktop" aria-label="Main">
        {links.map(([label, url]) => (
          <Link key={url} href={url}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="desktop">
        <Button href="/book">Book your visit</Button>
      </div>
      <MobileNav />
    </header>
  );
}
export function Footer() {
  return (
    <footer>
      <div>
        <Link className="wordmark" href="/">
          Jaz It Up<span>BEAUTY LOUNGE</span>
        </Link>
        <p>A little time for you. A look you love.</p>
      </div>
      <div>
        <Link href="/services">Services</Link>
        <Link href="/book">Book an appointment</Link>
        <Link href="/contact">Get in touch</Link>
      </div>
      <small>
        © {new Date().getFullYear()} Jaz It Up Beauty Lounge ·{" "}
        <Link href="/privacy">Privacy</Link> ·{" "}
        <Link href="/admin">Salon login</Link>
      </small>
    </footer>
  );
}
export function Intro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="intro">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{children}</p>
    </div>
  );
}
export function Placeholder({
  label = "Room for a little inspiration",
}: {
  label?: string;
}) {
  return (
    <div className="placeholder">
      <Scissors size={44} strokeWidth={1} />
      <span>{label}</span>
      <small>PHOTO COMING SOON</small>
    </div>
  );
}
