"use server";

import { login } from "@manhaj/auth";
import { redirect } from "next/navigation";

export async function loginAction(formData: FormData) {
  const password = (formData.get("password") as string | null) ?? "";
  const role = await login(password.trim());
  if (!role) redirect("/login?error=1");
  redirect(`/${role}`);
}
