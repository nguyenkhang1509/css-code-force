import type { Metadata } from "next";
import "./globals.css";
import "katex/dist/katex.min.css";
import { Navbar } from "@/components/navbar";

export const metadata: Metadata = {
  title: { default: "Computer Science Society | American Heritage School Broward", template: "%s · Computer Science Society" },
  description: "Practice programming and grow with Computer Science Society at American Heritage School Broward.",
  icons: { icon: "/logo.gif", apple: "/logo.gif" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" suppressHydrationWarning><body><Navbar /><main className="site-main">{children}</main><footer className="footer"><div className="container footer-inner">Computer Science Society (American Heritage School Broward)</div></footer></body></html>;
}
