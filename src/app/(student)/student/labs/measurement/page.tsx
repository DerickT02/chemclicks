import { redirect } from "next/navigation";

// Activities must be opened through a class assignment with server access checks.
export default function MeasurementLabPage() {
  redirect("/student");
}
