"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setError("");
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
    });
    const payload = await response.json() as { error?: string };
    setLoading(false);
    if (!response.ok) {
      setError(payload.error ?? "Usuario o contraseña incorrectos");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label>Usuario<input name="username" autoComplete="username" required autoFocus placeholder="Tu usuario" /></label>
      <label>Contraseña<input name="password" type="password" autoComplete="current-password" required placeholder="Tu contraseña" /></label>
      {error && <p className="login-error">{error}</p>}
      <button className="login-button" disabled={loading}>{loading ? "Ingresando…" : "Ingresar"}</button>
    </form>
  );
}
