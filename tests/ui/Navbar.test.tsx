/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { NavigationIdentity } from "@/lib/auth/navigation";

const mocks = vi.hoisted(() => ({
  pathname: "/", identity: vi.fn(), signOut: vi.fn(), getSession: vi.fn(),
  onAuthStateChange: vi.fn(), unsubscribe: vi.fn(), replace: vi.fn(), refresh: vi.fn(),
}));
vi.mock("@/lib/auth/navigation", () => ({ getNavigationIdentity: mocks.identity }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({
  auth: { signOut: mocks.signOut, getSession: mocks.getSession, onAuthStateChange: mocks.onAuthStateChange },
}) }));
vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("next/link", () => ({ default: ({ children, onClick, ...props }: ComponentProps<"a">) => (
  <a {...props} onClick={(event) => { onClick?.(event); event.preventDefault(); }}>{children}</a>
) }));

import Navbar from "@/components/Navbar";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.pathname = "/";
  mocks.identity.mockResolvedValue({ status: "signed-out" });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: mocks.unsubscribe } } });
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
  vi.stubGlobal("scrollTo", vi.fn());
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  const toggle = screen.getByRole("button", { name: "Toggle menu" });
  await user.click(toggle);
  expect(toggle).toHaveAttribute("aria-expanded", "true");
  const menu = document.getElementById(toggle.getAttribute("aria-controls")!);
  expect(menu).toBeVisible();
  return menu!;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function signedIn(role: "student" | "teacher" | null = "student") {
  mocks.identity.mockResolvedValue({ status: "signed-in", role });
  const view = render(<Navbar />);
  await screen.findByRole("button", { name: "Sign out" });
  return view;
}

describe("role-aware navigation", () => {
  it.each(["/", "/admin", "/student/labs"])("does not infer identity from %s", async (path) => {
    mocks.pathname = path;
    const user = userEvent.setup();
    render(<Navbar />);
    expect(await screen.findByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Features" })).toHaveAttribute("href", "/#features");
    expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute("href", "/#how-it-works");
    expect(screen.getByRole("link", { name: "ChemClicks" })).toHaveAttribute("href", "/");
    const menu = await openMenu(user);
    expect(within(menu).getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Classrooms" })).not.toBeInTheDocument();
  });

  it("gives a signed-in student dashboard and practice links even on marketing pages", async () => {
    await signedIn();
    expect(screen.getByRole("link", { name: "ChemClicks" })).toHaveAttribute("href", "/student");
    expect(screen.getByRole("link", { name: "My assignments" })).toHaveAttribute("href", "/student");
    expect(screen.getByRole("link", { name: "Practice labs" })).toHaveAttribute("href", "/student/labs");
    expect(screen.queryByRole("link", { name: "Models" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Classrooms" })).not.toBeInTheDocument();
    expect(document.querySelector('a[href="#"]')).not.toBeInTheDocument();
  });

  it("gives a signed-in teacher a genuine classroom destination on public pages", async () => {
    await signedIn("teacher");
    expect(screen.getByRole("link", { name: "ChemClicks" })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("link", { name: "Classrooms" })).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("link", { name: "Labs" })).toHaveAttribute("href", "/admin/labs");
    expect(screen.queryByRole("link", { name: "Bohr Models" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Practice labs" })).not.toBeInTheDocument();
    expect(document.querySelector('a[href="#"]')).not.toBeInTheDocument();
  });

  it.each([
    ["/student/assignments/assignment-1", "My assignments"],
    ["/student/quizzes/ionic", "My assignments"],
    ["/student/labs/measurement", "Practice labs"],
  ])("marks the correct student destination active for %s", async (path, label) => {
    mocks.pathname = path;
    await signedIn();
    expect(screen.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    const other = label === "My assignments" ? "Practice labs" : "My assignments";
    expect(screen.getByRole("link", { name: other })).not.toHaveAttribute("aria-current");
  });

  it("marks nested teacher reports as part of Classrooms", async () => {
    mocks.pathname = "/admin/classes/class-1/attempts";
    await signedIn("teacher");
    expect(screen.getByRole("link", { name: "Classrooms" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Labs" })).not.toHaveAttribute("aria-current");
  });

  it.each(["/admin/labs", "/admin/labs/measurement"])("marks Labs, not Classrooms, active for a teacher on %s", async (path) => {
    mocks.pathname = path;
    await signedIn("teacher");
    expect(screen.getByRole("link", { name: "Labs" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Classrooms" })).not.toHaveAttribute("aria-current");
  });

  it("does not offer the teacher Labs tab to students", async () => {
    await signedIn();
    expect(screen.queryByRole("link", { name: "Labs" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Practice labs" })).toHaveAttribute("href", "/student/labs");
  });

  it("announces mobile expansion and closes the menu on link navigation", async () => {
    const user = userEvent.setup();
    await signedIn();
    const menu = await openMenu(user);
    expect(within(menu).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    await user.click(within(menu).getByRole("link", { name: "Practice labs" }));
    expect(screen.getByRole("button", { name: "Toggle menu" })).toHaveAttribute("aria-expanded", "false");
    expect(menu).not.toBeVisible();
  });

  it("closes the menu when navigation occurs outside its links", async () => {
    const user = userEvent.setup();
    const view = await signedIn();
    await openMenu(user);
    mocks.pathname = "/student/labs";
    view.rerender(<Navbar />);
    expect(screen.getByRole("button", { name: "Toggle menu" })).toHaveAttribute("aria-expanded", "false");
    mocks.pathname = "/";
    view.rerender(<Navbar />);
    expect(screen.getByRole("button", { name: "Toggle menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("retains reduced-motion-aware homepage anchor scrolling and closes the menu", async () => {
    const user = userEvent.setup();
    render(<><Navbar /><section id="features">Features content</section></>);
    await screen.findByRole("link", { name: "Sign in" });
    const target = document.getElementById("features")!;
    vi.spyOn(target, "getBoundingClientRect").mockReturnValue({ top: 500 } as DOMRect);
    const menu = await openMenu(user);
    await user.click(within(menu).getByRole("link", { name: "Features" }));
    expect(window.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    expect(window.scrollTo).toHaveBeenCalledWith(0, 500);
    expect(menu).not.toBeVisible();
  });

  it("refreshes verified identity on Auth changes and unsubscribes on unmount", async () => {
    const view = await signedIn();
    mocks.identity.mockResolvedValue({ status: "signed-in", role: "teacher" });
    const callback = mocks.onAuthStateChange.mock.calls[0][0];
    await act(async () => { callback("SIGNED_IN", {}); });
    expect(await screen.findByRole("link", { name: "Classrooms" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My assignments" })).not.toBeInTheDocument();
    view.unmount();
    expect(mocks.unsubscribe).toHaveBeenCalled();
  });

  it("ignores outdated role results when an account changes during a lookup", async () => {
    let resolveOld!: (identity: NavigationIdentity) => void;
    mocks.identity.mockReturnValueOnce(new Promise<NavigationIdentity>((resolve) => { resolveOld = resolve; }));
    render(<Navbar />);
    mocks.identity.mockResolvedValue({ status: "signed-in", role: "student" });
    const callback = mocks.onAuthStateChange.mock.calls[0][0];
    await act(async () => { callback("SIGNED_IN", {}); });
    await screen.findByRole("link", { name: "My assignments" });
    await act(async () => { resolveOld({ status: "signed-in", role: "teacher" }); });
    expect(screen.queryByRole("link", { name: "Classrooms" })).not.toBeInTheDocument();
  });

  it("preserves sign out without dashboard links for an ineligible student classroom", async () => {
    const user = userEvent.setup();
    mocks.identity.mockResolvedValue({
      status: "signed-in", role: null, message: "Your classroom is inactive or unavailable. Please contact your teacher.",
    });
    render(<Navbar />);
    expect(await screen.findByRole("button", { name: "Sign out" })).toBeEnabled();
    expect(screen.getByRole("link", { name: "ChemClicks" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: "My assignments" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Classrooms" })).not.toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Your classroom is inactive or unavailable");
    const menu = await openMenu(user);
    expect(within(menu).getByRole("button", { name: "Sign out" })).toBeEnabled();
    expect(within(menu).queryByRole("link", { name: "Practice labs" })).not.toBeInTheDocument();
  });

  it("shows an account-check failure without fabricating a dashboard or hiding sign out", async () => {
    mocks.identity.mockRejectedValue(new Error("private error"));
    render(<Navbar />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Account navigation is unavailable");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
    expect(screen.queryByRole("link", { name: "My assignments" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Classrooms" })).not.toBeInTheDocument();
  });
});

describe("shared-device sign out", () => {
  it("preserves pending and retry controls when SIGNED_OUT arrives before confirmation", async () => {
    const user = userEvent.setup();
    await signedIn();
    const confirmation = deferred<NavigationIdentity>();
    mocks.identity.mockReturnValueOnce(confirmation.promise).mockResolvedValue({ status: "signed-out" });
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    const callback = mocks.onAuthStateChange.mock.calls[0][0];
    await act(async () => { callback("SIGNED_OUT", null); });
    expect(screen.getByRole("button", { name: "Signing out..." })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();

    await act(async () => { confirmation.resolve({ status: "error" }); });
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("We could not confirm sign out");
    expect(mocks.replace).not.toHaveBeenCalled();
    await act(async () => { callback("SIGNED_OUT", null); });
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
    const menu = await openMenu(user);
    expect(within(menu).getByRole("button", { name: "Sign out" })).toBeEnabled();
    await user.click(within(menu).getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(mocks.replace).toHaveBeenCalledTimes(1);
  });

  it.each(["signed-out", "error"] as const)("ignores an outdated %s confirmation after a newer login", async (status) => {
    const user = userEvent.setup();
    await signedIn();
    const confirmation = deferred<NavigationIdentity>();
    mocks.identity.mockReturnValueOnce(confirmation.promise).mockResolvedValue({ status: "signed-in", role: "teacher" });
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    const callback = mocks.onAuthStateChange.mock.calls[0][0];
    await act(async () => { callback("SIGNED_IN", { user: { id: "new-teacher" } }); });
    await screen.findByRole("link", { name: "Classrooms" });
    await act(async () => { confirmation.resolve({ status }); });
    expect(screen.getByRole("link", { name: "Classrooms" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("abandons an outdated sign-out request before starting confirmation for a newer login", async () => {
    const user = userEvent.setup();
    await signedIn();
    const request = deferred<{ error: null }>();
    mocks.signOut.mockReturnValueOnce(request.promise);
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    mocks.identity.mockResolvedValue({ status: "signed-in", role: "teacher" });
    const callback = mocks.onAuthStateChange.mock.calls[0][0];
    await act(async () => { callback("SIGNED_IN", { user: { id: "new-teacher" } }); });
    await screen.findByRole("link", { name: "Classrooms" });
    await act(async () => { request.resolve({ error: null }); });
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it.each(["returned error", "exception", "local session remains", "server session remains", "server check fails"])("shows a retryable failure when %s", async (failure) => {
    const user = userEvent.setup();
    await signedIn();
    if (failure === "returned error") mocks.signOut.mockResolvedValue({ error: { message: "private error" } });
    else if (failure === "exception") mocks.signOut.mockRejectedValue(new Error("private error"));
    else if (failure === "local session remains") mocks.getSession.mockResolvedValue({ data: { session: {} }, error: null });
    else if (failure === "server check fails") mocks.identity.mockResolvedValue({ status: "error" });
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We could not confirm sign out");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("disables sign out while pending and recovers after a failed request", async () => {
    const user = userEvent.setup();
    await signedIn();
    let rejectSignOut!: (error: Error) => void;
    mocks.signOut.mockReturnValue(new Promise((_resolve, reject) => { rejectSignOut = reject; }));
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByRole("button", { name: "Signing out..." })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Signing out..." }));
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    await act(async () => { rejectSignOut(new Error("network unavailable")); });
    expect(await screen.findByRole("button", { name: "Sign out" })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Please try again");
  });

  it("returns to role selection only after both client and server confirm sign out", async () => {
    const user = userEvent.setup();
    await signedIn();
    mocks.identity.mockResolvedValue({ status: "signed-out" });
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(mocks.getSession).toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith("/login");
    expect(mocks.refresh).toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
