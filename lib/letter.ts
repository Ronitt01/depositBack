import { formatMoney } from "./engine";
import type { CaseInput, CaseVerdict, LeaseClauseFlag } from "./types";

export interface LetterParty {
  tenantName: string;
  landlordName: string;
  propertyAddress: string;
  forwardingAddress: string;
}

const DEFAULT_PARTY: LetterParty = {
  tenantName: "[Your name]",
  landlordName: "[Landlord / property manager]",
  propertyAddress: "[Rental address]",
  forwardingAddress: "[Your current mailing address]",
};

function prettyDate(iso: string): string {
  const t = Date.parse(iso + "T00:00:00Z");
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

/**
 * Deterministic demand letter. Every number and citation comes from the engine + the
 * verified jurisdiction table — the model never invents them. The letter is informational,
 * not legal advice.
 */
export function generateDemandLetter(
  input: CaseInput,
  verdict: CaseVerdict,
  party: Partial<LetterParty> = {},
  leaseFlags: LeaseClauseFlag[] = [],
): string {
  const p = { ...DEFAULT_PARTY, ...party };
  const j = verdict.jurisdiction;
  const cur = j.currency;
  const { deadline, recovery } = verdict;

  const illegal = input.deductions.filter((d) => d.verdict === "illegal");
  const ambiguous = input.deductions.filter((d) => d.verdict === "ambiguous");

  const L: string[] = [];
  L.push(prettyDate(input.asOfDate));
  L.push("");
  L.push(`To: ${p.landlordName}`);
  L.push(`From: ${p.tenantName}`);
  L.push(`Re: Demand for return of security deposit — ${p.propertyAddress}`);
  L.push("");
  L.push(`Dear ${p.landlordName},`);
  L.push("");

  // Opening + facts.
  const moveOut = prettyDate(input.moveOutDate);
  L.push(
    `I am writing to formally demand the return of my security deposit of ${formatMoney(
      input.depositAmount,
      cur,
    )} for the above property, which I vacated on ${moveOut}.`,
  );
  L.push("");

  // Deadline argument.
  if (deadline.applicable && deadline.deadlineDays !== null) {
    if (deadline.forfeitsAll) {
      L.push(
        `Under ${j.statuteCitation}, you were required to return my deposit and provide an itemized statement within ${deadline.deadlineDays} days. ${
          deadline.returned
            ? `You did not do so until ${deadline.lateByDays} day(s) after that deadline.`
            : `${deadline.daysTaken} days have now passed with no return.`
        } Because that deadline was missed, you have forfeited the right to retain any portion of the deposit, regardless of any claimed damage.`,
      );
    } else if (deadline.isLate) {
      L.push(
        `Under ${j.statuteCitation}, the deposit and an itemized statement were due within ${deadline.deadlineDays} days of ${j.returnDeadline.trigger}. That deadline has passed, which raises a presumption that the deposit was withheld in bad faith.`,
      );
    } else {
      L.push(
        `Under ${j.statuteCitation}, a landlord may only withhold amounts for actual damage beyond ordinary wear and tear, supported by an itemized statement.`,
      );
    }
  } else {
    L.push(
      `Under ${j.statuteCitation}, a security deposit must be refunded after I hand over vacant possession, less only lawful, itemized, and documented deductions for actual damage beyond normal wear and tear.`,
    );
  }
  L.push("");

  // Over-cap (India / Colorado).
  if (recovery.depositCapFlag) {
    L.push(
      `Separately, the deposit you collected (${formatMoney(input.depositAmount, cur)}) exceeds the statutory cap of ${recovery.depositCapFlag.capMonths} month(s)' rent (${formatMoney(
        recovery.depositCapFlag.capAmount,
        cur,
      )}) by ${formatMoney(recovery.depositCapFlag.overBy, cur)}. ${recovery.depositCapFlag.note}`,
    );
    L.push("");
  }

  // Challenged deductions.
  if (illegal.length > 0) {
    L.push(`The following deductions are not permitted under ${j.name} law and must be refunded:`);
    for (const d of illegal) {
      L.push(`  • ${d.text} — ${formatMoney(d.amount, cur)}: ${d.reason}`);
    }
    L.push("");
  }
  if (ambiguous.length > 0) {
    L.push(`I also dispute the following deductions and request documentation (receipts/invoices/photographs) for each:`);
    for (const d of ambiguous) {
      L.push(`  • ${d.text} — ${formatMoney(d.amount, cur)}: ${d.reason}`);
    }
    L.push("");
  }

  // Void lease clauses.
  const voidFlags = leaseFlags.filter((f) => f.isLikelyVoid);
  if (voidFlags.length > 0) {
    L.push(`Any lease clause purporting to justify these charges is unenforceable. Specifically:`);
    for (const f of voidFlags) {
      L.push(`  • "${f.clause}" — ${f.reason}`);
    }
    L.push("");
  }

  // The demand + numbers.
  L.push(
    `Accordingly, I demand the return of ${formatMoney(recovery.baseOwed, cur)}${
      recovery.baseOwed !== input.depositAmount ? "" : " (the full deposit)"
    }.`,
  );
  if (recovery.penalty.applies && recovery.penalty.multiplier) {
    const cond =
      recovery.penalty.condition === "automatic"
        ? "If I am forced to pursue this in court,"
        : "Should a court find this withholding was in bad faith,";
    L.push(
      `${cond} ${j.name} law (${j.statuteCitation}) further provides for statutory damages of up to ${recovery.penalty.multiplier}× the wrongfully-withheld amount${
        recovery.penalty.flat ? ` plus ${formatMoney(recovery.penalty.flat, cur)}` : ""
      }${recovery.penalty.condition === "automatic" ? "" : ", plus attorney's fees"} — exposing you to as much as ${formatMoney(
        recovery.totalHigh,
        cur,
      )}.`,
    );
  }
  L.push("");

  // Deadline to respond + escalation.
  L.push(
    `Please remit ${formatMoney(recovery.baseOwed, cur)} to me at ${p.forwardingAddress} within 14 days of the date of this letter.`,
  );
  L.push(
    `If I do not receive payment, I am prepared to pursue this claim in ${j.smallClaims.forum} (jurisdictional limit ${j.smallClaims.limit}), where ${
      j.country === "IN" ? "the matter would be decided by the Rent Authority" : "I will also seek any statutory damages, costs, and fees available to me"
    }.`,
  );
  L.push("");
  L.push(`I would prefer to resolve this without litigation and look forward to your prompt response.`);
  L.push("");
  L.push(`Sincerely,`);
  L.push(p.tenantName);
  L.push("");
  L.push("———");
  L.push(
    `This letter was prepared with DepositBack and is for informational purposes only. It is not legal advice and does not create an attorney–client relationship. Verify the cited statute (${j.statuteCitation}) and consider consulting a local attorney or legal-aid office.`,
  );

  return L.join("\n");
}
