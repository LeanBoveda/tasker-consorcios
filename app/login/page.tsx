import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import { getCurrentIdentity } from "@/lib/current-user";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentIdentity()) redirect("/");
  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="login-brand"><span className="brand-mark">T</span><strong>Tasker</strong></div>
        <div className="login-copy">
          <span className="modal-kicker">GESTIÓN DIARIA</span>
          <h1>Todo el equipo,<br />en un mismo lugar.</h1>
          <p>Ingresá con el usuario y la contraseña que figuran en el Excel de la administración.</p>
        </div>
        <LoginForm />
        <small className="login-help">Si no recordás tus datos, consultá el archivo compartido del equipo.</small>
      </section>
      <aside className="login-visual" aria-hidden="true">
        <div className="login-board">
          <div><span /><article><i>ALTA</i><b>Revisar presupuesto del ascensor</b><small>Av. Cabildo 1842</small></article><article><i>MEDIA</i><b>Enviar liquidación</b><small>Amenábar 936</small></article></div>
          <div><span /><article><i>ALTA</i><b>Coordinar reparación</b><small>Aráoz 1240</small></article></div>
          <div><span /><article><i>BAJA</i><b>Control de matafuegos</b><small>Amenábar 936</small></article></div>
        </div>
        <p>Privadas por defecto.<br /><strong>Compartidas cuando las asignás.</strong></p>
      </aside>
    </main>
  );
}
