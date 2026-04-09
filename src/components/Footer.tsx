import Image from "next/image";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-background text-muted-foreground">
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
                <h3 className="text-sm font-bold text-foreground">CHEMISTRY CURRICULUM</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Master chemistry with interactive tools.
                </p>
              </div>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground md:mb-4">
              Product
            </h4>
            <ul className="space-y-2.5 text-sm md:space-y-3">
              <li>
                <a href="#" className="transition hover:text-foreground">
                  Bohr Models
                </a>
              </li>
              <li>
                <a href="#" className="transition hover:text-foreground">
                  Stability & Levels
                </a>
              </li>
              <li>
                <a href="#" className="transition hover:text-foreground">
                  Measurement Lab
                </a>
              </li>
            </ul>
          </div>

          {/* For */}
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground md:mb-4">
              For
            </h4>
            <ul className="space-y-2.5 text-sm md:space-y-3">
              <li>
                <a href="#" className="transition hover:text-foreground">
                  Teachers
                </a>
              </li>
              <li>
                <a href="#" className="transition hover:text-foreground">
                  Students
                </a>
              </li>
              <li>
                <a href="#" className="transition hover:text-foreground">
                  Schools
                </a>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground md:mb-4">
              Resources
            </h4>
            <ul className="space-y-2.5 text-sm md:space-y-3">
              <li>
                <a href="#" className="transition hover:text-foreground">
                  Docs
                </a>
              </li>
              <li>
                <a href="#" className="transition hover:text-foreground">
                  Help center
                </a>
              </li>
              <li>
                <a href="#" className="transition hover:text-foreground">
                  Guides
                </a>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-foreground md:mb-4">
              Stay Up to Date
            </h4>
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full rounded border border-border bg-card px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex flex-col gap-4 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:pt-8">
          <p>&copy; 2026 Chemistry Curriculum. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="transition hover:text-foreground">
              Privacy
            </a>
            <a href="#" className="transition hover:text-foreground">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
