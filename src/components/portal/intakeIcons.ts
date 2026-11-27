import { Baby, FileText, Flag, HeartHandshake, Home, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import type { QuestionSection } from "@/lib/intakeQuestionnaire";

/** Icons for the intake questionnaire's sections, shared by the form and the lead page. */
export const INTAKE_ICONS: Record<QuestionSection["icon"], LucideIcon> = { users: Users, family: Baby, home: Home, heart: HeartHandshake, shield: ShieldCheck, file: FileText, flag: Flag };
