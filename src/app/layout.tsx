import type { Metadata } from "next";
import CosmeticRoot from "@/components/cosmetic-root";
import "./globals.css";

export const metadata: Metadata = {
  title: "Life RPG",
  description: "把人生当RPG来升级"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark">
      <body>
        <CosmeticRoot />
        {children}
      </body>
    </html>
  );
}
