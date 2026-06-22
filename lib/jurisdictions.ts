import type { Jurisdiction } from "./types";

/**
 * Verified residential security-deposit law for 8 US states + India.
 *
 * Sourced and adversarially fact-checked against primary sources (statute text,
 * official .gov / court self-help, India's Model Tenancy Act 2021) by a research
 * workflow on 2026-06-22. Each record carries its statute citation + source URLs.
 *
 * This is reference data, NOT legal advice. Laws change; verify the cited statute.
 */
export const JURISDICTIONS: Jurisdiction[] = [
  {
    code: "US-CA",
    name: "California",
    short: "California (US)",
    country: "US",
    currency: "USD",
    returnDeadline: {
      days: 21,
      trigger: "the day you moved out / handed back possession",
      forfeitsOnLate: true,
      note: "Landlord must send an itemized statement and return the balance within 21 calendar days. Miss it and the landlord forfeits the right to keep any of the deposit.",
    },
    itemizedStatement: {
      required: true,
      rule: "Itemized statement required within 21 days. For deductions over $125, the landlord must include receipts, invoices, or documented labor rates.",
    },
    penalty: {
      multiplier: 2,
      condition: "bad-faith",
      note: "Up to 2x the deposit in statutory damages — but only if a court finds the landlord acted in bad faith. Not automatic.",
    },
    wearAndTear: {
      nonDeductible: [
        "Carpet worn thin from normal use",
        "Paint fading or aging from normal exposure",
        "Minor wall marks or nail holes",
        "Normal deterioration of fixtures and appliances from age",
        "Worn flooring from normal traffic",
      ],
      note: "Landlords cannot deduct for ordinary wear and tear. Deductions are limited to restoring the unit to its move-in condition, minus wear and tear.",
    },
    statuteCitation: "Cal. Civ. Code § 1950.5",
    sourceUrls: [
      "https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1950.5&lawCode=CIV",
      "https://selfhelp.courts.ca.gov/guide-security-deposits-california",
    ],
    smallClaims: {
      limit: "$12,500",
      filingFee: "$30–$75 depending on claim size",
      statuteOfLimitations: "3 years (CCP § 338(a))",
      forum: "Superior Court, Small Claims Division",
    },
    voidClauses: [
      "Non-refundable deposit clauses",
      "Automatic cleaning-fee provisions",
      "Forfeiture clauses for minor violations",
      "Clauses requiring 'perfect condition' to return the deposit",
    ],
    confidence: "high",
    caveats:
      "AB 2801 (2024–2025) added move-in/move-out photo documentation rules and clarified the bad-faith penalty standard. The 21-day deadline is strict; courts read it in tenants' favor.",
  },
  {
    code: "US-TX",
    name: "Texas",
    short: "Texas (US)",
    country: "US",
    currency: "USD",
    returnDeadline: {
      days: 30,
      trigger: "the LATER of moving out or giving the landlord a written forwarding address",
      forfeitsOnLate: false,
      note: "30 days from the later of surrender or your written forwarding address. Missing it does NOT cost you the deposit — it raises a presumption of bad faith, which unlocks heavy penalties.",
    },
    itemizedStatement: {
      required: true,
      rule: "If any amount is withheld, the landlord must give a written, itemized list of deductions. Bad-faith failure to itemize forfeits all withholding rights + attorney's fees.",
    },
    penalty: {
      multiplier: 3,
      condition: "bad-faith",
      flat: 100,
      note: "Bad-faith retention = $100 + 3x the wrongfully-withheld amount + attorney's fees. Bad faith is presumed if the 30-day deadline is blown.",
    },
    wearAndTear: {
      nonDeductible: [
        "Worn carpet from normal use",
        "Faded paint or wallpaper",
        "Breakage or malfunction due to age or deteriorated condition",
        "Scuffs from normal furniture placement",
        "Minor nail holes for hanging pictures",
      ],
      note: "Normal wear and tear (deterioration from intended use) cannot be deducted. Damage from negligence, carelessness, accident, or abuse can.",
    },
    statuteCitation: "Tex. Prop. Code ch. 92, subch. C (§§ 92.101–92.109)",
    sourceUrls: [
      "https://texas.public.law/statutes/tex._prop._code_section_92.109",
      "https://guides.sll.texas.gov/landlord-tenant-law/security-deposits",
    ],
    smallClaims: {
      limit: "$20,000",
      filingFee: "$25–$54 in Justice Court (plus service costs)",
      statuteOfLimitations: "4 years (Tex. Civ. Prac. & Rem. Code § 16.051)",
      forum: "Justice Court (Justice of the Peace)",
    },
    voidClauses: [
      "Non-refundable security deposit clauses",
      "Clauses authorizing forfeiture of the deposit (§ 92.106 — void)",
      "Blanket cleaning fees buried inside the deposit",
      "Deductions without written itemization",
    ],
    confidence: "high",
    caveats:
      "The clock runs from the LATER of move-out or your written forwarding address — give the address in writing to start it. The 3x penalty applies only to bad-faith withholding.",
  },
  {
    code: "US-NY",
    name: "New York",
    short: "New York (US)",
    country: "US",
    currency: "USD",
    returnDeadline: {
      days: 14,
      trigger: "the day you moved out",
      forfeitsOnLate: true,
      note: "Landlord must deliver an itemized statement AND return the balance within 14 days of move-out. Miss it and the landlord forfeits the right to keep any of it.",
    },
    itemizedStatement: {
      required: true,
      rule: "Itemized statement of repair/cleaning costs required within 14 days. Before move-out, the landlord must offer an inspection so you can fix issues first.",
    },
    penalty: {
      multiplier: 2,
      condition: "bad-faith",
      note: "Up to 2x the deposit for willful violations, plus actual damages. The landlord carries the burden of proving deductions were reasonable.",
    },
    wearAndTear: {
      nonDeductible: [
        "Normal wear and tear from ordinary use",
        "Fading or discoloration of paint/walls from age",
        "Ordinary deterioration of flooring",
        "Minor scuffs or marks consistent with residential use",
        "Depreciation of fixtures and appliances",
      ],
      note: "Landlords may only deduct repair/cleaning costs beyond normal wear and tear, and must prove the deductions are reasonable.",
    },
    statuteCitation: "N.Y. Gen. Oblig. Law § 7-108 (waiver void under § 7-103)",
    sourceUrls: [
      "https://www.nysenate.gov/legislation/laws/GOB/7-108",
      "https://ag.ny.gov/resources/individuals/tenants-homeowners/tenants/recovering-rent-security-deposits-and-interest",
    ],
    smallClaims: {
      limit: "$10,000 (NYC) · $3,000–$5,000 (other courts)",
      filingFee: "$10–$20",
      statuteOfLimitations: "6 years (CPLR § 213)",
      forum: "Small Claims Court (City/Town/Village)",
    },
    voidClauses: [
      "Non-refundable deposit (or non-refundable portion)",
      "Any waiver of deposit rights (GOL § 7-103 — absolutely void)",
      "Co-mingling deposits with the landlord's own funds",
      "Automatic cleaning fees or repair deductions",
    ],
    confidence: "high",
    caveats:
      "Penalty is for willful violations only. Buildings with 6+ units may keep a 1% administrative fee. Rent-stabilized units have extra protections (§ 7-107).",
  },
  {
    code: "US-FL",
    name: "Florida",
    short: "Florida (US)",
    country: "US",
    currency: "USD",
    returnDeadline: {
      days: 15,
      trigger: "the end of the rental agreement",
      forfeitsOnLate: true,
      note: "15 days to return the full deposit if no deductions. To claim deductions, the landlord must mail written notice within 30 days; you then have 15 days to object. Miss the 30-day notice and the landlord forfeits the right to claim anything.",
    },
    itemizedStatement: {
      required: false,
      rule: "The 30-day notice must state the amount claimed and the reason. Florida does not require receipts/photos in the notice itself — but the landlord must prove the damage if it goes to court.",
    },
    penalty: {
      multiplier: null,
      condition: "none",
      note: "No statutory damages multiplier. Remedies are: forfeiture of the right to deduct (if notice is late) and attorney's fees + court costs to the prevailing party.",
    },
    wearAndTear: {
      nonDeductible: [
        "Paint fading or aging",
        "Carpet or flooring wear from normal use",
        "Worn but functioning appliances",
        "Faded wallpaper or wall discoloration",
        "Normal settling or minor wall cracks",
      ],
      note: "Deductions are limited to costs and damages beyond normal wear and tear.",
    },
    statuteCitation: "Fla. Stat. § 83.49",
    sourceUrls: [
      "https://www.flsenate.gov/Laws/Statutes/2025/83.49",
    ],
    smallClaims: {
      limit: "$8,000 (small claims) · up to $50,000 (county court)",
      filingFee: "$55–$300 depending on claim size",
      statuteOfLimitations: "5 years (written lease) · 4 years (oral)",
      forum: "Small Claims / County Court",
    },
    voidClauses: [
      "Any clause waiving tenant rights under Chapter 83",
      "Clauses limiting the landlord's statutory liability",
      "Deposit-holding terms that violate the interest/account rules",
      "Waivers of the 30-day notice or 15-day objection window",
    ],
    confidence: "high",
    caveats:
      "No 2x/3x penalty in Florida. The key lever is the 30-day notice deadline (forfeiture) and attorney's-fees shifting. Send your objection within 15 days of any claim notice.",
  },
  {
    code: "US-IL-CHI",
    name: "Chicago, Illinois",
    short: "Chicago, IL (US)",
    country: "US",
    currency: "USD",
    returnDeadline: {
      days: 45,
      trigger: "the day you moved out",
      forfeitsOnLate: true,
      note: "Under Chicago's RLTO, the deposit balance is due within 45 days of move-out (itemized damage statement within 30 days). Chicago is stricter than Illinois state law.",
    },
    itemizedStatement: {
      required: true,
      rule: "Itemized statement of damages with repair costs due within 30 days; receipts required for repairs over $100.",
    },
    penalty: {
      multiplier: 2,
      condition: "automatic",
      note: "Chicago RLTO: 2x the deposit + interest + attorney's fees, AUTOMATIC for any violation (no need to prove bad faith). Stricter than Illinois state law (765 ILCS 710).",
    },
    wearAndTear: {
      nonDeductible: [
        "Light scuff marks and minor scratches",
        "Faded or worn paint (normal aging)",
        "Minor carpet wear",
        "Nail holes from hanging pictures",
        "Worn kitchen finishes from ordinary use",
      ],
      note: "Chicago RLTO excludes normal wear and tear. Deductions are limited to tenant-caused damage beyond normal use, plus unpaid rent.",
    },
    statuteCitation: "Chicago Municipal Code § 5-12-080 (RLTO)",
    sourceUrls: [
      "https://codelibrary.amlegal.com/codes/chicago/latest/chicago_il/0-0-0-2639124",
      "https://www.chicago.gov/city/en/depts/doh/provdrs/landlords/svcs/residential-landlord-and-tenant-ordinance.html",
    ],
    smallClaims: {
      limit: "$10,000",
      filingFee: "~$268 (Cook County)",
      statuteOfLimitations: "2 years from the violation",
      forum: "Small Claims Division, Cook County Circuit Court",
    },
    voidClauses: [
      "Non-refundable security deposits",
      "Automatic cleaning or maintenance fees",
      "Clauses making deposits non-recoverable",
      "Failure to hold the deposit in an insured Illinois interest-bearing account",
    ],
    confidence: "high",
    caveats:
      "This record is the City of Chicago RLTO, which is stricter than statewide Illinois (765 ILCS 710, where the 2x penalty needs bad faith). If your unit is outside Chicago, the state rules differ.",
  },
  {
    code: "US-MA",
    name: "Massachusetts",
    short: "Massachusetts (US)",
    country: "US",
    currency: "USD",
    returnDeadline: {
      days: 30,
      trigger: "the end of the tenancy",
      forfeitsOnLate: true,
      note: "Landlord must return the deposit (or balance) within 30 days of the tenancy ending. Missing the itemization rules forfeits the right to keep any of it.",
    },
    itemizedStatement: {
      required: true,
      rule: "Within 30 days, the landlord must provide an itemized list sworn under the pains and penalties of perjury, with written evidence (estimates, bills, receipts).",
    },
    penalty: {
      multiplier: 3,
      condition: "bad-faith",
      note: "Treble (3x) damages + 5% interest + attorney's fees for violating §§ 6(a),(d),(e). Strict liability — but courts will NOT impose treble damages if the landlord returns the deposit before you file suit.",
    },
    wearAndTear: {
      nonDeductible: [
        "Scuffs on walls",
        "Thinning or worn carpets from normal use",
        "Routine paint fade from normal aging",
        "Carpet shampooing / professional cleaning",
        "Routine repainting",
      ],
      note: "Peebles v. JRK Property Holdings (2025 SJC): tenants are not responsible for routine painting, carpet cleaning, or professional cleaning at move-out.",
    },
    statuteCitation: "Mass. Gen. Laws c. 186 § 15B",
    sourceUrls: [
      "https://malegislature.gov/Laws/GeneralLaws/PartII/TitleI/Chapter186/Section15B",
      "https://www.mass.gov/info-details/mass-general-laws-c186-ss-15b",
    ],
    smallClaims: {
      limit: "$7,000",
      filingFee: "$40–$150 by claim size (+ small surcharges)",
      statuteOfLimitations: "6 years (contract)",
      forum: "District / Housing / Boston Municipal Court, Small Claims",
    },
    voidClauses: [
      "Non-refundable deposits",
      "Automatic/unconditional cleaning fees",
      "Required professional cleaning or repainting at lease end",
      "Forfeiture clauses; any waiver of § 15B rights",
    ],
    confidence: "medium",
    caveats:
      "Treble-damages caselaw is nuanced (Mellor; Karaa/Castenholz): liability attaches without bad faith, but voluntary return before suit defeats the treble remedy. Confirm current caselaw before relying on the multiplier.",
  },
  {
    code: "US-CO",
    name: "Colorado",
    short: "Colorado (US)",
    country: "US",
    currency: "USD",
    returnDeadline: {
      days: 30,
      trigger: "the later of lease termination or surrender of the unit",
      forfeitsOnLate: true,
      note: "30 days by default (the lease may extend it up to 60). Failing to send the written statement in time forfeits all right to withhold.",
    },
    itemizedStatement: {
      required: true,
      rule: "Written statement of exact reasons within 30 (or up to 60) days. Supporting docs must be provided on written request. Failure forfeits all withholding rights.",
    },
    penalty: {
      multiplier: 3,
      condition: "automatic",
      note: "Willful retention triggers treble (3x) damages + attorney's fees + costs. HB25-1249 (eff. Jan 1, 2026) presumes bad faith if the landlord keeps 125%+ of actual damages.",
    },
    depositCap: {
      months: 1,
      note: "Colorado caps the deposit at 1 month's rent (effective Jan 1, 2026; reduced from 2 months).",
    },
    wearAndTear: {
      nonDeductible: [
        "Fading or minor wear from foot traffic",
        "Minor scuffs or fading on walls",
        "Peeling or fading paint from normal conditions",
        "Carpet more than 10 years old",
        "Light carpet staining or matting",
      ],
      note: "Normal wear is deterioration from intended use without negligence/abuse. HB25-1249 counts ordinary uncleanliness as normal wear unless it substantially reduces cleanliness.",
    },
    statuteCitation: "Colo. Rev. Stat. § 38-12-103",
    sourceUrls: [
      "https://colorado.public.law/statutes/crs_38-12-103",
      "https://leg.colorado.gov/bills/HB25-1249",
    ],
    smallClaims: {
      limit: "$7,500",
      filingFee: "$31–$55 by claim size",
      statuteOfLimitations: "1 year (treble penalty) · 6 years (deposit itself)",
      forum: "County Court, Small Claims Division",
    },
    voidClauses: [
      "Non-refundable security deposits",
      "Waivers of deposit-return rights",
      "Automatic / non-refundable cleaning fees",
      "Clauses attempting to forfeit the deposit",
    ],
    confidence: "high",
    caveats:
      "Treble damages key off WILLFUL retention (automatic on a willful violation). You must give 7 days' notice before suing. Deposit cap dropped to 1 month's rent on Jan 1, 2026.",
  },
  {
    code: "US-WA",
    name: "Washington",
    short: "Washington (US)",
    country: "US",
    currency: "USD",
    returnDeadline: {
      days: 30,
      trigger: "the end of the rental agreement and move-out",
      forfeitsOnLate: true,
      note: "30 days (changed from 21 in 2023). Miss it and the landlord is barred from asserting any claim against the deposit in court.",
    },
    itemizedStatement: {
      required: true,
      rule: "Full, specific itemized statement with copies of estimates/invoices. Landlord labor must show time and hourly rates.",
    },
    penalty: {
      multiplier: 2,
      condition: "bad-faith",
      note: "Court may award up to 2x for intentional refusal (discretionary). Prevailing party gets attorney's fees and costs.",
    },
    wearAndTear: {
      nonDeductible: [
        "Minor scratches, scuffs, nail holes from hanging pictures",
        "Fading or discoloration from normal use and light",
        "Carpet wear from normal use",
        "Carpet cleaning without documented excess wear",
        "Deterioration from age or aged-condition breakage",
      ],
      note: "Ordinary wear is deterioration from intended use. A 7-year-old carpet is treated as fully depreciated.",
    },
    statuteCitation: "RCW 59.18.280",
    sourceUrls: [
      "https://app.leg.wa.gov/rcw/default.aspx?cite=59.18.280",
    ],
    smallClaims: {
      limit: "$10,000 (individuals)",
      filingFee: "$35–$50 (varies by county)",
      statuteOfLimitations: "3 years from end of tenancy",
      forum: "District Court, Small Claims Division",
    },
    voidClauses: [
      "Non-refundable deposit unless clearly labeled",
      "Cleaning fees disguised as the deposit",
      "Forfeiture clauses waiving statutory protections",
      "Any waiver of RCW 59.18 protections",
    ],
    confidence: "high",
    caveats:
      "The 30-day deadline applies to tenancies after July 23, 2023. The 2x penalty is discretionary, not automatic. Missing the deadline fully bars the landlord's claims.",
  },
  {
    code: "IN",
    name: "India",
    short: "India",
    country: "IN",
    currency: "INR",
    returnDeadline: {
      days: null,
      trigger: "handing back vacant possession of the premises",
      forfeitsOnLate: false,
      note: "There is NO fixed nationwide deadline. The Model Tenancy Act 2021 says the deposit is refunded 'at the time of taking over vacant possession' after lawful deductions. Maharashtra's Rent Control Act says 'within one month'. Common practice is 15–30 days.",
    },
    itemizedStatement: {
      required: true,
      rule: "Deductions must be itemized with supporting invoices/receipts and limited to actual damage or genuine dues. Unsupported deductions are unenforceable.",
    },
    penalty: {
      multiplier: null,
      condition: "discretionary",
      note: "No automatic 2x/3x multiplier exists in India. A Rent Authority can order the refund plus interest and may sanction non-compliance. Remedies are discretionary, not formulaic.",
    },
    depositCap: {
      months: 2,
      note: "Model Tenancy Act 2021 caps the residential security deposit at 2 months' rent (6 months for commercial). Many landlords (esp. metro cities) collect more — anything over 2 months is over the statutory cap in adopting states.",
    },
    wearAndTear: {
      nonDeductible: [
        "Natural aging and fading of paint",
        "Minor scuffs on floors and walls",
        "Worn hinges and fixtures from normal use",
        "Peeling paint from age",
        "Normal deterioration from passage of time",
      ],
      note: "Only actual damage beyond normal use is deductible. The landlord bears the burden of proof with photos and invoices. The MTA does not exhaustively define wear and tear; Rent Authorities decide case by case.",
    },
    statuteCitation: "The Model Tenancy Act, 2021 — §10 (deposit cap), §11 (refund), §35 (60-day dispute target)",
    sourceUrls: [
      "https://mohua.gov.in/upload/uploadfiles/files/Model-Tenancy-Act-English-02_06_2021.pdf",
      "https://prsindia.org/billtrack/the-model-tenancy-act-2021",
    ],
    smallClaims: {
      limit: "No monetary cap — Rent Authority jurisdiction is unlimited for eligible disputes",
      filingFee: "Set by each state government (no national fee)",
      statuteOfLimitations: "3 years from refusal after a written demand (Limitation Act 1963, Art. 113)",
      forum: "Rent Authority (then Rent Court → Rent Tribunal). Civil courts have no jurisdiction under the MTA.",
    },
    voidClauses: [
      "Non-refundable security deposit clauses",
      "Automatic forfeiture without proof of actual damage",
      "Treating the deposit as advance rent / a non-refundable fee",
      "Deposit terms exceeding the statutory cap (2 months residential)",
    ],
    confidence: "high",
    caveats:
      "The Model Tenancy Act is a CENTRAL MODEL — adoption is state-by-state (Karnataka, Maharashtra, Tamil Nadu, UP, Gujarat, etc.; Delhi uses its updated 2020 Act). It sets no fixed return-deadline and no damages multiplier. Send a written demand first; disputes go to the state Rent Authority, not a US-style small-claims court.",
  },
];

export function getJurisdiction(code: string): Jurisdiction | undefined {
  return JURISDICTIONS.find((j) => j.code === code);
}
