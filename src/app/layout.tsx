// src/app/layout.tsx\
import "@/styles/globals.css"
export const metadata = {
    title: "Doubt Q",
    description: "A Simply and quickly adpotable RAG and LLM powered AI chat application ",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className="min-h-screen bg-gray-100">
                {children}
            </body>
        </html>
    );
}
