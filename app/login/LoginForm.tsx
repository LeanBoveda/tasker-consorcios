"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const submitting = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Usuario o contraseña incorrectos");
        submitting.current = false;
        setLoading(false);
        return;
      }
      router.replace("/");
    } catch {
      setError("No se pudo conectar. Intentá nuevamente.");
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit} aria-busy={loading}>
      <label>Usuario<input name="username" autoComplete="username" required autoFocus disabled={loading} placeholder="Tu usuario" /></label>
      <label>Contraseña<input name="password" type="password" autoComplete="current-password" required disabled={loading} placeholder="Tu contraseña" /></label>
      {error && <p className="login-error">{error}</p>}
      <button className="login-button" type="submit" disabled={loading}>{loading ? "Ingresando…" : "Ingresar"}</button>
    </form>
  );
}
