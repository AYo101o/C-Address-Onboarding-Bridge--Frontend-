import dynamic from "next/dynamic";

const ReferralsPage = dynamic(() => import("@/components/routes/referrals-page"), {
  loading: () => <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-sm text-[var(--text-muted)]">Loading referrals…</div>,
});

export default function ReferralsRoutePage() {
  return <ReferralsPage />;
}
