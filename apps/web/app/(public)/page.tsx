import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="welcome">
      <div className="welcome-card">
        <div className="brand-mark" aria-hidden="true">S</div>
        <p className="eyebrow">HOTEL SECURITY OPERATIONS</p>
        <h1>Clarity across your hotel&apos;s security posture.</h1>
        <p className="intro">
          StayShield brings network, identity, device, and incident oversight
          together for authorised hotel security teams.
        </p>
        <Link className="button primary" href="/auth/login">Sign in to StayShield</Link>
        <p className="privacy-note">
          Monitoring is designed to be authorised, transparent, and privacy-aware.
        </p>
      </div>
    </main>
  );
}
