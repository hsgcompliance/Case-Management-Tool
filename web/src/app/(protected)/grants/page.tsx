import { redirect } from "next/navigation";

// Deprecated: grant management moved to Budget + Programs.
export default function Page() {
  redirect("/budget");
}
