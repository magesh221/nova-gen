
import "./globals.css";
import Providers from "./providers";

export const metadata = {
  title: "Nova AI | Your AI Assistant",
  description: "A modern AI chatbot built with Next.js",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
