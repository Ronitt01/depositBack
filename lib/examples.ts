import type { ClassifiedDeduction, LeaseClauseFlag } from "./types";
import type { LetterParty } from "./letter";

export interface Example {
  id: string;
  label: string;
  blurb: string;
  jurisdictionCode: string;
  depositAmount: number;
  monthlyRent?: number;
  /** Days before "today" the tenant moved out (kept relative so the demo always feels current). */
  movedOutDaysAgo: number;
  /** Days before "today" the deposit balance came back; null = never returned. */
  returnedDaysAgo: number | null;
  deductions: ClassifiedDeduction[];
  leaseFlags: LeaseClauseFlag[];
  party: Partial<LetterParty>;
}

/**
 * Pre-classified, fully offline demo cases — the "Try an example" path renders a real
 * verdict + letter in ~1 second without calling Gemini (lead-with-offline demo rule).
 */
export const EXAMPLES: Example[] = [
  {
    id: "ca-padded",
    label: "California · padded move-out bill",
    blurb: "$1,800 deposit, returned 3 days late, with classic wear-and-tear padding.",
    jurisdictionCode: "US-CA",
    depositAmount: 1800,
    movedOutDaysAgo: 24,
    returnedDaysAgo: 0, // came back today → 24 days after move-out, 3 days late
    deductions: [
      {
        id: "1",
        text: "Repainting the entire apartment",
        amount: 350,
        verdict: "illegal",
        reason: "Routine repainting for normal fading is ordinary wear and tear, which California forbids deducting (Civ. Code § 1950.5).",
        basis: "Paint fading or aging from normal exposure",
      },
      {
        id: "2",
        text: "Carpet cleaning",
        amount: 250,
        verdict: "illegal",
        reason: "Standard carpet cleaning for normal use is not a permitted deduction in California.",
        basis: "Carpet worn thin from normal use",
      },
      {
        id: "3",
        text: "Patching nail holes from picture frames",
        amount: 120,
        verdict: "illegal",
        reason: "Minor nail holes are ordinary wear and tear and cannot be charged to the tenant.",
        basis: "Minor wall marks or nail holes",
      },
      {
        id: "4",
        text: "Replacing a cabinet door you broke",
        amount: 180,
        verdict: "legitimate",
        reason: "Actual physical damage beyond normal use can be deducted with documentation.",
      },
    ],
    leaseFlags: [
      {
        clause: "A $250 cleaning fee will be deducted from every security deposit.",
        isLikelyVoid: true,
        reason: "Automatic, non-refundable cleaning fees are unenforceable in California; cleaning for normal wear cannot be charged.",
      },
    ],
    party: {
      tenantName: "Jordan Rivera",
      landlordName: "Maple Grove Property Management",
      propertyAddress: "412 Alder St, Apt 5, Sacramento, CA",
      forwardingAddress: "88 Cedar Ave, Sacramento, CA 95811",
    },
  },
  {
    id: "in-overcap",
    label: "India · over-cap deposit, no refund",
    blurb: "₹2,00,000 deposit on ₹40,000 rent (5 months — over the 2-month cap), landlord stalling.",
    jurisdictionCode: "IN",
    depositAmount: 200000,
    monthlyRent: 40000,
    movedOutDaysAgo: 38,
    returnedDaysAgo: null, // never returned
    deductions: [
      {
        id: "1",
        text: "Repainting the flat",
        amount: 15000,
        verdict: "illegal",
        reason: "Repainting for normal fading is ordinary wear; only actual tenant-caused damage is deductible under the Model Tenancy Act, 2021.",
        basis: "Natural aging and fading of paint",
      },
      {
        id: "2",
        text: "Deep cleaning charges",
        amount: 8000,
        verdict: "ambiguous",
        reason: "Cleaning beyond normal use may be deductible, but only with receipts/photos showing the unit was left unreasonably dirty.",
      },
      {
        id: "3",
        text: "Replacing a damaged geyser",
        amount: 4000,
        verdict: "legitimate",
        reason: "Genuine damage to a fixture can be deducted if documented.",
      },
    ],
    leaseFlags: [
      {
        clause: "The security deposit is non-refundable if the tenant vacates before 24 months.",
        isLikelyVoid: true,
        reason: "Treating a security deposit as non-refundable contradicts the Model Tenancy Act, 2021 — the deposit is refundable after lawful deductions.",
      },
    ],
    party: {
      tenantName: "Aarav Sharma",
      landlordName: "Mr. R. Krishnan",
      propertyAddress: "Flat 304, Lakeview Residency, Indiranagar, Bengaluru",
      forwardingAddress: "12, MG Road, Bengaluru 560001",
    },
  },
];

export function getExample(id: string): Example | undefined {
  return EXAMPLES.find((e) => e.id === id);
}
