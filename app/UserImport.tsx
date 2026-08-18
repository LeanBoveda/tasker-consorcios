"use client";

import { useState } from "react";
import readXlsxFile from "read-excel-file/browser";
import type { WorkspaceData } from "@/db/task-store";

type ImportedUser = { username: string; name: string; password: string; role: string };

function cleanHeader(value: unknown) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s_-]+/g, "");
}

function csvRows(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  const delimiter = (lines[0]?.match(/;/g)?.length ?? 0) >= (lines[0]?.match(/,/g)?.length ?? 0) ? ";" : ",";
  return lines.map((line) => {
    const cells: string[] = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < line.length; index++) {
      const character = line[index];
      if (character === '"') {
        if (quoted && line[index + 1] === '"') { cell += '"'; index++; }
        else quoted = !quoted;
      } else if (character === delimiter && !quoted) {
        cells.push(cell.trim()); cell = "";
      } else cell += character;
    }
    cells.push(cell.trim());
    return cells;
  });
}

function usersFromRows(rows: unknown[][]): ImportedUser[] {
  if (rows.length < 2) throw new Error("El archivo no tiene filas de usuarios");
  const headers = rows[0].map(cleanHeader);
  const column = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const usernameIndex = column("usuario", "user", "username");
  const nameIndex = column("nombre", "nombrecompleto", "name");
  const passwordIndex = column("contrasena", "clave", "password");
  const roleIndex = column("rol", "role", "tipo");
  if ([usernameIndex, nameIndex, passwordIndex].some((index) => index < 0)) {
    throw new Error('Las columnas deben llamarse "usuario", "nombre", "contraseña" y "rol"');
  }
  return rows.slice(1).filter((row) => row.some((cell) => String(cell ?? "").trim())).map((row) => ({
    username: String(row[usernameIndex] ?? "").trim(),
    name: String(row[nameIndex] ?? "").trim(),
    password: String(row[passwordIndex] ?? ""),
    role: roleIndex >= 0 ? String(row[roleIndex] ?? "usuario").trim() : "usuario",
  }));
}

export default function UserImport({ onClose, onImported }: {
  onClose: () => void;
  onImported: (data: WorkspaceData) => void;
}) {
  const [users, setUsers] = useState<ImportedUser[]>([]);
  const [filename, setFilename] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function chooseFile(file?: File) {
    if (!file) return;
    setError("");
    setFilename(file.name);
    try {
      const rows = file.name.toLowerCase().endsWith(".csv")
        ? csvRows(await file.text())
        : await readXlsxFile(file);
      const parsed = usersFromRows(rows as unknown[][]);
      if (!parsed.length) throw new Error("No se encontraron usuarios");
      setUsers(parsed);
    } catch (reason) {
      setUsers([]);
      setError(reason instanceof Error ? reason.message : "No se pudo leer el archivo");
    }
  }

  async function importFile() {
    setLoading(true);
    setError("");
    const response = await fetch("/api/users/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ users }),
    });
    const payload = await response.json() as WorkspaceData & { error?: string };
    setLoading(false);
    if (!response.ok) {
      setError(payload.error ?? "No se pudieron importar los usuarios");
      return;
    }
    onImported(payload);
    onClose();
  }

  function downloadTemplate() {
    const content = "\uFEFFusuario;nombre;contraseña;rol\nlaura;Laura Martín;laura123;usuario\njuan;Juan Pérez;juan123;usuario";
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "plantilla-usuarios-tasker.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="modal-backdrop elevated" onMouseDown={onClose}>
      <section className="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="import-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div><span className="modal-kicker">USUARIOS</span><h2 id="import-title">Importar desde Excel</h2></div>
          <button className="close-button" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <p className="import-intro">Elegí un archivo <strong>.xlsx</strong> o <strong>.csv</strong> con las columnas usuario, nombre, contraseña y rol.</p>
        <div className="import-actions">
          <label className="file-button">Elegir archivo<input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => chooseFile(event.target.files?.[0])} /></label>
          <button className="template-button" onClick={downloadTemplate}>Descargar plantilla</button>
        </div>
        {filename && <p className="filename">▦ {filename}</p>}
        {error && <p className="import-error">{error}</p>}
        {users.length > 0 && (
          <div className="import-preview">
            <div className="import-preview-head"><strong>Vista previa</strong><span>{users.length} usuarios</span></div>
            <div className="import-table">
              <div className="import-row heading"><span>Usuario</span><span>Nombre</span><span>Contraseña</span><span>Rol</span></div>
              {users.map((user, index) => <div className="import-row" key={`${user.username}-${index}`}><span>{user.username}</span><span>{user.name}</span><span>{user.password}</span><span>{user.role || "usuario"}</span></div>)}
            </div>
          </div>
        )}
        <div className="modal-actions"><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!users.length || loading} onClick={importFile}>{loading ? "Importando…" : "Importar usuarios"}</button></div>
      </section>
    </div>
  );
}
