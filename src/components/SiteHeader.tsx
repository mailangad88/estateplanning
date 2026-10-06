"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight, Baby, BookOpen, Briefcase, Calculator, ChevronDown, CircleHelp, ClipboardCheck, ClipboardList, Download,
  FileText, GraduationCap, HandHeart, Heart, House, Landmark, Library, ListChecks, MapPin, Menu, Newspaper, Phone,
  Scale, ScrollText, ShieldCheck, Stethoscope, Sun, Users, Video, X, type LucideIcon,
} from "lucide-react";
import { NAV } from "@/config/navigation";
import { useTrackingNumber } from "@/components/TrackedPhone";
import { telHref } from "@/lib/tracking-number";

const ICONS: Record<string, LucideIcon> = {
  Baby, BookOpen, Briefcase, Calculator, CircleHelp, ClipboardCheck, ClipboardList, Download, FileText, GraduationCap,
  HandHeart, Heart, House, Landmark, Library, ListChecks, MapPin, Newspaper, Scale, ScrollText, ShieldCheck, Stethoscope,
  Sun, Users, Video,
};

/** Brand mark: a rounded house roof sheltering a leaf, drawn in the palette. */
export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="var(--brand)" />
      <path d="M9 21 L20 11 L31 21" fill="none" stroke="var(--gold)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 31 C13 29 13 22 20 18 C27 22 27 29 20 31 Z" fill="#fbf8f3" />
      <path d="M20 31 V23" stroke="var(--brand)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Site header with a mega menu. Desktop: hover or click a group to open its panel. Phones: a menu
 * button opens a drawer where each group is an accordion. Escape, an outside click or navigating
 * closes everything.
 */
export default function SiteHeader({ brandName, phone: fallback }: { brandName: string; phone: string }) {
  const [open, setOpen] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const ref = useRef<HTMLElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phone = useTrackingNumber(fallback);

  useEffect(() => {
    setOpen(null);
    setDrawer(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
        setDrawer(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null);
    };
    const onScroll = () => setScrolled(window.scrollY > 8);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("nav-locked", drawer);
  }, [drawer]);

  const hover = (label: string | null) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (!window.matchMedia("(hover: hover) and (min-width: 1024px)").matches) return;
    hoverTimer.current = setTimeout(() => setOpen(label), label ? 80 : 180);
  };

  return (
    <header ref={ref} className={`site-header${scrolled ? " is-scrolled" : ""}${drawer ? " is-drawer" : ""}`}>
      <div className="site-header__bar">
        <Link href="/" className="brand" aria-label={`${brandName}, home`}>
          <BrandMark />
          <span>{brandName}</span>
        </Link>
        <nav className="mega" aria-label="Main" id="main-nav">
          <ul className="mega__list">
            {NAV.map((g) => {
              const isOpen = open === g.label;
              const id = `mega-${g.label.toLowerCase().replace(/\W+/g, "-")}`;
              return (
                <li key={g.label} className={`mega__item${isOpen ? " is-open" : ""}`} onMouseEnter={() => hover(g.label)} onMouseLeave={() => hover(null)}>
                  <button type="button" className="mega__trigger" aria-expanded={isOpen} aria-controls={id} onClick={() => setOpen(isOpen ? null : g.label)}>
                    {g.label}
                    <ChevronDown size={16} aria-hidden="true" />
                  </button>
                  <div className="mega__panel" id={id} hidden={!isOpen}>
                    <div className="mega__inner">
                      <ul className={`mega__links${g.links.length > 6 ? " is-wide" : ""}`}>
                        {g.links.map((l) => {
                          const Icon = l.icon ? ICONS[l.icon] : undefined;
                          return (
                            <li key={l.href}>
                              <Link href={l.href} className="mega__link">
                                {Icon && (
                                  <span className="mega__icon">
                                    <Icon size={20} aria-hidden="true" />
                                  </span>
                                )}
                                <span>
                                  <strong>{l.label}</strong>
                                  {l.desc && <small>{l.desc}</small>}
                                </span>
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                      {g.feature && (
                        <aside className="mega__feature">
                          <strong>{g.feature.title}</strong>
                          <p>{g.feature.text}</p>
                          <Link href={g.feature.href} className="mega__feature-link">
                            {g.feature.cta} <ArrowRight size={16} aria-hidden="true" />
                          </Link>
                        </aside>
                      )}
                    </div>
                    {g.footer && (
                      <Link href={g.footer.href} className="mega__footer">
                        {g.footer.label} <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
            <li className="mega__item">
              <Link href="/pricing" className="mega__trigger">Pricing</Link>
            </li>
          </ul>
          <div className="mega__actions">
            <a className="header-phone" href={telHref(phone)} aria-label={`Call ${phone}`}>
              <Phone size={16} aria-hidden="true" />
              <span>{phone}</span>
            </a>
            <Link href="/plan-finder" className="button">Book a consult</Link>
          </div>
        </nav>
        <div className="site-header__mobile">
          <a className="icon-button" href={telHref(phone)} aria-label={`Call ${phone}`}>
            <Phone size={20} aria-hidden="true" />
          </a>
          <button type="button" className="icon-button" aria-expanded={drawer} aria-controls="main-nav" onClick={() => setDrawer(!drawer)} aria-label={drawer ? "Close menu" : "Open menu"}>
            {drawer ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}
