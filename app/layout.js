import './globals.css';

export const metadata = {
  title: { default: 'Job Radar', template: '%s · Job Radar' },
  description: 'Remote developer jobs from public boards, scored against your skills.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
