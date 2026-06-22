import Hero from "@/components/hero/Hero";
import Tool from "@/components/tool/Tool";

export default function Home() {
  return (
    <main className="relative">
      <Hero />

      <div className="relative z-10 bg-paper">
        <Tool />

        <footer className="border-t border-line bg-paper-2">
          <div className="mx-auto max-w-3xl px-5 py-10 text-sm text-muted">
            <div className="flex items-center gap-2.5">
              <span className="inline-block h-3.5 w-3.5 rotate-45 rounded-[3px] bg-gradient-to-br from-gold-bright to-gold" />
              <span className="font-display text-lg text-ink">DepositBack</span>
            </div>
            <p className="mt-3 max-w-xl leading-relaxed">
              Built on verified statutes for 8 US states (CA, TX, NY, FL, Chicago&nbsp;IL, MA, CO, WA) and India&apos;s
              Model Tenancy Act, 2021. Every deadline, penalty, and citation comes from a real source — not a chatbot&apos;s
              memory. DepositBack is informational only and is <strong>not legal advice</strong>.
            </p>
            <p className="mt-4 text-xs text-muted">Day 8 of 10 apps in 10 days · No login · Nothing stored.</p>
          </div>
        </footer>
      </div>
    </main>
  );
}
