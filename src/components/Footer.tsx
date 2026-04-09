import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-black-400 bg-background border-b border-foreground/10 text-slate-400">
      <div className="mx-auto max-w-7xl px-6 py-12 md:px-8 md:py-16">
        <div className="mb-10 grid grid-cols-1 gap-8 md:mb-12 md:grid-cols-5 md:gap-12">
          {/* Brand Section */}
          <div className="md:col-span-1">
            <div className="mb-4 flex items-start gap-3">
              <Image
                src="/favicon.svg"
                alt="ChemClicks logo"
                width={32}
                height={32}
                className="mt-1 h-8 w-8 flex-shrink-0"
              />
              <div>
                <h3 className="text-sm font-bold text-white">CHEMISTRY CURRICULUM</h3>
                <p className="mt-1 text-xs text-slate-500">Master chemistry with interactive tools.</p>
              </div>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white md:mb-4">Product</h4>
            <ul className="space-y-2.5 text-sm md:space-y-3">
              <li><a href="#" className="text-slate-400 transition hover:text-white">Bohr Models</a></li>
              <li><a href="#" className="text-slate-400 transition hover:text-white">Stability & Levels</a></li>
              <li><a href="#" className="text-slate-400 transition hover:text-white">Measurement Lab</a></li>
            </ul>
          </div>

          {/* For */}
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white md:mb-4">For</h4>
            <ul className="space-y-2.5 text-sm md:space-y-3">
              <li><a href="#" className="text-slate-400 transition hover:text-white">Teachers</a></li>
              <li><a href="#" className="text-slate-400 transition hover:text-white">Students</a></li>
              <li><a href="#" className="text-slate-400 transition hover:text-white">Schools</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white md:mb-4">Resources</h4>
            <ul className="space-y-2.5 text-sm md:space-y-3">
              <li><a href="#" className="text-slate-400 transition hover:text-white">Docs</a></li>
              <li><a href="#" className="text-slate-400 transition hover:text-white">Help center</a></li>
              <li><a href="#" className="text-slate-400 transition hover:text-white">Guides</a></li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white md:mb-4">Stay Up to Date</h4>
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full rounded border border-slate-700 bg-[#0d1117] px-4 py-2 text-sm text-slate-400 placeholder-slate-600 focus:border-slate-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col gap-4 border-t border-slate-800 pt-6 text-xs text-slate-500 md:flex-row md:items-center md:justify-between md:pt-8">
          <p>&copy; 2026 Chemistry Curriculum. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="text-slate-400 transition hover:text-white">Privacy</a>
            <a href="#" className="text-slate-400 transition hover:text-white">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}