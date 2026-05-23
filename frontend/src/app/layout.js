import "./globals.css";

export const metadata = {
  title: "Kaba-Compta Togo",
  description: "Plateforme de mise en relation pour assistants et missions au Togo",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
