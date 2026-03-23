import Lesson_Overview from "../components/homepage/Lesson_Overview";
import EmailField from "../components/ui/EmailField";

export default function Home() {
    return (
        <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-[#0d1117]">
            <main className="flex w-full flex-col">
                
                {/* --- Hero / Newsletter Section --- */}
                <section className="py-20 px-8 md:px-16 w-full max-w-7xl mx-auto">
                    <div className="w-full">
                        <EmailField />
                    </div>
                </section>

                {/* --- Lesson Overview Section --- */}
                {/* 
                    We wrap this in its own section. Since Lesson_Overview 
                    has its own dark background and internal padding, 
                    we let it span the full width of the screen.
                */}
                <section className="w-full border-t border-[#30363d]">
                    <Lesson_Overview />
                </section>


            </main>

            {/* --- Simple Footer --- */}
            <footer className="py-8 border-t border-[#30363d] text-center text-sm text-gray-500">
                © {new Date().getFullYear()} 3DAI Lab. All rights reserved.
            </footer>
        </div>
    );
}