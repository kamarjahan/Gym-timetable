import "./globals.css";

export const metadata = {
  title: "ProFit Tracker",
  description: "Track your weekly workout streaks",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}