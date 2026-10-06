/**
 * Probate filing fees published by Illinois circuit clerks, read from each clerk's official fee schedule
 * (researched 2026-10-06). Only schedules we could read are listed; the counties in FEES_NOT_FOUND publish no
 * readable schedule online. Fees change every year or two, so each row carries its schedule's effective date
 * and link. Shown at /estate-planning/illinois-probate-fees.
 */
export interface CountyProbateFees {
  county: string;
  /** Filing fee to open a decedent's estate, in dollars. */
  estate: number;
  /** Appearance fee, in dollars, where the schedule charges one. */
  appearance: number;
  /** Fee to file a will, in dollars; null when the schedule doesn't list one. */
  will: number | null;
  /** Effective date of the schedule, YYYY-MM-DD. */
  effective: string;
  source: string;
  note: string;
}

export const ILLINOIS_PROBATE_FEES: CountyProbateFees[] = [
  { county: "Cook", estate: 479, appearance: 250, will: 0, effective: "2025-10-01", source: "https://services.cookcountyclerkofcourt.org/forms/Forms/pdf_files/CCP0607.pdf", note: "A newer schedule may follow October 2026. Check with the clerk." },
  { county: "DuPage", estate: 300, appearance: 230, will: 0, effective: "2026-09-11", source: "https://dupagecircuitclerk.gov/18thJudicial/viewstaticpdf?pdfFile=FilingFeesSchedule.pdf", note: "No appearance fee for the executor or administrator." },
  { county: "Will", estate: 314, appearance: 244, will: 0, effective: "2026-07-12", source: "https://www.circuitclerkofwillcounty.com/portals/0/Fee%20Schedule%2009032026.pdf", note: "Listed as the new probate case filing fee." },
  { county: "Kane", estate: 314, appearance: 244, will: 0, effective: "2026-09-01", source: "https://cic.countyofkane.org/Documents/FeeSchedule.pdf", note: "" },
  { county: "McHenry", estate: 264, appearance: 194, will: 0, effective: "2026-10-01", source: "https://www.mchenrycircuitclerk.org/wp-content/uploads/2026/08/Civil-Filing-Fee-List-Revised-10-01-2026.pdf", note: "Revised schedule effective October 1, 2026. No appearance fee for the executor or administrator." },
  { county: "Winnebago", estate: 392, appearance: 217, will: 0, effective: "2026-07-20", source: "https://www.circuitclerk.wincoil.gov/assets/1/7/Civil_Filing_Fee_List_-_07202026_V1.pdf", note: "" },
  { county: "St. Clair", estate: 366, appearance: 189, will: 0, effective: "2025-10-01", source: "https://www.stclaircountyil.gov/webdocuments/departments/circuitclerk/additionalResources/Circuit Clerk Fee Schedule.pdf", note: "Includes a $100 Guardianship and Advocacy fee." },
  { county: "Sangamon", estate: 276, appearance: 206, will: null, effective: "2026-09-21", source: "https://www.sangamoncountycircuitclerk.org/application/files/8717/8973/7703/9-21-2026_Filing_Fees_Final.pdf", note: "The schedule does not list a will filing fee." },
  { county: "Peoria", estate: 281, appearance: 211, will: null, effective: "2026-09-04", source: "https://www.peoriacounty.gov/DocumentCenter/View/18900/Peoria-County-Circuit-Clerk-Filing-Fees-9426", note: "Effective date from the clerk's page. The schedule does not list a will filing fee." },
  { county: "McLean", estate: 282, appearance: 212, will: null, effective: "2026-09-17", source: "https://www.mcleancountyil.gov/1162/Civil-Fee-Schedule-PDF", note: "Listed as one Guardianship and Probate fee. The schedule does not state a will filing fee." },
];

/** Counties researched whose clerk schedule could not be read online. */
export const FEES_NOT_FOUND = ["Lake", "Madison", "Champaign", "Rock Island", "Tazewell", "Kankakee"];

export const RESEARCHED_ON = "2026-10-06";
