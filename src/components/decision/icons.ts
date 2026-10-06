import {
  Baby, Briefcase, Building2, CalendarClock, Check, FileSignature, FileText, Gift, HandHeart, Heart, Hourglass, House, Landmark,
  Lock, PawPrint, Receipt, Scale, ScrollText, ShieldCheck, Stethoscope, TreePine, Umbrella, UserCheck, Users, Wallet,
  Accessibility, BadgeCheck, Banknote, ClipboardList, Coins, CreditCard, Gavel, Gem, GitBranch, Handshake, HeartHandshake, Hospital,
  KeyRound, Layers, Network, PiggyBank, Puzzle, Split, Sprout, UserPlus, UsersRound, type LucideIcon,
} from "lucide-react";

/** Icons a decision guide can name. Unknown names fall back to a check mark. */
export const DECISION_ICONS: Record<string, LucideIcon> = {
  Baby, Briefcase, Building2, CalendarClock, Check, FileSignature, FileText, Gift, HandHeart, Heart, Hourglass, House, Landmark,
  Lock, PawPrint, Receipt, Scale, ScrollText, ShieldCheck, Stethoscope, TreePine, Umbrella, UserCheck, Users, Wallet,
  Accessibility, BadgeCheck, Banknote, ClipboardList, Coins, CreditCard, Gavel, Gem, GitBranch, Handshake, HeartHandshake, Hospital,
  KeyRound, Layers, Network, PiggyBank, Puzzle, Split, Sprout, UserPlus, UsersRound,
};

export const iconFor = (name: string): LucideIcon => DECISION_ICONS[name] ?? Check;
