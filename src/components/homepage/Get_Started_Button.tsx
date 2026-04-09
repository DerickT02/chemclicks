import Link from "next/link";

export default function Get_Started_Button() {
  return (
    <Link
      href="login/teacher"
      className="mt-6 inline-flex items-center justify-center rounded-lg bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
    >
      Get Started
    </Link>
  );
}
