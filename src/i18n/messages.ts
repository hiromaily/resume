import type { Lang } from "./lang";

// Text for the view page, such as headings
export type ViewMessages = {
  skills: string;
  certifications: string;
  selfPr: string;
  projects: string;
  noProjects: string;
  period: string;
  company: string;
  projectName: string;
  duties: string;
  technologies: string;
  positions: string;
  present: string;
  switchLabel: string;
  pageTitle(name: string): string;
};

export const MESSAGES: Record<Lang, ViewMessages> = {
  ja: {
    skills: "スキル",
    certifications: "資格",
    selfPr: "自己PR",
    projects: "職務経歴",
    noProjects: "まだ職務経歴がありません",
    period: "期間",
    company: "会社名",
    projectName: "プロジェクト名",
    duties: "職務内容",
    technologies: "利用技術",
    positions: "ポジション",
    present: "現在",
    switchLabel: "言語",
    pageTitle: (name) => (name ? `${name} の職務経歴書` : "職務経歴書"),
  },
  en: {
    skills: "Skills",
    certifications: "Certifications",
    selfPr: "Self-PR",
    projects: "Work Experience",
    noProjects: "No work experience yet",
    period: "Period",
    company: "Company",
    projectName: "Project",
    duties: "Responsibilities",
    technologies: "Technologies",
    positions: "Positions",
    present: "Present",
    switchLabel: "Language",
    pageTitle: (name) => (name ? `${name} — Résumé` : "Résumé"),
  },
};
